<div align="center">
  <img src="docs/assets/banner.svg" alt="Nodus — Your ideas. Your decisions. Real deliverables." width="100%" />
  <br /><br />
  <a href="https://github.com/alexwilliamclerk/Nodus/releases"><img src="https://img.shields.io/github/v/release/alexwilliamclerk/Nodus?style=flat-square&amp;color=b57858" alt="Latest release" /></a>
  <a href="https://github.com/alexwilliamclerk/Nodus/actions/workflows/ci.yml"><img src="https://github.com/alexwilliamclerk/Nodus/actions/workflows/ci.yml/badge.svg" alt="Checks" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-607d70?style=flat-square" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/desktop-macOS%20%7C%20Windows%20%7C%20Linux-72665e?style=flat-square" alt="macOS, Windows and Linux" />
  <p><a href="README.zh-CN.md">简体中文</a> · <a href="README.md">English</a></p>
</div>

<div align="center">

**从一个想法，到一份真正可交付的作品。**

先把方向想清楚，再与 AI 一起制作、预览和改进。

[下载安装](#下载安装) · [快速开始](#快速开始) · [使用手册](docs/guide.md) · [参与贡献](CONTRIBUTING.md) · [反馈问题](https://github.com/alexwilliamclerk/Nodus/issues)

</div>

---

Nodus 是一个以**动态选择与持续反馈**为核心的 AI 桌面工作台。你可以用自然语言描述目标，通过选项逐步明确需求，再让 Agent 制作网站、报告、演示文稿、Python 工程或数据分析。

选择、任务要求、作品版本和反馈保存在同一个工作空间中。你决定方向，也能回看为什么这样做、实际交付了什么，以及哪些要求还需要判断。

![Nodus 真实桌面界面：需求、任务规则与四种可选方向](docs/assets/workspace.jpg)

<p align="center"><sub>当前应用的真实界面截图；使用合成示例与模拟规划响应，没有使用私人对话或真实模型凭据。</sub></p>

## 为什么使用 Nodus

<table>
<tr>
<td width="50%"><h3>先想清楚，再动手</h3><p>默认 <code>/plan</code> 模式先提供方案。选择、补充、确认之后才制作；也可使用 <code>/goat</code> 在授权范围内自主推进。</p></td>
<td width="50%"><h3>要求不只留在聊天里</h3><p>已提交要求独立保存，可查看来源、修改、停用与恢复。规则作为用户任务数据参与后续规划和执行。</p></td>
</tr>
<tr>
<td><h3>作品可以预览，也可以反悔</h3><p>查看真实文件、比较版本、评价与修订。回改上游选择会使相关下游决定失效，恢复作品则创建新版本。</p></td>
<td><h3>看清依据，再接受交付</h3><p>文件检查、模型辅助审查与人工判断分别呈现。没有可靠证据的要求保持待确认，不把生成文件等同于完成目标。</p></td>
</tr>
<tr>
<td><h3>接入自己的模型</h3><p>管理多条模型连接，支持 OpenAI（GPT）、Anthropic（Claude）、DeepSeek、Kimi、GLM、MiniMax、Qwen 的已实现入口。凭据默认仅在本次运行中使用。</p></td>
<td><h3>作品交到你的目录</h3><p>选择本地交付目录，导出具体版本；任务、附件、决定与作品可备份。应用凭据不进入备份包。</p></td>
</tr>
</table>

在“设置与模型连接”的“外观主题”中，可选浅色、深色或跟随系统。选择会在重启后保留；作品预览保持作品原有配色。

在同一设置页的“界面语言”中，可选简体中文或 English。切换后界面和系统菜单立即更新，重启后保留选择；已有对话和作品保留原文。新生成的动态问题与选项会尽量使用所选界面语言，交付文件仍按任务要求。

同一设置页可以“检查更新”：Windows 安装版和 Linux AppImage 版在校验后可经确认安装并重启；Linux 可选择删除旧 AppImage，或备份旧程序。macOS 的更新按钮会打开对应版本的 GitHub 发布页，下载 DMG 后可在 Finder 选择替换旧应用。更新只处理程序文件，保留任务、作品与连接数据。Windows 版还提供卸载入口；如果 `Uninstall Nodus.exe` 报完整性错误，请按 [Windows 卸载修复说明](docs/windows-uninstall.zh-CN.md)处理。

## 下载安装

安装包内置 Electron 与 Pi SDK，**无需先安装 Node.js 或 Pi CLI**。模型调用需要自行配置有效的服务商凭据。

| 平台 | 下载 | 安装 |
| --- | --- | --- |
| macOS · Apple Silicon | `Nodus-v{版本}-macOS-arm64.dmg` | [最新发布页](https://github.com/alexwilliamclerk/Nodus/releases/latest)，打开后拖入 Applications |
| Windows · x64 | `Nodus-v{版本}-Windows-x64.exe` | [最新发布页](https://github.com/alexwilliamclerk/Nodus/releases/latest)，运行安装向导 |
| Linux · x64 | `Nodus-v{版本}-Linux-x86_64.AppImage` | [最新发布页](https://github.com/alexwilliamclerk/Nodus/releases/latest)，赋予执行权限后运行 |
| 其他平台 | [从源码构建](docs/development.md) | 暂无 Intel Mac、Windows ARM 或 Linux ARM 的预构建包 |

新发布的安装包文件名会写明版本、系统和架构；下方一句话命令使用兼容旧版的固定下载链接，但保存到本机时会带上版本号。

也可以复制一行命令，**下载并打开安装器**：

**macOS（终端）**

```bash
tag=$(curl -fsSL -o /dev/null -w '%{url_effective}' 'https://github.com/alexwilliamclerk/Nodus/releases/latest' | sed 's#.*/##') && file="$HOME/Downloads/Nodus-$tag-macOS-arm64.dmg" && curl -fL --retry 3 'https://github.com/alexwilliamclerk/Nodus/releases/latest/download/Nodus-mac-arm64.dmg' -o "$file" && open "$file"
```

**Windows（PowerShell）**

```powershell
$ErrorActionPreference='Stop'; $release=Invoke-RestMethod 'https://api.github.com/repos/alexwilliamclerk/Nodus/releases/latest'; $file=Join-Path $env:TEMP "Nodus-$($release.tag_name)-Windows-x64.exe"; Invoke-WebRequest 'https://github.com/alexwilliamclerk/Nodus/releases/latest/download/Nodus-windows-x64.exe' -OutFile $file; Start-Process $file
```

**Linux x64（终端）：安装后可选择清理旧版 AppImage**

```bash
mkdir -p "$HOME/.local/bin" && curl -fL --retry 3 'https://raw.githubusercontent.com/alexwilliamclerk/Nodus/main/scripts/install-linux.sh' -o "$HOME/.local/bin/Nodus-install-linux.sh" && bash "$HOME/.local/bin/Nodus-install-linux.sh"
```

Linux AppImage 可能需要发行版提供 FUSE 运行库；不同桌面环境的兼容性仍需实机验证。

> 安装包尚未完成正式开发者签名与 macOS 公证，系统可能提示来源验证。Windows 和 Linux 尚未完成干净系统实机验收。全部版本与 SHA-256 校验值见 [Releases](https://github.com/alexwilliamclerk/Nodus/releases)。

## 快速开始

1. **连接模型。** 打开“模型连接”，添加提供商、模型 ID 和 API Key，验证连接。
2. **描述目标。** 新建对话，说明想得到的作品，按需添加文件并选择本地交付目录。
3. **选择方向。** 在默认 `/plan` 模式下选择方案、补充要求，确认后开始制作。
4. **查看与改进。** 打开预览，查看检查依据、评价或发起修改；满意后接受所选版本。

```text
/plan 为我的设计作品制作一个简洁的个人网站
/plan 把这些材料整理成一份调研报告，明确标出尚未核实的内容
/goat 根据附件 CSV 生成描述统计报告
```

| | `/plan` · 默认 | `/goat` · 自主执行 |
| --- | --- | --- |
| 何时开始制作 | 选择方案并提交确认后 | 明确提交自主执行请求后 |
| 如何推进 | 用户逐步决定 | Agent 在授权范围内采用方案、制作与检查 |
| 如何停止 | 可随时停止、回改或暂存 | 可随时停止；每次提交最多 3 次制作尝试 |

重启应用不会自动恢复付费模型调用。中途预览可设置为每 3、5、8 次已提交修改后生成一版，或保持手动确认。

## 可以交付什么

| 类型 | 交付文件 | 当前能力范围 |
| --- | --- | --- |
| 网站 | HTML、CSS、JavaScript 与本地资源 | 本地预览与资源检查；不包含完整后端或自动部署 |
| 调研报告 | Markdown 与来源清单 | 结构与来源状态检查；联网来源不等于独立事实核实 |
| 演示文稿 | PPTX 与预览 | 以文字标题、要点和备注为主 |
| Python 工程 | 源码、依赖文件与说明 | AST 语法检查；不自动安装依赖或执行生成代码 |
| 数据分析 | 输入快照、代码、统计结果与说明 | 描述统计；需要数据材料与本机 Python 3 |
| Word 文档 | DOCX 与可编辑 JSON 源文件 | 文字段落与基础表格 |
| Excel 工作簿 | XLSX 与可编辑 JSON 源文件 | 基础工作表、文字、数字与布尔单元格 |
| 源代码 | 源文件与 README | 检查文件；不执行生成代码 |

PDF/DOCX 材料支持文字提取，不包含 OCR 或版式还原。图片理解需要支持视觉的模型。Word/Excel 目前只支持基础结构，不支持复杂版式或自由媒体排版。

## 本地数据与模型服务

任务和作品保存在本机；**发送给所选模型的材料会离开本机**。本地保存不代表离线推理。

API Key 默认只在内存中使用。主动选择“在本机记住连接”时才加密保存；macOS 已保存连接由用户主动恢复。不同地区、开放平台与 Coding Plan 的凭据不可混用。接入某个提供商不代表该提供商的所有模型、工具或视觉能力都已验证。

更多信息：[模型连接与数据备份](docs/guide.md#模型连接) · [安全说明](SECURITY.md)

## 从源码运行

需要 Node.js 24、pnpm 11.19.0；Python 工程检查与数据分析还需要 Python 3.10+。

```bash
git clone https://github.com/alexwilliamclerk/Nodus.git
cd Nodus
pnpm install --frozen-lockfile --ignore-scripts
node node_modules/electron/install.js
pnpm start
```

应用需要 Electron 桌面环境，不能直接在浏览器打开根目录 HTML。[开发、测试与构建说明 →](docs/development.md)

## 文档与贡献

- [使用手册](docs/guide.md)：模式、任务规则、预览、模型连接与备份。
- [开发指南](docs/development.md)：代码结构、测试、构建与 Release。
- [版本记录](CHANGELOG.md)：当前版本的功能与验证边界。
- [贡献指南](CONTRIBUTING.md)：报告问题与提交改进。

欢迎提交可复现的问题、文档改进和聚焦的 Pull Request。展示效果之外，我们同样关心要求是否保留、真实文件是否可用，以及未验证事项是否说清楚。

## 致谢与许可

Nodus 基于 [Electron](https://www.electronjs.org/) 和 [Pi](https://github.com/earendil-works/pi) 构建。仓库介绍结构参考 [Dify](https://github.com/langgenius/dify)，品牌与产品实现相互独立。

项目源码遵循 [MIT License](LICENSE)。第三方依赖保留各自许可证。
