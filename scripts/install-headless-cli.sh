#!/usr/bin/env bash
set -euo pipefail

source_binary="${1:-./rcodexmanager}"
install_root="${RCODEXMANAGER_INSTALL_ROOT:-$HOME/.local}"
destination="$install_root/bin/rcodexmanager"

if [[ ! -f "$source_binary" ]]; then
  printf 'rcodexmanager binary not found: %s\n' "$source_binary" >&2
  exit 1
fi

mkdir -p "$(dirname "$destination")"
install -m 0755 "$source_binary" "$destination"

printf 'installed: %s\n' "$destination"
if ! command -v tmux >/dev/null 2>&1; then
  printf 'note: install tmux to use persistent server profile start/stop.\n'
fi
printf 'use this absolute path in the Mac server-node setting when ~/.local/bin is not in non-interactive SSH PATH.\n'

