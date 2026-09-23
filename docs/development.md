# Development

## Requirements

Node.js 24, pnpm 11.19.0, and Python 3.10+ for Python/analysis checks. Desktop checks require a graphical session.

```sh
pnpm install --frozen-lockfile --ignore-scripts
node node_modules/electron/install.js
pnpm start
```

## Code map

| Path | Responsibility |
| --- | --- |
| `app.js`, `frontend/`, `index.html`, `styles.css` | UI, choices, requirements, modes, and feedback |
| `electron/` | Window, menus, IPC, preview server, and file dialogs |
| `backend/pi-service.mjs` | Model calls and streamed responses |
| `backend/artifact-service.mjs`, `backend/artifacts.mjs` | Production, versions, and file checks |
| `backend/completion.mjs`, `backend/requirement-audit.mjs` | Completion conditions and model-assisted requirement review |
| `backend/delivery-service.mjs`, `backend/backup.mjs` | Deliverable export and task backup |
| `skills/nodus-requirement-guardian/` | Requirement-preservation instructions loaded by Nodus |

## Checks

```sh
pnpm run check
pnpm test
node tests/delivery-desktop.mjs
node tests/agent-modes-desktop.mjs
```

The first two commands run in CI. Desktop scripts above use synthetic tasks and mocked model responses. Some other historical scripts require prior local tasks or installed applications; `test:desktop` is not a self-contained CI entry point. Real-account scripts may call a paid model and should only be run with intentionally configured test credentials.

## Packages

```sh
pnpm run dist:mac
pnpm run dist:win
pnpm run dist:linux
```

macOS produces an arm64 DMG, Windows an x64 NSIS installer, and Linux an x64 AppImage. A successful build does not prove target-system compatibility.

## GitHub releases

The Release workflow builds the committed source on macOS, Windows, and Linux, checks packaged application files against that source, collects installers, and computes SHA-256 values. It publishes a draft only after all three builds succeed, then marks it public.

Run it from **Actions → Release → Run workflow**, or include `[release]` in a main-branch commit message. The tag is read from `package.json`; increment the version before the next release. Existing releases are never overwritten. The workflow uses GitHub's temporary `GITHUB_TOKEN`; no personal token or model credential is needed.

Release assets use stable names `Nodus-mac-arm64.dmg`, `Nodus-windows-x64.exe`, and `Nodus-linux-x64.AppImage`, so the README's `releases/latest/download` commands continue to work when versions change.

Keep user data, credentials, `node_modules`, build output, and local test evidence out of Git. See `.gitignore` and `SECURITY.md`.
