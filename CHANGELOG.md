# Changelog

## 1.5.2

- Added persistent connection verification feedback and a direct start-chat action. Current-model questions use the configured provider/model; ordinary replies default to concise prose.
- Kept short user messages on a natural line, moved message actions out of text flow, and softened scenic backgrounds behind conversations.

- Render Markdown in saved chat messages and streaming replies, including headings, lists, code and tables. Escape raw HTML and prevent automatic image loads.

- Added a bilingual, no-key scripted demo for prompt injection, revocable memory and task budgets/context compression, with back/replay controls and explicit fictional-result labels.
- Added independent trial creation with fictional inputs only, manual submission and model/permission setup links; no automatic calls or imported approvals.
- Added a shared browser demo, recorded desktop walkthrough and two practical tutorials, linked from clean bilingual READMEs.

## 1.5.1

- Added reviewed task decomposition and complexity-weighted generation-token budgets for planning, execution steps and checking, with request-boundary enforcement.
- Added persistent usage, remaining allowance and user-priced cost estimates; missing usage conservatively retains the requested cap. Budget changes, cancellation and exhausted checks stop work without publishing an incomplete artifact.
- Added reviewable context compression with source quotations, exact retained details, manual/model drafts, explicit approval, editing and revocation. Original task data and permission labels remain intact.
- Invalidated summaries when their sources change or are deleted, and preserved original-history backups. Request review receives the compressed body exactly as it will be dispatched.
- Updated bilingual READMEs and the guide for both features without adding screenshots. Local verification: 252 automated tests and scripted desktop checks; no paid-model efficiency or quality claim.

## 1.5.0

- Added task-scoped file permissions, recipient approvals, revocable grants and reviewable natural-language permission drafts.
- Added source/action evidence, selected-material isolation and clean task retries.
- Added opt-in review and minimization of the actual outgoing model request.
- Added safety checks on isolated copies of user tasks, with saved model comparisons and separate safety/utility evidence.
- Added reviewable task/project memory with exact provenance, candidate-only extraction, explicit approval, editing, revocation and deletion.
- Updated English/Chinese READMEs to foreground agent safety, task evaluation, privacy controls and memory boundaries.
- Local development validation: 220 automated tests plus scripted desktop checks; no claim of complete prompt-injection resistance or a real-model safety ranking.

## 1.4.1

- Restored separate, readable user and assistant chat bubbles across the four landscape themes while keeping the conversation canvas transparent.
- Show a compact, bilingual thinking indicator immediately after submission, retain the current activity label, and replace it with streamed output or clear it when the request ends.
- Validated this release with 128 automated tests and packaged Windows installation, upgrade and removal checks. The Windows EXE remains unsigned, so Windows may still warn about or block interactive installation.

## 1.4.0

- Removed the remaining translucent transcript container, including native glass backgrounds and shadows across appearance modes.

- Added opt-in tracking for adopted advice, including editable adoption reasons, public HTTPS sources, manual checks and daily checks while the app runs. Evidence-backed AI assessments distinguish changed conditions, possible original errors and uncertainty.
- Added persisted check history, unread impact alerts, pause/resume, alternative-source search and backup coverage for advice watches.


## 1.3.2

- Added four landscape themes with coordinated colors, preview cards, bilingual names and persistent selection. Existing light, dark and system modes remain available.

- Added deletion of individual chat question/answer pairs, including removal from future reply context.
- Added deletion of current and answered decision questions, invalidating dependent choices and requiring a new execution confirmation.

## 1.3.1

- Added explicit install-and-restart updates for packaged Windows NSIS and Linux AppImage builds, with release metadata and SHA-256 verification. Linux can preserve a backup of the old AppImage; macOS opens the matching GitHub release for a user-selected Finder replacement because automatic updates require a signed app.
- Versioned installer filenames now identify the release, platform, and architecture; stable aliases keep older in-app updaters and one-line download links working.
- Added a Simplified Chinese / English interface switch that persists across restarts while preserving existing conversation and work content.
- Added direct chat, manual deliverable-type recognition, basic Word/Excel and code outputs, optional web search, and OpenAI/Anthropic API connections.
- Shortened ordinary revision decisions and strengthened website navigation and interaction-preservation checks.

## 1.3.0

- Added an in-app update check that downloads the platform installer from Nodus GitHub Releases, verifies its SHA-256, and opens the installer or locates the Linux AppImage.
- Added a Windows uninstall entry in Settings and documented recovery when the local NSIS uninstaller fails its integrity check.
- Added a release build check that installs and uninstalls the Windows installer on a clean runner.

The Windows v1.2.0 uninstaller passed a clean install/uninstall test. A deliberately corrupted copy was restored by moving it aside, reinstalling to the same directory, and uninstalling. This does not establish the cause of failures on every user's device. Installers remain unsigned; clean-machine user acceptance across all Windows configurations is still pending.

## 1.2.0

- Added Light, Dark, and Follow system options in Settings. The chosen theme applies immediately, survives restarts, and also themes native menus and dialogs.
- Kept generated website previews visually independent of the application theme.

The theme was checked in an isolated desktop session across switching, restart, and system preference behavior. Existing unit checks also passed. Platform packages and clean-machine behavior are tracked by the release workflow.

## 1.1.0

Initial public source release of the current Nodus desktop application.

- Plan-first interaction and explicitly authorized autonomous production with a three-attempt limit.
- Editable task requirements with provenance, change history, and file-grounded model-assisted review.
- Website, Markdown report, PPTX, Python project, and descriptive data-analysis deliverables.
- Version preview, user feedback, restoration, and export to a selected local directory.
- Multiple model connections, session-only credentials by default, and task backups excluding application credentials.
- Native file menus, conversation navigation, preview expansion, and configurable preview cadence.

Local source syntax checks and all 87 automated tests passed on September 23, 2026. Mocked-model tests do not establish real-model effectiveness. macOS, Windows, and Linux packages lack formal developer signing; macOS notarization and clean-machine Windows/Linux validation are pending. GitHub-built packages have separate build logs in Actions.
