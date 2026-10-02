# Linux packaging

Run `npm run package` from the repository root. Native bundle settings live in
`apps/desktop/src-tauri/tauri.conf.json`; runtime staging is explicit in
`scripts/stage-runtime.mjs` and `packaging/runtime.conf.json`. Output includes a real Node runtime and an ordinary
OpenClaw installation, not a flattened module tree.

The complete runtime is zstd-compressed once and checksum-verified before local
extraction on the first AI connection. The outer RPM payload uses no additional
compression. Development builds do not need the staged archive.

`scripts/inspect-packages.py` checks both payloads, the ELF executable, desktop
entry and embedded runtime hash without installing a package. Run it with
`rpmfile==2.1.0` in an isolated Python environment. Results and exact artifact
checksums are recorded in `docs/evidence/packages.json`.

The initial build uses Debian 13 x86_64 / glibc 2.41. The .deb and .rpm recipes are
provided, but a package extension is not cross-distribution compatibility evidence.
Current validation is in `docs/STATUS.md`. Do not claim AppImage, ARM64, clean Fedora
installation, or a signed update channel until those exact artifacts are tested.

No updater is enabled. Before enabling one, provision Duby-owned signing keys via
secure release infrastructure, publish checksummed compatible UI/runtime pairs,
and test interrupted updates, schema migrations and rollback. Never commit keys.
Package-manager installs must continue to be owned by their package manager.
