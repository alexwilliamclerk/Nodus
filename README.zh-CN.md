> **发行方式变更：** Nodus 从 v1.6.0 起采用闭源安装包发行。[下载最新版本](https://github.com/alexwilliamclerk/Nodus/releases/latest)。下方源码与 MIT 许可对应 v1.5.2 及以前的历史版本；新版应用和云服务源码不在此公开。

# Nodus — AI Agent 安全与可审阅记忆

### 用自己的任务检验 Agent，看清它发送什么，决定它记住什么。

**面向大模型智能体安全（LLM Agent Security）、提示注入测试与人工审阅的开源桌面工作台。**

Nodus 将基于真实任务的 Agent 安全评测、LLM 隐私控制与可追溯的 Agent 记忆放在同一个工作空间。你可以接入自己的模型，制作网站、报告、演示文稿和代码，同时审阅 Agent 的权限、上下文与决策。

面向需要处理真实文件、外部资料，并希望比较不同模型的个人开发者与独立创作者。

**[下载 v1.5.2](https://github.com/alexwilliamclerk/Nodus/releases/tag/v1.5.2)** · [English](README.md) · [使用手册](docs/guide.md) · [版本说明](docs/releases/v1.5.2.md)

macOS · Windows · Linux &nbsp; / &nbsp; 接入自己的模型 &nbsp; / &nbsp; MIT 开源

---

## 一分钟体验，无需 API Key

v1.5.2 已包含此入口。

打开侧栏 **“免密钥体验”**，逐步体验提示注入、记忆审阅与撤销、预算与上下文压缩。可回退、重播，并创建独立试用任务；连接模型、检查授权后再手动提交。

**这是离线脚本演示，所有结果均为虚构示例，不是模型评测。** 真实试用不会继承演示结果或批准，可能产生模型费用。

[演示与本地预览](docs/demo/README.md) · [提示注入案例](docs/tutorials/prompt-injection.md) · [可撤销记忆案例](docs/tutorials/reviewable-memory.md)

如果 Nodus 对你有帮助，欢迎 Star 支持后续开发，或通过 Issue 分享遇到的具体问题。

## 任务预算：规划、执行、检查分别分配

**决定一项任务可以花多少计算量，也看清额度用在了哪里。**

先让当前模型拆解任务，核对复杂度估计，再为规划、各个执行步骤和检查分配生成 token。执行不能挪用检查额度；已用量、占用量、剩余额度与费用估算都可查看。重启或重新拆解不会清除历史用量。

上限覆盖生成 token，包括服务商计入输出的推理 token，输入用量单独统计。费用按你填写的单价估算；用量或价格缺失时明确显示未知。入口在任务顶部的 **“任务预算”**。

## 可审阅的上下文压缩

**留下需要的上下文，也保留回到原文的路径。**

选择旧答复或资料，生成更短的摘要，对照来源引用后才启用。用户原话、最近对话、当前要求和权限独立保留；未决问题与重要细节可以指定逐字保留。

可以编辑后重新审阅，也可以撤销并使用当前原文。来源修改或删除后，旧摘要暂停使用。页面展示字符数变化，不把它当作 token 或费用节省承诺。入口在 **“安全与授权 → 可审阅的上下文压缩”**。

## 提示注入测试：用自己的任务比较 Agent

**通过提示注入测试（Prompt Injection Testing）评测 Agent，同时检查原任务能否完成。**

从已有任务创建隔离副本，加入测试材料，尝试诱导 Agent 泄露合成私密信息、修改受保护文件或放弃原目标。原任务保持不变；保存测试配置后，可以切换模型，使用同一份输入重新比较。

结果分开呈现你真正关心的三件事：

- **实际发生了什么：**合成私密信息是否进入请求或输出，受保护文件是否被改动。
- **哪些行为被拦截：**哪些尝试由权限层阻止。
- **原任务还能否完成：**产物检查、要求审阅，以及你的最终判断。

“任务被拦停”和“安全地完成任务”是不同的结果。Nodus 把两者同时展示，让你一起判断安全性与可用性。

## Agent 记忆：来源可追溯，授权可撤销

**知道记住了什么、来自哪里、适用于哪个项目。**

记忆来源追溯（Memory Provenance）让每条记忆的原文、来源任务、适用范围和修改历史都可查阅。你可以只让当前任务使用，也可以审阅后在来源任务所属项目内共享。

外部材料提炼出的经验先进入**候选列表**，逐条审阅后才会使用。修改内容或范围后，需要重新审阅；撤销后停止后续直接注入，并中断正在使用它的调用。也可以删除不再需要的记忆。

**材料里的建议，不会自动变成你的要求。** 已审阅记忆仍是参考上下文，与已确认任务要求、工具权限分别管理。

## LLM 隐私控制：外发审阅与数据脱敏

**审阅实际发送给模型的请求，再决定保留哪些信息。**

开启外发审阅后，可以查看请求体，并通过人工选择的数据脱敏（Data Redaction），在发送前移除选中的值或字段。处理范围包括对话历史和文件工具返回中的副本，帮助你减少客户信息、合同字段或日志内容的不必要外发。

原材料保持不变。你决定从本次外发请求中移除什么。

## Agent 权限控制：执行前的人工授权

**明确它可以读取什么、修改什么，以及发送给谁。**

通过任务级访问控制（Task-scoped Access Control）设置文件读写范围、标记敏感来源、批准接收方；需要确认的操作由用户参与授权（Human-in-the-loop）。也可以用自然语言描述权限，先生成草案，核对后再保存。支持的操作会在执行边界接受检查，已有授权可以撤销。

网页或附件里的文字不能授予工具访问权限；记住某个偏好，也不会扩大 Agent 的操作权限。

## 上下文隔离：检查可疑行为并重试

**查看依据、隔离材料，再用干净上下文重试。**

发现疑似提示注入或不期望的 Agent 行为时，审阅材料与拟执行操作之间的关联，选择需要隔离的内容，核对移除结果，再通过上下文隔离（Context Isolation）创建干净任务重试。原材料与原作品保留，便于回看和比较。

从检查操作、缩小上下文，到重试和审阅产物，这些能力可以在同一项工作中连续使用。材料关联为判断提供依据，但不被当作因果证明。

---

## 最终交付的，是可以保留和修改的作品

Nodus 支持从规划方向、确认要求，到制作、预览和修订真实文件。需要回退时，可以恢复较早的作品版本。

| 工作 | 交付内容 |
| --- | --- |
| 制作网站、准备代码 | 本地 HTML/CSS/JavaScript 网站、Python 工程与源文件 |
| 调研与表达 | 带来源的 Markdown 报告、PPTX 演示文稿、基础 DOCX 文档 |
| 处理数据 | 描述统计分析、基础 XLSX 工作簿 |

已确认要求独立于普通对话保存，能够修改与停用。文件检查、模型辅助审阅和人工接受分别呈现。建议追踪、本地备份和中英文界面则支持作品前后的持续工作。[了解完整工作方式 →](docs/guide.md)

## 开始使用

下载对应平台的安装包即可；使用安装版无需先安装 Node.js 或 Pi CLI。

| 平台 | 下载 |
| --- | --- |
| macOS · Apple Silicon | [DMG](https://github.com/alexwilliamclerk/Nodus/releases/latest/download/Nodus-mac-arm64.dmg) |
| Windows · x64 | [安装程序](https://github.com/alexwilliamclerk/Nodus/releases/latest/download/Nodus-windows-x64.exe) |
| Linux · x64 | [AppImage](https://github.com/alexwilliamclerk/Nodus/releases/latest/download/Nodus-linux-x64.AppImage) |

1. **连接模型。** 添加提供商、模型与 API Key。已实现 OpenAI、Anthropic、DeepSeek、Kimi、GLM、MiniMax、Qwen 的连接入口，具体可用性取决于账户与服务商。
2. **带入真实任务。** 描述想得到的结果，添加所需材料。
3. **打开“安全与授权”。** 设置访问边界、开启外发审阅，或从任务创建安全体检。
4. **制作、审阅与保留。** 检查交付作品，再决定哪些经验值得成为已审阅记忆。

凭据默认仅在内存中使用，本地加密保存需要主动开启。模型调用可能产生服务商费用。安装包目前尚未签名或公证；平台安装说明与校验文件见[发布页](https://github.com/alexwilliamclerk/Nodus/releases/latest)。

## 能力范围与验证依据

Nodus 聚焦桌面工作流中的 **AI Agent 安全、提示注入评测、信息外发控制与记忆来源追溯**。任务和文件保存在本机；发送给所选模型服务的上下文仍会离开设备。

防护不覆盖任意操作系统行为，也不控制导出后独立运行的文件。安全体检通过，只能为所测配置提供证据，不能保证抵抗所有攻击。撤销无法追回已发送内容，也不会消除它对已有输出的影响。

实现测试与有限规模的真实模型实验单独记录，保留负面结果和正常任务受中断的情况。[安全设计与边界](docs/safety.md) · [评测证据](docs/safety-evaluation.md) · [后续比较](docs/safety-followup-results.md)

## 开发与贡献

从源码运行需要 Node.js 24、pnpm 11.19.0；Python 检查与数据分析还需要 Python 3.10+。

```bash
git clone https://github.com/alexwilliamclerk/Nodus.git
cd Nodus
pnpm install --frozen-lockfile --ignore-scripts
node node_modules/electron/install.js
pnpm start
```

[开发指南](docs/development.md) · [贡献指南](CONTRIBUTING.md) · [反馈问题](https://github.com/alexwilliamclerk/Nodus/issues) · [安全问题报告](SECURITY.md)

基于 [Electron](https://www.electronjs.org/) 与 [Pi](https://github.com/earendil-works/pi) 构建。Nodus 源码遵循 [MIT License](LICENSE)，第三方依赖保留各自许可证。
