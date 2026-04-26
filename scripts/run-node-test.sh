#!/usr/bin/env bash
# run-node-test.sh - Cross-version Node.js test runner
#
# Detects the Node.js major version and conditionally enables --test-force-exit
# on Node 20+ to prevent test process hangs caused by lingering async resources.
#
# Usage: ./scripts/run-node-test.sh <test-file-pattern...>

set -euo pipefail

# Provide fallback values for required env vars when running in CI without .env
export AVAILABLE_MODELS="${AVAILABLE_MODELS:-test:Test}"

# Extract Node.js major version (e.g. "v20.19.3" → 20)
NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")

# Base arguments: always use the built-in test runner
ARGS=("--test")

# --test-force-exit was introduced in Node 20.0.0
# On Node 18, omitting it avoids the "bad option" fatal error in CI
if [ "$NODE_MAJOR" -ge 20 ]; then
  ARGS+=("--test-force-exit")
fi

# Expand glob patterns into actual file paths
# npm scripts pass globs as literal strings (single-quoted);
# Node --test does not expand globs on all platforms, so we expand them here.
# globstar requires bash 4+; use find as a portable fallback for ** patterns.
EXPANDED=()
for pattern in "$@"; do
    case "$pattern" in
        *'**'*)
            dir_prefix="${pattern%%\*\**}"
            dir_prefix="${dir_prefix%/}"
            [ -z "$dir_prefix" ] && dir_prefix="."
            suffix="${pattern#*\*\*}"
            suffix="${suffix#/}"
            # Convert glob suffix to find -path pattern: ** → *, * → valid find wildcard
            find_path="*"
            [ -n "$suffix" ] && find_path="*/$suffix"
            while IFS= read -r -d '' f; do
                EXPANDED+=("$f")
            done < <(find "$dir_prefix" -path "$find_path" -print0 2>/dev/null)
            ;;
        *)
            shopt -s nullglob 2>/dev/null || true
            for f in $pattern; do
                EXPANDED+=("$f")
            done
            shopt -u nullglob 2>/dev/null || true
            ;;
    esac
done

# If no files matched, report error (glob patterns should always resolve in CI)
if [ ${#EXPANDED[@]} -eq 0 ]; then
    echo "ERROR: No test files matched patterns: $*" >&2
    exit 1
fi

ARGS+=("${EXPANDED[@]}")

# Execute with inherited stdio for proper CI output
exec node "${ARGS[@]}"
