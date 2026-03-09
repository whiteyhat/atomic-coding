#!/usr/bin/env bash
set -euo pipefail

# Upstash provisioning script
# Usage: ./scripts/provision-upstash.sh <email> <api_key>

EMAIL="${1:?Usage: $0 <email> <api_key>}"
API_KEY="${2:?Usage: $0 <email> <api_key>}"
AUTH=$(echo -n "${EMAIL}:${API_KEY}" | base64)
DB_NAME="atomic-coding-dev"
REGION="us-east-1"

echo "==> Creating Redis database '${DB_NAME}' in ${REGION}..."

REDIS_RESPONSE=$(curl -s -X POST "https://api.upstash.com/v2/redis/database" \
  -H "Authorization: Basic ${AUTH}" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"${DB_NAME}\",\"region\":\"global\",\"primary_region\":\"${REGION}\",\"read_regions\":[],\"tls\":true}")

# Check for error
if echo "$REDIS_RESPONSE" | grep -q '"error"'; then
  echo "ERROR creating Redis database:"
  echo "$REDIS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$REDIS_RESPONSE"
  exit 1
fi

REDIS_REST_URL=$(echo "$REDIS_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"https://{d['endpoint']}\")" 2>/dev/null)
REDIS_REST_TOKEN=$(echo "$REDIS_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['rest_token'])" 2>/dev/null)

echo "   Redis database created successfully."

echo ""
echo "==> Fetching QStash token..."

QSTASH_RESPONSE=$(curl -s "https://api.upstash.com/v2/qstash/user" \
  -H "Authorization: Basic ${AUTH}")

if echo "$QSTASH_RESPONSE" | grep -q '"error"'; then
  echo "ERROR fetching QStash token:"
  echo "$QSTASH_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$QSTASH_RESPONSE"
  echo ""
  echo "Note: QStash may need to be enabled in your Upstash console first."
  QSTASH_TOKEN="<enable QStash in console and re-run>"
else
  QSTASH_TOKEN=$(echo "$QSTASH_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null || echo "<check console>")
  echo "   QStash token retrieved."
fi

echo ""
echo "============================================"
echo "  Add these to your environment variables:"
echo "============================================"
echo ""
echo "# Upstash Redis"
echo "UPSTASH_REDIS_REST_URL=${REDIS_REST_URL}"
echo "UPSTASH_REDIS_REST_TOKEN=${REDIS_REST_TOKEN}"
echo ""
echo "# Upstash QStash"
echo "QSTASH_TOKEN=${QSTASH_TOKEN}"
echo ""
echo "============================================"
echo ""
echo "Add to Supabase Edge Function secrets:"
echo "  supabase secrets set UPSTASH_REDIS_REST_URL=${REDIS_REST_URL}"
echo "  supabase secrets set UPSTASH_REDIS_REST_TOKEN=${REDIS_REST_TOKEN}"
echo "  supabase secrets set QSTASH_TOKEN=${QSTASH_TOKEN}"
