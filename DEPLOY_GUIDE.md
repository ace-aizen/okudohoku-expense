# Netlify 配備ガイド

奥道北 経費管理を `Netlify + Apps Script` で動かすための最短手順です。

## 1. 先に Apps Script 側を準備する

### 1-1. Apps Script のコードを使う

このフォルダを使います。

[`apps-script/expense-manager`](../../apps-script/expense-manager)

Apps Script エディタにあるコードを貼り、まず `setupExpenseApp` を実行します。

これで次が自動作成されます。

- スプレッドシート
- Drive の原本フォルダ
- `申請者 / 費目 / 判定ルール / 経費台帳 / ダッシュボード`

### 1-2. APIキーを入れる

Apps Script の `プロジェクトの設定 > スクリプト プロパティ` に次を入れます。

```text
EXPENSE_API_KEY=好きな長めの文字列
```

これは Netlify から Apps Script を呼ぶための合言葉です。

### 1-3. Apps Script を Webアプリとして再デプロイする

設定は次です。

- `実行ユーザー`: 自分
- `アクセスできるユーザー`: 全員

公開 URL を控えます。これが `APPS_SCRIPT_WEB_APP_URL` です。

## 2. Netlify 側の設定

### 2-1. Base directory を入れる

このリポジトリを Netlify に接続したあと、`Site configuration > Build & deploy` で次を設定します。

- `Base directory`: `netlify/expense-desk`
- `Publish directory`: `site`
- `Functions directory`: `netlify/functions`

### 2-2. Environment variables を入れる

`Site configuration > Environment variables` で次を設定します。

- `APPS_SCRIPT_WEB_APP_URL`
- `APPS_SCRIPT_API_KEY`

## 3. 最初の動作確認

1. Netlify を再デプロイする
2. 画面上部の `読込: 申請者 2件 / 費目 ...` が出るか確認する
3. `申請者` に `伊東` と `坂下` が出るか確認する
4. `ANA の領収書 PDF` を1枚入れる
5. `支払先`, `金額`, `費目候補` がある程度埋まるか確認する
6. 登録後に
   - Drive に原本が保存される
   - `経費台帳` に1行増える
   - 画面上の `累計支出額` と `残予算` が動く
   を確認する

## 4. うまくいかないとき

### 申請者が出ない

- Apps Script を再デプロイしたか
- `APPS_SCRIPT_WEB_APP_URL` が最新か
- `申請者` シートのヘッダーが完全一致しているか
- Netlify の `Base directory` が `netlify/expense-desk` になっているか

### OCR が動かない

- `Drive API` が有効か
- Apps Script 側で `Drive API` 高度なサービスが有効か
- PDF や画像が極端に荒くないか

### 登録できない

- `APPS_SCRIPT_WEB_APP_URL`
- `APPS_SCRIPT_API_KEY`

の2つが誤っていないかを先に確認します。
