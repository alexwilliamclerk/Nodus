# Changelog

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
