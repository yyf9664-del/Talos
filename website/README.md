# Talos 官网

Talos 的中文单页官网，零依赖纯静态（HTML + CSS + 原生 JS），可直接部署到任意静态托管。

## 本地预览

任选其一：

```bash
# 方式一：Python
cd website && python3 -m http.server 5173
# 打开 http://localhost:5173

# 方式二：Node（需全局 serve）
npx serve website
```

也可以直接用浏览器打开 `index.html`（部分浏览器对本地字体/资源更友好的方式仍是起一个本地服务）。

## 目录结构

```text
website/
├── index.html      # 页面结构（导航 / Hero / 特性 / 工作流 / 模型 / 下载 / FAQ / 页脚）
├── styles.css      # 全部样式，品牌色取自产品 favicon（暖陶色 #E0795A → #C96442）
├── script.js       # 移动端菜单、滚动渐显、回到顶部
├── assets/
│   └── favicon.svg # 站点图标 / Logo（复制自 frontend/public/favicon.svg）
└── README.md
```

## 关于占位素材

按需求，当前产品截图区域使用的是 **CSS 排版占位 mockup**（窗口、文档、表格、Artifact、多 Agent 等），
便于先确认整体排版与配色。后续可替换为真实素材：

项目内已有可用截图与动图（位于仓库 `docs/readme/`）：

- `openyak-workflow-artifacts.gif` — 上传文件 → 结构化答案 + 可复用产物
- `openyak-memo-to-brief.gif` — 备忘录 → 高管简报
- `openyak-budget-analysis.png` — 表格预算分析
- `openyak-artifact-panel.png` — 产物面板
- `openyak-multi-agent-task-batch.png` — 多 Agent 任务批次
- `openyak-auto-compress.gif` / `openyak-long-context.png` — 长上下文

替换方式示例（以工作流一为例）：把对应 `.workflow__media` 内的占位 `<div class="mock ...">`
换成真实图片即可：

```html
<div class="workflow__media">
  <img src="assets/memo-to-brief.gif" alt="备忘录到高管简报" loading="lazy" />
</div>
```

把素材复制进来后再引用：

```bash
cp docs/readme/openyak-memo-to-brief.gif website/assets/
```

## 可调整项

- **品牌色**：改 `styles.css` 顶部 `:root` 里的 `--brand` / `--brand-2`。
- **下载链接**：搜索 `releases/latest`，已统一指向 GitHub Release 页。
- **文案**：均在 `index.html` 内，内容基于仓库 `README.zh-CN.md`。
