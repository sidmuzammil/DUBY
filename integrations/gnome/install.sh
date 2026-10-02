#!/usr/bin/env bash
set -euo pipefail
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
extension_id=duby@sidmuzammil.github.io
target_dir="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$extension_id"
mkdir -p "$target_dir"
install -m 644 "$source_dir/$extension_id/metadata.json" "$source_dir/$extension_id/extension.js" "$target_dir/"
printf '%s\n' 'Installed the optional experimental Duby GNOME extension.' 'Sign out and back in, then enable it in Extensions and choose Top edge in Duby Settings.'
