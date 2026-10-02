# Working on Duby

Duby is a Linux desktop application, not a browser-only product. Read README.md,
docs/ARCHITECTURE.md and docs/SECURITY.md before changing privilege boundaries.
The master specification describes the target; docs/STATUS.md describes evidence.

Cloud tasks already have an isolated checkout. Use the existing checkout; do not
create a Git worktree unless the user explicitly requests one.

- Never put credentials in renderer code, logs, prompts, ordinary settings or exports.
- Keep OpenClaw as the sole model/turn/tool-dispatch owner. Events are observations.
- All model file operations must pass the Rust broker. Never broaden an allowlist to
  make a test pass, enable a shell fallback, or use a prompt as authorization.
- Keep dependency and upstream pins. Preserve third-party notices and original art.
- Run `npm run check`, `cargo test -p duby-broker`, and relevant runtime/native checks.
  UI checks use `npm run test:e2e`; native behavior needs native evidence.
- Do not call a provider or start billable CI as part of routine tests. Runtime tests
  use a local deterministic fixture and must be labeled as such.
- Keep unsupported platform features visibly disabled. Do not silently substitute
  a standalone window for the flagship Wayland top-edge acceptance gate.
