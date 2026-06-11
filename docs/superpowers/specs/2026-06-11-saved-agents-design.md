# Saved Agents — 会话转可复用 Agent（Phase 1 MVP）

> 状态：设计稿（待评审）
> 作者：基于与用户的头脑风暴
> 日期：2026-06-11
> 借鉴对象：CREAO 的 `persist-agentapp` 机制（会话 → 带结构化表单输入的可复用 agent）

## 1. 背景与目标

OpenYak 是 local-first 的 AI Agent 桌面应用，已具备完整的 agent 主循环、tool 体系、session 持久化、scheduler 定时任务、MCP connectors 与 workspace memory。

CREAO 的招牌能力是把「一次成功的会话」一键沉淀为「带结构化表单输入、可反复运行、可跨运行对比指标」的可复用 agent。这是 OpenYak 当前完全缺失的一块，而它依赖的运行底座（沙箱、集成、定时、记忆）OpenYak 基本都已具备。

**本 spec 的目标**：在不引入 S3/FUSE/独立 Linux 沙箱的前提下（与 local-first 定位冲突），最大化复用现有底座，落地「会话 → 可复用 Agent」的 **Phase 1 MVP**。

### 1.1 Phase 1 范围（本 spec）

- 把当前会话沉淀为一个 Saved Agent（带 SKILL.md + 结构化表单 schema）。
- 在独立的前端入口里列出 Saved Agents、填写表单、运行（headless 会话）。
- 沉淀机制采用 **builtin 工具 `persist_agent`**（非 stdout 标记）。

### 1.2 非目标（留给后续 Phase）

- Phase 2：`record_run` 指标采集 + 运行历史 + 跨运行聚合（avg/sum/count + group_by）。
- Phase 3：定时重跑（接 scheduler）、引用文件打包、dashboard/applet 集成。
- 不做团队共享 / 多用户协作（OpenYak 是单机优先）。
- 不做云端隔离沙箱（复用现有 `bash`/`code_execute`）。

## 2. 关键决策（已与用户确认）

| 决策点 | 选择 | 理由 |
|---|---|---|
| 触发/注册机制 | builtin 工具 `persist_agent` | 符合 OpenYak 工具化架构、可控权限、结构化参数；比 stdout 标记解析更稳健 |
| 前端入口 | 新建独立 tab / 侧栏区（不复用 Workflow tab） | 与 WIP 的 applet/workflow 解耦，避免互相阻塞 |
| 本期范围 | Phase 1 MVP | 先打通「沉淀 + 表单 + 运行」最小闭环 |
| 存储 | DB 为真相 + 磁盘 bundle 导出 | bundle 落独立目录 `.openyak/saved-agents/<id>/` 便于 git/移植；**不**被现有加载器自动加载（见 §4.1） |

## 3. CREAO → OpenYak 概念映射

| CREAO | OpenYak Phase 1 落地 |
|---|---|
| `[APP_CREATED]` stdout 标记 | `persist_agent` builtin 工具 |
| `skillContent`（SKILL.md） | DB `skill_content` + 导出到 `{ws}/.openyak/saved-agents/<id>/SKILL.md`（仅导出，不被 registry 自动加载） |
| `configContent.form` | `manifest.yaml` 的 `form` + DB `form_schema(JSON)` |
| `configContent.memory` | DB `memory_schema(JSON)`（Phase 1 仅存储，不聚合） |
| reference files（S3 FUSE） | 复制进 `{ws}/.openyak/saved-agents/<id>/files/`（Phase 3 真正打包，Phase 1 仅预留字段） |
| `dashboardTemplate` | Phase 3，复用 artifact/applet |
| 定时重跑 | Phase 3，复用 `scheduler`/`automations` |
| 隔离沙箱 | 复用现有 `bash`/`code_execute` |

## 4. 架构与组件

### 4.1 数据模型

模块边界：只负责 Saved Agent 的存储与 bundle 落盘，向上通过 storage 类暴露接口；不直接耦合 session/agent 主循环。

**建表机制（评审修正）**：项目 DB schema 由启动时 `Base.metadata.create_all` + `_add_missing_columns` 轻量自动迁移完成（`backend/app/main.py:112-115`）；`backend/alembic/versions/` 为空，**Alembic 未启用**。`create_all` 只建在调用前已注册进 `Base.metadata` 的模型。因此：

- **方案（采用）**：把 ORM 模型放 `backend/app/models/saved_agent.py` 并加入 `models/__init__.py` 聚合导入——这样随其他模型一起注册，无需额外处理。
- 业务逻辑（storage、bundle 落盘）放 `backend/app/saved_agent/`，只 import 模型。
- 若坚持模型放 `app/saved_agent/`，则**必须**仿 `main.py:110` 的 `_ws_memory_models` 在 `create_all` 之前显式 import，否则全新 DB 上该表**静默不创建**（`_add_missing_columns` 只补已存在表的列，救不了未注册的表）。

**`SavedAgent` 表**

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | str (ULID) | 主键 |
| `workspace_path` | str | 所属工作区目录 |
| `identifier` | str | 稳定 kebab-case ID，`(workspace_path, identifier)` 唯一 |
| `title` | str | 展示名 |
| `description` | str | 一句话描述 |
| `version` | str | 语义版本，默认 `1.0.0` |
| `skill_content` | text | SKILL.md 正文（Goal/Inputs/Procedure/Output） |
| `form_schema` | JSON | 表单字段定义（见 4.4） |
| `memory_schema` | JSON | `{persist_fields, aggregations}`（Phase 1 仅存储） |
| `source_session_id` | str \| null | 沉淀来源会话 |
| `time_created` / `time_updated` | datetime | 时间戳（复用 TimestampMixin） |

**磁盘 bundle**：`{workspace}/.openyak/saved-agents/<identifier>/`
- `SKILL.md` — 即 `skill_content`，带 YAML frontmatter（`name`/`description`）。
- `manifest.yaml` — `name/description/version/form/memory`（人可读、可 git diff）。
- `files/` — Phase 1 预留空目录（Phase 3 才复制引用文件）。

> **重要（评审修正）**：bundle 仅作**导出产物**，DB 是唯一运行时真相来源。
> - 经核查：`SkillRegistry` 只递归扫 `**/skills/**/SKILL.md`（`backend/app/skill/registry.py:54-88`），`AgentRegistry` 只非递归扫 `.openyak/agents/*.md`（`backend/app/agent/agent.py:208`）。
> - 因此故意把 bundle 放在**独立目录 `.openyak/saved-agents/`**（不是 `.openyak/agents/` 也不是 `.openyak/skills/`）：既不会污染现有 agent/skill 列表，也**不会**被现有加载器自动加载——这正是我们想要的（每个 saved agent 的运行版本不应混进全局 skill/agent 列表）。
> - 早期设计稿曾声称「可被现有加载器发现」，**该说法为假，已删除**。Saved Agent 的加载完全走自己的 DB + API，不依赖 registry 扫描。

### 4.2 `persist_agent` builtin 工具（`backend/app/tool/builtin/persist_agent.py`）

参数 schema 借鉴 `ArtifactTool`（同样有 `identifier`、同样在 `main.py:_register_builtin_tools` 注册），但 **DB 写入不能照搬 `ArtifactTool`**（评审修正）。

**关键风险点 — 工具如何写 DB**：
- `ToolContext.workspace` 公有可用（`backend/app/tool/context.py:29`）。
- 但 `ToolContext` **没有公有的 DB/session_factory 字段**。`ArtifactTool` 根本不碰 DB——它只写内存 `ctx._job.artifact_cache`，真正落盘是在工具之外的 processor 副作用（`_apply_tool_side_effects`）里完成的，所以它不是合适的模板。
- **正确模板是 `TaskTool` / `TodoTool`**：通过 processor 运行时注入的私有契约 `app_state = getattr(ctx, "_app_state", None)` → `session_factory = app_state["session_factory"]`（见 `backend/app/tool/builtin/task.py:97-102`）拿到 DB session 工厂。
- 这是**未文档化的私有契约**，仅当工具跑在正常 session processor 主循环里才会被注入。本 spec 的 persist agent 经 `POST /prompt` 触发，恰好满足此前提。`persist_agent` 工具须显式检查 `_app_state` 是否存在，缺失时返回明确错误（仿 `task.py:99-100`）。

**参数 schema**

```json
{
  "type": "object",
  "properties": {
    "identifier":    {"type": "string", "description": "稳定 kebab-case ID，同工作区唯一"},
    "title":         {"type": "string"},
    "description":   {"type": "string"},
    "skill_content": {"type": "string", "description": "SKILL.md 正文：Goal/Inputs/Procedure/Output"},
    "form_schema":   {"type": "array", "items": {"$ref": "#/$defs/formField"}},
    "memory_schema": {"type": "object", "description": "persist_fields + aggregations（Phase 1 仅存储）"},
    "reference_files": {"type": "array", "items": {"type": "string"}, "description": "工作区相对路径，Phase 1 仅记录不复制"}
  },
  "required": ["identifier", "title", "skill_content", "form_schema"]
}
```

**行为**：
1. 校验 `form_schema`（字段类型合法、`select`/`multiselect` 必带 `options`）。
2. upsert `SavedAgent` 行（按 `(workspace_path, identifier)`）。
3. 写 bundle 目录（SKILL.md + manifest.yaml）。
4. 返回 `ToolResult`：成功信息 + 该 agent 的 id / 表单字段摘要。

**权限**：归类为 `write` 类权限（沿用 build agent 的 `ask` 策略，或在 persist agent 内 `allow`）。

### 4.3 `persist` agent（system prompt 改编自 CREAO skill）

- 在 `BUILTIN_AGENTS` 新增一个 `persist` agent（`mode="hidden"` 或 `"primary"` 视触发方式）。
- `tools=["persist_agent"]`（外加只读工具便于它读会话上下文）。
- system prompt：需新增 `backend/app/agent/prompts/persist.txt`（否则 `_load_prompt("persist")` 返回空串，见 `agent.py:24`），或在 `AgentInfo(system_prompt=...)` 内联。改编自用户提供的 CREAO `persist-agentapp` SKILL.md，核心要点：
  - 不复述会话，直接产出 `persist_agent` 调用。
  - `skill_content` 聚焦 Goal/Inputs/Procedure/Output，≤500 行，不写 CSS/模板/算法细节。
  - 表单字段只提升「跨运行会变化且可校验」的输入。
  - 必须给出 `memory_schema`（即使 Phase 1 不聚合，也为 Phase 2 留好结构）。

**触发方式（Phase 1）**：前端「转为可复用 Agent」按钮 → 在当前会话里发起一轮，指定 `agent="persist"`，prompt 为固定指令「把本会话沉淀为可复用 agent」。复用现有 `POST /prompt` 流程，无需新执行路径。

### 4.4 表单字段类型（form_schema）

对齐 CREAO 字段类型，便于前端渲染：

| `type` | 渲染 | 需 `options` | 值类型 |
|---|---|---|---|
| `string` | 单行文本 | 否 | string |
| `textarea` | 多行文本 | 否 | string |
| `number` / `integer` | 数字 | 否 | number |
| `boolean` | 开关 | 否 | boolean |
| `select` | 单选下拉 | 是 | string |
| `multiselect` | 多选 | 是 | string[] |
| `file` / `files` | 文件上传 | 否 | (Phase 1 暂不支持，预留) |

字段属性：`id`（机器键）、`name`（标签）、`type`、`required`、`description`、`default_value`、`example`、`options[{label,value}]`。

### 4.5 运行链路（填表单 → headless 会话）

**`POST /saved-agents/{id}/run`**，body 为 `{inputs: {field_id: value}}`：

1. 加载 SavedAgent，按 `form_schema` 校验 `inputs`（必填/类型/options）。
2. 拼 prompt：
   - 注入结构化输入（`## Inputs\n- field: value` 列表）。
   - 指令「严格遵循以下 SKILL.md 流程」+ `skill_content`。
3. 复用 scheduler 的执行模板 `_run_session`（`backend/app/scheduler/executor.py:312-351`）起 headless 会话——**注意 `run_generation` 真实签名远不止 `PromptRequest`**（评审修正）：

```python
# 真实签名（backend/app/session/processor.py:333-343）
await run_generation(
    job,                                  # 需自建 GenerationJob(stream_id, session_id)
    PromptRequest(session_id=..., text=..., agent="build",
                  model=..., workspace=savedagent.workspace_path),
    session_factory=...,                  # 以下 4 个 registry 从 app_state 取
    provider_registry=app_state.provider_registry,
    agent_registry=app_state.agent_registry,
    tool_registry=app_state.tool_registry,
    index_manager=get_index_manager(),
)
```

   - `/run` 端点须能拿到 `app_state`（含 4 个 registry + session_factory）、自建 `GenerationJob`，如需前端流式则在 `stream_manager` 注册（同 scheduler）。
   - `agent`：默认 `build`（Phase 1），workspace = SavedAgent.workspace_path；新会话不存在时 `SessionPrompt` 会自动建（`prompt.py:266-271`）。
   - 标题 `[Agent] <title> — <time>`，用 `asyncio.wait_for(..., timeout)` 包超时（默认 1800s）。
4. 返回 `session_id`，前端可跳到该会话查看流式结果（复用现有会话视图）。

> Phase 1 不解析指标、不写 `AgentRun`（留到 Phase 2）。运行结果就是一个普通会话。

### 4.6 API（新增 `backend/app/api/saved_agents.py`，在 `router.py` 注册）

| 端点 | 用途 |
|---|---|
| `GET /saved-agents?workspace=` | 列出某工作区的 Saved Agents |
| `GET /saved-agents/{id}` | 详情（含 form_schema） |
| `PUT /saved-agents/{id}` | 编辑元数据/表单（手动微调） |
| `DELETE /saved-agents/{id}` | 删除（同时删 bundle 目录） |
| `POST /saved-agents/{id}/run` | 按表单输入运行，返回 session_id |

> 注册模式（`backend/app/api/router.py:7-59`）：`from app.api import X as X_api` + `api_router.include_router(X_api.router, tags=[...])`。照此新增 saved_agents 即可。（注：`api/applet*.py` 目前在 `api/` 下尚不存在，无现成范例可抄，但 `sessions`/`automations` 等均为同一模式。）

### 4.7 前端（新建独立入口）

- 新 tab / 侧栏区「Agents」：
  - 列表：卡片展示 title/description/最近运行。
  - 详情：按 `form_schema` 渲染表单（可复用 `schema-renderer` 的字段渲染思路，或写一个轻量 `AgentRunForm`）→ 「运行」按钮 → 调 `/run` → 跳转到生成的会话。
- 聊天工具栏新增「转为可复用 Agent」按钮：以 `agent="persist"` 在当前会话发起沉淀轮，完成后提示「已保存为 Agent」并可跳到 Agents 列表。

## 5. 数据流

```
[沉淀]
用户点「转为可复用 Agent」
  → POST /prompt (agent=persist, 当前 session)
  → persist agent 读会话上下文，调用 persist_agent 工具
  → 写 SavedAgent 行 + bundle 目录
  → 前端提示已保存

[运行]
用户在 Agents 列表选 agent → 填表单 → 运行
  → POST /saved-agents/{id}/run {inputs}
  → 校验 inputs，拼 prompt(注入 inputs + skill_content)
  → run_generation 起 headless 会话
  → 返回 session_id → 前端跳转会话视图看流式结果
```

## 6. 错误处理

- `persist_agent` 工具：identifier 非法/重复时 upsert 覆盖（带 version bump 提示）；form_schema 校验失败返回明确错误，agent 可重试。
- `/run`：inputs 校验失败返回 422 + 字段级错误；workspace 不存在返回 400。
- bundle 落盘失败：DB 写入成功仍返回成功，bundle 写入失败记 warning（DB 为真相来源），与 SkillRegistry 落盘策略一致。
- headless 会话超时/异常：复用 scheduler 的 try/except + 超时（默认 1800s）。

## 7. 测试策略

- 单元测试：
  - `persist_agent` 工具：合法/非法 form_schema、upsert 覆盖、bundle 落盘内容。
  - form_schema 校验器：各字段类型、required、select 必带 options。
  - `/run` 的 prompt 拼装：inputs 正确注入。
- 集成测试：
  - 端到端：mock 一个会话 → persist agent 调工具 → DB + bundle 生成 → GET /saved-agents 可见。
  - `/run` → 起会话 → 返回 session_id（可 mock run_generation）。
- 不为 Phase 2/3 的指标聚合、定时、文件打包写测试（超出本期范围）。

## 8. 复用清单（不重复造）

| 能力 | 复用的现有模块 |
|---|---|
| headless 执行 | `app/scheduler/executor.py:_run_session`（完整调用模板，非裸 `run_generation`） |
| 工具参数范式 | `app/tool/builtin/artifact.py`（仅 schema 形态）；**DB 写入照 `app/tool/builtin/task.py` 的 `_app_state` 模式** |
| 工具注册 | `app/main.py:_register_builtin_tools` |
| agent 注册 | `app/agent/agent.py:BUILTIN_AGENTS`（+ 新增 `prompts/persist.txt`） |
| 沙箱 | 现有 `bash` / `code_execute` 工具 |
| 集成 | 现有 MCP connectors（saved agent 可在 tools 列表引用） |

> 注：bundle 的 SKILL.md **不**复用 `SkillRegistry` 发现机制（见 §4.1，刻意不被自动加载）。

## 9. 决策记录（已确认）

1. **`persist` agent 的 `mode` = `hidden`**（仅由前端「转为可复用 Agent」按钮程序触发，不出现在用户可选 agent 列表）。
2. **`/run` 固定用 `build` agent 执行**（Phase 1）；SavedAgent 自带 `agent` + `tools` 白名单留到 Phase 2 再放开。
3. ~~bundle 目录冲突~~ **已核查并解决**：bundle 放独立目录 `.openyak/saved-agents/<id>/`，`AgentRegistry` 扫 `.openyak/agents/*.md`（非递归）、`SkillRegistry` 扫 `**/skills/**/SKILL.md`，二者都不会触及——既不污染也不自动加载（见 §4.1）。
