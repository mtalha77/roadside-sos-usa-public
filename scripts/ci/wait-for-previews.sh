#!/usr/bin/env bash
# Waits for the Vercel preview deployments of a commit and writes their URLs to $GITHUB_OUTPUT
# (web_url, provider_url, admin_url). Apps Vercel skipped (unaffected) get no URL.
# Reads GitHub deployment statuses, which turn "success" as soon as a preview is live (Vercel's
# check runs finish minutes later, so they are only used to learn which apps are building).
# Usage: scripts/ci/wait-for-previews.sh <sha>   (needs GH_TOKEN and GITHUB_REPOSITORY)
set -euo pipefail
sha="${1:?commit sha}"
repo="${GITHUB_REPOSITORY:?}"
out="${GITHUB_OUTPUT:-/dev/stdout}"
deadline=$((SECONDS + 900))

declare -A url=()
while :; do
  # Apps Vercel is deploying for this commit (a check run per project).
  apps=$(gh api "repos/$repo/commits/$sha/check-runs?per_page=100" --jq '.check_runs[] | select(.name | startswith("Vercel – rsos-")) | "\(.name | sub("Vercel – rsos-"; ""))=\(.status)/\(.conclusion // "")"' | sort -u)
  waiting=0
  for entry in $apps; do
    app=${entry%%=*}
    state=${entry#*=}
    [ -n "${url[$app]:-}" ] && continue
    case "$state" in completed/skipped | completed/neutral | completed/cancelled) continue ;; esac
    if [ "$state" = "completed/failure" ]; then echo "::error::Vercel build failed for $app"; exit 1; fi
    for id in $(gh api "repos/$repo/deployments?sha=$sha&per_page=50" --jq ".[] | select(.environment | test(\"rsos-$app\")) | .id"); do
      u=$(gh api "repos/$repo/deployments/$id/statuses" --jq '[.[] | select(.state == "success")][0].environment_url // empty')
      if [ -n "$u" ]; then url[$app]=$u; break; fi
    done
    [ -z "${url[$app]:-}" ] && waiting=$((waiting + 1))
  done
  if [ -n "$apps" ] && [ "$waiting" -eq 0 ]; then break; fi
  if [ -z "$apps" ] && [ $SECONDS -gt 180 ]; then echo "No Vercel deployments for $sha"; break; fi
  if [ $SECONDS -gt $deadline ]; then echo "::error::Timed out waiting for Vercel previews"; exit 1; fi
  sleep 5
done

for app in web provider admin; do
  echo "${app}_url=${url[$app]:-}" >> "$out"
  echo "$app: ${url[$app]:-<not deployed>}"
done
