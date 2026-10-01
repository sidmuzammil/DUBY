# Release status — development alpha

The master specification is the product target. This build implements a useful
native vertical slice, original art pipeline and enforced file boundary; it is **not
a completed flagship release**. The following distinctions are intentional.

## Implemented and exercised

- Native Tauri 2 / GTK / WebKitGTK application, React interface, offline bundled assets.
- Original Blender source and rigged GLB: 11,472 triangles, 10 bones, 4 material meshes,
  12 named clips, approximately 550 KB GLB. Four reference renders and a fallback
  atlas. Khronos validation: zero errors; four documented hierarchy warnings.
- Real Three.js rendering inspected in Chromium **and the native X11 WebKitGTK app**.
- Onboarding, composer, event timeline, explicit Pause/Stop, file scope controls,
  local note creation, memory editing/export/deletion, themes, reduced motion,
  character gallery and diagnostic export.
- Rust broker tests exercise actual temporary files and SQLite: scoped read/create,
  no overwrite, idempotency, unknown identity, read-only grants, pause, revocation,
  traversal/symlink denial, restart authority loss and approved-memory lifecycle.
- Native OpenClaw Gateway 2026.9.7 + public client/protocol 2026.8.1 + Node 24.19.0:
  real authenticated wire-v4 handshake. End-to-end deterministic model fixture reads
  a document through the trusted plugin/broker and saves a verified summary.
- Fragmented and interleaved tool arguments are assembled by OpenClaw. An exact-value
  scan of 18 generated runtime files found no fixture credential residue. A separate
  adversarial fixture requests `exec`; the runtime rejects it without a mutation.
- Automated UI/navigation/GLB checks and WCAG A/AA checks on the main views in both
  themes. These do not replace a native screen-reader audit.
- Native GTK/WebKit AT-SPI actions confirm folder consent, real note creation,
  memory editing/deletion, broker-backed diagnostic export and grant revocation
  against temporary fixture data, including the extracted Debian application.
- Native build and Debian/RPM package generation with bundled Node/OpenClaw. Both
  payloads contain verified archive hashes, ELF executables and desktop entries.
  The extracted runtime authenticates using its bundled Node executable. Exact final
  package and performance evidence is recorded alongside the generated artifacts.

## Compatibility evidence

| Environment / capability | Classification | Evidence / limit |
| --- | --- | --- |
| Debian 13.6 x86_64, GTK 3.24.49, WebKitGTK 2.54.0, Xvfb | Limited, tested development environment | Native window, GLB and UI smoke evidence; software graphics, not a normal desktop session |
| Packaged GUI → managed Gateway under PRoot | Validation blocked / unresolved | Native cold connection times out in this wrapper; the same bundled runtime and stdio lifecycle authenticate when launched directly on the host |
| GNOME Wayland top-edge pet | Not implemented / not tested | Requires compositor extension/placement proof and real hardware/session tests |
| KDE Plasma Wayland top-edge pet | Not implemented / not tested | Layer-shell creation and lifecycle proof missing |
| Real GNOME/KDE/XFCE X11 desktop | Not tested | Xvfb smoke testing does not satisfy the flagship baseline |
| Sway / Hyprland / other wlroots | Not tested | No assumptions inherited from GNOME/KDE |
| ScreenCast / RemoteDesktop / microphone / shortcuts | Disabled | Portal presence is probed; capture, input and consent flows are not enabled |
| AT-SPI and native screen readers | Partially tested | Native AT-SPI smoke passed; manual Orca/screen-reader audit remains open |
| ARM64 | Not built / not tested | Independent dependency and packaging target |
| Older Ubuntu/Debian/Mint ABI | Not supported by these binaries | Current binary baseline is glibc 2.41; build on an older baseline before claiming it |
| Fedora/openSUSE RPM installation | Not tested | Recipe/artifact validation is separate from clean installation |
| AppImage / Flatpak | Not implemented | Do not infer support from Tauri's available target names |

## Provider evidence

| Provider | Implemented path | Executed check |
| --- | --- | --- |
| OpenAI | Native OpenAI Responses adapter config + Secret Service reference | Configuration/endpoint tests only; no paid API call |
| Anthropic | Native Anthropic adapter config + Secret Service reference | Configuration tests only; no paid API call |
| Google Gemini | Native Google adapter config + Secret Service reference | Configuration tests only; no paid API call |
| Ollama | Native API, loopback, non-cloud model | Gateway handshake; Ollama 0.18.3 server starts, but model registry returned Forbidden |
| Custom | Explicit HTTPS or loopback OpenAI-compatible endpoint | Full local deterministic streaming/tool fixture; not live model quality evidence |

No compatible model weights were available. The official Ollama binary was checksum
verified, but `registry.ollama.ai` denied the model pull. No hosted inference was
purchased or used. `api.github.com` was also denied, preventing release creation;
Git remote reads work, but push returned HTTP 403: the connected `Protectol` identity
does not have write access to `sidmuzammil/DUBY`. The source is locally committed and
a portable Git bundle is provided. These are environment limits, not
reasons to claim live provider or release-publishing success.

## Remaining specification work

Resolve the three transitive npm dependency advisories documented in
`SECURITY.md` and `evidence/npm-audit.json` before a production release.

1. Prove flagship anchored rendering on real GNOME Wayland, Plasma Wayland and one
   X11 desktop, including multiple monitors, focus, input regions, scaling and lock.
2. Build consented portal screen capture/input and native voice, with expiry,
   revocation, lock/resume and stale-target tests. Keep them disabled until then.
3. Add an enforceable subprocess sandbox before any terminal/development commands.
   Bubblewrap namespace creation is unavailable in this machine. No root daemon.
4. Add reviewed browser/service/MCP integrations through the same broker boundary;
   no decorative integrations or automatic executable-plugin installations exist.
5. Implement reversible file organization/move plans and tested undo records. Current
   writes are create-only; destructive/move operations are not exposed.
6. Complete durable conversation recovery/history UI, per-operation/task/persistent
   grant choices, retention preferences, schema migration/rollback tests and usage
   reporting. Current grants are session-only and memories are explicit.
7. Validate keychain lock/unlock and secret residue on a real Secret Service desktop;
   session-only secure credential entry is not implemented.
8. Test real local and hosted model tool/vision/cancellation behavior. Vision, speech,
   exact prices and enforced-offline inference are not advertised.
9. Clean-install/update/uninstall tests across target distributions, signed Duby
   updates, ABI-baseline packaging, ARM64, and integrated-GPU/battery measurements.

See `docs/evidence/` for reports and screenshots. Test-fixture outputs are clearly
identified; no simulated progress or fixture model is shipped as the user's AI.
