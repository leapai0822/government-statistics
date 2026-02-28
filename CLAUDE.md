# Government Statistics Query System (e-Stat API)

日本の政府統計データをe-Stat APIから取得するシステム。
ユーザーの質問に対して、シェルスクリプトを実行してデータを取得・回答する。

## スクリプト一覧

すべてプロジェクトルートから実行する。

### 1. 統計表検索
```bash
./scripts/search-stats.sh -k "キーワード" [-f フィールドコード] [-y 年] [-l 件数]
```
- `-k` keyword: 検索キーワード（日本語OK）。AND/OR/NOT演算子対応
- `-f` field: 統計分野コード（下記参照）
- `-y` year: 調査年 (yyyy) またはレンジ (yyyymm-yyyymm)
- `-l` limit: 最大件数 (デフォルト10)
- `-a` area: 1=全国, 2=都道府県, 3=市区町村

### 2. メタデータ取得（次元・カテゴリ確認）
```bash
./scripts/get-meta.sh <statsDataId>
```
検索結果のテーブルIDを指定。利用可能な次元（時間, 地域, カテゴリ）とコードを表示。

### 3. 統計データ取得
```bash
./scripts/get-data.sh <statsDataId> [-l 件数] [--cdTime コード] [--cdArea コード] ...
```
- `--cdTime`: 時間コードでフィルタ（メタデータから取得）
- `--cdTimeFrom`/`--cdTimeTo`: 時間レンジ
- `--cdArea`: 地域コードでフィルタ
- `--cdCat01`: カテゴリ01コードでフィルタ
- `--lvArea`: 地域レベル（例: 2=都道府県）
- `--raw`: 生のJSON出力
- `-l` limit: 最大行数 (デフォルト100)

### 4. データカタログ検索
```bash
./scripts/get-catalog.sh -k "キーワード" [-t データタイプ]
```

## 質問への回答ワークフロー

ユーザーが統計に関する質問をしたら、以下の手順で回答する：

1. **トピック特定** - 統計分野コードとキーワードを決定
2. **検索** - `./scripts/search-stats.sh -k "keyword" -f <field_code>`
3. **メタデータ確認** - `./scripts/get-meta.sh <statsDataId>` で次元を把握
4. **データ取得** - `./scripts/get-data.sh <statsDataId> [filters]` で実データ取得
5. **回答作成** - データを読みやすく要約して回答

### 例: 「日本の人口は？」
```bash
# Step 1: 人口統計を検索
./scripts/search-stats.sh -k "人口" -f 02 -l 5

# Step 2: 関連テーブルのメタデータ確認
./scripts/get-meta.sh 0003448237

# Step 3: データ取得
./scripts/get-data.sh 0003448237 -l 50
```

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

## 設定
- `.env`の`ESTAT_APP_ID`にアプリケーションIDを設定
- `API_MODE=local`: e-Stat APIを直接呼び出し（APP_IDが必要）
- `API_MODE=worker`: Cloudflare Worker経由で呼び出し
- Workerデプロイ後は`WORKER_URL`を本番URLに変更

## トラブルシューティング
- "Authentication failure": ESTAT_APP_IDを確認
- 結果が空: キーワードを広げるか別の分野コードを試す
- 大量データ: `--start`と`--limit`でページネーション
- e-Stat APIの上限: 1リクエスト最大100,000行
