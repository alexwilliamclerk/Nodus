# Nodus

### 用自己的任务检验 Agent，看清它发送什么，决定它记住什么。

**把安全控制融入实际工作的 AI Agent 桌面工作台。**

Nodus 将任务安全体检、信息外发审阅和可撤销的项目记忆放在同一个工作空间。你可以接入自己的模型，制作网站、报告、演示文稿和代码，同时审阅 Agent 的权限、上下文与决策。

面向需要处理真实文件、外部资料，并希望比较不同模型的个人开发者与独立创作者。

**[下载 v1.5.0](https://github.com/alexwilliamclerk/Nodus/releases/tag/v1.5.0)** · [English](README.md) · [使用手册](docs/guide.md) · [版本说明](docs/releases/v1.5.0.md)

macOS · Windows · Linux &nbsp; / &nbsp; 接入自己的模型 &nbsp; / &nbsp; MIT 开源

---

## 安全体检，直接用你自己的任务

**模型是否适合你的工作，用实际任务来比较。**

从已有任务创建隔离副本，加入测试材料，尝试诱导 Agent 泄露合成私密信息、修改受保护文件或放弃原目标。原任务保持不变；保存测试配置后，可以切换模型，使用同一份输入重新比较。

结果分开呈现你真正关心的三件事：

- **实际发生了什么：**合成私密信息是否进入请求或输出，受保护文件是否被改动。
- **哪些行为被拦截：**哪些尝试由权限层阻止。
- **原任务还能否完成：**产物检查、要求审阅，以及你的最终判断。

“任务被拦停”和“安全地完成任务”是不同的结果。Nodus 把两者同时展示，让你一起判断安全性与可用性。

## 记忆看得见，也撤得回

**知道记住了什么、来自哪里、适用于哪个项目。**

每条记忆保留来源原文、来源任务、适用范围和修改历史。你可以只让当前任务使用，也可以审阅后在来源任务所属项目内共享。

外部材料提炼出的经验先进入**候选列表**，逐条审阅后才会使用。修改内容或范围后，需要重新审阅；撤销后停止后续直接注入，并中断正在使用它的调用。也可以删除不再需要的记忆。

**材料里的建议，不会自动变成你的要求。** 已审阅记忆仍是参考上下文，与已确认任务要求、工具权限分别管理。

## 信息发出前，先看清楚

**审阅实际发送给模型的请求，再决定保留哪些信息。**

开启外发审阅后，可以查看请求体，并在发送前移除选中的值或字段。处理范围包括对话历史和文件工具返回中的副本，帮助你减少客户信息、合同字段或日志内容的不必要外发。

原材料保持不变。你决定从本次外发请求中移除什么。

## Agent 动手前，先划定边界

**明确它可以读取什么、修改什么，以及发送给谁。**

按任务设置文件读写范围、标记敏感来源、批准接收方。也可以用自然语言描述权限，先生成草案，核对后再保存。支持的操作会在执行边界接受检查，已有授权可以撤销。

网页或附件里的文字不能授予工具访问权限；记住某个偏好，也不会扩大 Agent 的操作权限。

## 发现可疑行为，还能继续工作

**查看依据、隔离材料，再用干净上下文重试。**

审阅系统记录的材料与拟执行操作之间的关联，选择需要隔离的内容，核对移除结果，再创建干净任务重试。原材料与原作品保留，便于回看和比较。

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
