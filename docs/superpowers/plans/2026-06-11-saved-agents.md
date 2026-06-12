# Saved Agents（会话转可复用 Agent）Implementation Plan — Phase 1 MVP

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户把一次成功的会话沉淀成「带结构化表单输入、可反复运行」的 Saved Agent，并在独立入口填表单运行。

**Architecture:** 借鉴 CREAO 的 `persist-agentapp`，但全部复用 Talos 现有底座：新增 `persist_agent` builtin 工具（仿 `task.py` 用 `ctx._app_state["session_factory"]` 写 DB）把会话沉淀为 `SavedAgent` 行 + 磁盘 bundle；新增 hidden `persist` agent 触发沉淀；新增 `/saved-agents` API，`/run` 端点仿 `scheduler/executor.py:_run_session` 起 headless 会话执行。DB 用 `create_all` 自动建表，bundle 落 `.openyak/saved-agents/<id>/` 仅作导出（不被 registry 自动加载）。

**Tech Stack:** Python 3.12 / FastAPI / SQLAlchemy(async) / SQLite；前端 Next.js 15 / React / TanStack Query / Zustand / Tailwind。

**Spec:** `docs/superpowers/specs/2026-06-11-saved-agents-design.md`

**Phase 1 范围**：沉淀 + 表单 + 运行。**不含**：指标聚合/运行历史（Phase 2）、定时/文件打包/dashboard（Phase 3）。因此 Phase 1 只建 `SavedAgent` 表，不建 `AgentRun` 表。

---

## 约定

- 后端工作目录：`backend/`。测试命令统一在 `backend/` 下运行：`cd backend && python -m pytest ...`。
- 提交粒度：每个 Task 末尾一次 commit。提交信息用英文 `feat:/test:` 前缀。
- 遵循现有风格：`from __future__ import annotations`、`Mapped[...]` ORM、`ToolDefinition` 工具基类。

---

## File Structure

| 文件 | 职责 | 动作 |
|---|---|---|
| `backend/app/models/saved_agent.py` | `SavedAgent` ORM 模型 | Create |
| `backend/app/models/__init__.py` | 注册模型到 `Base.metadata` | Modify |
| `backend/app/saved_agent/__init__.py` | 包初始化 | Create |
| `backend/app/saved_agent/form_schema.py` | 表单字段校验 + 输入校验（纯函数，无 IO） | Create |
| `backend/app/saved_agent/storage.py` | SavedAgent CRUD + bundle 落盘 | Create |
| `backend/app/tool/builtin/persist_agent.py` | `persist_agent` builtin 工具 | Create |
| `backend/app/main.py` | 注册 persist_agent 工具 | Modify |
| `backend/app/agent/agent.py` | 新增 hidden `persist` agent | Modify |
| `backend/app/agent/prompts/persist.txt` | persist agent system prompt | Create |
| `backend/app/schemas/saved_agent.py` | API 请求/响应 schema | Create |
| `backend/app/api/saved_agents.py` | CRUD + `/run` 端点 | Create |
| `backend/app/api/router.py` | 挂载 saved_agents router | Modify |
| `frontend/src/types/saved-agent.ts` | 前端类型 | Create |
| `frontend/src/hooks/use-saved-agents.ts` | TanStack Query hooks | Create |
| `frontend/src/components/saved-agents/saved-agent-list.tsx` | 列表 | Create |
| `frontend/src/components/saved-agents/saved-agent-run-form.tsx` | 表单渲染 + 运行 | Create |
| `frontend/src/components/chat/chat-form.tsx` | 「转为可复用 Agent」按钮 | Modify |
| `frontend/src/lib/constants.ts` | 新增 API 端点常量 | Modify |

---

## Task 1: SavedAgent ORM 模型 + 建表

**Files:**
- Create: `backend/app/models/saved_agent.py`
- Modify: `backend/app/models/__init__.py`
- Test: `backend/tests/test_storage/test_saved_agent_model.py`

- [ ] **Step 1: 写失败测试**

```python
# backend/tests/test_storage/test_saved_agent_model.py
import pytest
from sqlalchemy import select
from app.models.saved_agent import SavedAgent


@pytest.mark.asyncio
async def test_saved_agent_insert_and_query(db):
    agent = SavedAgent(
        workspace_path="/tmp/ws",
        identifier="weather-report",
        title="Weather Report",
        description="Daily weather",
        skill_content="# Weather\n## Goal\n...",
        form_schema=[{"id": "city", "type": "string", "required": True}],
        memory_schema={"persist_fields": ["city", "temperature"], "aggregations": []},
        source_session_id="sess-1",
    )
    db.add(agent)
    await db.flush()

    row = (await db.execute(select(SavedAgent).where(SavedAgent.identifier == "weather-report"))).scalar_one()
    assert row.title == "Weather Report"
    assert row.form_schema[0]["id"] == "city"
    assert row.version == "1.0.0"
    assert row.id  # ULID auto-generated
    assert row.time_created is not None
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_storage/test_saved_agent_model.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.models.saved_agent'`

- [ ] **Step 3: 实现模型**

```python
# backend/app/models/saved_agent.py
"""SavedAgent model — a session persisted as a reusable, form-driven agent."""

from __future__ import annotations

from typing import Any

from sqlalchemy import String, UniqueConstraint
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin
from app.utils.id import generate_ulid


class SavedAgent(Base, TimestampMixin):
    __tablename__ = "saved_agent"
    __table_args__ = (
        UniqueConstraint("workspace_path", "identifier", name="uq_saved_agent_ws_identifier"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_ulid)

    workspace_path: Mapped[str] = mapped_column(String, nullable=False, index=True)
    identifier: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False, default="")
    version: Mapped[str] = mapped_column(String, nullable=False, default="1.0.0")

    skill_content: Mapped[str] = mapped_column(String, nullable=False)
    form_schema: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    memory_schema: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    source_session_id: Mapped[str | None] = mapped_column(String, nullable=True)
```

- [ ] **Step 4: 注册到 models/__init__.py**

在 `backend/app/models/__init__.py` 加入 import 与 `__all__`：

```python
from app.models.saved_agent import SavedAgent
# ... __all__ 末尾追加 "SavedAgent"
```

- [ ] **Step 5: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_storage/test_saved_agent_model.py -v`
Expected: PASS

> 注：`models/__init__.py` 会在 `main.py` 的 `create_all` 前被导入（其他 model 已走此路径），故新表会随启动自动创建，无需 Alembic。

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/saved_agent.py backend/app/models/__init__.py backend/tests/test_storage/test_saved_agent_model.py
git commit -m "feat: add SavedAgent ORM model"
```

---

## Task 2: 表单 schema 校验（纯函数）

校验两件事：(a) `form_schema` 字段定义是否合法（沉淀时用）；(b) 一组 `inputs` 是否满足 `form_schema`（运行时用）。纯函数、无 IO，便于测试。

**Files:**
- Create: `backend/app/saved_agent/__init__.py`（空文件）
- Create: `backend/app/saved_agent/form_schema.py`
- Test: `backend/tests/test_saved_agent/test_form_schema.py`

- [ ] **Step 1: 写失败测试**

```python
# backend/tests/test_saved_agent/test_form_schema.py
import pytest
from app.saved_agent.form_schema import validate_form_schema, validate_inputs

FIELD_TYPES = ["string", "textarea", "number", "integer", "boolean", "select", "multiselect"]


def test_valid_schema_passes():
    schema = [
        {"id": "city", "type": "string", "required": True},
        {"id": "depth", "type": "select", "required": True,
         "options": [{"label": "Quick", "value": "q"}, {"label": "Deep", "value": "d"}]},
    ]
    assert validate_form_schema(schema) == []


def test_select_without_options_is_error():
    errs = validate_form_schema([{"id": "depth", "type": "select", "required": True}])
    assert any("options" in e for e in errs)


def test_unknown_type_is_error():
    errs = validate_form_schema([{"id": "x", "type": "color"}])
    assert any("type" in e for e in errs)


def test_missing_id_is_error():
    errs = validate_form_schema([{"type": "string"}])
    assert any("id" in e for e in errs)


def test_duplicate_id_is_error():
    errs = validate_form_schema([{"id": "a", "type": "string"}, {"id": "a", "type": "number"}])
    assert any("duplicate" in e.lower() for e in errs)


def test_inputs_required_missing():
    schema = [{"id": "city", "type": "string", "required": True}]
    errs = validate_inputs(schema, {})
    assert any("city" in e for e in errs)


def test_inputs_type_coercion_and_check():
    schema = [{"id": "n", "type": "integer", "required": True}]
    assert validate_inputs(schema, {"n": 5}) == []
    assert any("n" in e for e in validate_inputs(schema, {"n": "abc"}))


def test_inputs_select_value_must_be_in_options():
    schema = [{"id": "d", "type": "select", "required": True,
               "options": [{"label": "Q", "value": "q"}]}]
    assert validate_inputs(schema, {"d": "q"}) == []
    assert any("d" in e for e in validate_inputs(schema, {"d": "zzz"}))
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_saved_agent/test_form_schema.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: 实现校验器**

```python
# backend/app/saved_agent/form_schema.py
"""Pure validators for Saved Agent form schemas and run inputs."""

from __future__ import annotations

from typing import Any

VALID_TYPES = {
    "string", "textarea", "number", "integer", "boolean", "select", "multiselect",
    "file", "files",  # 预留，Phase 1 不在前端渲染
}
OPTION_TYPES = {"select", "multiselect"}


def validate_form_schema(schema: Any) -> list[str]:
    """Validate a form field definition list. Returns list of error strings (empty = ok)."""
    errors: list[str] = []
    if not isinstance(schema, list):
        return ["form_schema must be a list of field definitions"]

    seen_ids: set[str] = set()
    for i, field in enumerate(schema):
        if not isinstance(field, dict):
            errors.append(f"field[{i}] must be an object")
            continue
        fid = field.get("id")
        if not fid or not isinstance(fid, str):
            errors.append(f"field[{i}] missing required string 'id'")
        else:
            if fid in seen_ids:
                errors.append(f"field '{fid}': duplicate id")
            seen_ids.add(fid)

        ftype = field.get("type")
        if ftype not in VALID_TYPES:
            errors.append(f"field '{fid}': invalid type '{ftype}'")

        if ftype in OPTION_TYPES:
            opts = field.get("options")
            if not isinstance(opts, list) or not opts:
                errors.append(f"field '{fid}': type '{ftype}' requires non-empty 'options'")
            else:
                for opt in opts:
                    if not isinstance(opt, dict) or not opt.get("value"):
                        errors.append(f"field '{fid}': each option needs a non-empty 'value'")
                        break
    return errors


def validate_inputs(schema: list[dict[str, Any]], inputs: dict[str, Any]) -> list[str]:
    """Validate run inputs against a (already-valid) form schema."""
    errors: list[str] = []
    inputs = inputs or {}

    for field in schema:
        fid = field["id"]
        ftype = field.get("type", "string")
        required = field.get("required", False)
        present = fid in inputs and inputs[fid] not in (None, "")

        if required and not present:
            errors.append(f"field '{fid}' is required")
            continue
        if not present:
            continue

        value = inputs[fid]
        if ftype in ("number",) and not isinstance(value, (int, float)):
            errors.append(f"field '{fid}': expected number")
        elif ftype in ("integer",) and not isinstance(value, int):
            errors.append(f"field '{fid}': expected integer")
        elif ftype == "boolean" and not isinstance(value, bool):
            errors.append(f"field '{fid}': expected boolean")
        elif ftype == "multiselect" and not isinstance(value, list):
            errors.append(f"field '{fid}': expected list")
        elif ftype in ("string", "textarea", "select") and not isinstance(value, str):
            errors.append(f"field '{fid}': expected string")

        if ftype in OPTION_TYPES:
            allowed = {o["value"] for o in field.get("options", [])}
            values = value if isinstance(value, list) else [value]
            for v in values:
                if v not in allowed:
                    errors.append(f"field '{fid}': value '{v}' not in options")
    return errors
```

创建空的 `backend/app/saved_agent/__init__.py` 与 `backend/tests/test_saved_agent/__init__.py`（如测试目录需要）。

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_saved_agent/test_form_schema.py -v`
Expected: PASS（8 个用例）

- [ ] **Step 5: Commit**

```bash
git add backend/app/saved_agent/ backend/tests/test_saved_agent/
git commit -m "feat: add saved-agent form schema validators"
```

---

## Task 3: SavedAgent storage + bundle 落盘

封装 DB CRUD（按 `(workspace_path, identifier)` upsert）与 bundle 导出。DB 为真相；bundle 落盘失败仅 warning（仿 SkillRegistry）。

**Files:**
- Create: `backend/app/saved_agent/storage.py`
- Test: `backend/tests/test_saved_agent/test_storage.py`

- [ ] **Step 1: 写失败测试**

```python
# backend/tests/test_saved_agent/test_storage.py
import pytest
from app.saved_agent.storage import upsert_saved_agent, list_saved_agents, get_saved_agent


@pytest.mark.asyncio
async def test_upsert_creates_then_updates(db, tmp_path):
    ws = str(tmp_path)
    a1 = await upsert_saved_agent(
        db, workspace_path=ws, identifier="rep",
        title="Rep", description="d", skill_content="# Rep",
        form_schema=[{"id": "x", "type": "string"}],
        memory_schema={"persist_fields": ["x"], "aggregations": []},
        source_session_id="s1",
    )
    await db.flush()
    assert a1.version == "1.0.0"

    # bundle written to disk
    bundle = tmp_path / ".openyak" / "saved-agents" / "rep"
    assert (bundle / "SKILL.md").read_text().startswith("---")  # has frontmatter
    assert (bundle / "manifest.yaml").exists()

    # second upsert same identifier → same row, version bumped
    a2 = await upsert_saved_agent(
        db, workspace_path=ws, identifier="rep",
        title="Rep v2", description="d2", skill_content="# Rep v2",
        form_schema=[{"id": "x", "type": "string"}], memory_schema={}, source_session_id="s1",
    )
    await db.flush()
    assert a2.id == a1.id
    assert a2.title == "Rep v2"
    assert a2.version == "1.0.1"


@pytest.mark.asyncio
async def test_list_and_get(db, tmp_path):
    ws = str(tmp_path)
    await upsert_saved_agent(db, workspace_path=ws, identifier="a", title="A",
                             description="", skill_content="#A", form_schema=[], memory_schema={})
    await db.flush()
    items = await list_saved_agents(db, workspace_path=ws)
    assert len(items) == 1
    got = await get_saved_agent(db, items[0].id)
    assert got.identifier == "a"
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_saved_agent/test_storage.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: 实现 storage**

```python
# backend/app/saved_agent/storage.py
"""Persistence + on-disk bundle export for Saved Agents."""

from __future__ import annotations

import logging
from pathlib import Path

import yaml
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.saved_agent import SavedAgent

logger = logging.getLogger(__name__)


def _bump_patch(version: str) -> str:
    try:
        major, minor, patch = (version or "1.0.0").split(".")
        return f"{major}.{minor}.{int(patch) + 1}"
    except Exception:
        return "1.0.1"


async def get_saved_agent(db: AsyncSession, agent_id: str) -> SavedAgent | None:
    return (await db.execute(select(SavedAgent).where(SavedAgent.id == agent_id))).scalar_one_or_none()


async def list_saved_agents(db: AsyncSession, *, workspace_path: str) -> list[SavedAgent]:
    rows = (await db.execute(
        select(SavedAgent).where(SavedAgent.workspace_path == workspace_path)
        .order_by(SavedAgent.time_updated.desc())
    )).scalars().all()
    return list(rows)


async def upsert_saved_agent(
    db: AsyncSession, *, workspace_path: str, identifier: str, title: str,
    description: str, skill_content: str, form_schema: list, memory_schema: dict,
    source_session_id: str | None = None,
) -> SavedAgent:
    existing = (await db.execute(
        select(SavedAgent).where(
            SavedAgent.workspace_path == workspace_path,
            SavedAgent.identifier == identifier,
        )
    )).scalar_one_or_none()

    if existing is None:
        agent = SavedAgent(
            workspace_path=workspace_path, identifier=identifier, title=title,
            description=description, version="1.0.0", skill_content=skill_content,
            form_schema=form_schema, memory_schema=memory_schema,
            source_session_id=source_session_id,
        )
        db.add(agent)
    else:
        existing.title = title
        existing.description = description
        existing.skill_content = skill_content
        existing.form_schema = form_schema
        existing.memory_schema = memory_schema
        existing.version = _bump_patch(existing.version)
        if source_session_id:
            existing.source_session_id = source_session_id
        agent = existing

    _write_bundle(agent)
    return agent


def _write_bundle(agent: SavedAgent) -> None:
    """Export SKILL.md + manifest.yaml to .openyak/saved-agents/<id>/. Best-effort."""
    try:
        bundle = Path(agent.workspace_path) / ".openyak" / "saved-agents" / agent.identifier
        (bundle / "files").mkdir(parents=True, exist_ok=True)

        frontmatter = f"---\nname: {agent.identifier}\ndescription: {agent.description}\n---\n\n"
        (bundle / "SKILL.md").write_text(frontmatter + agent.skill_content, encoding="utf-8")

        manifest = {
            "name": agent.title,
            "description": agent.description,
            "version": agent.version,
            "form": agent.form_schema,
            "memory": agent.memory_schema,
        }
        (bundle / "manifest.yaml").write_text(
            yaml.safe_dump(manifest, allow_unicode=True, sort_keys=False), encoding="utf-8"
        )
    except OSError as e:
        logger.warning("Could not write saved-agent bundle for %s: %s", agent.identifier, e)
```

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_saved_agent/test_storage.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/saved_agent/storage.py backend/tests/test_saved_agent/test_storage.py
git commit -m "feat: add saved-agent storage and bundle export"
```

---

## Task 4: `persist_agent` builtin 工具

仿 `task.py`：从 `ctx._app_state["session_factory"]` 拿 DB，从 `ctx.workspace` 拿工作区，从 `ctx.session_id` 拿来源会话。校验 `form_schema` 后调用 `upsert_saved_agent`。

**Files:**
- Create: `backend/app/tool/builtin/persist_agent.py`
- Modify: `backend/app/main.py:554-561`（注册工具）
- Test: `backend/tests/test_tool/test_persist_agent.py`

- [ ] **Step 1: 写失败测试**

```python
# backend/tests/test_tool/test_persist_agent.py
import asyncio
import pytest
from app.tool.builtin.persist_agent import PersistAgentTool
from app.tool.context import ToolContext
from app.schemas.agent import AgentInfo, Ruleset


def _ctx(tmp_path, session_factory):
    ctx = ToolContext(
        session_id="src-sess", message_id="m1",
        agent=AgentInfo(name="persist", description="", mode="hidden", tools=["persist_agent"],
                        permissions=Ruleset(), system_prompt=""),
        call_id="c1", workspace=str(tmp_path),
    )
    ctx._app_state = {"session_factory": session_factory}  # type: ignore[attr-defined]
    return ctx


@pytest.mark.asyncio
async def test_persist_agent_creates_row(tmp_path, session_factory):
    tool = PersistAgentTool()
    ctx = _ctx(tmp_path, session_factory)
    result = await tool.execute({
        "identifier": "weather", "title": "Weather", "description": "daily",
        "skill_content": "# Weather\n## Goal\n...",
        "form_schema": [{"id": "city", "type": "string", "required": True}],
        "memory_schema": {"persist_fields": ["city"], "aggregations": []},
    }, ctx)
    assert result.success, result.error
    assert "weather" in result.output.lower()

    from app.saved_agent.storage import list_saved_agents
    async with session_factory() as db:
        items = await list_saved_agents(db, workspace_path=str(tmp_path))
    assert len(items) == 1 and items[0].identifier == "weather"


@pytest.mark.asyncio
async def test_persist_agent_rejects_bad_form(tmp_path, session_factory):
    tool = PersistAgentTool()
    ctx = _ctx(tmp_path, session_factory)
    result = await tool.execute({
        "identifier": "bad", "title": "Bad", "skill_content": "#x",
        "form_schema": [{"id": "d", "type": "select"}],  # select 缺 options
    }, ctx)
    assert not result.success
    assert "options" in result.error


@pytest.mark.asyncio
async def test_persist_agent_missing_app_state(tmp_path):
    tool = PersistAgentTool()
    ctx = ToolContext(
        session_id="s", message_id="m", call_id="c", workspace=str(tmp_path),
        agent=AgentInfo(name="persist", description="", mode="hidden", tools=[],
                        permissions=Ruleset(), system_prompt=""),
    )
    result = await tool.execute({"identifier": "x", "title": "X", "skill_content": "#x",
                                 "form_schema": []}, ctx)
    assert not result.success
```

> 注：核对 `AgentInfo` 的真实必填字段（`backend/app/schemas/agent.py`），按需调整测试里的构造参数。

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_tool/test_persist_agent.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: 实现工具**

```python
# backend/app/tool/builtin/persist_agent.py
"""persist_agent tool — turn the current session into a reusable Saved Agent."""

from __future__ import annotations

import logging
from typing import Any

from app.tool.base import ToolDefinition, ToolResult
from app.tool.context import ToolContext

logger = logging.getLogger(__name__)


class PersistAgentTool(ToolDefinition):

    @property
    def id(self) -> str:
        return "persist_agent"

    @property
    def description(self) -> str:
        return (
            "Persist the current session as a reusable, form-driven Saved Agent. "
            "Provide a stable kebab-case identifier, a SKILL.md body (Goal/Inputs/"
            "Procedure/Output), a form_schema of structured inputs, and a memory_schema. "
            "Call this exactly once when the user asks to 'turn into an agent' / 'save as agent'."
        )

    def parameters_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "identifier": {"type": "string", "description": "Stable kebab-case id, unique per workspace"},
                "title": {"type": "string"},
                "description": {"type": "string"},
                "skill_content": {"type": "string", "description": "SKILL.md body: Goal/Inputs/Procedure/Output"},
                "form_schema": {"type": "array", "description": "List of form field definitions"},
                "memory_schema": {"type": "object", "description": "{persist_fields, aggregations} (stored, not aggregated in Phase 1)"},
            },
            "required": ["identifier", "title", "skill_content", "form_schema"],
        }

    async def execute(self, args: dict[str, Any], ctx: ToolContext) -> ToolResult:
        from app.saved_agent.form_schema import validate_form_schema
        from app.saved_agent.storage import upsert_saved_agent

        app_state = getattr(ctx, "_app_state", None)
        if not app_state:
            return ToolResult(error="persist_agent unavailable: missing app state (must run inside a session)")
        session_factory = app_state["session_factory"]

        workspace = ctx.workspace or "."
        form_schema = args.get("form_schema", [])

        schema_errors = validate_form_schema(form_schema)
        if schema_errors:
            return ToolResult(error="Invalid form_schema: " + "; ".join(schema_errors))

        try:
            async with session_factory() as db:
                async with db.begin():
                    agent = await upsert_saved_agent(
                        db,
                        workspace_path=workspace,
                        identifier=args["identifier"],
                        title=args["title"],
                        description=args.get("description", ""),
                        skill_content=args["skill_content"],
                        form_schema=form_schema,
                        memory_schema=args.get("memory_schema", {}),
                        source_session_id=ctx.session_id,
                    )
                    agent_id = agent.id
                    version = agent.version
        except Exception as e:
            logger.exception("persist_agent failed")
            return ToolResult(error=f"Failed to persist agent: {e}")

        field_ids = [f.get("id") for f in form_schema if isinstance(f, dict)]
        return ToolResult(
            output=(
                f"Saved Agent '{args['title']}' (id={args['identifier']}, v{version}) registered.\n"
                f"Form inputs: {', '.join(field_ids) or '(none)'}"
            ),
            title=f"Saved Agent: {args['title']}",
            metadata={"saved_agent_id": agent_id, "identifier": args["identifier"]},
        )
```

- [ ] **Step 4: 在 main.py 注册**

`backend/app/main.py` 的 `_register_builtin_tools`：import 并加入注册列表。

```python
from app.tool.builtin.persist_agent import PersistAgentTool
# 在 for tool_cls in [...] 列表中追加 PersistAgentTool,
```

- [ ] **Step 5: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_tool/test_persist_agent.py -v`
Expected: PASS（3 个用例）

- [ ] **Step 6: Commit**

```bash
git add backend/app/tool/builtin/persist_agent.py backend/app/main.py backend/tests/test_tool/test_persist_agent.py
git commit -m "feat: add persist_agent builtin tool"
```

---

## Task 5: hidden `persist` agent + prompt

**Files:**
- Modify: `backend/app/agent/agent.py:29-141`（在 `BUILTIN_AGENTS` 加 `persist`）
- Create: `backend/app/agent/prompts/persist.txt`
- Test: `backend/tests/test_agent/test_persist_agent_registered.py`

- [ ] **Step 1: 写失败测试**

```python
# backend/tests/test_agent/test_persist_agent_registered.py
from app.agent.agent import AgentRegistry


def test_persist_agent_registered_and_hidden():
    reg = AgentRegistry()
    agent = reg.get("persist")
    assert agent is not None
    assert agent.mode == "hidden"
    assert agent.tools == ["persist_agent"]
    # hidden agents must not surface in the user-facing list
    assert "persist" not in [a.name for a in reg.list_agents(include_hidden=False)]
    # but must have a non-empty system prompt
    assert agent.system_prompt
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_agent/test_persist_agent_registered.py -v`
Expected: FAIL — `reg.get("persist")` 返回 None

- [ ] **Step 3: 创建 prompt 文件**

`backend/app/agent/prompts/persist.txt`（改编自 CREAO persist-agentapp，去掉 stdout marker/S3，改用 `persist_agent` 工具）：

```text
You are the Persist Agent inside Talos. Your sole job: turn the just-completed
session into ONE reusable Saved Agent by calling the `persist_agent` tool exactly once.

ACT FAST. The conversation history is already in context — do NOT re-narrate or
re-simulate what the prior session did. Think briefly, then call the tool.

Decide, in <=3 bullets:
- The one-line goal of the session.
- Which inputs VARIED between hypothetical runs → these become form fields.
- What output metrics are worth comparing across runs → memory persist_fields.

Then call `persist_agent` with:
- identifier: stable kebab-case id (e.g. "weather-report")
- title, description: short and human-readable
- skill_content: a SKILL.md body with sections Goal / Inputs / Procedure / Output.
  Keep it focused (<500 lines). Describe WHAT to do, not CSS/templates/algorithm internals.
- form_schema: list of fields. Each: {id, name, type, required, description, options?}.
  Types: string, textarea, number, integer, boolean, select, multiselect.
  select/multiselect MUST include non-empty options: [{label, value}].
  Only promote inputs that vary across runs AND can be validated. Do NOT promote
  internal constants or implementation choices.
- memory_schema: {persist_fields: [...form ids + output metric ids...],
  aggregations: [{field, ops: [avg|sum|count], group_by: [...]}]}.
  Include BOTH input fields and output metrics in persist_fields.

After the tool returns, briefly confirm to the user what the agent does and what
inputs it expects. Do NOT write files. Do NOT call any other tool.
```

- [ ] **Step 4: 在 BUILTIN_AGENTS 注册**

`backend/app/agent/agent.py`，在 `BUILTIN_AGENTS` dict 中加入：

```python
    "persist": AgentInfo(
        name="persist",
        description="Persist a session into a reusable Saved Agent",
        mode="hidden",
        tools=["persist_agent"],
        permissions=Ruleset(rules=[
            PermissionRule(action="deny", permission="*"),
            PermissionRule(action="allow", permission="persist_agent"),
        ]),
        system_prompt=_load_prompt("persist"),
    ),
```

- [ ] **Step 5: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_agent/test_persist_agent_registered.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/agent/agent.py backend/app/agent/prompts/persist.txt backend/tests/test_agent/test_persist_agent_registered.py
git commit -m "feat: add hidden persist agent and prompt"
```

---

## Task 6: saved_agents API（CRUD）+ schemas + router 挂载

**Files:**
- Create: `backend/app/schemas/saved_agent.py`
- Create: `backend/app/api/saved_agents.py`（本 Task 只做 CRUD，`/run` 在 Task 7）
- Modify: `backend/app/api/router.py`
- Test: `backend/tests/test_api/test_saved_agents.py`

- [ ] **Step 1: 写失败测试**

```python
# backend/tests/test_api/test_saved_agents.py
import pytest


@pytest.mark.asyncio
async def test_crud_flow(app_client, tmp_path):
    ws = str(tmp_path)
    # 直接建一条（CRUD 不依赖 persist 工具）
    payload = {
        "workspace_path": ws, "identifier": "rep", "title": "Rep",
        "description": "d", "skill_content": "# Rep",
        "form_schema": [{"id": "city", "type": "string", "required": True}],
        "memory_schema": {"persist_fields": ["city"], "aggregations": []},
    }
    r = await app_client.post("/api/saved-agents", json=payload)
    assert r.status_code == 200, r.text
    agent_id = r.json()["id"]

    r = await app_client.get(f"/api/saved-agents?workspace={ws}")
    assert r.status_code == 200
    assert len(r.json()) == 1

    r = await app_client.get(f"/api/saved-agents/{agent_id}")
    assert r.json()["identifier"] == "rep"

    r = await app_client.delete(f"/api/saved-agents/{agent_id}")
    assert r.status_code == 200
    r = await app_client.get(f"/api/saved-agents?workspace={ws}")
    assert len(r.json()) == 0


@pytest.mark.asyncio
async def test_create_rejects_bad_form_schema(app_client, tmp_path):
    payload = {
        "workspace_path": str(tmp_path), "identifier": "bad", "title": "Bad",
        "skill_content": "#x", "form_schema": [{"id": "d", "type": "select"}],
        "memory_schema": {},
    }
    r = await app_client.post("/api/saved-agents", json=payload)
    assert r.status_code == 422
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_api/test_saved_agents.py -v`
Expected: FAIL — 404（路由未挂）

- [ ] **Step 3: 实现 schemas**

```python
# backend/app/schemas/saved_agent.py
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class SavedAgentCreate(BaseModel):
    workspace_path: str
    identifier: str
    title: str
    description: str = ""
    skill_content: str
    form_schema: list[dict[str, Any]] = []
    memory_schema: dict[str, Any] = {}
    source_session_id: str | None = None


class SavedAgentUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    skill_content: str | None = None
    form_schema: list[dict[str, Any]] | None = None
    memory_schema: dict[str, Any] | None = None


class SavedAgentResponse(BaseModel):
    id: str
    workspace_path: str
    identifier: str
    title: str
    description: str
    version: str
    skill_content: str
    form_schema: list[dict[str, Any]]
    memory_schema: dict[str, Any]
    source_session_id: str | None
    time_created: datetime
    time_updated: datetime

    model_config = {"from_attributes": True}


class RunRequest(BaseModel):
    inputs: dict[str, Any] = {}
    model: str | None = None


class RunResponse(BaseModel):
    session_id: str
    status: str = "started"
```

- [ ] **Step 4: 实现 CRUD endpoints**

```python
# backend/app/api/saved_agents.py
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.saved_agent.form_schema import validate_form_schema
from app.saved_agent.storage import (
    get_saved_agent, list_saved_agents, upsert_saved_agent,
)
from app.schemas.saved_agent import (
    SavedAgentCreate, SavedAgentResponse, SavedAgentUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/saved-agents", response_model=list[SavedAgentResponse])
async def list_agents(workspace: str, db: AsyncSession = Depends(get_db)):
    return await list_saved_agents(db, workspace_path=workspace)


@router.post("/saved-agents", response_model=SavedAgentResponse)
async def create_agent(body: SavedAgentCreate, db: AsyncSession = Depends(get_db)):
    errs = validate_form_schema(body.form_schema)
    if errs:
        raise HTTPException(422, detail="Invalid form_schema: " + "; ".join(errs))
    agent = await upsert_saved_agent(
        db, workspace_path=body.workspace_path, identifier=body.identifier,
        title=body.title, description=body.description, skill_content=body.skill_content,
        form_schema=body.form_schema, memory_schema=body.memory_schema,
        source_session_id=body.source_session_id,
    )
    await db.flush()
    return agent


@router.get("/saved-agents/{agent_id}", response_model=SavedAgentResponse)
async def get_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    agent = await get_saved_agent(db, agent_id)
    if agent is None:
        raise HTTPException(404, "Saved Agent not found")
    return agent


@router.put("/saved-agents/{agent_id}", response_model=SavedAgentResponse)
async def update_agent(agent_id: str, body: SavedAgentUpdate, db: AsyncSession = Depends(get_db)):
    agent = await get_saved_agent(db, agent_id)
    if agent is None:
        raise HTTPException(404, "Saved Agent not found")
    if body.form_schema is not None:
        errs = validate_form_schema(body.form_schema)
        if errs:
            raise HTTPException(422, detail="Invalid form_schema: " + "; ".join(errs))
    agent = await upsert_saved_agent(
        db, workspace_path=agent.workspace_path, identifier=agent.identifier,
        title=body.title if body.title is not None else agent.title,
        description=body.description if body.description is not None else agent.description,
        skill_content=body.skill_content if body.skill_content is not None else agent.skill_content,
        form_schema=body.form_schema if body.form_schema is not None else agent.form_schema,
        memory_schema=body.memory_schema if body.memory_schema is not None else agent.memory_schema,
    )
    await db.flush()
    return agent


@router.delete("/saved-agents/{agent_id}")
async def delete_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    import shutil
    from pathlib import Path
    agent = await get_saved_agent(db, agent_id)
    if agent is None:
        raise HTTPException(404, "Saved Agent not found")
    bundle = Path(agent.workspace_path) / ".openyak" / "saved-agents" / agent.identifier
    await db.delete(agent)
    try:
        shutil.rmtree(bundle, ignore_errors=True)
    except OSError:
        pass
    return {"status": "deleted"}
```

- [ ] **Step 5: 挂载 router**

`backend/app/api/router.py`：

```python
from app.api import saved_agents as saved_agents_api
# ...
api_router.include_router(saved_agents_api.router, tags=["saved-agents"])
```

- [ ] **Step 6: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_api/test_saved_agents.py -v`
Expected: PASS（CRUD + 422 用例）

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/saved_agent.py backend/app/api/saved_agents.py backend/app/api/router.py backend/tests/test_api/test_saved_agents.py
git commit -m "feat: add saved-agents CRUD API"
```

---

## Task 7: `POST /saved-agents/{id}/run` — 起 headless 会话

仿 `scheduler/executor.py:_run_session`：校验 inputs → 拼 prompt（注入 inputs + skill_content）→ 在后台任务里 `run_generation` 起 headless 会话 → 立即返回 session_id。

**Files:**
- Create: `backend/app/saved_agent/runner.py`（拼 prompt + 起会话，便于单测）
- Modify: `backend/app/api/saved_agents.py`（加 `/run` 端点）
- Test: `backend/tests/test_saved_agent/test_runner.py`

- [ ] **Step 1: 写失败测试（prompt 拼装，纯函数）**

```python
# backend/tests/test_saved_agent/test_runner.py
from app.saved_agent.runner import build_run_prompt


def test_build_run_prompt_injects_inputs_and_skill():
    skill = "# Weather\n## Procedure\n1. fetch"
    prompt = build_run_prompt(
        title="Weather", skill_content=skill,
        form_schema=[{"id": "city", "name": "City", "type": "string"}],
        inputs={"city": "Tokyo"},
    )
    assert "Tokyo" in prompt
    assert "city" in prompt
    assert "## Procedure" in prompt  # skill embedded
    assert "Weather" in prompt
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_saved_agent/test_runner.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: 实现 runner（prompt 拼装 + 起会话）**

```python
# backend/app/saved_agent/runner.py
"""Build run prompts and launch headless sessions for Saved Agents."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)


def build_run_prompt(
    *, title: str, skill_content: str, form_schema: list[dict[str, Any]], inputs: dict[str, Any]
) -> str:
    lines = [f"Run the Saved Agent: {title}.", "", "## Inputs"]
    by_id = {f["id"]: f for f in form_schema if isinstance(f, dict)}
    for fid, value in inputs.items():
        label = by_id.get(fid, {}).get("name", fid)
        lines.append(f"- {label} ({fid}): {value}")
    if not inputs:
        lines.append("- (no inputs)")
    lines += [
        "",
        "Follow the procedure below exactly. Use the inputs above.",
        "",
        "## SKILL",
        skill_content,
    ]
    return "\n".join(lines)


async def launch_run(
    *, saved_agent, inputs: dict[str, Any], model: str | None,
    session_factory, provider_registry, agent_registry, tool_registry, index_manager=None,
) -> str:
    """Create a headless session and run it in the background. Returns session_id."""
    from app.schemas.chat import PromptRequest
    from app.session.processor import run_generation
    from app.streaming.manager import GenerationJob
    from app.utils.id import generate_ulid

    session_id = generate_ulid()
    prompt = build_run_prompt(
        title=saved_agent.title, skill_content=saved_agent.skill_content,
        form_schema=saved_agent.form_schema, inputs=inputs,
    )
    job = GenerationJob(stream_id=generate_ulid(), session_id=session_id)
    request = PromptRequest(
        session_id=session_id, text=prompt, model=model,
        agent="build", workspace=saved_agent.workspace_path,
    )

    async def _run():
        try:
            await asyncio.wait_for(
                run_generation(
                    job, request, session_factory=session_factory,
                    provider_registry=provider_registry, agent_registry=agent_registry,
                    tool_registry=tool_registry, index_manager=index_manager,
                ),
                timeout=1800,
            )
        except Exception as e:
            logger.warning("Saved Agent run %s failed: %s", session_id, e)

    asyncio.create_task(_run(), name=f"saved-agent-run-{session_id[:12]}")
    return session_id
```

- [ ] **Step 4: 加 `/run` 端点**

`backend/app/api/saved_agents.py`：

```python
from app.dependencies import (
    get_agent_registry, get_index_manager, get_provider_registry,
    get_session_factory, get_tool_registry,
)
from app.saved_agent.form_schema import validate_inputs
from app.saved_agent.runner import launch_run
from app.schemas.saved_agent import RunRequest, RunResponse


@router.post("/saved-agents/{agent_id}/run", response_model=RunResponse)
async def run_agent(
    agent_id: str,
    body: RunRequest,
    db: AsyncSession = Depends(get_db),
    session_factory=Depends(get_session_factory),
    provider_registry=Depends(get_provider_registry),
    agent_registry=Depends(get_agent_registry),
    tool_registry=Depends(get_tool_registry),
    index_manager=Depends(get_index_manager),
):
    agent = await get_saved_agent(db, agent_id)
    if agent is None:
        raise HTTPException(404, "Saved Agent not found")

    errs = validate_inputs(agent.form_schema, body.inputs)
    if errs:
        raise HTTPException(422, detail="Invalid inputs: " + "; ".join(errs))

    session_id = await launch_run(
        saved_agent=agent, inputs=body.inputs, model=body.model,
        session_factory=session_factory, provider_registry=provider_registry,
        agent_registry=agent_registry, tool_registry=tool_registry, index_manager=index_manager,
    )
    return RunResponse(session_id=session_id)
```

- [ ] **Step 5: 写 API 集成测试（mock run_generation）**

```python
# 追加到 backend/tests/test_api/test_saved_agents.py
@pytest.mark.asyncio
async def test_run_validates_inputs(app_client, tmp_path, monkeypatch):
    # 建一个 required city 的 agent
    ws = str(tmp_path)
    r = await app_client.post("/api/saved-agents", json={
        "workspace_path": ws, "identifier": "rep", "title": "Rep", "skill_content": "#x",
        "form_schema": [{"id": "city", "type": "string", "required": True}], "memory_schema": {},
    })
    agent_id = r.json()["id"]

    # 缺 required → 422
    r = await app_client.post(f"/api/saved-agents/{agent_id}/run", json={"inputs": {}})
    assert r.status_code == 422

    # mock launch_run 避免真起 LLM
    import app.api.saved_agents as mod
    async def _fake_launch(**kwargs):
        return "fake-session"
    monkeypatch.setattr(mod, "launch_run", _fake_launch)

    r = await app_client.post(f"/api/saved-agents/{agent_id}/run", json={"inputs": {"city": "Tokyo"}})
    assert r.status_code == 200
    assert r.json()["session_id"] == "fake-session"
```

> 注：`app_client` fixture 里 `get_provider_registry` 等被 mock 成 MagicMock，`/run` 端点拿到的就是这些 mock；因 `launch_run` 被 monkeypatch，registry 不会被真正使用。

- [ ] **Step 6: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_saved_agent/test_runner.py tests/test_api/test_saved_agents.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/saved_agent/runner.py backend/app/api/saved_agents.py backend/tests/test_saved_agent/test_runner.py backend/tests/test_api/test_saved_agents.py
git commit -m "feat: add saved-agent run endpoint (headless session)"
```

---

## Task 8: 后端全量回归

- [ ] **Step 1: 跑全部后端测试**

Run: `cd backend && python -m pytest tests/ -q`
Expected: 全绿（新增用例 + 既有用例不回归）。若有红，修复后再继续。

- [ ] **Step 2: 启动 smoke check**

Run: `cd backend && python -c "from app.main import create_app; from app.config import Settings; create_app(Settings(openrouter_api_key='x', database_url='sqlite+aiosqlite://'))"`
Expected: 无 import/路由注册错误（验证 router 挂载、tool/agent 注册无环依赖）。

- [ ] **Step 3: Commit（若有修复）**

```bash
git add -A && git commit -m "test: backend regression for saved agents"
```

---

## Task 9: 前端类型 + API 常量 + hooks

前端 TDD 较弱，这几个 Task 以「能编译 + 手动验证」为准。先建数据层。

**Files:**
- Modify: `frontend/src/lib/constants.ts`（API + queryKeys）
- Create: `frontend/src/types/saved-agent.ts`
- Create: `frontend/src/hooks/use-saved-agents.ts`

- [ ] **Step 1: 加 API 常量**

`frontend/src/lib/constants.ts` 的 `API` 对象内加：

```ts
  SAVED_AGENTS: {
    LIST: (workspace: string) =>
      `/api/saved-agents?workspace=${encodeURIComponent(workspace)}` as const,
    CREATE: "/api/saved-agents",
    DETAIL: (id: string) => `/api/saved-agents/${id}` as const,
    UPDATE: (id: string) => `/api/saved-agents/${id}` as const,
    DELETE: (id: string) => `/api/saved-agents/${id}` as const,
    RUN: (id: string) => `/api/saved-agents/${id}/run` as const,
  },
```

`queryKeys` 内加：

```ts
  savedAgents: {
    all: (workspace: string) => ["savedAgents", workspace] as const,
    detail: (id: string) => ["savedAgents", id] as const,
  },
```

- [ ] **Step 2: 定义类型**

```ts
// frontend/src/types/saved-agent.ts
export type FormFieldType =
  | "string" | "textarea" | "number" | "integer"
  | "boolean" | "select" | "multiselect";

export interface FormFieldOption { label: string; value: string }

export interface FormField {
  id: string;
  name?: string;
  type: FormFieldType;
  required?: boolean;
  description?: string;
  default_value?: unknown;
  example?: string;
  options?: FormFieldOption[];
}

export interface SavedAgent {
  id: string;
  workspace_path: string;
  identifier: string;
  title: string;
  description: string;
  version: string;
  skill_content: string;
  form_schema: FormField[];
  memory_schema: Record<string, unknown>;
  source_session_id: string | null;
  time_created: string;
  time_updated: string;
}
```

- [ ] **Step 3: 实现 hooks（仿 use-automations / 现有 hook 风格）**

```ts
// frontend/src/hooks/use-saved-agents.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API, queryKeys } from "@/lib/constants";
import type { SavedAgent } from "@/types/saved-agent";

export function useSavedAgents(workspace: string) {
  return useQuery({
    queryKey: queryKeys.savedAgents.all(workspace),
    queryFn: () => api.get<SavedAgent[]>(API.SAVED_AGENTS.LIST(workspace)),
    enabled: !!workspace,
  });
}

export function useRunSavedAgent() {
  return useMutation({
    mutationFn: (vars: { id: string; inputs: Record<string, unknown>; model?: string }) =>
      api.post<{ session_id: string; status: string }>(
        API.SAVED_AGENTS.RUN(vars.id),
        { inputs: vars.inputs, model: vars.model },
      ),
  });
}

export function useDeleteSavedAgent(workspace: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(API.SAVED_AGENTS.DELETE(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.savedAgents.all(workspace) }),
  });
}
```

> 注：`frontend/src/lib/api.ts` 导出的删除方法是 `api.delete`（不是 `del`）。

- [ ] **Step 4: 编译确认**

Run: `cd frontend && npx tsc --noEmit`
Expected: 无新增类型错误。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/constants.ts frontend/src/types/saved-agent.ts frontend/src/hooks/use-saved-agents.ts
git commit -m "feat(web): saved-agents types, api constants, hooks"
```

---

## Task 10: 前端 Agents 入口（列表 + 运行表单）

新建独立入口（不复用 Workflow tab）。沿用现有 tab 机制：`frontend/src/stores/sidebar-store.ts` 的 `activeTab` 增加 `"agents"`，在 `frontend/src/app/(main)/layout.tsx` 与 `frontend/src/components/layout/sidebar.tsx` 增加对应导航与渲染分支（仿现有 `workflow` tab 写法）。

**Files:**
- Modify: `frontend/src/stores/sidebar-store.ts`（activeTab 联合类型加 `"agents"`）
- Modify: `frontend/src/components/layout/sidebar.tsx`（导航项）
- Modify: `frontend/src/app/(main)/layout.tsx`（渲染分支）
- Create: `frontend/src/components/saved-agents/saved-agent-list.tsx`
- Create: `frontend/src/components/saved-agents/saved-agent-run-form.tsx`

- [ ] **Step 1: 列表组件**

`saved-agent-list.tsx`：用 `useSavedAgents(workspace)` 渲染卡片网格（title / description / version / 「运行」「删除」按钮）。空态提示「在聊天里点『转为可复用 Agent』来创建」。点卡片打开 `SavedAgentRunForm`。

- [ ] **Step 2: 运行表单组件**

`saved-agent-run-form.tsx`：按 `agent.form_schema` 渲染输入控件：
- `string` → input；`textarea` → textarea；`number`/`integer` → number input；`boolean` → switch/checkbox；`select` → 单选；`multiselect` → 多选。
- 前端做与后端一致的 required 校验（防呆，后端仍会再校验）。
- 提交调用 `useRunSavedAgent()`，成功后用现有会话跳转逻辑打开返回的 `session_id`（参考 `use-chat.ts` / 现有「打开会话」的方式）。
- `file`/`files` 字段 Phase 1 不渲染（后端预留）。

- [ ] **Step 3: 接入 tab**

- `sidebar-store.ts`：`activeTab: "chat" | "workflow" | "agents"`。
- `sidebar.tsx`：加一个「Agents」导航按钮（图标用现有图标库）。
- `layout.tsx`：`activeTab === "agents"` 时渲染 `<SavedAgentList workspace={...} />`。workspace 取当前选中的工作区（参考现有 workflow/chat 如何拿 workspace）。

- [ ] **Step 4: 编译 + 手动验证**

Run: `cd frontend && npx tsc --noEmit && npm run lint`
手动：启动 app → 切到 Agents tab → 空态正常；（用后端已存在的一条记录）能看到卡片 → 填表单 → 运行 → 跳到新会话看到流式执行。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/saved-agents/ frontend/src/stores/sidebar-store.ts frontend/src/components/layout/sidebar.tsx "frontend/src/app/(main)/layout.tsx"
git commit -m "feat(web): saved-agents tab with list and run form"
```

---

## Task 11: 聊天工具栏「转为可复用 Agent」按钮

**Files:**
- Modify: `frontend/src/components/chat/chat-form.tsx`（加按钮）
- 可能 Modify: `frontend/src/hooks/use-chat.ts`（暴露一个以 `agent="persist"` 发起当前会话一轮的方法）

- [ ] **Step 1: 加触发方法**

在发送 prompt 的逻辑里支持指定 `agent`。点按钮时，对**当前 session** 发起一轮：`POST /api/chat/prompt`，body 含 `session_id=当前会话`、`agent="persist"`、`text="把本次会话沉淀为可复用 Agent。"`（沿用现有 `usePrompt`/`useChat` 的发送路径，仅覆盖 `agent` 字段）。

- [ ] **Step 2: 加按钮**

`chat-form.tsx` 工具栏加一个按钮（仅当当前会话已有消息时可用）。点击 → 调上面的方法 → 现有流式 UI 会显示 persist agent 调用 `persist_agent` 工具的结果。完成后 toast 提示「已保存为 Agent，可在 Agents 标签查看」。

- [ ] **Step 3: 编译 + 手动验证**

Run: `cd frontend && npx tsc --noEmit`
手动：在一个有内容的会话点按钮 → 看到 persist 工具结果 → 切到 Agents tab 看到新卡片 → 运行成功。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/chat/chat-form.tsx frontend/src/hooks/use-chat.ts
git commit -m "feat(web): add 'turn into reusable agent' button"
```

---

## 最终验收清单

- [ ] `cd backend && python -m pytest tests/ -q` 全绿。
- [ ] 后端 smoke：`create_app(...)` 无错误，`/saved-agents` 路由可用。
- [ ] 端到端手动：聊天 → 「转为可复用 Agent」→ Agents tab 出现卡片 → 填表单运行 → 新会话按 SKILL.md 流程执行。
- [ ] bundle 落盘：`{workspace}/.openyak/saved-agents/<id>/` 下有 `SKILL.md` + `manifest.yaml`；确认它**未**出现在 skills / agents 列表里（无污染）。
- [ ] `frontend`：`npx tsc --noEmit` 与 `npm run lint` 通过。

## 风险与备注

- **`_app_state` 私有契约**：`persist_agent` 依赖 processor 注入的 `ctx._app_state`，仅当工具跑在正常会话主循环里才有。本设计经 `POST /prompt`（agent=persist）触发，满足前提；工具已对缺失情况返回明确错误。
- **`/run` registry 依赖**：`/run` 端点通过 `Depends(get_*_registry)` 拿 registry，与 scheduler 用 `app_state` 略有不同但等价（DI 单例）。测试里通过 monkeypatch `launch_run` 规避真实 LLM 调用。
- **YAGNI**：Phase 1 不建 `AgentRun` 表、不解析指标、不做聚合/定时/文件打包/dashboard——这些在 Phase 2/3 的独立 plan 里做。
- **前端 tab 接入**：未读全 `sidebar-store.ts`/`layout.tsx`/`sidebar.tsx` 的实现细节，执行时以「仿现有 workflow tab」为准，按真实代码微调。
