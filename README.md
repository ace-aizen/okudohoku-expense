# Netlify版 奥道北 経費管理

Netlify で見た目を動かしつつ、`Apps Script 側の保存・OCR・集計ロジック` をそのまま使う構成です。

## 構成

```text
netlify/expense-desk/
├── netlify.toml
├── netlify/
│   └── functions/
│       ├── bootstrap.js
│       ├── analyze-evidence.js
│       ├── submit-expense.js
│       ├── refresh-dashboard.js
│       └── _lib/
└── site/
    ├── index.html
    ├── styles.css
    └── app.js
```

## 特徴

- Netlify 上でそのまま動く
- フロントはビルド不要
- UI は Apps Script より安定しやすい
- 原本保存・台帳保存・OCR は Apps Script が担当
- これまで作った `申請者 / 費目 / 判定ルール / 経費台帳 / ダッシュボード` をそのまま活かせる

## いちばんおすすめの使い方

- Apps Script は `backend`
- Netlify は `画面`

この形なら、Google Cloud のサービスアカウントを新しく運用しなくても進めやすいです。

## Netlify に入れる環境変数

- `APPS_SCRIPT_WEB_APP_URL`
- `APPS_SCRIPT_API_KEY`

## 予備の環境変数

Apps Script を使わず、Netlify から直接 Google API を叩きたい場合だけ使います。

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_SPREADSHEET_ID`
- `GOOGLE_DRIVE_ROOT_FOLDER_ID`
- `APP_TOTAL_BUDGET`
- `APP_PROJECT_NAME`

## Apps Script 側で必要なこと

1. 既存の `apps-script/expense-manager` を使う
2. `setupExpenseApp` を実行する
3. 必要なら `EXPENSE_API_KEY` を Script Properties に入れる
4. Webアプリとしてデプロイする

## Sheets の最低構成

### `申請者`

```text
applicant_id | applicant_name | applicant_email | active_flag | sort_order
ITO          | 伊東           | xxx             | TRUE        | 1
SAKASHITA    | 坂下           | xxx             | TRUE        | 2
```

### `費目`

```text
category_code | category_name | sort_order | active_flag
AIR           | 航空券         | 1          | TRUE
TRANSPORT     | 交通費         | 2          | TRUE
HOTEL         | 宿泊費         | 3          | TRUE
CAR           | 車両費         | 4          | TRUE
STAY          | 滞在費         | 5          | TRUE
MEAL          | 会食費         | 6          | TRUE
ENTERTAINMENT | 接待費         | 7          | TRUE
EVENT         | イベント参加費 | 8          | TRUE
OTHER         | その他         | 9          | TRUE
```

### `判定ルール`

```text
rule_id | match_type | match_value      | category_code | priority | active_flag
RULE-1  | contains   | ana              | AIR           | 1        | TRUE
RULE-2  | contains   | jal              | AIR           | 2        | TRUE
RULE-3  | contains   | 東横inn          | HOTEL         | 3        | TRUE
RULE-4  | contains   | トヨタレンタカー | CAR           | 4        | TRUE
```

### `経費台帳`

ヘッダー行は次です。

```text
expense_id,created_at,applicant_id,applicant_name,use_date,vendor_name_source,vendor_name_manual,vendor_name_final,amount_source,amount_manual,amount_final,category_rule,category_manual,category_final,purpose_text,project_name,attendees_text,note_text,evidence_type,drive_file_name,original_file_name,extracted_text_excerpt,extraction_method,match_summary,drive_file_id,drive_file_url,review_status,error_flag,error_message
```

## Netlify への配置

1. Netlify の対象プロジェクトへこのリポジトリを接続
2. `Base directory` を `netlify/expense-desk` に設定
3. `Publish directory` を `site` に設定
4. `Functions directory` を `netlify/functions` に設定
5. `APPS_SCRIPT_WEB_APP_URL` と `APPS_SCRIPT_API_KEY` を設定
6. Deploy

## 注意

- Apps Script の Web アプリ URL が未設定だと、この構成の良さを活かせません
- OCR は Apps Script 側の Drive OCR ベースなので、きれいなPDFやスクショの方が得意です
- より高精度が必要なら、あとから Gemini / Document AI を Apps Script 側または Netlify 側へ足せます
- 初回配備は [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md) の順で進めると詰まりにくいです
