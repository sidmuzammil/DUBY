# Security boundary

This is an unprivileged alpha, with a deliberately small enabled tool surface.

## What is enforced

- Only three trusted tools are exposed. Exact runtime allowlists plus deny groups
  disable alternate shell, filesystem, browser, node, plugin-install, messaging,
  scheduler, media, setup-agent and MCP routes. A real model-fixture test asks for
  `exec`; the Gateway rejects it and no target is created.
- Grants originate in native folder selection or a native confirmation of a typed
  absolute path. They last at most one hour in the UI and disappear at app exit.
  The root filesystem and entire home directory cannot be granted.
- The broker authenticates its private Unix-socket caller. The directory is 0700,
  the socket 0600, and the token is sent to trusted background components only.
- Trusted runtime factory context supplies agent/session identity and tool-call ID.
  A task must have been admitted by the native app; model-supplied identity fields
  are rejected. A conversation without a folder has no file authority.
- Directory handles and cap-std constrain ambient filesystem access. Path traversal,
  absolute paths, hidden components, and symlinks are denied. Component-by-component
  no-follow opens prevent check/open symlink swaps from changing the access scope.
- Reads are UTF-8 regular files capped at 256 KiB. Searches have entry/depth bounds.
  Saves use a new temporary file, fsync and atomic create-only hard-link publication.
  No destination is overwritten; existing symlinks cannot redirect writes.
- Task/call IDs and argument fingerprints prevent duplicate mutations. An uncertain
  or failed operation is not automatically replayed. Pause/revoke/stop block future
  admission. An already published small file operation is not rolled back.
- Provider keys are entered via `secret-tool`, never the renderer. OpenClaw receives
  supported SecretRefs; ordinary config contains references, not secret values.
  Child environments are explicitly constructed, not copied wholesale. Arbitrary
  tool subprocesses and third-party executable plugins are disabled.
- CSP limits scripts/assets and native IPC. Provider content is rendered as text.
  No secret values or document contents enter diagnostic exports.

## Limits and threat model

Trusted components include the native app, pinned OpenClaw/Node installation, and
Duby's single bundled plugin. In-process plugins are not sandboxes. This is not
protection against a compromised user account, root, modified application binaries,
or arbitrary trusted native plugin code. A same-user attacker can often inspect
processes or access Secret Service; keychain storage alone is not process isolation.

This environment cannot create the tested Bubblewrap user/network namespace
(`setting up uid map: Read-only file system`). Automatic shell, GUI control, screen
capture, microphone, remote MCP and execution-plugin installation therefore stay
disabled. They are not “approved” by a frontend toggle or a model prompt.

Ollama is restricted to loopback native endpoints and non-`:cloud` model IDs, but a
separately running server's egress is not controlled. No enforced-offline inference
claim is made. Hosted inference sends the selected task/context to its configured
provider. No provider fallback or model download happens silently.

Grants permit user-selected document content to be read. Duby does not classify every
visible document as secret or non-secret. Choose narrow folders and avoid credentials.
The operation journal can retain read results to make duplicate receipts deterministic;
it is private application data, not an encrypted document vault. Clear it from Activity.
Memories remain until explicitly deleted and are exported only on user request.

No external messages, purchases, destructive actions, root operation, or account
changes are available to the model in this release. No payments were made during build.
Signed updates remain disabled until Duby-controlled signing keys and rollback tests
are available. Never point the updater at another project's feed.

## Reporting and updates

The production dependency audit currently reports **three unresolved packages**
inside OpenClaw's bundled npm: brace-expansion 5.0.9 (high), undici 6.28.0 (high),
and ip-address 10.5.0 (moderate). The newer npm 11.21.0 and 12.2.0 packages checked
retain these versions; npm overrides do not replace their bundled dependencies.
The exposed runtime cannot execute npm or install packages, but that restriction
does not constitute a vulnerability fix. See `evidence/npm-audit.json`. Resolving
and revalidating these advisories is a production-release gate.

Do not publish secrets or private documents in an issue. Share a redacted diagnostic
report and minimal fixture. Dependency updates require repinning and rerunning broker,
Gateway compatibility, alternate-route, credential-residue and packaging checks.
