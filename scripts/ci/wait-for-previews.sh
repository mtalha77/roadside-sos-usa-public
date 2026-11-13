#!/usr/bin/env bash
# Waits for the Vercel preview deployments of a commit and writes their URLs to $GITHUB_OUTPUT
# (web_url, provider_url, admin_url). Apps Vercel skipped (unaffected) get no URL.
# Vercel reports each project as a commit STATUS ("Vercel – rsos-<app>"), then the preview URL as a
# GitHub deployment status; both arrive about 20 s after the push.
# When Vercel skips an app for this commit ("Skipped - Not affected"), the branch's latest live
# preview of that app is used instead, so tests still run against a real deployment.
# Usage: scripts/ci/wait-for-previews.sh <sha> [branch]   (needs GH_TOKEN and GITHUB_REPOSITORY)
set -euo pipefail
sha="${1:?commit sha}"
branch="${2:-}"
repo="${GITHUB_REPOSITORY:?}"
out="${GITHUB_OUTPUT:-/dev/stdout}"
deadline=$((SECONDS + 900))

url_web=""; url_provider=""; url_admin=""
get_url() { local v="url_$1"; echo "${!v:-}"; }
while :; do
  # Latest state per Vercel project for this commit: pending, success, failure or error.
  states=$(gh api "repos/$repo/commits/$sha/status" --jq '.statuses[] | select(.context | startswith("Vercel – rsos-")) | "\(.context | sub("Vercel – rsos-"; ""))=\(if (.description // "" | test("Skipped")) then "skipped" else .state end)"')
  waiting=0
  for entry in $states; do
    app=${entry%%=*}
    state=${entry#*=}
    [ -n "$(get_url "$app")" ] && continue
    case "$state" in
      failure | error) echo "::error::Vercel build failed for $app"; exit 1 ;;
      pending) waiting=$((waiting + 1)); continue ;;
      skipped)
        # Not affected by this commit: use the branch's latest live preview, if any.
        if [ -n "$branch" ]; then
          # Vercel labels deployments by commit, so walk back through the branch's recent commits.
          for c in $(gh api "repos/$repo/commits?sha=$branch&per_page=15" --jq '.[].sha'); do
            for id in $(gh api "repos/$repo/deployments?sha=$c&per_page=10" --jq ".[] | select(.environment | test(\"rsos-$app\")) | .id"); do
              u=$(gh api "repos/$repo/deployments/$id/statuses" --jq '[.[] | select(.state == "success")][0].environment_url // empty')
              if [ -n "$u" ]; then printf -v "url_$app" "%s" "$u"; break 2; fi
            done
          done
        fi
        [ -z "$(get_url "$app")" ] && printf -v "url_$app" "%s" "-"
        continue ;;
    esac
    for id in $(gh api "repos/$repo/deployments?sha=$sha&per_page=50" --jq ".[] | select(.environment | test(\"rsos-$app\")) | .id"); do
      u=$(gh api "repos/$repo/deployments/$id/statuses" --jq '[.[] | select(.state == "success")][0].environment_url // empty')
      if [ -n "$u" ]; then printf -v "url_$app" "%s" "$u"; break; fi
    done
    [ -z "$(get_url "$app")" ] && waiting=$((waiting + 1))
  done
  if [ -n "$states" ] && [ "$waiting" -eq 0 ]; then break; fi
  if [ -z "$states" ] && [ $SECONDS -gt 120 ]; then echo "No Vercel deployments for $sha"; break; fi
  if [ $SECONDS -gt $deadline ]; then echo "::error::Timed out waiting for Vercel previews"; exit 1; fi
  sleep 5
done

for app in web provider admin; do
  u=$(get_url "$app")
  [ "$u" = "-" ] && u=""
  echo "${app}_url=${u}" >> "$out"
  echo "$app: ${u:-<not deployed>}"
done
