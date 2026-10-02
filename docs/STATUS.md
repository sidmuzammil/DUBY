# Release status — development alpha

The master specification is the product target. This build implements a useful
native vertical slice, original art pipeline and enforced file boundary; it is **not
a completed flagship release**. The following distinctions are intentional.

## Implemented and exercised

- Native Tauri 2 / GTK / WebKitGTK application, React interface, offline bundled assets.
- Original Blender source and rigged GLB: 11,472 triangles, 10 bones, 4 material meshes,
  12 named clips, approximately 550 KB GLB. Four reference renders and a fallback
  atlas. Khronos validation: zero errors; four documented hierarchy warnings.
- Three.js rendering verified in Chromium and the packaged GTK/WebKit companion.
  Native evidence requires the actual GLB render state and visible pet pixels;
  a release CSP bug that previously forced its atlas fallback is corrected.
- Onboarding, composer, event timeline, explicit Pause/Stop, file scope controls,
  local note creation, memory editing/export/deletion, durable task index and
  conversation recovery, saved model settings, native session-key dialog, selectable
  access durations, opt-in autostart, themes, reduced motion,
  character gallery and diagnostic export.
- Rust broker tests exercise actual temporary files and SQLite: scoped read/create,
  no overwrite, idempotency, unknown identity, read-only grants, pause, revocation,
  traversal/symlink denial, restart authority loss and approved-memory lifecycle.
- Native OpenClaw Gateway 2026.9.7 + public client/protocol 2026.8.1 + Node 24.19.0:
  real authenticated wire-v4 handshake. End-to-end deterministic model fixture reads
  a document through the trusted plugin/broker and saves a verified summary.
- Fragmented and interleaved tool arguments are assembled by OpenClaw. An exact-value
  scan of generated runtime files found no fixture credential residue. A separate
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
| Public alpha .deb | Built and published on a standard Ubuntu 24.04 runner | Frontend, Rust and local runtime fixtures passed; public download checksum verified; package retains glibc 2.41 minimum |
| Ubuntu 26.04.1 x86_64 desktop | User target; installation not yet verified | Downloadable alpha available; actual installation and desktop behavior remain open checks |
| Packaged GUI → managed Gateway | Tested in cloud X11 | Native authentication passes after removing PRoot from the test harness; cloud-only WebKit helper relocation leaves shipped libraries unchanged |
| GNOME Wayland top-edge pet | Experimental implementation, not runtime-tested | Optional extension authenticates caller PID and registers the actual 3D window; real GNOME acceptance remains open |
| KDE Plasma Wayland top-edge pet | Not implemented / not tested | Layer-shell creation and lifecycle proof missing |
| X11 top-edge companion | Tested in cloud X11 | Separate transparent GLB window, mode switching, activation and close; real GNOME/KDE/XFCE baseline and multiple monitors remain untested |
| Sway / Hyprland / other wlroots | Not tested | No assumptions inherited from GNOME/KDE |
| ScreenCast / RemoteDesktop / microphone / shortcuts | Disabled | Portal presence is probed; capture, input and consent flows are not enabled |
| AT-SPI and native screen readers | Partially tested | Native AT-SPI smoke passed; manual Orca/screen-reader audit remains open |
| ARM64 | Not built / not tested | Independent dependency and packaging target |
| Older Ubuntu/Debian/Mint ABI | Not supported by these binaries | Current binary baseline is glibc 2.41; build on an older baseline before claiming it |
| Fedora/openSUSE RPM installation | Not tested | Recipe/artifact validation is separate from clean installation |
| AppImage | Built and extracted artifact tested | Native file/memory/export/revoke and Gateway checks pass; Debian 13 ABI baseline and host WebKitGTK 4.1 required; FUSE mount and clean-system install untested |
| Flatpak | Not implemented | Portal/host automation packaging must be designed and tested separately |

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
purchased or used. GitHub API access was subsequently restored for `sidmuzammil`;
the source and complete original Git history are now published at
https://github.com/sidmuzammil/DUBY. A portable source bundle and local installers
are also preserved. The x86_64 .deb and SHA256SUMS are now published in
[v0.1.0-alpha.1](https://github.com/sidmuzammil/DUBY/releases/tag/v0.1.0-alpha.1).
The anonymous public download was checksum-verified. This does not establish live
model quality or a clean Ubuntu desktop installation.

## Remaining specification work

The pinned production dependency audit reports zero known advisories after the
reproducible npm dependency repack documented in `vendor/README.md`.

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
6. Extend task recovery with richer usage reporting, per-operation/task/persistent
   grant choices, retention preferences and migration/rollback coverage. Task/run
   mapping and history recovery are implemented; scope never survives restart.
7. Validate keychain lock/unlock on a real Secret Service desktop. Native session-only
   credential entry is implemented separately; no plaintext fallback exists.
8. Test real local and hosted model tool/vision/cancellation behavior. Vision, speech,
   exact prices and enforced-offline inference are not advertised.
9. Clean-install/update/uninstall tests across target distributions, signed Duby
   updates, ABI-baseline packaging, ARM64, and integrated-GPU/battery measurements.
   Cloud measurements are recorded in `evidence/native-performance.json`; the managed
   runtime raises measured total PSS to roughly 1.3 GiB, an optimization target.

See `docs/evidence/` for reports and screenshots. Test-fixture outputs are clearly
identified; no simulated progress or fixture model is shipped as the user's AI.
