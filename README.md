# 小夜月（さよづき）

かみのやま温泉の湯宿「小夜月」の公式サイト。Next.js 16 + Tailwind CSS 4。

```bash
npm install
npm run dev   # http://localhost:3000
```

## 公開（Cloudflare Workers）

Cloudflare Workers の Worker「sayozuki」で公開している（OpenNext で Next.js を Workers に載せる）。設定は `wrangler.jsonc` と `open-next.config.ts`。

```bash
npx wrangler login   # 初回だけ
npm run preview      # Workers と同じ環境で手元確認（http://localhost:8787）
npm run deploy       # ビルドして本番へ
```

- 秘密の値（`RESEND_API_KEY` など、`.env.local.example` の項目）はリポジトリに置かず `npx wrangler secret put RESEND_API_KEY` で入れる。
- 本番は https://sayozuki.com（2026-11-08 に接続。Worker「sayozuki」のカスタムドメインに sayozuki.com・www.sayozuki.com・shop.sayozuki.com）。workers.dev とプレビューURLは止めている（`wrangler.jsonc` の `workers_dev: false`・`preview_urls: false`）。
- 客室オーダー（`order/`）は別の Worker「sayozuki-order」。`order/` の中でデプロイする。
- **本番ビルドは Webpack**（`npm run build` = `next build --webpack`）。Turbopack だと Workers Builds の環境で `next/font/google` の Noto Sans JP が「Can't resolve '@vercel/turbopack-next/internal/font/google/font'」「next/font/google queries have exactly one entry」で落ちる（手元では通る）。`next dev` は Turbopack のまま。

### 自動デプロイ（Workers Builds）

GitHub の `main` に入ると、Cloudflare の Workers Builds が3つの Worker をそれぞれビルドして本番に出す。
設定はダッシュボードの各 Worker → Settings → Builds にある（リポジトリには入っていない）。

| Worker | ルート | ビルドコマンド | デプロイコマンド | ビルド変数 |
| --- | --- | --- | --- | --- |
| sayozuki | `/` | `npx opennextjs-cloudflare build` | `npx opennextjs-cloudflare deploy` | `NEXT_PUBLIC_SPLIT_DOMAINS=true` |
| sayozuki-order | `order` | なし | `npx wrangler deploy` | なし |
| sayozuki-booking | `/booking/worker` | `npm ci` | `npm run deploy` | なし |

- **`main` 以外のブランチのビルド（Previews）は2つとも止めている。** `npx wrangler preview` は Wrangler の設定に `previews` ブロックがないと失敗し、客室オーダーで使うには本番と別の D1 と Square のサンドボックスを用意する必要があるため。PR でビルドを確かめたくなったら、それを用意してから Settings → Builds → Previews Base でオンにする。
- sayozuki のビルドコマンドを `npx wrangler deploy` にしないこと。OpenNext のプロジェクトだと Wrangler がビルドせずにデプロイしようとして失敗する。

## 更新する場所

| 変えたいもの | ファイル |
| --- | --- |
| 客室・料金・温泉・住所などの宿情報 | `lib/site.ts` |
| 楽天トラベル・じゃらんの予約URL | `lib/site.ts` の `otaLinks` |
| 写真 | `public/images/` に置き、`lib/site.ts` の `photos` にパスを書く |
| 宿のページの文章（日本語） | `lib/i18n/ja.ts` |
| 外国語の文章（英・中・越・泰・韓） | `lib/i18n/en.ts` `zh.ts` `vi.ts` `th.ts` `ko.ts` |
| 宿のページの構成 | `components/InnPage.tsx` |
| 滞在中のご案内（/guide）のチェックイン・アウト、浴場の時間、駐車場 | `lib/site.ts` の `stay`（未定は null のままで「準備中」と出る） |
| 滞在中のご案内の文章（日・英・中・韓） | `lib/guide.ts` |
| お取り寄せの商品・販売設定・特商法の表記 | `lib/shop.ts` |
| 予約（事前決済）の料金の決まり：追加1名・繁忙期の期間と加算・最長泊数 | `lib/site.ts` の `bookingRules` |
| キャンセル規定 | `lib/site.ts` の `cancellationPolicy` と `lib/i18n/*.ts` の `book.policy`（6言語とも） |
| 予約ページ・完了画面の文言 | `lib/i18n/*.ts` の `book` |
| 宿のページの色（客室オーダーと同じ青緑） | `app/globals.css` の後半（`--color-sea` など） |

料理の写真は `photos.meal` に入れると「お食事」欄に表示されます。

## 空室カレンダーと予約（事前決済）

`/reserve`（外国語は `/en/reserve` など）。カレンダーでご到着日とご出発日を選び、部屋・食事・お客様情報を入れて、Square で前払いする。

```
HP（Worker sayozuki）──サービスバインディング（BOOKING → sayozuki-booking の HpApi）──→ 予約管理（D1）
   │ 空室：/api/availability が calendar() を20秒ためて返す
   │ 予約：料金を lib/pricing.ts で計算し直し、startCheckout() で部屋を「仮」で押さえる
   │       → 予約管理が Square の支払いリンクを作る → お客様は Square のページで払う
   └ 完了：/reserve/done が checkoutStatus() で払われたかを聞き、「確定・HPで決済済」にする
```

- 部屋の押さえは予約管理の「重なる予約がないときだけ1行入れる」1文でやるので、2人が同時に押しても片方しか入らない
- 30分で払われなければ、予約管理の毎分の見回りが支払いリンクを消して部屋を戻す。払われたのに完了画面に戻ってこなくても、見回りが確定する
- 決済待ち（仮）の予約は台帳スプシに送らない。払われてから取り込みGASが台帳に載せ、カレンダー・通知がかかる
- 料金：2名料金＋3名目から1名ごとに2名料金の半分＋繁忙期の夜は1室3,000円＋食事（お一人様1泊 朝食1,000円・夕食3,500円）。入湯税は現地払い
- 確認メール（お客様と宿）は予約管理の Worker が払われたときに1回だけ送る。文面はHPが言語に合わせて作る
- 台帳にない客室（304号室）と「準備中」の部屋は予約できない（カレンダーの空き数にも入らない）
- 予約管理につながっていない（`next dev` など）ときは「ただいまオンラインのご予約を受け付けられません」と出る

設定は予約管理の Worker 側（`booking/worker/README.md` の「HPの事前決済」）。HP側は `wrangler.jsonc` の `BOOKING` だけで、秘密の値は要らない。

## お問い合わせフォーム

直接のお問い合わせは、Resend のメール通知と、予約管理（Worker「sayozuki-booking」の D1）の両方に送ります。
予約管理の画面の「問い合わせ」に出て、「予約にする」で手動入力に引き継げます（予約と同じ `BOOKING` でつなぐので、別の設定は要らない）。

フォームでご到着日を選ぶと、予約管理（D1）の空きをもとに客室ごとの「空室あり／満室／定員を超えます／受付準備中／宿で確認」を出し、満室・準備中・定員超えの客室は選べなくなる。
送信のときもサーバーで確かめ直し、見ているあいだに埋まった客室なら止める。
HPの「201号室」は台帳の「201」に読み替え、台帳にない客室（304号室など）は「宿で確認」で選べる。空室が取れないときは、空室表示なしで今までどおり送れる。

| 値 | 用途 |
| --- | --- |
| `RESEND_API_KEY` `INQUIRY_MAIL_TO` `INQUIRY_MAIL_FROM` | メール通知 |

本番は Worker の secret（`npx wrangler secret put 名前`）、手元は `.env.local`（`.env.local.example` をコピー）に入れる。
入っているかは `npx wrangler secret list --name sayozuki` で確かめられる。

どちらか片方に届けば完了画面を出す。**本番でどちらにも届かなかったときはエラーを出す**（以前は未設定でも完了画面が出て、申し込みが黙って消えていた）。
`next dev` のときだけは、未設定でもログに出して完了画面にする。

## ドメイン

- 宿：https://sayozuki.com（6言語）
- お取り寄せ：https://shop.sayozuki.com（中身は `/shop` 以下。`proxy.ts` で振り分ける）

`NEXT_PUBLIC_SPLIT_DOMAINS=true` を入れてビルド・デプロイすると、宿とお取り寄せのリンクがそれぞれのドメインを向き、sayozuki.com/shop は shop.sayozuki.com へ、www などほかのホストは sayozuki.com へ転送される。
ビルド時に埋め込まれる値なので、ビルドする環境（ローカルなら `.env.production`）に入れる。Cloudflare の Worker の変数に入れても効かない。
本番は Worker「sayozuki」→ Settings → Builds →「Variables and secrets」に入れてある（2026-11-08）。未設定のあいだ・ローカルでは今までどおり `/shop` で動く。

## 多言語

日本語は `/`、英語 `/en`、中国語（簡体字）`/zh`、ベトナム語 `/vi`、タイ語 `/th`、韓国語 `/ko`。
文言を変えるときは `lib/i18n/ja.ts` を直し、同じ項目を各言語のファイルにも入れる（型で漏れが分かる）。
お問い合わせメールは日本語で届き、お客様の言語が1行目に入る。

## お取り寄せ（/shop）

日本酒の通販。注文はフォームで受けてメール通知し、送料と支払い方法は注文後にメールで案内する。
インターネットで酒を売るには「通信販売酒類小売業免許」が必要なため、取得するまでは `lib/shop.ts` の `open` を `false` にして注文の確定を止めている。
取得後に `legal`（特定商取引法の表記・酒類販売管理者標識）を実際の内容で埋め、`open: true` にする。

注文の流れは カート（/shop/cart）→ お届け先（/shop/checkout）→ お支払い方法（/shop/checkout/payment）→ 確認（/shop/checkout/confirm）→ 完了（/shop/complete）。
送料表・支払方法・受け取り方法・商品区分（通常／別注）は `lib/shop.ts`。送料の金額は仮なので、運送会社と契約したら差し替える。

### 免許申請用の資料

- `docs/layout/ECサイトレイアウト図.pdf` … 各画面と法定表示の位置をまとめたもの
- `docs/layout/screens/` … 各画面のスクリーンショット
- `/documents/delivery-note`・`/documents/receipt` … 納品書・領収書のフォーマット案（ブラウザで開いて印刷・PDF保存できる）
