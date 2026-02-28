import { Hono } from "hono";
import { cors } from "hono/cors";
import { EStatClient } from "./estat-client";
import type { Bindings } from "./types";

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors());

app.get("/", (c) => c.json({ status: "ok", service: "estat-proxy" }));

// 統計表検索
app.get("/api/stats/search", async (c) => {
  const client = new EStatClient(c.env.ESTAT_APP_ID);
  try {
    const data = await client.getStatsList({
      searchWord: c.req.query("searchWord"),
      statsField: c.req.query("statsField"),
      surveyYears: c.req.query("surveyYears"),
      statsCode: c.req.query("statsCode"),
      searchKind: c.req.query("searchKind"),
      collectArea: c.req.query("collectArea"),
      limit: c.req.query("limit") ? Number(c.req.query("limit")) : 10,
      startPosition: c.req.query("startPosition")
        ? Number(c.req.query("startPosition"))
        : undefined,
      lang: c.req.query("lang"),
    });
    return c.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// メタデータ取得
app.get("/api/stats/meta/:statsDataId", async (c) => {
  const client = new EStatClient(c.env.ESTAT_APP_ID);
  try {
    const data = await client.getMetaInfo({
      statsDataId: c.req.param("statsDataId"),
      lang: c.req.query("lang"),
    });
    return c.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// 統計データ取得
app.get("/api/stats/data/:statsDataId", async (c) => {
  const client = new EStatClient(c.env.ESTAT_APP_ID);
  const query = c.req.query();
  try {
    const data = await client.getStatsData({
      statsDataId: c.req.param("statsDataId"),
      lvTab: query.lvTab,
      cdTab: query.cdTab,
      lvTime: query.lvTime,
      cdTime: query.cdTime,
      cdTimeFrom: query.cdTimeFrom,
      cdTimeTo: query.cdTimeTo,
      lvArea: query.lvArea,
      cdArea: query.cdArea,
      cdAreaFrom: query.cdAreaFrom,
      cdAreaTo: query.cdAreaTo,
      lvCat01: query.lvCat01,
      cdCat01: query.cdCat01,
      cdCat01From: query.cdCat01From,
      cdCat01To: query.cdCat01To,
      lvCat02: query.lvCat02,
      cdCat02: query.cdCat02,
      cdCat03: query.cdCat03,
      startPosition: query.startPosition
        ? Number(query.startPosition)
        : undefined,
      limit: query.limit ? Number(query.limit) : 100,
      metaGetFlg: query.metaGetFlg,
      cntGetFlg: query.cntGetFlg,
      lang: query.lang,
      replaceSpChar: query.replaceSpChar,
    });
    return c.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// データカタログ検索
app.get("/api/stats/catalog", async (c) => {
  const client = new EStatClient(c.env.ESTAT_APP_ID);
  try {
    const data = await client.getDataCatalog({
      searchWord: c.req.query("searchWord"),
      statsField: c.req.query("statsField"),
      surveyYears: c.req.query("surveyYears"),
      dataType: c.req.query("dataType"),
      limit: c.req.query("limit") ? Number(c.req.query("limit")) : 10,
      startPosition: c.req.query("startPosition")
        ? Number(c.req.query("startPosition"))
        : undefined,
      lang: c.req.query("lang"),
    });
    return c.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

export default app;
