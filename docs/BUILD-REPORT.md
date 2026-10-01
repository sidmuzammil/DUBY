# Build report — 1 October 2026

Duby is a working native development alpha, not the completed master specification.
No payments, hosted model calls or billable CI runs were made.

## Verified

| Check | Result |
| --- | --- |
| TypeScript and production frontend build | Passed |
| Provider, event and cancellation contracts | 12 tests passed |
| Rust broker and archive installation | 10 tests passed |
| Rust Clippy, all workspace targets | No warnings |
| Browser UI and automated WCAG A/AA | 3 tests passed; main views in both themes |
| Original GLB | 0 validation errors, 4 documented hierarchy warnings; 12 animations |
| OpenClaw authenticated protocol | Real wire-v4 handshake passed |
| Streaming file-task fixture | Read/find/create through real Gateway, plugin and Rust broker; interleaved arguments |
| Alternate execution route | Model-requested `exec` denied, no mutation |
| Credential residue | No fixture keys in 18 generated runtime files |
| Native UI | Folder confirmation, actual note creation, memories and revocation exercised through GTK/WebKit/AT-SPI |
| Linux installer payloads | Debian and RPM executable, desktop entry and runtime archive hashes verified |
| Bundled Node/OpenClaw | Authentication passed using the bundled executable |
| Cloud setup | Repeated successfully; reusable environment configuration draft saved |

Detailed machine-readable reports and screenshots are in `evidence/`. Local model
fixtures are clearly labeled; they do not establish live model quality or paid-provider
compatibility. The native test environment is Xvfb with software graphics, not a real
GNOME/KDE Wayland desktop. Installer hashes are in `evidence/packages.json`.

## Publication and remaining work

GitHub rejected `git push -u origin main` with HTTP 403: the configured `Protectol`
identity has no write access to `sidmuzammil/DUBY`. No other GitHub account is logged
in. All work is locally committed, and `.artifacts/packages/Duby-source.bundle`
preserves the Git history. The `.deb`, `.rpm` and SHA256SUMS are in the same directory.

The GitHub release API and Ollama model registry were also blocked. No GitHub Release,
live local inference or hosted inference is claimed. Three transitive npm dependency
advisories remain production blockers; see `SECURITY.md`.

`STATUS.md` tracks the remaining specification work, including real Wayland anchoring,
consented screen/input/voice, subprocess isolation, durable conversation recovery,
signed updates, additional package targets and clean-system compatibility tests.
