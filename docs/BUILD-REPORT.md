# Build report — 2 October 2026

Duby is a working native development alpha with a packaged 3D companion, a managed
OpenClaw runtime, and enforced file tools. It does **not** yet complete every feature
or flagship desktop acceptance gate in the master specification. No payments,
hosted inference requests, purchases, or billable CI runs were made.

## Delivered functionality

- Original editable Blender character, rigged GLB, twelve animation clips, gallery,
  local fonts/assets, themes, reduced motion, and a rendered-atlas fallback.
- Native main window and transparent 3D companion; X11 top-edge placement, opening
  the main window from the pet, opt-in autostart, and graceful quit. An optional
  GNOME extension implements narrow caller-owned window registration, but is not
  yet validated in a real GNOME Wayland session.
- Native folder consent with selectable expiry; scoped read/find/create tools,
  pause/stop/revoke, no overwrites, an idempotent operation journal, and diagnostic
  export. Shell, desktop control, capture, and microphone remain disabled.
- Provider selection, saved model settings, Secret Service credential lookup, and
  a native masked session-key dialog that keeps keys out of the renderer.
- Durable task/run mapping, restart-safe conversation recovery through OpenClaw's
  public history API, and user-approved memory editing/export/deletion. Recovery
  never restores folder grants or replays a task.
- Debian, RPM, and AppImage artifacts with bundled Node/OpenClaw and checksums.
  The current binaries require the documented Debian 13 / glibc 2.41 baseline;
  AppImage also requires the host's matching WebKitGTK 4.1 stack.

## Executed verification

| Check | Result |
| --- | --- |
| TypeScript and production frontend build | Passed |
| Provider, event and cancellation contracts | 12 tests passed |
| Rust broker, archive installation and autostart escaping | 13 tests passed |
| Rust Clippy, all workspace targets | No warnings |
| Browser UI and automated WCAG A/AA | 4 tests passed; main views in both themes |
| Original GLB | 0 validation errors; 4 documented hierarchy warnings; 12 animations |
| Production dependency audit | 0 known advisories after the documented npm dependency repack |
| Real Gateway protocol and stdio bridge | Authenticated wire-v4 handshake, saved preferences, session credentials and shutdown passed |
| Streaming file fixture | Read/find/create through the real Gateway, trusted plugin and Rust broker; fragmented/interleaved arguments |
| Alternate execution route | Model-requested exec rejected; no target mutation |
| Packaged native AI flow | Native key dialog → Gateway → plugin → broker → verified new summary file |
| Native restart recovery | Saved conversation loaded; no restored grants; zero additional model requests |
| Credential residue | Fixture key absent from 163 generated native/runtime state files |
| Native 3D companion | Real GLB loaded and visible pixels checked; placement, opening main, mode switching, autostart and quit exercised |
| Native deterministic UI | Folder confirmation, actual file creation, memory editing/deletion, diagnostic export and revocation passed |
| AppImage | Extracted artifact launches and completes native file/memory/export/revoke and bundled Gateway checks |
| Installer contents | ELF executable, desktop entry and embedded runtime archive SHA-256 verified |
| Cloud onboarding | Installation/start instructions saved to the reusable environment configuration draft |

The full native GUI-to-Gateway failure from the earlier build is **resolved**.
The old PRoot test wrapper caused filesystem EFAULT errors. Native tests now use a
private WebKit test-library copy with its helper path relocated to the unprivileged
sysroot; shipped libraries are unchanged. Historical evidence is retained with its
resolution in `evidence/native-runtime-limit.json`.

A separate release CSP issue previously blocked loading local GLB files and caused
the atlas fallback. App-origin asset fetches are now allowed by `connect-src 'self'`.
The native companion check requires the real 3D render state and visible pet pixels,
so a blank window or fallback image cannot pass as verified GLB rendering.

Machine-readable results and screenshots are in `evidence/`. Performance sampling
distinguishes native/WebKit memory from the background runtime and compares costs
before and after Gateway connection; see
`evidence/native-performance.json` for measured memory, idle CPU and readiness times.
These are single cloud software-rendering samples, not integrated-GPU or battery
claims. Deterministic local model fixtures do not establish live model quality.

On this machine, accessible onboarding appeared in 2.11 seconds and the first
Gateway handshake took 8.54 seconds. Settled Settings used about 419 MiB proportional
memory before connection and 1,327 MiB with the Gateway connected, without a model
loaded. The corresponding ten-second CPU samples were 0.9% and 4.09% of one core.
OpenClaw's memory cost remains a significant optimization target; it is included in
these totals rather than hidden behind a renderer-only figure.

## Publication and environment limits

Source publication is complete at https://github.com/sidmuzammil/DUBY. GitHub's API
authenticated as `sidmuzammil` and confirmed repository write access. The cloud Git
push route still used `Protectol`, so the Git Database API published the source while
preserving all four original commit IDs, including `ae84370`. The initial publication
merge `96ab415ce1d82a128fa1cf93a1c0f2ced9361949` has the exact verified source tree
`25eeae248e2fb919d07b395c5c320f040250657f`; the initialization commit remains in history.
The branch was updated with fast-forward enforcement and checked again through the API.

The portable `.artifacts/packages/Duby-source.bundle`, source ZIP and installers
remain in the build workspace. No GitHub Release or installer assets were uploaded.
The Ollama model registry remains an unavailable check; no live local or hosted
inference was run. The reusable cloud configuration is saved as a draft; fresh-task
environment restoration has not been independently verified.

## Remaining specification work

See `STATUS.md` for the full compatibility matrix and concrete open gates. The main
unfinished areas are KDE Wayland anchoring and real GNOME/KDE/X11 desktop validation,
consented capture/input/voice, enforceable command sandboxing, reviewed service/MCP
integrations, reversible file moves, broader retention/grant choices, real-provider
validation, clean distribution installs, signed updates and ARM64. These are future
implementation or validation work, not features established by the passing alpha
checks. A full flagship release must not be labeled complete until those gates pass.
