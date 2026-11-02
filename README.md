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
- ドメイン接続までの仮のURLは https://sayozuki.toneclown17.workers.dev 。
- 客室オーダー（`order/`）は別の Worker「sayozuki-order」。`order/` の中でデプロイする。

### 自動デプロイ（Workers Builds）

GitHub の `main` に入ると、Cloudflare の Workers Builds が2つの Worker をそれぞれビルドして本番に出す。
設定はダッシュボードの各 Worker → Settings → Builds にある（リポジトリには入っていない）。

| Worker | ルート | ビルドコマンド | デプロイコマンド |
| --- | --- | --- | --- |
| sayozuki | `/` | `npx opennextjs-cloudflare build` | `npx opennextjs-cloudflare deploy` |
| sayozuki-order | `order` | なし | `npx wrangler deploy` |

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

料理の写真は `photos.meal` に入れると「お食事」欄に表示されます。

## ご予約フォーム

直接のお問い合わせは、Resend のメール通知と、予約管理の台帳（スプシの「問い合わせ」タブ）の両方に送ります。
台帳に入った問い合わせは、予約管理の画面（`booking/`）の「問い合わせ」から「予約にする」で手動入力に引き継げます。

フォームでご到着日を選ぶと、台帳の空き（同じ受付用 GAS から取る）をもとに客室ごとの「空室あり／満室／定員を超えます／受付準備中／宿で確認」を出し、満室・準備中・定員超えの客室は選べなくなる。
送信のときもサーバーで確かめ直し、見ているあいだに埋まった客室なら止める。空室は `/api/availability` が5分ためておく（台帳の予約が画面に出るまで最大5分）。
HPの「201号室」は台帳の「201」に読み替え、台帳にない客室（304号室など）は「宿で確認」で選べる。空室が取れないときは、空室表示なしで今までどおり送れる。
受け口の GAS の作り方は `booking/README.md` の「HPの問い合わせを台帳に入れる」。

| 値 | 用途 |
| --- | --- |
| `RESEND_API_KEY` `INQUIRY_MAIL_TO` `INQUIRY_MAIL_FROM` | メール通知 |
| `BOOKING_INTAKE_URL` `BOOKING_INTAKE_SECRET` | 台帳への連携（受付用 GAS の `/exec` と合言葉） |

本番は Worker の secret（`npx wrangler secret put 名前`）、手元は `.env.local`（`.env.local.example` をコピー）に入れる。
入っているかは `npx wrangler secret list --name sayozuki` で確かめられる。

どちらか片方に届けば完了画面を出す。**本番でどちらにも届かなかったときはエラーを出す**（以前は未設定でも完了画面が出て、申し込みが黙って消えていた）。
`next dev` のときだけは、未設定でもログに出して完了画面にする。

## ドメイン

- 宿：https://sayozuki.com（6言語）
- お取り寄せ：https://shop.sayozuki.com（中身は `/shop` 以下。`proxy.ts` で振り分ける）

`NEXT_PUBLIC_SPLIT_DOMAINS=true` を入れてビルド・デプロイすると、宿とお取り寄せのリンクがそれぞれのドメインを向き、sayozuki.com/shop は shop.sayozuki.com へ、workers.dev などほかのホストは sayozuki.com へ転送される。
ビルド時に埋め込まれる値なので、ビルドする環境（ローカルなら `.env.production`）に入れる。Cloudflare の Worker の変数に入れても効かない。
**DNS がつながってから入れること**（先に入れると本番のアクセスが仮ページへ飛ぶ）。未設定のあいだ・ローカルでは今までどおり `/shop` で動く。

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
