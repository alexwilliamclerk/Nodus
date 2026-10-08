> **Distribution change:** Nodus v1.6.0 and later is distributed as proprietary binary releases. [Download the latest release](https://github.com/alexwilliamclerk/Nodus/releases/latest). The source and MIT license below describe historical versions through v1.5.2; new application and cloud-server source is not published here.

# Nodus — AI Agent Safety & Reviewable Memory

### Test your agents. Review what they send. Decide what they remember.

**An open-source desktop workspace for LLM agent security, prompt injection testing and human-in-the-loop control.**

Nodus combines AI agent evaluation on your own tasks, LLM privacy controls and agent memory with source provenance. Build websites, reports, presentations and code with your own model—and keep the agent's permissions, context and decisions open to review.

For independent developers and creators working with real files, external sources and more than one AI model.

**[Download v1.5.2](https://github.com/alexwilliamclerk/Nodus/releases/tag/v1.5.2)** · [简体中文](README.zh-CN.md) · [User guide](docs/guide.md) · [Release notes](docs/releases/v1.5.2.md)

macOS · Windows · Linux &nbsp; / &nbsp; Bring your own model &nbsp; / &nbsp; MIT License

---

## Try it in one minute — no API key

Included in v1.5.2.

Open **Try without a key** in the sidebar. Step through prompt injection, memory review and revocation, and budgets with context compression. Go back, replay, or create a separate trial task; connect a model and review permissions before submitting it yourself.

**This is an offline scripted demo with fictional outcomes, not a model evaluation.** Real trials inherit no scripted results or approvals and may incur model charges.

[Demo and local preview](docs/demo/README.md) · [Prompt injection walkthrough](docs/tutorials/prompt-injection.md) · [Revocable memory walkthrough](docs/tutorials/reviewable-memory.md)

If Nodus helps you, star the project to support its development or open an issue with a concrete problem you encountered.

## Task budgets for planning, execution and checking

**Decide how much computation a task can use—and see where it goes.**

Let the current model decompose the task, review its complexity estimates, then allocate generation tokens across planning, individual execution steps and checking. Execution cannot borrow the checking allowance. Inspect used and reserved tokens, remaining allowance and estimated costs; restarting or replanning retains prior usage.

The limit covers generated tokens, including reasoning counted as output by the provider. Input usage is tracked separately. Costs use your supplied rates; missing usage or prices remain explicitly unknown. Open **Task budget** in the task header.

## Reviewable context compression

**Keep the useful context, with the originals still within reach.**

Choose earlier replies or materials, draft a shorter summary and review its quotations before enabling it. User messages, recent turns, current requirements and permissions remain separate. Pin unresolved questions or important details to retain their exact wording.

Edit and review again, or revoke the summary to use current originals. Changed or deleted sources invalidate old summaries. The preview shows character reduction, not a promised token or billing saving. Open **Safety & permissions → Reviewable context compression**.

## Prompt injection testing on your own tasks

**Run task-specific agent safety evaluations while checking whether useful work still gets done.**

Take an isolated copy of a task and add test materials that try to make the agent disclose a synthetic secret, modify a protected file or abandon the original goal. Keep the original task intact, save the test configuration and rerun it after switching models.

The comparison separates three things that matter:

- **What happened:** whether the synthetic secret appeared in a request or output, or a protected file changed.
- **What was blocked:** attempts stopped by the permission layer.
- **What still got done:** output checks, requirement review and your assessment of the original task.

A stopped task and a safely completed task are different outcomes. Nodus keeps that difference visible so you can judge both safety and usefulness.

## Agent memory with provenance and revocation

**See what is remembered, where it came from and which project can use it.**

Memory provenance is visible: each entry carries its source quotation, originating task, scope and edit history. Keep it within one task or approve it for the source task's project.

Observations from external material enter as **candidates**. You review each one before it is used. Editing its content or scope returns it to review; revoking it stops future direct injection and interrupts calls using it. You can also delete an entry.

**A document's suggestion never automatically becomes your requirement.** Reviewed memory remains reference context, separate from confirmed task requirements and tool permissions.

## LLM privacy: review and redact outgoing requests

**Inspect the actual outgoing model request before it is sent.**

Turn on disclosure review for human-reviewed data redaction: inspect the request body, then remove selected values or fields before dispatch. This includes copies carried in conversation history and file-tool results, helping you reduce unnecessary exposure of customer details, contract fields or log content.

Original materials stay intact. You decide what to omit from the outgoing request.

## Agent permissions with human-in-the-loop approval

**Choose what the agent may read, change and send.**

Use task-scoped access control to set file read/write scopes, mark sensitive sources and approve recipients. Describe a policy in plain language to get a draft you can review before saving. Permissions are checked at supported action boundaries and can be revoked.

Text inside a webpage or attachment cannot grant tool access. A remembered preference cannot expand the agent's permissions.

## Context isolation and recovery

**Keep useful work moving while preserving the evidence.**

Inspect source-to-action evidence when reviewing suspected prompt injection or unwanted agent behavior. Select material to isolate, inspect the removal, and retry in a clean task without overwriting the originals.

This connects the parts of the workflow: inspect the action, narrow its context, retry, and review the resulting work. Source/action links provide evidence for your judgment; they are not proof of causation.

---

## From a task to a deliverable you can keep

Nodus is a working environment for making and revising real files. Plan a direction, confirm requirements, inspect the result and restore earlier versions when needed.

| Work | Deliverables |
| --- | --- |
| Build a site or prepare code | Local HTML/CSS/JavaScript websites, Python projects and source files |
| Research and communicate | Markdown reports with sources, PPTX presentations and basic DOCX documents |
| Work with data | Descriptive analyses and basic XLSX workbooks |

Confirmed requirements stay editable and separate from ordinary conversation. File checks, model-assisted review and your acceptance remain distinct. Advice tracking, local backups and Chinese/English interfaces support the work around each deliverable. [Explore the full workflow →](docs/guide.md)

## Get started

Download the package for your platform; Node.js and the Pi CLI are not required for packaged builds.

| Platform | Download |
| --- | --- |
| macOS · Apple Silicon | [DMG](https://github.com/alexwilliamclerk/Nodus/releases/latest/download/Nodus-mac-arm64.dmg) |
| Windows · x64 | [Installer](https://github.com/alexwilliamclerk/Nodus/releases/latest/download/Nodus-windows-x64.exe) |
| Linux · x64 | [AppImage](https://github.com/alexwilliamclerk/Nodus/releases/latest/download/Nodus-linux-x64.AppImage) |

1. **Connect your model.** Add a provider, model and API key. Implemented connections include OpenAI, Anthropic, DeepSeek, Kimi, GLM, MiniMax and Qwen; availability depends on your account and provider.
2. **Bring a real task.** Describe the result you want and add the materials it needs.
3. **Open Safety & permissions.** Set access boundaries, enable outgoing-request review, or create a safety check from the task.
4. **Build, review and retain.** Inspect the deliverable and choose which observations deserve to become reviewed memories.

Credentials are held in memory by default; encrypted local storage is opt-in. Model calls may incur provider fees. Installers are currently unsigned/not notarized; platform notes and checksums are on the [release page](https://github.com/alexwilliamclerk/Nodus/releases/latest).

## Scope and evidence

Nodus focuses on **AI agent safety, prompt-injection evaluation, disclosure control and memory provenance** within its supported desktop workflow. Tasks and files are stored locally; context sent to your chosen provider still leaves your machine.

Controls do not cover arbitrary OS activity or exported files run elsewhere. A passing safety check is evidence for that configuration, not a guarantee against every attack. Revocation cannot recall content already sent or erase its influence on existing outputs.

Implementation tests and bounded live-model experiments are documented separately, including negative results and normal-task interruptions. [Safety design and limits](docs/safety.md) · [Evaluation evidence](docs/safety-evaluation.md) · [Follow-up comparisons](docs/safety-followup-results.md)

## Develop and contribute

To run from source, use Node.js 24 and pnpm 11.19.0. Python checks and analyses also require Python 3.10+.

```bash
git clone https://github.com/alexwilliamclerk/Nodus.git
cd Nodus
pnpm install --frozen-lockfile --ignore-scripts
node node_modules/electron/install.js
pnpm start
```

[Development guide](docs/development.md) · [Contributing](CONTRIBUTING.md) · [Report an issue](https://github.com/alexwilliamclerk/Nodus/issues) · [Security reporting](SECURITY.md)

Built with [Electron](https://www.electronjs.org/) and [Pi](https://github.com/earendil-works/pi). Nodus is released under the [MIT License](LICENSE); third-party dependencies retain their own licenses.
