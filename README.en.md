<div align="center">
  <img src="docs/assets/banner.svg" alt="Nodus — Your ideas. Your decisions. Real deliverables." width="100%" />
  <br /><br />
  <a href="https://github.com/alexwilliamclerk/Nodus/releases"><img src="https://img.shields.io/github/v/release/alexwilliamclerk/Nodus?style=flat-square&amp;color=b57858" alt="Latest release" /></a>
  <a href="https://github.com/alexwilliamclerk/Nodus/actions/workflows/ci.yml"><img src="https://github.com/alexwilliamclerk/Nodus/actions/workflows/ci.yml/badge.svg" alt="Checks" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-607d70?style=flat-square" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/desktop-macOS%20%7C%20Windows%20%7C%20Linux-72665e?style=flat-square" alt="macOS, Windows and Linux" />
  <p><a href="README.md">简体中文</a> · <a href="README.en.md">English</a></p>
</div>

<div align="center">

**Turn an idea into something you can actually deliver.**

Choose a direction. Build with AI. Review the work. Make it yours.

[Download](#download) · [Get started](#get-started) · [Documentation](docs/guide.md) · [Contribute](CONTRIBUTING.md) · [Issues](https://github.com/alexwilliamclerk/Nodus/issues)

</div>

---

Nodus is a desktop AI workspace built around **decisions and feedback**. Describe a goal, refine it through dynamic choices, and work with an agent to produce a website, report, presentation, Python project, or descriptive data analysis.

Requirements, choices, deliverable versions, and feedback stay together. You can revisit decisions, inspect actual files, and see which requirements still need your judgment.

![The Nodus desktop workspace with a sample portfolio planning task](docs/assets/workspace.jpg)

<p align="center"><sub>Actual application UI with synthetic content and a mocked planning response. No private conversations or model credentials are shown. The current application interface is Chinese.</sub></p>

## Built for collaboration

| | |
| --- | --- |
| **Plan before making changes** | `/plan` waits for your choices and confirmation; `/goat` can work within explicitly authorized scope. |
| **Keep requirements editable** | Submitted requirements are stored separately, with sources and change history. They remain user task data. |
| **Preview, revise, restore** | Review files and versions, give feedback, and restore work into a new version. |
| **Inspect the evidence** | File checks, model-assisted review, and human acceptance are distinct. Unverified requirements remain unverified. |
| **Bring your model connection** | Implemented provider entries include DeepSeek, Kimi, GLM, MiniMax, and Qwen. Keys are session-only by default. |
| **Keep your deliverables** | Export a selected version into a local directory and back up tasks without saved application credentials. |

## Download

| Platform | Installer |
| --- | --- |
| macOS · Apple Silicon | [Download DMG](https://github.com/alexwilliamclerk/Nodus/releases/latest/download/Nodus-mac-arm64.dmg) |
| Windows · x64 | [Download installer](https://github.com/alexwilliamclerk/Nodus/releases/latest/download/Nodus-windows-x64.exe) |
| Linux · x64 | [Download AppImage](https://github.com/alexwilliamclerk/Nodus/releases/latest/download/Nodus-linux-x64.AppImage) |

No separate Node.js or Pi CLI installation is needed for packaged apps. You need valid credentials for your chosen model service. Python checks and data analysis require a local Python 3 installation.

**macOS — download and open the installer:**

```bash
curl -fL --retry 3 'https://github.com/alexwilliamclerk/Nodus/releases/latest/download/Nodus-mac-arm64.dmg' -o "$HOME/Downloads/Nodus.dmg" && open "$HOME/Downloads/Nodus.dmg"
```

Drag Nodus into Applications after opening the disk image.

**Windows PowerShell — download and launch setup:**

```powershell
$ErrorActionPreference='Stop'; Invoke-WebRequest 'https://github.com/alexwilliamclerk/Nodus/releases/latest/download/Nodus-windows-x64.exe' -OutFile "$env:TEMP\Nodus-Setup.exe"; Start-Process "$env:TEMP\Nodus-Setup.exe"
```

**Linux x64 — download into your user application directory and launch:**

```bash
mkdir -p "$HOME/.local/bin" && curl -fL --retry 3 'https://github.com/alexwilliamclerk/Nodus/releases/latest/download/Nodus-linux-x64.AppImage' -o "$HOME/.local/bin/Nodus.AppImage" && chmod +x "$HOME/.local/bin/Nodus.AppImage" && "$HOME/.local/bin/Nodus.AppImage"
```

AppImage may require a FUSE runtime from your Linux distribution. Desktop compatibility has not yet been tested on a clean Linux installation.

> Builds are not formally developer-signed or notarized. Clean-machine Windows and Linux validation is pending. Intel Mac, Windows ARM, and Linux ARM prebuilt releases are not currently provided. During the first publication, downloads become available after the [release workflow](https://github.com/alexwilliamclerk/Nodus/actions/workflows/release.yml) succeeds. See [Releases](https://github.com/alexwilliamclerk/Nodus/releases) for versions and SHA-256 checksums.

## Get started

1. Add and verify a model connection in settings.
2. Describe a deliverable, attach source materials, and choose a local output directory.
3. Choose a direction in `/plan`, add requirements, then confirm production.
4. Preview the result, inspect checks, request revisions, or accept a version.

`/goat` allows up to **three production attempts per submission**. It stops on missing prerequisites, cancellation, or its attempt limit. Restarting the app does not resume paid calls automatically.

## Deliverables and boundaries

| Type | Output | Current scope |
| --- | --- | --- |
| Website | HTML, CSS, JavaScript, local assets | Local preview and reference checks; no full backend or deployment |
| Research report | Markdown and source list | Structure and source-status checks; no online fact verification |
| Presentation | PPTX and preview | Text titles, bullets, and speaker notes |
| Python project | Source, dependencies, instructions | AST syntax checks; no automatic execution of generated code |
| Data analysis | Input snapshots, code, statistics, explanation | Descriptive statistics; input data and local Python required |

PDF/DOCX input supports text extraction, not OCR or layout reconstruction. Image understanding requires a vision-capable model. Arbitrary DOCX/XLSX output and unrestricted media layout are not supported.

## Data and credentials

Tasks and files are stored locally. Materials sent to the selected model provider **leave the device**; local storage does not imply offline inference. API keys remain in memory unless you explicitly choose encrypted persistence. On macOS, saved connections are restored only on request.

Provider support does not imply that every model, account, tool, or vision capability has been tested. Read the [user guide](docs/guide.md) and [security notes](SECURITY.md).

## Develop locally

Requires Node.js 24 and pnpm 11.19.0. Python checks and analysis need Python 3.10+.

```bash
git clone https://github.com/alexwilliamclerk/Nodus.git
cd Nodus
pnpm install --frozen-lockfile --ignore-scripts
node node_modules/electron/install.js
pnpm start
```

The app requires Electron; opening the HTML file in a browser is not supported. See [development](docs/development.md), [contributing](CONTRIBUTING.md), and [changes](CHANGELOG.md).

## Credits and license

Built with [Electron](https://www.electronjs.org/) and [Pi](https://github.com/earendil-works/pi). Repository presentation draws inspiration from [Dify](https://github.com/langgenius/dify); Nodus is an independent project.

Nodus source is distributed under the [MIT License](LICENSE). Dependencies retain their respective licenses.
