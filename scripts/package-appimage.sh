#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Run npm run package first to stage the pinned managed runtime.
npx tauri build --config apps/desktop/src-tauri/tauri.conf.json --config packaging/runtime.conf.json --bundles appimage
python3 scripts/finalize-appimage.py
appdir="$PWD/target/release/bundle/appimage/Duby.AppDir"
plugin="${XDG_CACHE_HOME:-$HOME/.cache}/tauri/linuxdeploy-plugin-appimage.AppImage"
test -x "$plugin"
mkdir -p .artifacts/packages
cd .artifacts/packages
APPIMAGE_EXTRACT_AND_RUN=1 ARCH=x86_64 VERSION=0.1.0 OUTPUT=Duby_0.1.0_amd64.AppImage "$plugin" --appdir="$appdir"
sha256sum -- *.deb *.rpm *.AppImage > SHA256SUMS
