# Talos

<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/lang-English-blue?style=flat-square" alt="English" /></a>
  <a href="https://github.com/yyf9664-del/Talos/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/yyf9664-del/Talos/ci.yml?branch=main&style=flat-square&label=CI" alt="CI" /></a>
  <a href="https://github.com/yyf9664-del/Talos/stargazers"><img src="https://img.shields.io/github/stars/yyf9664-del/Talos?style=flat-square" alt="GitHub Stars" /></a>
  <a href="https://github.com/yyf9664-del/Talos/blob/main/LICENSE"><img src="https://img.shields.io/github/license/yyf9664-del/Talos?style=flat-square" alt="License" /></a>
  <img src="https://img.shields.io/badge/status-开发中-orange?style=flat-square" alt="开发中" />
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue?style=flat-square" alt="Platform: macOS | Windows | Linux" />
</p>

<p align="center">
  <img src="docs/readme/openyak-workflow-artifacts.gif" width="820" alt="Talos 把办公文件整理成结构化结果" />
</p>

<h3 align="center">运行在你电脑上的本地优先 AI Agent</h3>

<p align="center">
  在本机运行、处理本地文件、优先用本地模型，只在你需要时才连接云端。
</p>

---

## 为什么选择 Talos

- **无需账号。** 装好就能用，没有登录、账单、席位或充值。
- **数据留在本地。** 文件、对话、记忆和生成结果都存在你的设备上。
- **直接处理你的文件。** 支持 Word、Excel、PPT、PDF、CSV，帮你生成简报、表格、计划和邮件。
- **一个对话走完整个流程。** 从分析到计划、再到写邮件，不用反复重讲背景。
- **模型自己选。** 本地用 [Rapid-MLX](https://github.com/raullenchai/Rapid-MLX) 或 [Ollama](https://ollama.com)，需要云端时再填自己的 API Key（OpenAI、Anthropic、Google 等）。
- **手机也能用。** 开启远程访问后扫码连接，把任务发给电脑执行。

## 它能帮你做什么

| 你要它做 | 它给你 |
|----------|--------|
| 读一份长文档 | 核心结论、风险、负责人、下一步和一封可直接发的邮件 |
| 分析一张表格 | 预算差异、异常点和可以拿去开会的结论 |
| 审阅一份 PPT | 逐页梳理、缺失论据和演讲备注 |
| 汇总多份文件 | 把多个文件对齐成一份完整简报 |
| 拆成多个任务并行 | 多个子任务同时跑，主对话里汇总结果 |
| 在同一对话里继续 | 行动计划、会议议程、后续草稿，不必重述背景 |

## 项目状态

> Talos 目前处于**开发阶段**，还没有提供打包好的安装包。现在可以从源码克隆运行，体验完整功能；打包发布会在后续版本提供。

## 快速开始

从源码运行（详见下方[开发者](#开发者)一节）：

```bash
git clone https://github.com/yyf9664-del/Talos.git
cd Talos
npm install
npm run dev:all
```

启动后：

1. 选择模型：本地用 Rapid-MLX / Ollama，或填入云端 provider 的 API Key。
2. 新建对话，上传一份真实文件。
3. 直接说出你要的结果——简报、计划、邮件、表格都行。
4. 查看结果，并在同一对话里继续追问。

示例：

```text
请阅读我上传的文件，整理成一份简洁的团队简报：
先列三条关键结论，再列风险、负责人和下一步行动，
最后写一封可以直接发给团队的邮件。
```

## 模型选项

**本地优先**

- **Rapid-MLX：** Apple Silicon Mac 可在设置里启动和切换 MLX 模型。
- **Ollama：** 通过 [Ollama](https://ollama.com) 运行任意本地模型，自动检测、可离线使用。
- **自定义本地服务：** 也可指向你自己的 OpenAI 兼容接口。

**可选云端 Provider（都需自带 API Key）**

OpenRouter、OpenAI、Anthropic、Google、DeepSeek、Groq、Mistral、xAI、Qwen、Kimi、MiniMax、智谱，以及现有的 ChatGPT 订阅。

云端为可选项。Talos 不提供托管账号、也不代理流量，请求会从你的电脑直接发往你配置的 provider。

## 开发者

**技术栈：** Tauri v2、Rust、Next.js 15、FastAPI、SQLite

```text
desktop-tauri/    Rust 桌面外壳和系统集成
frontend/         Next.js 聊天界面、设置、artifact、流式传输
backend/          FastAPI agent 引擎、工具执行、模型流式、存储
```

`npm run dev:all` 会同时启动后端（`8000` 端口）和前端（`3000` 端口）。更多说明见 [frontend/README.md](frontend/README.md) 和 [backend/README.md](backend/README.md)。

## 常见问题

<details>
<summary>我的数据会离开本机吗？</summary>

文件、对话、记忆和生成结果都存在本机。用本地模型时请求不出本机；只有选择云端模型时，才会把内容直接发给你配置的 provider。
</details>

<details>
<summary>需要注册账号吗？</summary>

不需要。Talos 没有账号、登录或充值流程。用云端 provider 时才需要你自己的 API Key 或订阅。
</details>

<details>
<summary>和 ChatGPT、Claude.ai 有什么区别？</summary>

Talos 运行在你的桌面上，围绕本地文件、工具、权限和连续工作流设计，更像一个能看文件、用工具的本地工作台，而不只是网页问答。
</details>

<details>
<summary>可以离线使用吗？</summary>

可以。用 Rapid-MLX（Apple Silicon Mac）或 Ollama 下载模型后，即可在不连云端的情况下使用。
</details>

<details>
<summary>远程访问怎么用？</summary>

在设置里开启远程访问，扫码即可在手机网页端使用，通过 Cloudflare Tunnel 加 token 鉴权连接，无需端口转发。
</details>

## 社区与许可证

- 提问讨论：[GitHub Discussions](https://github.com/yyf9664-del/Talos/discussions)
- 问题反馈：[GitHub Issues](https://github.com/yyf9664-del/Talos/issues)
- 参与贡献：[CONTRIBUTING.md](CONTRIBUTING.md)
- 许可证：[Apache-2.0](LICENSE)
