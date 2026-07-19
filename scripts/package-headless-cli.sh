#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "$(uname -s)" != "Linux" ]]; then
  printf 'Linux headless packages must be built on Linux or by the release workflow.\n' >&2
  exit 1
fi

label="${1:-linux-$(uname -m)}"
package_dir="$repo_root/dist/headless/$label"
archive="$repo_root/dist/rcodexmanager-$label.tar.gz"

"$repo_root/scripts/build-headless-cli.sh"

rm -rf "$package_dir"
mkdir -p "$package_dir"
install -m 0755 "$repo_root/target/release/rcodexmanager" "$package_dir/rcodexmanager"
install -m 0755 "$repo_root/scripts/install-headless-cli.sh" "$package_dir/install.sh"
tar -C "$package_dir" -czf "$archive" rcodexmanager install.sh

printf 'headless package: %s\n' "$archive"
