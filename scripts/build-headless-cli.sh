#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
manifest="$repo_root/headless-cli/Cargo.toml"

cargo build --release --locked --manifest-path "$manifest"

binary="$repo_root/target/release/rcodexmanager"
printf 'headless CLI: %s\n' "$binary"
file "$binary"
