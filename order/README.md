# 小夜月 客室オーダー（Sayozuki In-room Order）

客室のQRからゲストのスマホで注文・0円リクエスト・お会計ができる仕組み。
Cloudflare Workers（無料枠）＋ Square（無料プラン・端末なし）で動く。

## 全体の流れ

1. **チェックイン**：スタッフ画面 `/staff/` で部屋番号・課税人数・免除人数・泊数を入れる → 客室QRが出る（印刷して客室へ）
2. **滞在中**：ゲストがQRを読む → メニュー注文（部屋付け）・リクエスト・起こさないで・ご案内
3. **お届け**：スタッフ画面に新着が音付きで出る（Slack通知も可）→「お届け完了」でゲスト画面に通知
4. **精算**：スタッフが「精算する」→ Squareの支払いリンクを発行。ゲストは自分のスマホの「お会計」タブから支払う（スタッフ画面のQRでも可）。入湯税は自動で加算
5. **支払い完了**：SquareのWebhookで自動的に精算済み → 宛名入り領収書を発行できる

現金で受け取ったときは「現金で受領済み」で締める。

## 構成

| 場所 | 役割 |
| --- | --- |
| `public/` | ゲスト画面（和紙テーマ・5言語・写真スライド）、`/staff/` スタッフ画面、`/receipt` 領収書 |
| `src/routes/` | ゲストAPI・スタッフAPI・Square Webhook |
| `src/desk.ts` | 注文の受付窓口（Durable Object）。旅館全体で1つ、注文を1件ずつ処理して**二重受注を防ぐ**。メニューのキャッシュも持つ |
| `src/square/` | カタログ・在庫の読み込み、支払いリンク作成、Square未接続時のモック |
| `src/config/i18n-menu.ts` | **商品名・カテゴリ名の4言語訳**と、カテゴリごとの受付締め切り |
| `public/i18n.js` | 画面文言の5言語、**Wi-Fi情報**、ご案内リンク、リクエスト項目 |
| `migrations/` | D1（データベース）の表定義 |

## 最初のセットアップ

### 1. Cloudflare

```bash
npm install
npx wrangler login
npx wrangler d1 create sayozuki-order        # 出てきた database_id を wrangler.jsonc に貼る
npm run db:remote                             # 表を作る
npx wrangler secret put STAFF_PIN             # スタッフ画面のPIN（長めに）
npx wrangler secret put SQUARE_ACCESS_TOKEN
npx wrangler secret put SQUARE_WEBHOOK_SIGNATURE_KEY
npx wrangler secret put NOTIFY_SLACK_WEBHOOK  # 任意
npm run deploy
```

- `wrangler.jsonc` の `vars` を本番の値に：`SQUARE_LOCATION_ID`、`PUBLIC_ORIGIN`（`https://order.sayozuki.com`）、`GUIDE_BASE_URL`（HPのご案内ページ）
- Workers の **Custom Domain** で `order.〇〇.com` を割り当てる（QRに workers.dev を出さない）
- **スタッフ画面の保護**：Cloudflare Zero Trust → Access で `/staff*` にアプリを作り、スタッフのメールアドレスだけ許可（50人まで無料）。PINとの二重ロックにする

### 2. Square

1. [Square Developer](https://developer.squareup.com/apps) でアプリを作る。まずは **Sandbox** のアクセストークンとロケーションIDで試す
2. 商品登録（Squareの管理画面）
   - カテゴリを **「夕食」「夜食」「飲み物」「翌朝」** で作る（この名前のカテゴリに入った商品だけが注文画面に出る）
   - 数に限りがある商品（すき焼き・レイトチェックアウトなど）は **在庫管理をON** にして、毎朝その日の数を入れる。0で自動的に売り切れ
   - 在庫を追わない商品は、切れたらSquareアプリで **「売り切れ」** にする
   - 写真は商品ごとに複数枚登録できる。1枚目が一覧のサムネ、全部が拡大スライドに出る
3. Webhook（Developer Dashboard → Webhooks）
   - URL：`https://（本番ドメイン）/webhooks/square`
   - イベント：`payment.created` `payment.updated` `catalog.version.updated` `inventory.count.updated`
   - 表示される署名キーを `SQUARE_WEBHOOK_SIGNATURE_KEY` に入れる
4. Sandboxで通しテスト → 問題なければ `SQUARE_ENV` を `production` にして本番トークンへ差し替え

### 3. 商品を増やしたとき

`src/config/i18n-menu.ts` の `ITEMS` に、**Squareに登録した日本語名そのまま**をキーにして4言語の訳を足す。足さなければ日本語で表示される。

## ローカルで試す（Square未接続のモック）

```bash
cp .dev.vars.example .dev.vars   # STAFF_PIN を設定。MOCK_SQUARE=1 でSquare未接続のモックになる
npm run db:local
npm run dev                      # http://127.0.0.1:8787/staff/ でチェックイン → 出てきたURLを開く
npm test
```

## 運用で決めておくこと

- **入湯税の税率**：`BATH_TAX_YEN`（初期値150円）。上山市の税率・免除条件は市の税務課で確定させる。帳簿CSVはスタッフ画面から月別に出せる（1年保存）
- **受付時間**：`ORDER_OPEN`〜`LAST_ORDER`（初期値 6:00〜22:30）。夕食カテゴリは `i18n-menu.ts` の `cutoff`（初期値18:00）で締める
- **領収書**：今は免税事業者を前提に、税率ごとの内訳と登録番号を載せていない。インボイス登録をしたら `public/receipt.html` に登録番号と税率別の金額を足す
- 酒の**未開栓ボトルの持ち帰り販売**をメニューに載せるなら、酒類小売業免許が別途必要
