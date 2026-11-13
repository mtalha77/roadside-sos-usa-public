#!/usr/bin/env bash
# Fails if a build log contains warnings (Gate 1: warnings are failures).
# Usage: scripts/ci/assert-no-warnings.sh build.log
set -euo pipefail
log="${1:?log file}"
if grep -nE '⚠|(^|[^a-z-])(warn|warning)([^a-z]|$)' -i "$log" | grep -viE 'no-warn|warnings? as (failures|errors)|0 warnings|No tasks were executed'; then
  echo "::error::Build produced warnings (see lines above). Fix them: warnings fail the build."
  exit 1
fi
echo "No build warnings."
