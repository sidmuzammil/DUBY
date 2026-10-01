#!/usr/bin/env bash
# Reproducible unprivileged Debian 13 development setup. No repository edits.
set -euo pipefail
cd "$(dirname "$0")/.."
base=/workspace/toolchains
apt_state=/workspace/.cache/apt
mkdir -p "$base" "$apt_state"/{lists/partial,archives/partial,sourceparts,apt.conf.d}
cat > "$apt_state/sources.list" <<'SOURCES'
deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] https://deb.debian.org/debian trixie main
deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] https://deb.debian.org/debian-security trixie-security main
SOURCES
cat > "$apt_state/config" <<'CONFIG'
Dir::Etc::main "/dev/null";
Dir::Etc::parts "/workspace/.cache/apt/apt.conf.d";
Dir::Etc::sourcelist "/workspace/.cache/apt/sources.list";
Dir::Etc::sourceparts "/workspace/.cache/apt/sourceparts";
Dir::State::lists "/workspace/.cache/apt/lists";
Dir::Cache::archives "/workspace/.cache/apt/archives";
APT::Get::List-Cleanup "false";
Debug::NoLocking "true";
CONFIG
export APT_CONFIG="$apt_state/config"
/usr/bin/apt-get update
/usr/bin/apt-get install --download-only -y --no-install-recommends libwebkit2gtk-4.1-dev \
  libappindicator3-dev librsvg2-dev patchelf libssl-dev xvfb dbus-x11 proot xdotool \
  gir1.2-atspi-2.0 libtalloc2 zstd
mkdir -p "$base/sysroot"
for deb in "$apt_state"/archives/*.deb; do dpkg-deb -x "$deb" "$base/sysroot"; done
python3 - <<'PY'
import pathlib,os
root=pathlib.Path('/workspace/toolchains/sysroot')
for p in root.rglob('*'):
 if p.is_symlink() and not p.exists():
  target=pathlib.Path(os.readlink(p))
  source=target if target.is_absolute() else pathlib.Path('/')/p.parent.relative_to(root)/target
  if source.exists():p.unlink();p.symlink_to(source)
PY
export CARGO_HOME="$base/cargo" RUSTUP_HOME="$base/rustup"
if [ ! -x "$CARGO_HOME/bin/rustup" ]; then
  curl --proto '=https' --tlsv1.2 -fL https://sh.rustup.rs -o "$base/rustup-init.sh"
  sh "$base/rustup-init.sh" -y --no-modify-path --profile minimal --default-toolchain 1.99.0
fi
cat > "$base/activate.sh" <<'ACTIVATE'
export CARGO_HOME=/workspace/toolchains/cargo
export RUSTUP_HOME=/workspace/toolchains/rustup
export PATH=/workspace/toolchains/cargo/bin:/workspace/toolchains/sysroot/usr/bin:$PATH
export PKG_CONFIG_PATH=/workspace/toolchains/sysroot/usr/lib/x86_64-linux-gnu/pkgconfig:/workspace/toolchains/sysroot/usr/share/pkgconfig
export PKG_CONFIG_SYSROOT_DIR=/workspace/toolchains/sysroot
export LIBRARY_PATH=/workspace/toolchains/sysroot/usr/lib/x86_64-linux-gnu
export LD_LIBRARY_PATH=/workspace/toolchains/sysroot/usr/lib/x86_64-linux-gnu
export NPM_CONFIG_CACHE=/workspace/.cache/npm
export CARGO_BUILD_JOBS=4
ACTIVATE
source "$base/activate.sh"
rustup toolchain install 1.99.0 --profile minimal --component rustfmt,clippy
node -e 'const [major,minor]=process.versions.node.split(".").map(Number);if(major!==24||minor<16)throw Error("Use Node 24.19.0 from .nvmrc")'
npm ci
npm run check
cargo test -p duby-broker --locked
