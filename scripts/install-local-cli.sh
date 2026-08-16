#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
install_root="${RCODEXMANAGER_INSTALL_ROOT:-$HOME/.local}"
destination="$install_root/bin/rcodexmanager"
host_target="$(rustc -vV | awk '/^host:/ { print $2 }')"
source_binary="${1:-$repo_root/target/$host_target/release/rcodexmanager}"

if [[ $# -eq 0 ]]; then
  cargo build --release --locked --manifest-path "$repo_root/src-tauri/Cargo.toml" --target "$host_target"
elif [[ ! -x "$source_binary" ]]; then
  printf 'rcodexmanager binary not found: %s\n' "$source_binary" >&2
  exit 1
fi

mkdir -p "$(dirname "$destination")"
install -m 0755 "$source_binary" "$destination"

"$destination" --json info
printf 'installed: %s\n' "$destination"
