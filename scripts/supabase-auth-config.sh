#!/usr/bin/env bash
# Sets Supabase Auth for one environment: site URL and redirect URLs, the custom access token hook
# (roles in the JWT, RSOS-018), authenticator-app MFA and password rules.
# Usage: scripts/supabase-auth-config.sh <dev|staging|prod> <project-ref>
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

body=$(cat <<JSON
{
  "site_url": "$site_url",
  "uri_allow_list": "$allow",
  "hook_custom_access_token_enabled": true,
  "hook_custom_access_token_uri": "pg-functions://postgres/public/custom_access_token_hook",
  "mfa_totp_enroll_enabled": true,
  "mfa_totp_verify_enabled": true,
  "mfa_max_enrolled_factors": 10,
  "password_min_length": 12,
  "mailer_secure_email_change_enabled": true,
  "security_update_password_require_reauthentication": true
}
JSON
)
status=$(curl -sS -o /tmp/auth-config-response.json -w '%{http_code}' -X PATCH \
  "https://api.supabase.com/v1/projects/${ref}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "$body")

if [ "$status" -ge 300 ]; then
  echo "Auth config update failed for $env_name (HTTP $status): $(head -c 400 /tmp/auth-config-response.json)" >&2
  exit 1
fi
echo "Auth configured for $env_name: site_url=$site_url, token hook on, TOTP MFA on"
