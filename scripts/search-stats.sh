#!/usr/bin/env bash
# Search e-Stat for statistics tables
# Usage: ./scripts/search-stats.sh -k "人口" [-f 02] [-y 2023] [-l 10]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

KEYWORD="" FIELD="" YEAR="" LIMIT="10" START="" AREA=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -k|--keyword) KEYWORD="$2"; shift 2 ;;
    -f|--field) FIELD="$2"; shift 2 ;;
    -y|--year) YEAR="$2"; shift 2 ;;
    -l|--limit) LIMIT="$2"; shift 2 ;;
    -s|--start) START="$2"; shift 2 ;;
    -a|--area) AREA="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

PARAMS="limit=${LIMIT}"
[ -n "$KEYWORD" ] && PARAMS="${PARAMS}&searchWord=$(urlencode "$KEYWORD")"
[ -n "$FIELD" ] && PARAMS="${PARAMS}&statsField=${FIELD}"
[ -n "$YEAR" ] && PARAMS="${PARAMS}&surveyYears=${YEAR}"
[ -n "$START" ] && PARAMS="${PARAMS}&startPosition=${START}"
[ -n "$AREA" ] && PARAMS="${PARAMS}&collectArea=${AREA}"

if [ "$API_MODE" = "worker" ]; then
  RESULT=$(estat_request "search" "$PARAMS")
else
  RESULT=$(estat_request "getStatsList" "$PARAMS")
fi

echo "$RESULT" | jq -r '
  if .GET_STATS_LIST.RESULT.STATUS != 0 then
    "Error: \(.GET_STATS_LIST.RESULT.ERROR_MSG)"
  else
    "Found \(.GET_STATS_LIST.DATALIST_INF.NUMBER // 0) tables\n" +
    (
      (.GET_STATS_LIST.DATALIST_INF.TABLE_INF // []) |
      if type == "object" then [.] else . end |
      to_entries |
      map(
        "\(.key + 1). [\(.value["@id"])] " +
        (if .value.STAT_NAME | type == "object" then .value.STAT_NAME["$"] else (.value.STAT_NAME // "") end) +
        "\n   " +
        (if .value.TITLE | type == "object" then .value.TITLE["$"] else (.value.TITLE // "") end) +
        "\n   Survey: \(.value.SURVEY_DATE // "N/A") | Records: \(.value.OVERALL_TOTAL_NUMBER // "N/A")"
      ) | join("\n\n")
    )
  end
'
