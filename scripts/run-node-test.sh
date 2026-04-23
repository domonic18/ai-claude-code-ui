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
shopt -s globstar nullglob
EXPANDED=()
for pattern in "$@"; do
    for f in $pattern; do
        EXPANDED+=("$f")
    done
done
shopt -u globstar nullglob

# If no files matched, report error (glob patterns should always resolve in CI)
if [ ${#EXPANDED[@]} -eq 0 ]; then
    echo "ERROR: No test files matched patterns: $*" >&2
    exit 1
fi

ARGS+=("${EXPANDED[@]}")

# Execute with inherited stdio for proper CI output
exec node "${ARGS[@]}"
