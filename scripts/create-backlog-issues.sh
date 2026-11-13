#!/usr/bin/env bash
# Creates one issue per RSOS ticket (RSOS-001 to RSOS-097), titles only, labelled by phase.
# Known tickets come from scripts/backlog-tickets.tsv; the rest get a placeholder title until specified.
# Finished tickets are closed as completed. Safe to re-run (skips existing titles).
set -euo pipefail
repo="${1:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
here="$(cd "$(dirname "$0")" && pwd)"
for l in foundations design-system data-auth website unscheduled; do
  gh label create "phase:$l" -R "$repo" --color c5def5 --description "Backlog phase: $l" --force >/dev/null
done
existing=$(gh issue list -R "$repo" --state all --limit 500 --search "RSOS- in:title" --json title --jq '.[].title')
for n in $(seq -w 1 97); do
  id=$(printf '%03d' "$((10#$n))")
  line=$(awk -F"\t" -v id="$id" '$1==id' "$here/backlog-tickets.tsv")
  if [ -n "$line" ]; then IFS=$'\t' read -r _ name phase state <<<"$line"; else name="To be specified"; phase="unscheduled"; state="open"; fi
  title="RSOS-${id}: ${name}"
  if grep -qxF "$title" <<<"$existing"; then continue; fi
  url=$(gh issue create -R "$repo" --title "$title" --label "phase:$phase" --body "Ticket RSOS-${id}. Spec: docs/batches/ (or to be written)." )
  if [ "$state" = done ]; then gh issue close "$url" -R "$repo" --reason completed >/dev/null; fi
  echo "$title ($state)"
done
