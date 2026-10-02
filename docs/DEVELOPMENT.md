# Development and distribution

## Reproducibility

Node is pinned in `.nvmrc`, Rust in `rust-toolchain.toml`, npm dependency resolutions
in `package-lock.json`, and Rust resolutions in `Cargo.lock`. Use `npm ci` and locked
Cargo commands. The reviewed upstream SHAs, releases, source licenses and lockfile
hashes are in `upstream-manifest.json`. OpenClaw is unmodified; a reproducible
npm dependency repack is documented in `vendor/README.md`.

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

Native smoke testing uses Xvfb with software graphics. Debian WebKitGTK hardcodes
its helper location under `/usr/lib`, while cloud helpers live in the sysroot.
`scripts/relocate-webkit-test.py` changes only that path constant in a private test
copy of the library. The original library and production artifacts remain unchanged.
No sandbox-disable flag is used. PRoot is no longer used: its filesystem EFAULT
errors prevented reliable Gateway startup.

```bash
source /workspace/toolchains/activate.sh
python3 scripts/relocate-webkit-test.py
# Start once in a separate terminal:
Xvfb :99 -screen 0 1280x900x24 -nolisten tcp
# For transparent companion checks, in another terminal:
DISPLAY=:99 xcompmgr -n
# With an extracted Debian package (debug mode also needs the Vite server):
DISPLAY=:99 GSETTINGS_BACKEND=memory \
DUBY_TEST_BINARY="$PWD/.artifacts/installed/usr/bin/duby" \
DUBY_TEST_RUNTIME=1 DUBY_TEST_EXPORT=1 \
LD_LIBRARY_PATH="/workspace/toolchains/webkit-relocated:$LD_LIBRARY_PATH" \
GI_TYPELIB_PATH=/workspace/toolchains/sysroot/usr/lib/x86_64-linux-gnu/girepository-1.0 \
WEBKIT_INJECTED_BUNDLE_PATH=/workspace/toolchains/sysroot/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1/injected-bundle \
WEBKIT_DISABLE_DMABUF_RENDERER=1 \
dbus-run-session /usr/bin/python3 tests/native-smoke.py
```

Replace `native-smoke.py` with `native-ai-flow.py` for a deterministic local model
fixture exercising the native credential dialog, Gateway/plugin/broker file flow,
restart recovery and credential residue. It makes no hosted requests. The shared
driver uses actual GTK/WebKit AT-SPI controls, clipboard input, native confirmation
and private fixture data. It restores X11 keyboard focus because Xvfb has no window
manager. These checks do not establish real GNOME/KDE or hardware compatibility.
`native-companion.py` checks actual GLB pixels, placement, mode changes, autostart and
quit. `native-performance.py` records process-tree PSS, idle CPU and readiness times
without sending a model request; run it when other builds are idle. For an AppImage,
extract with `--appimage-extract` and set `DUBY_TEST_BINARY` to its `AppRun`.

## Packaging

`npm run package` builds the frontend, stages a normal production dependency
installation plus the exact running Node executable, builds the native shell and
bundles `.deb` / `.rpm`. Artifacts and checksums go in `.artifacts/packages/`.
Staging preserves package exports, package metadata, native modules and notices.
The complete tree is bundled as `runtime.tar.zst`. When the background bridge first starts,
Rust verifies its SHA-256 and extracts it into a private content-addressed `engines/`
directory. Later starts reuse a completed extraction. This is local extraction,
not a code download. The archive is configured in `packaging/runtime.conf.json`,
so ordinary debug builds do not require staging a production runtime first.
It does not flatten OpenClaw's `dist` tree. End users do not need Node, npm, Rust,
Blender or an existing OpenClaw installation to open the installed shell.

Only build with the intended runtime/ABI baseline. The current artifacts were built
on Debian 13 with glibc 2.41; they are not binaries for older Ubuntu/Debian systems.
The Debian dependency and RPM symbol requirement enforce that glibc baseline.
The manual CI recipe uses Ubuntu 24.04 as a future separate baseline, but it was not
run during this build. The RPM needs its own clean-install validation.
`bash scripts/package-appimage.sh` builds an AppImage with the same ABI baseline
and explicit host WebKitGTK 4.1 prerequisite. In this cloud sysroot, use
`XDG_CACHE_HOME=/workspace/.cache` and
`LD_GTK_LIBRARY_PATH=/workspace/toolchains/sysroot/usr/lib/x86_64-linux-gnu`; GTK
runtime modules must exist there. The finalizer preserves sysroot notices and uses
host WebKit to avoid mismatched helpers. ARM64 and signed updates remain unverified.
AppImage autostart records the portable `APPIMAGE` launcher, not its temporary mounted
binary. Moving that launcher later requires toggling autostart off and on again.

GitHub workflows are manually dispatched. The release workflow only runs on this
public repository's main branch and uses a free standard Ubuntu 24.04 runner, with
no paid/larger runner or retained Actions artifacts. It was used to publish the
development-alpha .deb and checksum in `v0.1.0-alpha.1`; no billing setting changed.
Do not put large installers into Git history. The workflow verifies the draft
release download before publishing, and refuses to overwrite an already-published
release. Future versions need a new draft/tag and a corresponding workflow update.

Source and all original development commits are published at `sidmuzammil/DUBY`.
The authenticated GitHub API provided write access as `sidmuzammil` while this
cloud's Git push route still used another account. Publication preserved commit and
tree hashes and updated the branch with fast-forward enforcement. Ordinary Git
fetch works; future Git pushes require the connected account to have write access.
The portable backup can also be cloned with `git clone Duby-source.bundle Duby`.

## Recovery and uninstall

Duby uses its XDG application data directory, including `duby.sqlite` for its own
records and a distinct `runtime/` directory for the managed Gateway. It does not
modify another OpenClaw installation. Grants are session-only. Stop an uncertain
task and inspect its operation receipt/output before retrying; the app never claims
that cancellation undid a completed save.

A missing/locked Secret Service can use the native **Use a key for this session**
dialog. **Forget session keys** disconnects the runtime and discards those keys.
No keys are accepted through the chat composer or ordinary settings.

Use the package manager to remove the package (`apt remove duby` on Debian).
Disable Autostart in Settings and remove the optional GNOME extension before
uninstalling. Personal XDG data and keychain credentials are retained; remove them if
desired. Keep unrelated `~/.openclaw` data. Future updates must migrate schema versions
explicitly; this app refuses to modify a database from a newer schema.
