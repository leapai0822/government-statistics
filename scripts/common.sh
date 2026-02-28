#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load .env if present
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

# API_MODE: "local" (direct to e-Stat) or "worker" (through Cloudflare Worker)
API_MODE="${API_MODE:-local}"

ESTAT_BASE_URL="https://api.e-stat.go.jp/rest/3.0/app/json"
ESTAT_APP_ID="${ESTAT_APP_ID:-YOUR_APP_ID_HERE}"

WORKER_URL="${WORKER_URL:-http://localhost:8787}"

validate_app_id() {
  if [ "$API_MODE" = "local" ] && [ "$ESTAT_APP_ID" = "YOUR_APP_ID_HERE" ]; then
    echo "ERROR: ESTAT_APP_ID is not configured." >&2
    echo "Set it in .env or export ESTAT_APP_ID=your_app_id" >&2
    exit 1
  fi
}

# Usage: estat_request <endpoint> <query_params>
estat_request() {
  local endpoint="$1"
  local query_params="${2:-}"

  if [ "$API_MODE" = "worker" ]; then
    local url="${WORKER_URL}/api/stats/${endpoint}"
    if [ -n "$query_params" ]; then
      url="${url}?${query_params}"
    fi
  else
    validate_app_id
    local url="${ESTAT_BASE_URL}/${endpoint}?appId=${ESTAT_APP_ID}"
    if [ -n "$query_params" ]; then
      url="${url}&${query_params}"
    fi
  fi

  curl -s --max-time 30 "$url"
}

urlencode() {
  python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$1"
}
