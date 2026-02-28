export type Bindings = {
  ESTAT_APP_ID: string;
};

export interface EStatResult {
  STATUS: number;
  ERROR_MSG: string;
  DATE: string;
}

export interface TableInfo {
  "@id": string;
  STAT_NAME: { "@code": string; $: string } | string;
  GOV_ORG: { "@code": string; $: string } | string;
  STATISTICS_NAME: string;
  TITLE: { "@no": string; $: string } | string;
  CYCLE: string;
  SURVEY_DATE: string;
  OPEN_DATE: string;
  SMALL_AREA: number;
  COLLECT_AREA: string;
  MAIN_CATEGORY: { "@code": string; $: string };
  SUB_CATEGORY: { "@code": string; $: string };
  OVERALL_TOTAL_NUMBER: number;
  UPDATED_DATE: string;
  STATISTICS_NAME_SPEC: {
    TABULATION_CATEGORY: string;
    TABULATION_SUB_CATEGORY1?: string;
  };
  DESCRIPTION?: string;
  TITLE_SPEC: { TABLE_NAME: string; TABLE_EXPLANATION?: string };
}

export interface ClassItem {
  "@code": string;
  "@name": string;
  "@level": string;
  "@unit"?: string;
  "@parentCode"?: string;
}

export interface ClassObject {
  "@id": string;
  "@name": string;
  CLASS: ClassItem | ClassItem[];
}

export interface DataValue {
  "@tab": string;
  "@cat01"?: string;
  "@cat02"?: string;
  "@cat03"?: string;
  "@area"?: string;
  "@time"?: string;
  "@unit"?: string;
  $: string;
}

export interface GetStatsListResponse {
  GET_STATS_LIST: {
    RESULT: EStatResult;
    PARAMETER: Record<string, string>;
    DATALIST_INF: {
      NUMBER: number;
      RESULT_INF: {
        FROM_NUMBER: number;
        TO_NUMBER: number;
        NEXT_KEY?: number;
      };
      TABLE_INF: TableInfo | TableInfo[];
    };
  };
}

export interface GetMetaInfoResponse {
  GET_META_INFO: {
    RESULT: EStatResult;
    PARAMETER: Record<string, string>;
    METADATA_INF: {
      TABLE_INF: TableInfo;
      CLASS_INF: {
        CLASS_OBJ: ClassObject | ClassObject[];
      };
    };
  };
}

export interface GetStatsDataResponse {
  GET_STATS_DATA: {
    RESULT: EStatResult;
    PARAMETER: Record<string, string>;
    STATISTICAL_DATA: {
      RESULT_INF: {
        TOTAL_NUMBER: number;
        FROM_NUMBER: number;
        TO_NUMBER: number;
        NEXT_KEY?: number;
      };
      TABLE_INF: TableInfo;
      CLASS_INF: { CLASS_OBJ: ClassObject | ClassObject[] };
      DATA_INF: {
        NOTE?: { char: string; $: string }[];
        VALUE: DataValue | DataValue[];
      };
    };
  };
}
