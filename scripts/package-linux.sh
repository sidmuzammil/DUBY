#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
node scripts/stage-runtime.mjs
# Development helpers and original editable art do not need to be bundled as runtime code.
npx tauri build --config apps/desktop/src-tauri/tauri.conf.json --config packaging/runtime.conf.json
mkdir -p .artifacts/packages
find target/release/bundle -type f \( -name '*.deb' -o -name '*.rpm' -o -name '*.AppImage' \) -exec cp {} .artifacts/packages/ \;
(cd .artifacts/packages && sha256sum -- *.deb *.rpm > SHA256SUMS)
