# Security and privacy

Nodus sends task context and attached material to the model provider selected by the user. Local task storage does not mean offline model execution.

- API keys are session-only by default. Optional persistence uses Electron's OS-backed encryption facilities.
- Application backups exclude saved application credentials and Pi authentication directories. Sensitive text a user puts into a task or deliverable is not automatically redacted.
- Generated files and model-assisted checks are not a guarantee of safety or correctness. Review output before use.
- Published installers currently lack formal developer signing and macOS notarization.

## Reporting a vulnerability

Do not post credentials, private conversations, sensitive reproduction files, or exploitable details in a public issue. If the repository's Security tab offers **Report a vulnerability**, use that private channel. Otherwise, open an issue asking the maintainer to establish a private reporting channel without including exploit details or private data.

Use synthetic examples when reporting ordinary bugs. Remove keys, tokens, file-system usernames, and private material from logs and screenshots.
