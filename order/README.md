# 小夜月 客室オーダー（Sayozuki In-room Order）

客室のQRからゲストのスマホで注文・0円リクエスト・お会計ができる仕組み。
Cloudflare Workers（無料枠）＋ Square（無料プラン・端末なし）で動く。

## 全体の流れ

1. **客室QR**：部屋ごとに**固定のQR**を一度だけ発行済み（D1の `rooms` 表）。印刷して客室に置きっぱなしにする。スタッフ画面からは発行しない
2. **滞在中**：ゲストがQRを読む → メニュー注文（部屋付け）・リクエスト・起こさないで・ご案内
3. **お届け**：スタッフ画面に新着が音付きで出る（Slack通知も可）→「お届け完了」でゲスト画面に通知
4. **精算**：スタッフが「精算する」→ Squareの支払いリンクを発行。ゲストは自分のスマホの「お会計」タブから支払う（スタッフ画面のQRでも可）
5. **支払い完了**：Squareの注文を毎分確かめて自動的に精算済み（Webhookを登録すれば即時）→ 宛名入り領収書を発行できる

現金で受け取ったときは「現金で受領済み」で締める。精算が済むと、その部屋は次のお客様向けにまっさらな状態に戻る。

入湯税はこの仕組みでは扱わない（フロントで人数を聞いて対応）。

## 構成

| 場所 | 役割 |
| --- | --- |
| `public/` | ゲスト画面（和紙テーマ・5言語・写真スライド）、`/staff/` スタッフ画面、`/receipt` 領収書 |
| `src/routes/` | ゲストAPI・スタッフAPI・Square Webhook |
| `src/desk.ts` | 注文の受付窓口（Durable Object）。旅館全体で1つ、注文を1件ずつ処理して**二重受注を防ぐ**。メニューのキャッシュも持つ |
| `src/square/` | カタログ・在庫の読み込み、支払いリンク作成、Square未接続時のモック |
| `src/config/i18n-menu.ts` | **商品名・カテゴリ名の4言語訳**と、カテゴリごとの受付締め切り |
| `public/i18n.js` | 画面文言の5言語、ご案内リンク、リクエスト項目 |
| Wi-Fi情報 | Cloudflare の Secret `WIFI_SSID` `WIFI_PASSWORD`（公開リポジトリに書かない。客室QRで開いた人にだけ /api/session で渡す） |
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

- `wrangler.jsonc` の `vars` を本番の値に：`SQUARE_LOCATION_ID`、`PUBLIC_ORIGIN`（`https://order.sayozuki.com`）、`GUIDE_BASE_URL`（`https://sayozuki.com/guide`）
- Workers の **Custom Domain** で `order.sayozuki.com` を割り当て済み（2026-11-08）。workers.dev とプレビューURLは止めている（`wrangler.jsonc` の `workers_dev: false`・`preview_urls: false`）。客室QRは `order.sayozuki.com` のものだけが使える
- 客室QRの中身は、スタッフ画面を開いているドメインで作られる。新しく刷るQRは `https://order.sayozuki.com/staff` から出す
- スマホ通知（Webプッシュ）はドメインごとの登録。`order.sayozuki.com/staff` をホーム画面に追加し直して、通知をオンにし直す
- **スタッフ画面の保護**：Cloudflare Zero Trust → Access で `/staff*` にアプリを作り、スタッフのメールアドレスだけ許可（50人まで無料）。PINとの二重ロックにする

### 2. Square

1. [Square Developer](https://developer.squareup.com/apps) でアプリを作る。まずは **Sandbox** のアクセストークンとロケーションIDで試す
2. 商品登録（Squareの管理画面）
   - カテゴリは **「夕食」「夜食」「飲み物」「お菓子」「朝食」「翌朝」「その他」**（この名前のカテゴリに入った商品だけが注文画面に出る。スタッフ画面から商品を追加すると、Squareに無いカテゴリは自動で作る。商品のないカテゴリは注文画面に出さない）
   - 数に限りがある商品（すき焼き・レイトチェックアウトなど）は **在庫管理をON** にして、毎朝その日の数を入れる。0で自動的に売り切れ
   - 在庫を追わない商品は、切れたらSquareアプリで **「売り切れ」** にする
   - 写真は商品ごとに複数枚登録できる。1枚目が一覧のサムネ、全部が拡大スライドに出る
3. Webhook（Developer Dashboard → Webhooks）
   - URL：`https://order.sayozuki.com/webhooks/square`（2026-11-08 に変更済み。署名は `PUBLIC_ORIGIN` と届いたURLの両方で確かめる）
   - イベント：`payment.created` `payment.updated` `catalog.version.updated` `inventory.count.updated`
   - 表示される署名キーを `SQUARE_WEBHOOK_SIGNATURE_KEY` に入れる
   - Webhookが未登録でも、支払い完了は `src/lib/settle.ts` が拾う（毎分のcron・スタッフ画面の一覧・お客様のお会計タブ・スタッフの「支払いを確認」ボタンから Orders API で確認）。Webhookは即時反映と取りこぼし防止のため
4. Sandboxで通しテスト → 問題なければ `SQUARE_ENV` を `production` にして本番トークンへ差し替え

### 3. 商品の追加・編集・掲載をやめる

スタッフ画面の「**メニュー**」から行う（`src/square/admin.ts`）。

- 名前・説明・価格・カテゴリ・写真・在庫数は Square のカタログにそのまま書く
- 英語・中国語・韓国語の訳と「一時停止」は D1 の `menu_meta` に置く。訳の空欄は保存時に Workers AI が日本語から訳す
- 「掲載をやめる」は Square のアーカイブ（Squareの管理画面から戻せる）
- 精算前の注文に入っている商品は、価格の変更と掲載をやめることができない（Squareの請求額が明細とずれるため）
- `src/config/i18n-menu.ts` の `ITEMS` は最初に入れた12品の訳。スタッフ画面で一度保存した商品は `menu_meta` の訳が優先される

## 商品の紹介ページと、夕食・朝食の事前予約

| URL | 中身 |
| --- | --- |
| 注文画面で商品をタップ | 写真スライド＋紹介のモーダル。URLの末尾に `#<slug>` が付き、戻るボタンで閉じる |
| `/menu` | 紹介ページの一覧（客室QRなしで開ける） |
| `/menu/<slug>` | 1品の紹介ページ（例：`/menu/sukiyaki`）。`?lang=en` で言語を指定 |

- **中身はスタッフ画面で入れる**：「メニュー」→ 商品の編集（または追加）→「詳細ページ」。URL・ひとこと・紹介文・内容・お届け・量・補足・アレルゲン。英語の空欄は保存のときに Workers AI が日本語から訳す（中国語・韓国語の画面にも英語で出す）。D1 の `settings` に `menu_detail:<商品id>` で置く（`src/square/detail.ts`。客室オーダーのデプロイは D1 の表を作り替えないので、表や列は足していない）
- 写真は Square の商品写真（スタッフ画面の「写真を追加」）。無ければ `public/dishes.js` の `photos`、それも無ければ「撮影予定」の枠
- **下書き**：スタッフ画面の「メニュー」のいちばん上。下書きの商品はお客様の注文画面にも `/menu` の一覧にも出ず、注文も受けない（`/menu/<URL>` を開けば下見できる）。一覧の「公開」で出し、編集画面の「下書きに戻す」で引っ込める。新しく追加した商品は「下書き保存」か「保存して公開」を選ぶ。D1 の `settings` に `menu_draft:<商品id>`（`src/square/detail.ts`）
- 最初から下書きに入っているのは `DRAFT_SEEDS` の3品（すき焼き・クロワッサンサンドの朝食・おにぎりと漬物の朝食）。Square に無い朝食2品は「Squareに未登録」として並び、「公開」で `public/dishes.js` の内容・写真・価格のまま Square に商品を作る（価格はあとから直せる）
- **一時停止中の商品**も一覧（`/menu`）に出ないが、`/menu/<URL>` を開けば見られる
- `public/dishes.js` は、まだ詳細ページを保存していない商品の初期値（スタッフ画面で開くと入っている。チェックを入れて保存すると画面の内容が使われる）
- 価格・写真・売り切れ・詳細は `/api/public/menu`（客室QR不要・在庫数は出さない）から出す
- **夕食・朝食は事前予約制**（`i18n-menu.ts` の `preorder`）。仕込みが要り当日言われても用意できないので、注文画面には紹介だけ出して注文は受けない（サーバーも `preorder_only` で断る）
- 申込は予約のとき。HP・ほかのサイトは予約フォームで選ぶ。Airbnb は申込欄がないので、予約が入った時点で宿がメッセージで聞き、答えを予約管理（`booking/`）の予約の中身 →「食事を入れる」に入れる。聞く文面は同じ画面でコピーできる（`/menu` のリンク入り）

## ローカルで試す（Square未接続のモック）

```bash
cp .dev.vars.example .dev.vars   # STAFF_PIN を設定。MOCK_SQUARE=1 でSquare未接続のモックになる
npm run db:local
npm run db:seed                  # 手元のD1だけに確認用の6部屋を入れる（本番には流さない）
npm run dev                      # http://127.0.0.1:8787/?r=local-dev-201 と /staff/ を開く
npm test
```

## 客室を足すとき

QRのidは推測されないランダムな文字列にする（このリポジトリは公開なので、idをコードやREADMEに書かない）。

```bash
npx wrangler d1 execute sayozuki-order --remote --command \
  "INSERT INTO rooms (id, name, sort, created_at) VALUES ('$(openssl rand -base64 12 | tr '+/' '-_')', '205号室', 7, datetime('now'))"
```

QRの中身は `https://order.sayozuki.com/?r=（id）`。

## 運用で決めておくこと

- **受付時間**：`ORDER_OPEN`〜`LAST_ORDER`（初期値 6:00〜22:30）。カテゴリごとの締めは `i18n-menu.ts` の `cutoff`。夕食・朝食は `preorder`（注文画面では受けない）
- **領収書**：今は免税事業者を前提に、税率ごとの内訳と登録番号を載せていない。インボイス登録をしたら `public/receipt.html` に登録番号と税率別の金額を足す
- 酒の**未開栓ボトルの持ち帰り販売**をメニューに載せるなら、酒類小売業免許が別途必要
