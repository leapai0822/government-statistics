#!/usr/bin/env bash
# Get metadata for a specific statistics table
# Usage: ./scripts/get-meta.sh <statsDataId>

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <statsDataId>" >&2
  exit 1
fi
STATS_DATA_ID="$1"

if [ "$API_MODE" = "worker" ]; then
  RESULT=$(estat_request "meta/${STATS_DATA_ID}" "")
else
  RESULT=$(estat_request "getMetaInfo" "statsDataId=${STATS_DATA_ID}")
fi

echo "$RESULT" | jq -r '
  if .GET_META_INFO.RESULT.STATUS != 0 then
    "Error: \(.GET_META_INFO.RESULT.ERROR_MSG)"
  else
    .GET_META_INFO.METADATA_INF |
    "Table: \(if .TABLE_INF.TITLE | type == "object" then .TABLE_INF.TITLE["$"] else (.TABLE_INF.TITLE // "") end)\n" +
    "Stat: \(if .TABLE_INF.STAT_NAME | type == "object" then .TABLE_INF.STAT_NAME["$"] else (.TABLE_INF.STAT_NAME // "") end)\n" +
    "Survey Date: \(.TABLE_INF.SURVEY_DATE // "N/A")\n" +
    "\n--- Dimensions ---\n" +
    (
      (.CLASS_INF.CLASS_OBJ // []) |
      if type == "object" then [.] else . end |
      map(
        "[\(.["@id"])] \(.["@name"])\n" +
        (
          (.CLASS // []) |
          if type == "object" then [.] else . end |
          map("  \(.["@code"]): \(.["@name"])" + (if .["@unit"] then " (\(.["@unit"]))" else "" end)) |
          join("\n")
        )
      ) | join("\n\n")
    )
  end
'
