# Changelog

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
