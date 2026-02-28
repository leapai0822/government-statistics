const ESTAT_BASE_URL = "https://api.e-stat.go.jp/rest/3.0/app/json";

export class EStatClient {
  constructor(private appId: string) {}

  async getStatsList(params: {
    searchWord?: string;
    statsField?: string;
    statsCode?: string;
    surveyYears?: string;
    searchKind?: string;
    collectArea?: string;
    startPosition?: number;
    limit?: number;
    lang?: string;
    updatedDate?: string;
  }) {
    return this.request("getStatsList", params);
  }

  async getMetaInfo(params: { statsDataId: string; lang?: string }) {
    return this.request("getMetaInfo", params);
  }

  async getStatsData(params: {
    statsDataId?: string;
    dataSetId?: string;
    lvTab?: string;
    cdTab?: string;
    lvTime?: string;
    cdTime?: string;
    cdTimeFrom?: string;
    cdTimeTo?: string;
    lvArea?: string;
    cdArea?: string;
    cdAreaFrom?: string;
    cdAreaTo?: string;
    lvCat01?: string;
    cdCat01?: string;
    cdCat01From?: string;
    cdCat01To?: string;
    lvCat02?: string;
    cdCat02?: string;
    cdCat03?: string;
    startPosition?: number;
    limit?: number;
    metaGetFlg?: string;
    cntGetFlg?: string;
    lang?: string;
    replaceSpChar?: string;
  }) {
    return this.request("getStatsData", params);
  }

  async getDataCatalog(params: {
    searchWord?: string;
    surveyYears?: string;
    statsField?: string;
    statsCode?: string;
    dataType?: string;
    collectArea?: string;
    catalogId?: string;
    resourceId?: string;
    startPosition?: number;
    limit?: number;
    lang?: string;
    updatedDate?: string;
  }) {
    return this.request("getDataCatalog", params);
  }

  private async request(
    endpoint: string,
    params: Record<string, string | number | undefined>
  ) {
    const cleanParams = Object.fromEntries(
      Object.entries({ appId: this.appId, ...params }).filter(
        ([, v]) => v !== undefined && v !== null
      )
    );
    const url = new URL(`${ESTAT_BASE_URL}/${endpoint}`);
    for (const [key, val] of Object.entries(cleanParams)) {
      url.searchParams.set(key, String(val));
    }
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(
        `e-Stat API error: ${response.status} ${response.statusText}`
      );
    }
    return response.json();
  }
}
