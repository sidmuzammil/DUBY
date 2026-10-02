# Duby — Codex Master Build Prompt

Research snapshot: 1 October 2026.
Deliverable: an original Linux desktop AI companion with a real animated 3D character, practical local computer assistance, and configurable AI providers.

This is a product and engineering specification, not a claim that the application already exists or that compatibility has been tested. The source appendix records the research foundation. Recheck source contracts against the exact revisions selected for implementation.

## 1. Your role and the intended result

You are Codex acting as the lead desktop engineer, agent-systems engineer, product designer, and technical artist for Duby.

Build a working, polished Linux desktop application named Duby. It should feel like a small, friendly, technically capable companion living near the desktop’s top edge or panel. Users should be able to open it instantly, explain a task in ordinary language, attach context, and watch it perform authorized work on their own computer.

Combine:
- The compact, responsive desktop-companion interaction pattern associated with Coucou.
- The agent, session, provider, and tool capabilities of OpenClaw.
- An entirely original Duby identity, 3D character, animation language, and Linux integration.

The first release must contain useful end-to-end behavior. A decorative pet, a browser-only chat page, or simulated task animations are insufficient.

Work in the existing repository when one is supplied. Inspect its instructions, branch, architecture, and uncommitted work before editing. Preserve user changes. If the repository is empty, create a clean project with the module boundaries below. Make reasonable reversible implementation choices, document them, and continue. Ask only when a genuinely blocking product decision, credential, or external authorization is missing.

Do not stop after producing a plan. Implement in stages, keep the application runnable, verify each consequential boundary, and report honestly what has and has not been demonstrated.

## 2. Product promises and scope

Duby should help a person:
- Ask questions about a selected file, folder, browser page, or permitted screen/window.
- Find and organize files within granted locations.
- Open applications and help operate supported interfaces.
- Carry out bounded terminal or development tasks when permitted.
- Research online through a configured search/browser capability.
- Draft useful outputs and save them locally.
- Connect chosen services through supported integrations and MCP tools.
- Continue a multi-step task, show its real status, pause, recover, and stop.
- Remember user-approved preferences and useful context under visible retention controls.

The application, pet assets, preferences, and local interface live on the user’s computer. Hosted AI inference requires network access. Offline reasoning requires a compatible, already installed local model and enough hardware. Local application installation does not mean hosted providers receive no data.

Interpret “all Linux” as an architecture that supports multiple distributions and desktops, with published tested tiers and graceful fallbacks. Never promise identical overlays, capture, or input automation on every compositor, obsolete distribution, CPU architecture, or headless machine.

Interpret “all access” as broad capabilities the user can grant deliberately and revoke. Do not make unrestricted root access the default.

## 3. Upstream audit, cloning, and complete rebranding

Use these canonical references unless the existing project establishes a different intended source:
- Coucou: https://github.com/Louis-CFM/coucou
- OpenClaw: https://github.com/openclaw/openclaw

Treat the Coucou identity as the best-supported interpretation of the user’s reference. Inspect both projects before deciding exactly which code to reuse.

Clone the canonical repositories into isolated reference checkouts or pinned submodules. Record each URL, release/tag, full commit SHA, license, dependency lockfile, and local patch in an upstream manifest. Select a reviewed compatible release; do not install an unpinned moving latest release at application startup.

Coucou’s reviewed code license is MIT, while its separate asset license restricts its name, Mochi character, character appearance and animations, icons, sounds, and media. Audit both license files at the pinned revision. Reuse only eligible generic application/integration code with attribution. Do not ship Mochi drawing code, choreography, sounds, icons, or recolored variants. Sources: [code license](https://github.com/Louis-CFM/coucou/blob/main/LICENSE) and [asset license](https://github.com/Louis-CFM/coucou/blob/main/LICENSE-ASSETS.md).

OpenClaw’s reviewed license is MIT with third-party notices. Retain all applicable notices for reused code and dependencies. Source: [OpenClaw license](https://github.com/openclaw/openclaw/blob/main/LICENSE).

Use Duby throughout first-party application titles, launcher entries, setup, help, notifications, icons, website/documentation copy, package labels, CLI, and voice identity. Use lowercase duby for the command and appropriate first-party identifiers.

Preserve upstream names where technically or legally necessary: dependency imports, protocol fields, configuration keys, original copyright notices, license text, and source references. Do not perform a blind global replacement that breaks compatibility or removes attribution.

Create original Duby branding and an asset provenance manifest. Do not claim trademark clearance or ownership over upstream code. Audit component licenses before assigning a distribution license to the combined product.

## 4. Recommended architecture

Default to Tauri 2, Rust, TypeScript, and Three.js. Use React for the interface if starting fresh; preserve a suitable existing TypeScript interface when converting it would add little value. Use React Three Fiber only if it simplifies the selected React implementation.

This choice aligns with relevant existing Tauri code in [Coucou’s Windows application](https://github.com/Louis-CFM/coucou/blob/main/windows/README.md) and [OpenClaw’s Linux companion](https://docs.openclaw.ai/platforms/linux). It remains subject to the early Linux graphics and windowing proof in Phase 0; [Tauri documents Linux graphics limitations](https://v2.tauri.app/develop/debug/linux-graphics/).

Separate these responsibilities:

| Module | Responsibility |
| --- | --- |
| apps/desktop | Duby interface, onboarding, quick panel, task details, accessibility |
| crates/duby-platform | Desktop detection, window integration, portals, app launching, native media |
| crates/duby-broker | Execution authorization, scoped OS actions, cancellation, audit records |
| packages/runtime-bridge | Versioned OpenClaw connection, supervision, pairing, event normalization |
| packages/contracts | Shared schemas and versioned task/capability interfaces |
| packages/duby-tools | Minimal trusted OpenClaw tools that call the broker |
| packages/pet | Three.js scene, character state machine, animation controller, fallback renderer |
| assets/duby | Editable model, exported assets, original sounds, provenance |
| integrations/gnome | Optional narrowly scoped GNOME Shell integration |
| integrations/kde | Optional Plasma panel/desktop integration |
| packaging | Native packages, AppImage, update metadata, desktop entries |
| docs and tests | Architecture decisions, compatibility evidence, meaningful verification |

The renderer is a presentation boundary. It must not hold API keys, spawn arbitrary commands, read arbitrary files, or connect directly to privileged Gateway endpoints. Native/background components expose a narrow validated API.

Use OpenClaw as the primary agent/session/provider runtime. Avoid a second independent model loop, competing task queue, or competing memory engine in the pet UI. Duby can maintain UI projections and execution journals, but ownership of authoritative state must be explicit.

OpenClaw owns model streaming, tool-call assembly, agent turns, and tool dispatch. Duby consumes validated lifecycle events for presentation; receiving an event must never trigger duplicate execution. A Duby tool executes only through its registered runtime implementation and an authenticated broker request. Provider parsing belongs in the selected runtime adapter, not another dispatcher in the UI bridge.

Use typed, versioned communication. Prefer authenticated local IPC appropriate to each boundary. If local HTTP/WebSocket is needed, bind to loopback, authenticate connections, validate applicable origins, and avoid public listening by default.

## 5. OpenClaw integration contract

Inspect the pinned upstream’s Linux companion and public embedding/client documentation. Adapt proven lifecycle and setup code when its license and architecture permit.

Package a normal installed OpenClaw dependency with a real compatible Node runtime, preserving its dependency resolution and exports. Cloning source for audit/build traceability does not mean flattening its dist directory into Duby. Follow the [embedding contract](https://docs.openclaw.ai/gateway/embedding) and [Gateway client contract](https://docs.openclaw.ai/gateway/clients).

Use the documented Gateway protocol and public client/SDK interfaces. Verify client-package, wire-protocol, Gateway, and Node compatibility as a combination. Do not assume matching version numbers establish compatibility.

Keep Gateway credentials, device identity, pairing, reconnect logic, and subscriptions in the native/background bridge. Advertise required event capabilities and request only scopes the application uses. Normalize upstream events into Duby events; do not invent upstream methods or message shapes.

Give the Gateway one lifecycle owner: either a supervised application child or a deliberately configured user service. Handle port conflicts and existing installations without silently attaching to another user configuration. Obtain readiness from the authenticated protocol handshake rather than a log message.

Use documented APIs for history, sessions, model status, usage, and configuration. Do not implement features by editing private OpenClaw databases or transcript files. Keep the Duby-managed runtime’s supported configuration/state location distinct from an existing independent installation. Offer explicit migration or connection, never silent adoption.

Implement bounded restart/reconnect, graceful shutdown, crash recovery, cancellation, and schema migration. Reconcile uncertain task state after reconnect before resending requests.

Audit every execution route available to the model. Disable or constrain alternate built-in shell, filesystem, browser, plugin, or node routes that could bypass Duby’s broker policy. A permission screen in the frontend is not enforcement.

OpenClaw sandboxing and in-process plugins have different trust boundaries. Configure and test the chosen sandbox explicitly. Treat installed native plugins as trusted executable code, and keep the initial trusted plugin set small.

## 6. Linux compatibility and desktop behavior

Create a capability report at startup and after relevant environment changes. Detect session type, compositor/desktop, architecture, graphics support, portal interfaces and versions, keychain availability, and relevant native services. Environment names alone are insufficient evidence of a feature.

Maintain separate capabilities for panel integration, overlay placement, global shortcut, screenshot, live screen capture, pointer control, keyboard control, accessibility access, microphone, and app/window enumeration.

Make GNOME on Wayland and KDE Plasma on Wayland the two primary desktop targets, plus at least one X11 baseline. Record exact distro, desktop, compositor, driver, and dependency versions in Phase 0. A completed flagship release must demonstrate the real animated 3D pet anchored at the top edge/panel on both primary targets and the selected X11 baseline. A normal-window fallback supports other configurations but does not satisfy these flagship gates. If anchoring remains unproven, label that feature and release incomplete rather than quietly substituting a tray-only product.

Proposed release coverage:

| Environment | Intended behavior and required fallback |
| --- | --- |
| GNOME on versions that still offer X11 | Test compact companion positioning, focus behavior, shortcuts, and permitted input; use normal window fallback if needed |
| GNOME on Wayland | Prefer portal APIs and an optional GNOME extension for panel anchor/window placement; baseline standalone companion remains available |
| KDE Plasma on Wayland | Test panel integration and appropriate compositor/layer-shell support; keep a normal companion window if anchoring fails |
| KDE, XFCE, Cinnamon, MATE on X11 | Test shared X11 capabilities and actual panel/tray behavior rather than assuming equivalence |
| Sway and other wlroots desktops | Enable only protocols and portal interfaces actually present; screen capture support does not imply remote input support |
| Hyprland | Test its compositor and portal backend separately; do not inherit Sway/wlr capability assumptions |
| Other supported graphical Linux systems | Provide launcher, accessible normal window, chat, and granted non-GUI tools; clearly describe unavailable integrations |
| ARM64 Linux | Treat as a separate build/test target; mark preview until native dependencies and behavior are verified |

A normal Wayland application cannot assume arbitrary global positioning or universal always-on-top behavior. Do not treat XWayland as a security or compositor-policy bypass. See the [window-management limitations](https://doc.qt.io/qt-6/application-windows.html). The proposed GNOME route is an implementation hypothesis based on [Mutter’s window placement API](https://mutter.gnome.org/meta/method.Window.move_resize_frame.html), and must be proven rather than advertised from documentation alone.

For GNOME, prototype an optional extension that owns the panel anchor and positions only registered Duby windows using appropriate compositor APIs. Restrict window identification to Duby’s expected application/process registration. Do not expose a general arbitrary-window control service. Verify creation timing, focus, scaling, extension disable, and session restart cleanup.

For KDE/wlroots, investigate a maintained layer-shell or desktop integration path. Window roles often must be assigned before realization. Do not assume applying a GTK layer-shell call to an already-created Tauri window works. Avoid abandoned bindings and undocumented reparenting hacks. If a small reviewed creation hook is required, document and test it. If it remains unreliable, ship the stable window fallback and label anchored mode experimental.

The true 3D character should remain in the application renderer. A panel can use a small original icon or rendered frame and open the 3D companion. Do not call a static tray icon a completed animated top-edge experience.

Use ScreenCast/PipeWire for permitted screen streams and RemoteDesktop for supported input injection, including libei/EIS where implemented. InputCapture serves a different purpose and is not a substitute for RemoteDesktop. Probe each interface and handle denial, dismissal, expiry, and revocation. Follow the actual [RemoteDesktop portal contract](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.RemoteDesktop.html).

Use the GlobalShortcuts portal where available on Wayland. Tauri’s ordinary global-shortcut backend must not be assumed to cover every Wayland desktop. Provide a user-configurable alternative, panel action, and normal launcher.

Support AT-SPI where available for meaningful application accessibility. Combine APIs, accessibility, and permitted visual interaction rather than relying on brittle coordinates alone.

Test multiple monitors, monitor removal, fractional scaling, desktop panels, fullscreen applications, suspend/resume, screen lock, and session changes. Pause capture and actions on lock or lost authority; verify the active target again before resuming.

## 7. Original Duby character and art direction

Create Duby as a tiny floating robot-otter companion: warm, cute, intelligent, and visually distinct.

Design:
- A small head and soft pear-shaped ceramic body.
- Rounded petal-like ears that can tilt expressively.
- Short flipper-like hands and tiny feet.
- A curved crescent tail with a restrained status light.
- Warm ivory surfaces, a graphite face inset, gentle teal eyes, and a muted lilac accent.
- Subtle seams, controlled studio highlights, soft contact shadow, and readable forms.
- A silhouette recognizable at small desktop sizes without expensive fur or cluttered accessories.

Aim for a carefully designed miniature physical collectible brought to life. Avoid copied mascot silhouettes, exact expressions, sound motifs, or character-specific interactions from Coucou.

Use personality through timing and posture: attentive, patient, quietly playful, and capable. Duby should never beg for affection, guilt the user, punish inactivity, or announce invented emotions about completed tasks.

Use simple, warm interface language. Provide light and dark themes, strong text contrast, generous spacing, crisp icons, and restrained motion. Avoid decorative overload, excessive glow, constantly moving particles, and panels filled with inactive integrations.

Keep technical configuration in an advanced area unless it helps the user make a decision.

## 8. Real 3D asset production and animation

Use Blender as the reproducible default authoring/export pipeline. Maya is acceptable when legitimately available, with a tested FBX/interchange conversion into the chosen GLB pipeline. End users must not need either application installed.

If artist tools are available, use them. If only Blender scripting is available, create a reproducible original model, rig, materials, and authored keyframes through scripts. Do not claim Maya or manual sculpting was used when it was not.

Required assets:
- Editable duby.blend, or the actual Maya source plus conversion project.
- A real rigged duby.glb with named animation clips and materials.
- Asset generation/export scripts with pinned tool versions.
- Original icon set, application artwork, and optional original sounds.
- Front, side, rear, and three-quarter reference renders.
- An animation-gallery screen for reviewing every clip and transition.
- A fallback atlas rendered from Duby’s own model for low graphics capability.
- Asset provenance, license, source, and build-hash manifest.

A static image with CSS translation does not fulfill the 3D requirement. A procedural geometry prototype is acceptable during development but should mature into the reviewable character and asset pipeline before completion.

Use glTF-compatible skeletal/morph animation, bake unsupported authoring behavior, validate with the Khronos glTF Validator, and visually inspect the exported result in Duby’s actual renderer. Bundle required loaders/decoders and assets locally.

Create approximately 12 polished core states:

| Real state | Duby behavior |
| --- | --- |
| Available | Rested posture and occasional blink |
| Greeting | Brief ear lift and small wave |
| Listening | Attentive forward lean with explicit microphone indicator |
| Understanding | Small head tilt |
| Working | Focused pose and restrained hand/tail movement |
| Needs approval | Calm amber cue and a visible decision card |
| Needs information | Patient open posture |
| Completed | Brief satisfied nod and tail-light pulse |
| Error | Mild puzzled tilt with practical recovery text |
| Offline | Calm rest with clear connectivity status |
| Paused | Settled pose and persistent paused label |
| Sleeping/hidden | Resting pose, then suspend rendering |

Drive these states from actual task events and device permissions. Do not infer task success from elapsed time. Do not show screen-watching or listening behavior when those inputs are inactive. Keep the task state machine separate from animation blending.

Use short crossfades, controlled squash/stretch, and procedural detail where useful. Eye-following should work within the available pointer context; global cursor tracking is optional and platform-dependent.

Pet interactions must never approve actions. Reduced motion and sound mute are separate settings, and critical states must always have readable text.

## 9. Compact interface and onboarding

Provide four coordinated surfaces:

1. Compact presence: Duby near the top edge/panel where supported, with a small status capsule.
2. Quick panel: one composer, attachments, optional voice, current task state, and an obvious Stop button.
3. Task detail: plan, real steps, results, files, pending decisions, and recovery options.
4. Settings: appearance, AI connection, access, connected services, memory, usage, and diagnostics.

Default prompt: “Ask Duby to help…”

Click or a working shortcut opens the panel. Background events must not steal focus. Escape closes an ordinary panel without cancelling work. Use a distinct Stop action to cancel work. Provide an explicit Open Duby launcher even when the desktop lacks tray support.

Keep transparent input regions tight so invisible overlay areas do not block other applications. Make keyboard access and screen-reader labels complete. Test the chosen WebView’s accessibility on supported Linux desktops.

Prefer shaped input regions that keep the intended pet interaction area active. If full-window click-through is enabled, restore interaction through a working panel action, shortcut, or launcher control. Do not rely on hover from a window that is ignoring pointer events.

Onboarding should have four short steps:
- Meet Duby: preview character, theme, motion, and sound.
- Choose AI: provider/local model, supported authentication, model, and explicit connection check.
- Choose access: understandable folder, browser, screen, microphone, and command permissions.
- Try a useful task: summarize a selected sample file and save a result in a chosen folder.

Use real validation and plain-language recovery for invalid keys, unavailable models, missing desktop services, and permission denials. Advanced endpoint fields belong behind an advanced control.

Autostart, microphone listening, proactive suggestions, and background schedules must be user-controlled. Keep push-to-talk as the initial voice interaction. Use a tested native audio route if embedded WebView capture is unavailable. The text interface must remain fully useful.

## 10. Provider flexibility and network behavior

Reuse OpenClaw’s supported provider integrations. Implement and test configuration paths for OpenAI, Anthropic, Gemini, Ollama, and explicitly supported custom endpoints. Expand other providers through the same adapter boundary.

Use native provider adapters when supported. In particular, do not replace the OpenClaw Ollama integration with a generic OpenAI /v1 endpoint merely because it looks compatible. Sources: [OpenClaw Ollama integration](https://docs.openclaw.ai/providers/ollama) and [Anthropic compatibility limitations](https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk).

Model capabilities differ. Maintain a registry containing provider ID, transport, base URL, model ID, credential reference, actual inference location, capability evidence, adapter/runtime version, and last verification time.

Track supported, unsupported, and unknown status for:
- Text and streaming.
- Function/tool calling.
- Images and screen observations.
- Structured outputs.
- Native computer-use environments.
- Speech input/output.
- Context limits, usage reporting, and cancellation behavior.

Enable a feature only when the model, adapter, Linux capability, user grant, and current resources all permit it. A successful text request does not prove tool calling or image support.

Let users choose models from available metadata and enter a model manually when discovery is unavailable. Do not hardcode “latest” models or invented prices. Clearly distinguish measured usage, estimated cost, and unknown cost.

Require the selected runtime/provider adapters to preserve native conversation items, tool-call IDs, streaming blocks, and opaque provider metadata. Do not flatten everything into plain chat strings. Test fragmented arguments, multiple tool calls, stream failures, rate limits, and bounded retries at that adapter boundary. OpenClaw dispatches only complete validated tool calls; the Duby bridge observes these events without executing them again.

Never silently change providers or send a task to another endpoint after failure. Offer a clear user-controlled fallback. Provider switching must preserve the applicable data-sharing boundary.

The pet, settings, and permitted local history remain available offline. Existing deterministic local functionality can continue when it does not need hosted inference. If no suitable local model is installed, explain which AI tasks need connectivity.

For local-only mode, enforce the actual inference route and disable hosted fallback, cloud models, remote MCP, remote embeddings, telemetry, and remote speech for that task. A localhost model server can still relay a cloud model, so localhost alone is not proof of offline inference.

Distinguish verified local inference from enforced offline mode. Offline mode must also prevent external egress from relevant runtime/task processes, including update checks, plugin downloads, model downloads, and background search. Include a separately installed model server in that boundary or clearly disclose that its egress is unverified. Advertise only the guarantee actually enforced and tested.

Do not replay an uncertain mutation after reconnect. Reconcile its outcome first.

## 11. Local task execution and PC understanding

Use a structured observe, plan, authorize, act, verify loop. Prefer:
1. Purpose-built APIs or connected service tools.
2. Local structured application interfaces and bounded command-line tools.
3. Accessibility interfaces.
4. Permissioned visual computer interaction when necessary.

Perception must be explicit and limited to the task’s context. Start with user-selected files/windows/screens. Offer continuous screen context only as a clear opt-in session with a visible indicator, pause, stop, and retention control.

For GUI actions, verify the target application and current screen state. Map coordinates using the actual capture stream, scaling, crop, and monitor. Stop or re-observe after focus changes, monitor changes, stale captures, user interference, or permission loss. Do not continue clicking blindly.

Define typed tool requests with task ID, tool ID, validated arguments, requested resources, timeout, cancellation handle, and idempotency metadata where meaningful. The broker returns a policy decision and structured execution result, not just a text success claim.

Derive requester identity, upstream run/session, parent task, and applicable grants from authenticated runtime context and trusted records. Model arguments must not borrow another task’s authority, declare themselves approved, or supply administrative roles. Bind each approval to the validated operation/resources and recheck revocation immediately before execution.

Maintain one broker policy boundary for built-in tools, custom tools, desktop actions, and MCP. Never rely on the model prompt alone to limit access.

Examples that must become real acceptance flows:
- Summarize a selected document and save a Markdown summary.
- Locate files matching a user request inside a granted folder.
- Propose an organization plan, then move selected files and offer an undo record.
- Open a named application or URL through a supported local interface.
- Explain a selected screen/window using a capable model.
- Perform a harmless GUI action in a controlled demo application where input is supported.
- Execute a bounded development command in a selected project and report its actual exit status.
- Use a configured integration to read relevant information and prepare a draft.

Keep external communications, purchases, destructive actions, and account/security changes tied to explicit task authorization. Build a reviewable draft or change preview before any additional required approval.

## 12. Access, secrets, and trustworthy automation

Provide understandable grants scoped by capability, resource, and duration. Routine work inside an existing valid grant should proceed without repetitive prompts. New scope or consequential external/destructive actions require the appropriate concrete authorization.

Offer Allow once, Allow for this task, and clearly scoped persistent grants where appropriate. Expiry, denial, and revocation must be enforced by execution code. Revocation stops queued work and prevents further steps.

Keep the default application unprivileged. Use standard polkit/system mechanisms for any explicitly supported privileged operation instead of collecting administrator passwords. Avoid a permanent root daemon.

Protect API credentials using the available Linux Secret Service/keychain implementation. Store opaque references in ordinary settings and integrate with supported OpenClaw secret references. Do not place credentials in renderer state, URL queries, lookup attributes, prompts, logs, exported settings, or broad subprocess environments.

If the keychain is missing or locked, offer unlock or session-only storage. Never silently fall back to plaintext.

Keychain storage alone does not isolate secrets from unrestricted same-user shell or D-Bus access. Restrict untrusted tool subprocess environments, filesystem/process visibility, session-bus access, and network reach using supported sandbox mechanisms. Deny the agent direct access to secret resolvers and credential stores. If a boundary cannot be enforced, disable the affected automatic execution mode and explain the limitation. This requirement accounts for the limits of the [Secret Service specification](https://specifications.freedesktop.org/secret-service/latest-single/) and the separately configured [OpenClaw sandbox](https://docs.openclaw.ai/gateway/sandboxing).

Audit alternative execution routes and native plugin trust. Do not claim that all third-party plugins are sandboxed. Do not automatically install executable plugins or MCP servers suggested by model output.

Treat webpages, documents, screenshots, email, tool outputs, and MCP descriptions as untrusted data. They must not modify policy, gain secret access, or authorize further tools. Validate paths, symlinks, URLs, argument schemas, and workspace boundaries where those affect access.

Maintain a content-security policy, sanitized output rendering, restricted IPC handlers, and a dependency/security update process. Do not render untrusted HTML with privileged native access.

Show an immediate Stop/Pause control. Cancellation must prevent new steps and report whether an already-running operation actually stopped. Never promise cancellation reversed a completed change.

Pause blocks admission of subsequent actions immediately. Interrupt already-running work only where supported and display its actual state; a model response may still arrive while tools are paused. Resume revalidates grants, target state, and context. Stop uses the runtime cancellation path and cancels broker work where possible. Neither operation implies rollback.

Maintain useful local audit records with secret redaction and configurable retention. Minimize screenshot persistence and exclude the pet/permission UI from capture where practical. A screen-sharing indicator must remain truthful.

## 13. Memory, task state, and integrations

Prefer a local SQLite-backed Duby store for its own preferences, grants, execution journal, and UI projections. Keep OpenClaw-owned sessions/memory behind supported interfaces. Avoid divergent authoritative copies of the same conversation or task.

OpenClaw is authoritative for conversations, model turns, and upstream run lifecycle. The broker is authoritative for Duby grants, revocation, and individual OS-operation outcomes. Pet state, displayed progress, and cached history are rebuildable projections. Persist the mapping between each Duby task, upstream run, and broker operation so reconnect and completion cannot disagree.

Document ownership for each data entity:
- Provider configuration and credential references.
- Access grants and revocations.
- User preferences and approved memories.
- Task/execution records and uncertain outcomes.
- UI event cursors and deduplication.
- Artifact references and change/undo records.
- Integration connection metadata.
- Retention and migration versions.

Memory should be inspectable, editable, exportable, and deletable. Default to explicitly useful user context rather than indexing the whole computer. Index only selected locations and explain what leaves the machine if remote embedding is configured. Use local search before adding a separate vector database.

Delegate narrow subtasks only when useful and supported by the runtime. Limit concurrency and give all subtasks the parent’s permitted scope. Serialize conflicting writes. Do not create competing agents controlling the same desktop simultaneously.

Support optional MCP through OpenClaw’s maintained implementation where compatible. Show a server’s command/destination, requested tools, and permissions before connecting. Namespace tools and use separate authentication. Server annotations are hints, not authority to bypass policy.

Connected services should be added as needed. A generic connector system is preferable to dozens of decorative unimplemented integration cards.

Durable scheduled tasks may be built on the runtime’s supported scheduler, with explicit timezone, visibility, revocation, and fresh authorization rules for consequential work. Do not promise exact reminders while the computer is powered off. Define missed-run and resume behavior and avoid duplicate execution.

## 14. Event model and grounded status

Define versioned Duby event schemas for task start, context request, model waiting, tool request, approval needed, tool start/result/failure, pause, completion, cancellation, and disconnection.

Every event should carry a task ID, event ID, timestamp, source, and ordering/deduplication information appropriate to the transport. Keep user-facing status summaries separate from hidden model reasoning.

A proposed execution envelope should include:
- Request identity and validated input.
- Current grant/policy decision.
- Execution status: queued, running, succeeded, failed, cancelled, or outcome unknown.
- Result/evidence references.
- Error category and a useful recovery option.
- Any reversible-change record.
- Usage and timing when available.

Do not map a sent request directly to a completed task. Report success only after execution evidence or an appropriate post-action observation. Represent partial success and uncertain outcomes honestly.

The interface may display a short plan and action summaries. It must not fabricate internal reasoning, progress percentages, expected completion times, or a success animation unsupported by the runtime.

## 15. Performance and desktop polish

Treat the following as initial engineering targets to measure, not already-achieved guarantees:
- Primary pet model around 10,000–20,000 triangles, about 32 or fewer deform bones, a small material count, and roughly 10 or fewer mascot draw calls.
- Primary GLB target under 5 MB; begin with textures no larger than a 1024-pixel atlas unless visual evidence justifies more.
- Smooth active animation on a documented reference integrated GPU; adapt to 30 fps or simpler effects on battery or weaker hardware.
- Stop continuous rendering while hidden or settled. Use on-demand frames and bounded low-cost idle gestures.
- Limit device-pixel ratio and render only the small visible pet area.
- Keep model inference, file indexing, and blocking work away from the UI thread.
- Reuse GPU resources and recover cleanly from context loss.

Measure CPU, GPU, memory, startup time, panel response, and animation frame timing. Separate the desktop shell, OpenClaw runtime, and any local model server in measurements. Do not hide the Node/runtime or model memory cost behind a low renderer-only number.

Verify transparency, text rendering, input regions, focus, accessibility, suspend/resume, and graphics fallback on real target environments. A browser screenshot or successful compile is insufficient evidence for native desktop behavior.

Bundle assets, fonts where licensed, and decoders. No CDN dependency should be required to display Duby or open settings.

## 16. Packaging, updates, and distribution

Start with a verified x86_64 Linux release, then expand the compatibility matrix deliberately. Initial distribution families should cover Ubuntu/Debian/Linux Mint, Fedora/openSUSE, and Arch-compatible systems through suitable native packages or AppImage. Prepare .deb, .rpm, and AppImage recipes as applicable; only advertise artifacts actually built and tested on documented versions. A compatible package format alone does not establish support for every distribution in its family.

Build against an intentional supported runtime/ABI baseline. Document glibc, C++ runtime, WebKitGTK, graphics, portal, and other native dependencies. AppImage does not remove every host compatibility requirement.

Apply that baseline to the entire process tree: Tauri, bundled Node, OpenClaw native dependencies, broker, and helper executables. Test clean installations with no pre-existing OpenClaw or development environment. The pet, settings, and onboarding shell must open without downloading application code on first launch.

Ship/manage the required compatible runtime so normal users do not need to install development toolchains or Maya/Blender. Document optional local-model installation separately.

Include application and symbolic icons, a desktop entry, standard XDG locations, accessible launch/recovery paths, and an opt-in autostart setting. Avoid shell-profile modifications and undocumented privileged installers.

Flatpak can be an additional distribution path, but its sandbox changes host automation. Use supported portals or a separately authorized host bridge. Do not request indiscriminate host permissions or silently use flatpak-spawn to bypass the intended sandbox.

Treat ARM64 as an independent dependency and packaging validation effort. Provide honest source-build instructions when binaries are not verified.

Use signed updates under Duby-controlled metadata and keys, checksums, compatible runtime/UI updates, and safe migration/rollback. Native package-manager installs should respect package ownership. Never route Duby’s updater to another project’s application feed.

Produce a redacted diagnostic report containing app/runtime versions, distro, session, portal capabilities, graphics route, integration availability, and errors. It must exclude secrets and user document contents.

Uninstall should remove installed components cleanly and let the user choose whether to retain personal data. Updates must not erase unrelated OpenClaw or Coucou installations.

## 17. Implementation phases and completion gates

Phase 0 — Evidence and technical proof:
- Inspect the repository and pin upstream references.
- Produce concise architecture, license, compatibility, and upstream-integration decisions.
- Demonstrate the chosen Tauri/Three.js graphics route on a target Linux desktop.
- Demonstrate authenticated OpenClaw connection and real task events.
- Prove minimal enforcement before real tools: an authenticated broker request, one scoped file operation, one denied out-of-scope request, and rejection of an alternate runtime execution route.
- Prototype GNOME/Wayland and KDE/Wayland anchoring with a genuine animated GLB, plus the X11 baseline; test the highest-risk capture/input paths separately.
- For the layer-shell candidate, prove window-role assignment timing, show/hide/close/reopen, input regions, and renderer ownership before accepting any creation-hook patch.
- Record limitations and choose stable fallbacks before expanding the interface.

Phase 1 — Working vertical slice:
- Launch Duby with an original initial 3D asset.
- Complete provider setup with safe credential handling.
- Run a real selected-file summary task.
- Save its output within a granted folder.
- Show actual task progress, result, denial, error, and cancellation.
- Keep an accessible standalone window throughout.

Phase 2 — Character and complete interface:
- Finish the original rig, core clips, export pipeline, gallery, themes, onboarding, history, settings, and reduced-motion behavior.
- Inspect all assets in the real application.

Phase 3 — Local agency:
- Expand the already-enforced broker boundary to additional desktop controls and browser/API tools; finish memory controls, keychain integration, and recovery.
- Verify alternate OpenClaw routes cannot bypass the chosen boundaries.

Phase 4 — Compatibility and distribution:
- Finish and test desktop-specific integrations.
- Build packages, signed-update support, diagnostic export, migrations, and uninstall behavior.
- Test representative supported environments and classify remaining ones honestly.

Phase 5 — Release review:
- Run the acceptance scenarios, accessibility review, branding/asset review, security checks, and performance measurements.
- Provide artifacts and evidence. Keep unavailable live/provider/platform checks explicitly marked not run.

Do not treat phase boundaries as reasons to stop permanently. Continue through authorized work; if the environment blocks a specific item, complete independent work and report the exact remaining dependency.

## 18. Acceptance scenarios

| Scenario | Required evidence |
| --- | --- |
| Fresh installation | App opens and onboarding works without an IDE or modeling package |
| Branding | First-party surfaces say Duby; restricted Coucou/Mochi assets are absent; required notices remain |
| 3D character | Editable source, real rigged GLB, named clips, validation report, and in-app visual review |
| Basic useful task | Selected file summarized through the configured runtime and output exists in the granted destination |
| Permission denial | Denied operation causes no target mutation; interface recovers |
| Grant revocation | Queued/future actions lose access immediately and ongoing state is reported accurately |
| Scope enforcement | Out-of-scope and symlink-escape attempts are blocked; alternate runtime tools cannot bypass the policy |
| Streaming | Fragmented/interleaved tool calls are reconstructed and executed only when complete |
| Stop/cancel | Further steps stop; actual state of already-started work is visible |
| Reconnect | No duplicate mutation after network/runtime interruption |
| Provider coverage | Adapter/configuration tests exist for each advertised provider; live checks separately identified |
| Offline/local-only | Local UI works; capable local model works where configured; no unintended remote calls |
| Desktop capture | Consent, correct stream/monitor, revocation, screen lock, and stale-context handling tested |
| GUI control | Harmless controlled action verified on each environment advertised as supporting it |
| Window experience | Focus, click-through, panels, scaling, fullscreen, monitor changes, and fallback tested |
| Flagship top-edge experience | Real animated 3D anchoring demonstrated on the named GNOME Wayland, KDE Wayland, and X11 targets; ordinary-window fallback does not pass this gate |
| Accessibility | Keyboard and screen-reader access, contrast, reduced motion, and textual task states verified |
| Credential handling | No keys in renderer, logs, exports, ordinary settings, or unauthorized tool environments |
| Untrusted content | Document/web/MCP instructions cannot expand permissions or obtain secrets |
| Runtime lifecycle | No orphan gateways, restart loops, accidental configuration adoption, or silent task replay |
| Packaging/update | Clean install, launch, update/migration, rollback where supported, and uninstall evidence |
| Performance | Reproducible measurements with hardware/session details; hidden animation does not run continuously |

Use unit/contract tests for policy, event handling, provider boundaries, and lifecycle. Use integration tests for real local file work and runtime connections. Native desktop behavior requires appropriate native integration or manual verification, not browser automation alone.

Use controlled fixtures for consequential tests. Do not use the user’s real files as destructive test data. If credentials or GUI environments are unavailable, provide the fixture coverage and clearly mark live/desktop evidence as outstanding.

## 19. Required handoff

Deliver:
- Working source with pinned dependencies and upstream revision manifest.
- Original 3D source/exported assets and generation pipeline.
- Build/run instructions and available installation artifacts.
- Architecture and data-ownership decisions.
- A feature-by-environment compatibility matrix with supported, limited, experimental, and not-tested states.
- Tests and concise evidence for acceptance scenarios.
- Security/access design and actual enforcement limitations.
- Asset licenses, dependency notices, and provenance.
- Measured performance results.
- Known issues and the next specific work needed.

The final build report must separate implemented functionality, tested functionality, unavailable checks, and future enhancements. Do not label placeholders or unverified environments production-ready.

Start by examining the repository and the pinned-source choices, then implement the first real end-to-end slice. Keep the user informed about meaningful findings and blockers as you work.

---

# Research source appendix

These are primary sources used to shape the requirements. Recheck their applicable content at implementation time. The design, character concept, module layout, performance budgets, and acceptance criteria above are proposed Duby requirements, not claims made by these projects.

## Coucou and reuse

1. [Coucou repository and implementation overview](https://github.com/Louis-CFM/coucou)
2. [Coucou source-code license](https://github.com/Louis-CFM/coucou/blob/main/LICENSE)
3. [Coucou asset and character restrictions](https://github.com/Louis-CFM/coucou/blob/main/LICENSE-ASSETS.md)
4. [Coucou Windows/Tauri implementation](https://github.com/Louis-CFM/coucou/blob/main/windows/README.md)

## OpenClaw

5. [Canonical OpenClaw repository](https://github.com/openclaw/openclaw)
6. [OpenClaw license](https://github.com/openclaw/openclaw/blob/main/LICENSE)
7. [Embedding OpenClaw](https://docs.openclaw.ai/gateway/embedding)
8. [Building a Gateway client](https://docs.openclaw.ai/gateway/clients)
9. [Linux companion and compatibility limits](https://docs.openclaw.ai/platforms/linux)
10. [Sandboxing](https://docs.openclaw.ai/gateway/sandboxing)
11. [Exec approvals](https://docs.openclaw.ai/tools/exec-approvals)
12. [Secrets](https://docs.openclaw.ai/gateway/secrets)
13. [Native Ollama integration](https://docs.openclaw.ai/providers/ollama)
14. [Custom model providers](https://docs.openclaw.ai/concepts/model-providers/custom-providers)
15. [MCP integration](https://docs.openclaw.ai/tools/mcp)

## Linux integration

16. [RemoteDesktop portal](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.RemoteDesktop.html)
17. [ScreenCast portal](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.ScreenCast.html)
18. [GlobalShortcuts portal](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.GlobalShortcuts.html)
19. [Freedesktop Secret Service specification](https://specifications.freedesktop.org/secret-service/latest-single/)
20. [Mutter window placement API](https://mutter.gnome.org/meta/method.Window.move_resize_frame.html)
21. [GTK layer-shell documentation](https://wmww.github.io/gtk-layer-shell/)

## AI provider contracts

22. [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)
23. [OpenAI computer use](https://developers.openai.com/api/docs/guides/tools-computer-use)
24. [Anthropic OpenAI compatibility limits](https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk)
25. [Gemini computer use](https://ai.google.dev/gemini-api/docs/computer-use)
26. [Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility)

## 3D production and rendering

27. [Official Khronos Blender glTF importer/exporter](https://github.com/KhronosGroup/glTF-Blender-IO)
28. [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
29. [Three.js animation controller](https://threejs.org/docs/pages/AnimationMixer.html)
30. [Rendering and performance guidance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)
31. [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator)
32. [Qt Quick 3D, including module licensing](https://doc.qt.io/qt-6/qtquick3d-index.html)

## Additional execution-boundary references

33. [OpenClaw native plugin architecture](https://docs.openclaw.ai/plugins/architecture)
34. [OpenClaw tool permissions](https://docs.openclaw.ai/gateway/security/tool-permissions)
35. [Tauri Linux graphics behavior](https://v2.tauri.app/develop/debug/linux-graphics/)
36. [Tauri layer-shell creation timing issue](https://github.com/tauri-apps/tauri/issues/14277)
