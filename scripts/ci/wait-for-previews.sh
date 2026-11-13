#!/usr/bin/env bash
# Waits for the Vercel preview deployments of a commit and writes their URLs to $GITHUB_OUTPUT
# (web_url, provider_url, admin_url). Apps Vercel skipped (unaffected) get no URL.
# Usage: scripts/ci/wait-for-previews.sh <sha>   (needs GH_TOKEN and GITHUB_REPOSITORY)
set -euo pipefail
sha="${1:?commit sha}"
repo="${GITHUB_REPOSITORY:?}"
out="${GITHUB_OUTPUT:-/dev/stdout}"
deadline=$((SECONDS + 900))

# 1) Wait until every Vercel check run on the commit has finished (or none exist after 3 min).
while :; do
  checks=$(gh api "repos/$repo/commits/$sha/check-runs?per_page=100" --jq '[.check_runs[] | select(.name | startswith("Vercel – rsos-"))]')
  total=$(jq 'length' <<<"$checks")
  pending=$(jq '[.[] | select(.status != "completed")] | length' <<<"$checks")
  if [ "$total" -gt 0 ] && [ "$pending" -eq 0 ]; then break; fi
  if [ "$total" -eq 0 ] && [ $SECONDS -gt 180 ]; then echo "No Vercel checks on $sha"; break; fi
  if [ $SECONDS -gt $deadline ]; then echo "::error::Timed out waiting for Vercel previews"; exit 1; fi
  sleep 8
done
jq -r '.[] | "\(.name): \(.conclusion)"' <<<"${checks:-[]}"

# 2) Read the deployment URL for each app from GitHub Deployments (created by Vercel).
for app in web provider admin; do
  url=""
  ids=$(gh api "repos/$repo/deployments?sha=$sha&per_page=50" --jq ".[] | select(.environment | test(\"rsos-$app\")) | .id")
  for id in $ids; do
    url=$(gh api "repos/$repo/deployments/$id/statuses" --jq '[.[] | select(.state == "success")][0].environment_url // empty')
    [ -n "$url" ] && break
  done
  echo "${app}_url=${url}" >> "$out"
  echo "$app: ${url:-<not deployed>}"
done
