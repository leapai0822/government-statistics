#!/usr/bin/env bash
# Search e-Stat data catalog
# Usage: ./scripts/get-catalog.sh -k "国勢調査" [-t DB] [-f 02] [-l 10]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

KEYWORD="" FIELD="" YEAR="" TYPE="" LIMIT="10"
while [[ $# -gt 0 ]]; do
  case "$1" in
    -k|--keyword) KEYWORD="$2"; shift 2 ;;
    -f|--field) FIELD="$2"; shift 2 ;;
    -y|--year) YEAR="$2"; shift 2 ;;
    -t|--type) TYPE="$2"; shift 2 ;;
    -l|--limit) LIMIT="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

PARAMS="limit=${LIMIT}"
[ -n "$KEYWORD" ] && PARAMS="${PARAMS}&searchWord=$(urlencode "$KEYWORD")"
[ -n "$FIELD" ] && PARAMS="${PARAMS}&statsField=${FIELD}"
[ -n "$YEAR" ] && PARAMS="${PARAMS}&surveyYears=${YEAR}"
[ -n "$TYPE" ] && PARAMS="${PARAMS}&dataType=${TYPE}"

if [ "$API_MODE" = "worker" ]; then
  RESULT=$(estat_request "catalog" "$PARAMS")
else
  RESULT=$(estat_request "getDataCatalog" "$PARAMS")
fi

echo "$RESULT" | jq .
