#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_dir="$repo_root/skills/rcodexmanager"
target_home="${CODEX_HOME:-$HOME/.codex}"
mode="install"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check)
      mode="check"
      shift
      ;;
    --home)
      if [[ $# -lt 2 ]]; then
        printf '%s\n' 'missing value for --home' >&2
        exit 2
      fi
      target_home="$2"
      shift 2
      ;;
    *)
      printf 'unknown option: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

destination="$target_home/skills/rcodexmanager"
files=(
  "SKILL.md"
  "agents/openai.yaml"
  "references/cli.md"
  "references/workflows.md"
)

if [[ "$mode" == "check" ]]; then
  for relative_path in "${files[@]}"; do
    installed="$destination/$relative_path"
    if [[ ! -f "$installed" ]]; then
      printf 'skill file missing: %s\n' "$installed" >&2
      exit 1
    fi
    if ! cmp -s "$source_dir/$relative_path" "$installed"; then
      printf 'skill file differs: %s\n' "$installed" >&2
      exit 1
    fi
  done
  printf 'skill is synchronized: %s\n' "$destination"
  exit 0
fi

for relative_path in "${files[@]}"; do
  installed="$destination/$relative_path"
  mkdir -p "$(dirname "$installed")"
  install -m 0644 "$source_dir/$relative_path" "$installed"
done

printf 'skill installed: %s\n' "$destination"
printf 'verify with: %s --check --home %q\n' "$0" "$target_home"
