# Development and distribution

## Reproducibility

Node is pinned in `.nvmrc`, Rust in `rust-toolchain.toml`, npm dependency resolutions
in `package-lock.json`, and Rust resolutions in `Cargo.lock`. Use `npm ci` and locked
Cargo commands. The reviewed upstream SHAs, releases, source licenses and lockfile
hashes are in `upstream-manifest.json`. No upstream patches are applied.

Run from the repository root:

```bash
npm ci
npm run desktop
npm run check
cargo test -p duby-broker --locked
npm run test:flow
node tests/runtime-security.mjs
```

The model tests use an in-process HTTP fixture; they perform actual Gateway
handshakes, streaming assembly and broker operations. They do not evaluate model
quality or claim that a live hosted/local model was tested.

To regenerate the character use Blender **4.3.2** and `npm run assets`. The script
creates geometry, a 10-bone rig, four skinned material meshes, twelve authored clips,
four reference renders, and a 4×3 fallback atlas. `npm run assets:check` records the
Khronos validation result. Four non-root skinned-mesh warnings are retained and
explained by the exported armature hierarchy; there are no validation errors.
Native rendering was inspected, not inferred from the presence of a GLB file.

## This cloud machine

The cloud user cannot modify `/usr` and has no system package installation rights.
`scripts/setup-cloud.sh` downloads packages through APT's signed Debian repositories
and extracts them into `/workspace/toolchains/sysroot`; it never disables signatures,
checksums or TLS. Development library symlinks use the already installed matching
Debian runtime libraries when applicable. Rust and npm caches live in `/workspace`.

```bash
bash scripts/setup-cloud.sh
source /workspace/toolchains/activate.sh
npm run dev
```

Native smoke testing in this machine uses Xvfb with software graphics. The distro
WebKitGTK library has an absolute helper path, so a development-only PRoot mapping
locates the extracted helpers without modifying the host:

```bash
source /workspace/toolchains/activate.sh
Xvfb :99 -screen 0 1280x900x24 -nolisten tcp
# In another terminal, with the Vite development server running:
DISPLAY=:99 \
WEBKIT_INJECTED_BUNDLE_PATH=/workspace/toolchains/sysroot/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1/injected-bundle \
WEBKIT_DISABLE_DMABUF_RENDERER=1 \
proot -b /workspace/toolchains/sysroot/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1:/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1 \
dbus-run-session target/debug/duby
```

For the native automated UI flow, also set
`GI_TYPELIB_PATH=/workspace/toolchains/sysroot/usr/lib/x86_64-linux-gnu/girepository-1.0`
and `GSETTINGS_BACKEND=memory`, then replace the final executable with
`/usr/bin/python3 tests/native-smoke.py`. It uses AT-SPI to locate controls, native
confirmation, real clipboard input and actual broker writes in temporary fixtures.
`DUBY_TEST_BINARY` selects an extracted package executable; `DUBY_TEST_RUNTIME=1`
checks the bundled Gateway handshake without inference, and `DUBY_TEST_EXPORT=1`
checks the broker-backed diagnostic export. Bind the extracted `/usr/lib/Duby`
resource directory into the same PRoot session when testing a Debian package.

Use separate XDG data/config/cache locations for fixture runs. These processes must
be restarted after restoring a cloud snapshot. Do not treat PRoot or Xvfb as an
application sandbox or as a real GNOME/KDE compatibility test. This old PRoot build
causes filesystem-metadata errors in GTK's folder picker; the native-confirmed path
entry is provided as a fallback. No WebKit sandbox-disable flags were used.

## Packaging

`npm run package` builds the frontend, stages a normal production dependency
installation plus the exact running Node executable, builds the native shell and
bundles `.deb` / `.rpm`. Artifacts and checksums go in `.artifacts/packages/`.
Staging preserves package exports, package metadata, native modules and notices.
The complete tree is bundled as `runtime.tar.zst`. On the first AI connection,
Rust verifies its SHA-256 and extracts it into a private content-addressed `engines/`
directory. Later starts reuse a completed extraction. This is local extraction,
not a code download. The archive is configured in `packaging/runtime.conf.json`,
so ordinary debug builds do not require staging a production runtime first.
It does not flatten OpenClaw's `dist` tree. End users do not need Node, npm, Rust,
Blender or an existing OpenClaw installation to open the installed shell.

Only build with the intended runtime/ABI baseline. The current artifacts were built
on Debian 13 with glibc 2.41; they are not binaries for older Ubuntu/Debian systems.
The manual CI recipe uses Ubuntu 24.04 as a future separate baseline, but it was not
run during this build. The RPM needs its own clean-install validation. AppImage and
ARM64 packaging are outstanding. There is no signed update feed in this alpha.

The GitHub workflow is manually dispatched. Building it may consume the repository
owner's Actions allowance. No workflow was triggered, and no billing setting changed.
Do not put large installers into Git history. Upload them to a reviewed release only
when the GitHub API is available; this cloud environment returned Forbidden.

The attempted push to `sidmuzammil/DUBY` was denied to the configured `Protectol`
identity. No alternate GitHub login is configured. Local commits and
`.artifacts/packages/Duby-source.bundle` preserve the source. With repository write
credentials restored, publish the existing checkout with `git push -u origin main`.
The bundle can also be cloned with `git clone Duby-source.bundle Duby`.

## Recovery and uninstall

Duby uses its XDG application data directory, including `duby.sqlite` for its own
records and a distinct `runtime/` directory for the managed Gateway. It does not
modify another OpenClaw installation. Grants are session-only. Stop an uncertain
task and inspect its operation receipt/output before retrying; the app never claims
that cancellation undid a completed save.

A missing/locked Secret Service prevents hosted connection; unlock the keychain or
use a local model. This release does not implement a session-only credential prompt.
No keys are accepted through the chat composer or ordinary settings.

Use the package manager to remove the package (`apt remove duby` on Debian).
Personal XDG data and keychain credentials are retained; remove them deliberately if
desired. Keep unrelated `~/.openclaw` data. Future updates must migrate schema versions
explicitly; this app refuses to modify a database from a newer schema.
