# Government Statistics Query System (e-Stat API)

日本の政府統計データをe-Stat APIから取得するシステム。
ユーザーの質問に対して、Worker APIにcurlでリクエストしてデータを取得・回答する。

## Worker API (必ずこのURLを使うこと)

**Base URL:** `https://leapai-government-statistics.leapai0822.workers.dev`

### エンドポイント

#### 1. 統計表検索
```bash
curl -s "https://leapai-government-statistics.leapai0822.workers.dev/api/stats/search?searchWord=キーワード&statsField=分野コード&limit=10"
```
主なパラメータ:
- `searchWord` (URLエンコード必須): 検索キーワード。AND/OR/NOT演算子対応
- `statsField`: 統計分野コード（下記参照）
- `surveyYears`: 調査年 (yyyy) またはレンジ (yyyymm-yyyymm)
- `limit`: 最大件数 (デフォルト10)
- `collectArea`: 1=全国, 2=都道府県, 3=市区町村

#### 2. メタデータ取得（次元・カテゴリ確認）
```bash
curl -s "https://leapai-government-statistics.leapai0822.workers.dev/api/stats/meta/{statsDataId}"
```
検索結果のテーブルIDを指定。利用可能な次元（時間, 地域, カテゴリ）とコードを表示。

#### 3. 統計データ取得
```bash
curl -s "https://leapai-government-statistics.leapai0822.workers.dev/api/stats/data/{statsDataId}?limit=100&metaGetFlg=Y"
```
主なパラメータ:
- `limit`: 最大行数 (デフォルト100)
- `metaGetFlg=Y`: レスポンスにメタデータ（コード→名前の対応）を含める。**常に付けること**
- `cdTime`: 時間コードでフィルタ
- `cdTimeFrom`/`cdTimeTo`: 時間レンジ
- `cdArea`: 地域コードでフィルタ
- `cdCat01`: カテゴリ01コードでフィルタ
- `cdCat02`, `cdCat03`: カテゴリ02, 03コードでフィルタ
- `lvArea`: 地域レベル（例: 2=都道府県）
- `startPosition`: ページネーション用の開始位置

#### 4. データカタログ検索
```bash
curl -s "https://leapai-government-statistics.leapai0822.workers.dev/api/stats/catalog?searchWord=キーワード&limit=10"
```

## 質問への回答ワークフロー

ユーザーが統計に関する質問をしたら、以下の手順でcurlを使って回答する：

1. **トピック特定** - 統計分野コードとキーワードを決定
2. **検索** - `/api/stats/search` で関連テーブルを検索
3. **メタデータ確認** - `/api/stats/meta/{id}` で次元・カテゴリコードを把握
4. **データ取得** - `/api/stats/data/{id}` でフィルタ付きでデータ取得
5. **回答作成** - jqでデータを解析し、読みやすく要約して回答

### 例: 「日本のミャンマー人人口は？」
```bash
# Step 1: 国籍詳細の人口テーブルを検索
curl -s "https://leapai-government-statistics.leapai0822.workers.dev/api/stats/search?searchWord=%E5%9B%BD%E7%B1%8D%20%E8%A9%B3%E7%B4%B0%20%E5%A4%96%E5%9B%BD%E4%BA%BA&statsField=02&limit=5" | jq -r '.GET_STATS_LIST.DATALIST_INF.TABLE_INF | if type == "object" then [.] else . end | .[] | "[\(.["@id"])] \(.TITLE["$"] // .TITLE) (Survey: \(.SURVEY_DATE))"'

# Step 2: メタデータでカテゴリコードを確認（ミャンマーのコードを探す）
curl -s "https://leapai-government-statistics.leapai0822.workers.dev/api/stats/meta/0003445257" | jq -r '.GET_META_INFO.METADATA_INF.CLASS_INF.CLASS_OBJ | if type == "object" then [.] else . end | .[] | select(.["@id"] == "cat01") | .CLASS | if type == "object" then [.] else . end | .[] | select(.["@name"] | test("ミャンマー")) | "\(.["@code"]): \(.["@name"])"'

# Step 3: ミャンマー(code=1140)でフィルタしてデータ取得
curl -s "https://leapai-government-statistics.leapai0822.workers.dev/api/stats/data/0003445257?cdCat01=1140&limit=10&metaGetFlg=Y" | jq -r '.GET_STATS_DATA.STATISTICAL_DATA | (reduce ((.CLASS_INF.CLASS_OBJ // []) | if type == "object" then [.] else . end | .[] | . as $obj | ((.CLASS // []) | if type == "object" then [.] else . end | .[]) | { key: ($obj["@id"] + ":" + .["@code"]), value: .["@name"] }) as $entry ({}; . + { ($entry.key): $entry.value })) as $lookup | (.DATA_INF.VALUE // []) | if type == "object" then [.] else . end | .[] | ($lookup["cat01:" + .["@cat01"]] // "") + " | " + ($lookup["cat02:" + .["@cat02"]] // "") + " | " + ($lookup["time:" + .["@time"]] // "") + " => " + .["$"] + " 人"'
```

## レスポンスの読み方

e-Stat APIのJSONレスポンスには以下の構造がある：
- `RESULT.STATUS`: 0=成功, 1=データなし, 100以上=エラー
- `CLASS_INF.CLASS_OBJ`: 次元の定義（コード→名前のマッピング）
- `DATA_INF.VALUE`: 実データの配列。`@tab`, `@cat01`, `@cat02`, `@area`, `@time` などのコードと `$` に値が入る
- 単一レコードの場合、配列ではなくオブジェクトで返る場合がある。`if type == "object" then [.] else . end` で統一すること

## 統計分野コード
| コード | 分野 |
|--------|------|
| 01 | 国土・気象 |
| 02 | 人口・世帯 |
| 03 | 労働・賃金 |
| 04 | 農林水産業 |
| 05 | 鉱工業 |
| 06 | 商業・サービス業 |
| 07 | 企業・家計・経済 |
| 08 | 住宅・土地・建設 |
| 09 | エネルギー・水 |
| 10 | 運輸・観光 |
| 11 | 情報通信・科学技術 |
| 12 | 教育・文化・スポーツ・生活 |
| 13 | 行財政 |
| 14 | 司法・安全・環境 |
| 15 | 社会保障・衛生 |
| 16 | 国際 |

## よく使うキーワード
- 人口: 人口, 国勢調査, 世帯数, 出生, 死亡, 人口推計
- 経済/GDP: GDP, 国内総生産, 経済成長, 景気
- 雇用: 就業, 失業, 雇用, 労働力, 賃金
- 物価: 消費者物価, 物価指数, CPI
- 貿易: 貿易, 輸出, 輸入
- 住宅: 住宅, 地価, 建設
- 教育: 学校, 教育, 学生数
- 医療: 医療, 病院, 健康, 平均寿命

## トラブルシューティング
- STATUS 100 "認証に失敗しました": Worker側のESTAT_APP_IDシークレットを確認
- STATUS 1 "該当データなし": キーワードを広げるか別の分野コードを試す
- 大量データ: `startPosition`と`limit`でページネーション
- e-Stat APIの上限: 1リクエスト最大100,000行
