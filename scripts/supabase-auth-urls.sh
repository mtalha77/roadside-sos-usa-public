#!/usr/bin/env bash
# Sets the Supabase Auth site URL and allowed redirect URLs for one environment.
# Usage: scripts/supabase-auth-urls.sh <dev|staging|prod> <project-ref>
# Needs: SUPABASE_ACCESS_TOKEN, APP_DOMAIN (e.g. the test domain), VERCEL_TEAM_SLUG (dev only).
# Hostnames come from environment variables so the domain can change without a code edit.
set -euo pipefail

env_name="${1:?environment (dev|staging|prod)}"
ref="${2:?project ref}"
: "${SUPABASE_ACCESS_TOKEN:?missing}"
: "${APP_DOMAIN:?missing}"

case "$env_name" in
  dev)
    : "${VERCEL_TEAM_SLUG:?missing}"
    site_url="http://localhost:3000"
    allow="http://localhost:3000/**,http://localhost:3001/**,http://localhost:3002/**,https://*-${VERCEL_TEAM_SLUG}.vercel.app/**"
    ;;
  staging)
    site_url="https://staging.${APP_DOMAIN}"
    allow="https://staging.${APP_DOMAIN}/**,https://staging-pro.${APP_DOMAIN}/**,https://staging-admin.${APP_DOMAIN}/**"
    ;;
  prod)
    site_url="https://${APP_DOMAIN}"
    allow="https://${APP_DOMAIN}/**,https://www.${APP_DOMAIN}/**,https://pro.${APP_DOMAIN}/**,https://admin.${APP_DOMAIN}/**"
    ;;
  *)
    echo "Unknown environment: $env_name" >&2
    exit 1
    ;;
esac

body=$(printf '{"site_url":"%s","uri_allow_list":"%s"}' "$site_url" "$allow")
status=$(curl -sS -o /tmp/auth-config-response.json -w '%{http_code}' -X PATCH \
  "https://api.supabase.com/v1/projects/${ref}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "$body")

if [ "$status" -ge 300 ]; then
  echo "Auth URL update failed for $env_name (HTTP $status)" >&2
  exit 1
fi
echo "Auth URLs set for $env_name: site_url=$site_url"
