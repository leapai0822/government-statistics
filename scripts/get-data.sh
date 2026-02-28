#!/usr/bin/env bash
# Retrieve statistics data from a specific table
# Usage: ./scripts/get-data.sh <statsDataId> [-l 100] [--cdTime code] [--cdArea code] ...

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <statsDataId> [options]" >&2
  echo "  -l, --limit      Max data rows (default: 100)" >&2
  echo "  --cdTab           Filter by tab code" >&2
  echo "  --cdCat01         Filter by category 01 code" >&2
  echo "  --cdArea          Filter by area code" >&2
  echo "  --cdTime          Filter by time code" >&2
  echo "  --cdTimeFrom      Time range start" >&2
  echo "  --cdTimeTo        Time range end" >&2
  echo "  --lvArea          Area level filter" >&2
  echo "  --raw             Output raw JSON" >&2
  exit 1
fi
STATS_DATA_ID="$1"; shift

LIMIT="100" START="" RAW=false FILTER_PARAMS=""

require_option_value() {
  local opt="$1"
  local val="${2-}"
  if [ -z "$val" ] || [[ "$val" == -* ]]; then
    echo "Option ${opt} requires a value." >&2
    exit 1
  fi
}

append_filter_param() {
  local key="$1"
  local value="$2"
  FILTER_PARAMS="${FILTER_PARAMS}&${key}=$(urlencode "$value")"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -l|--limit)
      require_option_value "$1" "${2-}"
      LIMIT="$2"; shift 2 ;;
    -s|--start)
      require_option_value "$1" "${2-}"
      START="$2"; shift 2 ;;
    --cdTab|--cdCat01|--cdCat02|--cdCat03|--cdArea|--cdTime)
      require_option_value "$1" "${2-}"
      append_filter_param "${1#--}" "$2"; shift 2 ;;
    --cdTimeFrom|--cdTimeTo|--cdAreaFrom|--cdAreaTo|--cdCat01From|--cdCat01To)
      require_option_value "$1" "${2-}"
      append_filter_param "${1#--}" "$2"; shift 2 ;;
    --lvTab|--lvTime|--lvArea|--lvCat01|--lvCat02)
      require_option_value "$1" "${2-}"
      append_filter_param "${1#--}" "$2"; shift 2 ;;
    --lang)
      require_option_value "$1" "${2-}"
      append_filter_param "lang" "$2"; shift 2 ;;
    --metaGetFlg)
      require_option_value "$1" "${2-}"
      append_filter_param "metaGetFlg" "$2"; shift 2 ;;
    --raw) RAW=true; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

PARAMS="limit=${LIMIT}"
[ -n "$START" ] && PARAMS="${PARAMS}&startPosition=${START}"
PARAMS="${PARAMS}${FILTER_PARAMS}"

if [ "$API_MODE" = "worker" ]; then
  RESULT=$(estat_request "data/${STATS_DATA_ID}" "$PARAMS")
else
  RESULT=$(estat_request "getStatsData" "statsDataId=${STATS_DATA_ID}&${PARAMS}")
fi

if [ "$RAW" = true ]; then
  echo "$RESULT" | jq .
  exit 0
fi

echo "$RESULT" | jq -r '
  if .GET_STATS_DATA.RESULT.STATUS != 0 then
    "Error: \(.GET_STATS_DATA.RESULT.ERROR_MSG)"
  else
    .GET_STATS_DATA.STATISTICAL_DATA |
    "Total records: \(.RESULT_INF.TOTAL_NUMBER // 0)" +
    (if .RESULT_INF.NEXT_KEY then " (next page: \(.RESULT_INF.NEXT_KEY))" else "" end) +
    "\nTable: \(if .TABLE_INF.TITLE | type == "object" then .TABLE_INF.TITLE["$"] else (.TABLE_INF.TITLE // "") end)\n\n" +

    # Build class code->name lookup
    (
      reduce (
        (.CLASS_INF.CLASS_OBJ // []) |
        if type == "object" then [.] else . end | .[] |
        . as $obj |
        ((.CLASS // []) | if type == "object" then [.] else . end | .[]) |
        { key: ($obj["@id"] + ":" + .["@code"]), value: .["@name"] }
      ) as $entry ({}; . + { ($entry.key): $entry.value })
    ) as $lookup |

    (
      (.DATA_INF.VALUE // []) |
      if type == "object" then [.] else . end |
      map(
        . as $v |
        [
          (if $v["@tab"] then ($lookup["tab:" + $v["@tab"]] // $v["@tab"]) else null end),
          (if $v["@cat01"] then ($lookup["cat01:" + $v["@cat01"]] // $v["@cat01"]) else null end),
          (if $v["@cat02"] then ($lookup["cat02:" + $v["@cat02"]] // $v["@cat02"]) else null end),
          (if $v["@cat03"] then ($lookup["cat03:" + $v["@cat03"]] // $v["@cat03"]) else null end),
          (if $v["@area"] then ($lookup["area:" + $v["@area"]] // $v["@area"]) else null end),
          (if $v["@time"] then ($lookup["time:" + $v["@time"]] // $v["@time"]) else null end)
        ] | map(select(. != null)) | join(" | ") |
        . + " => " + ($v["$"] // "N/A") +
        (if $v["@unit"] then " (\($v["@unit"]))" else "" end)
      ) | join("\n")
    )
  end
'
