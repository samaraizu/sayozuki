# 小夜月（さよづき）

かみのやま温泉の湯宿「小夜月」の公式サイト。Next.js 16 + Tailwind CSS 4。

```bash
npm install
npm run dev   # http://localhost:3000
```

## 更新する場所

| 変えたいもの | ファイル |
| --- | --- |
| 客室・料金・温泉・住所などの宿情報 | `lib/site.ts` |
| 楽天トラベル・じゃらんの予約URL | `lib/site.ts` の `otaLinks` |
| 写真 | `public/images/` に置き、`lib/site.ts` の `photos` にパスを書く |
| 宿のページの文章（日本語） | `lib/i18n/ja.ts` |
| 外国語の文章（英・中・越・泰・韓） | `lib/i18n/en.ts` `zh.ts` `vi.ts` `th.ts` `ko.ts` |
| 宿のページの構成 | `components/InnPage.tsx` |
| お取り寄せの商品・販売設定・特商法の表記 | `lib/shop.ts` |

料理の写真は `photos.meal` に入れると「お食事」欄に表示されます。

## ご予約フォーム

直接のお問い合わせは Resend でメール通知します。`.env.local.example` を `.env.local` にコピーして値を入れてください。
未設定のあいだは送信せず、内容をサーバーのログに出します。

## ドメイン

- 宿：https://sayozuki.com（6言語）
- お取り寄せ：https://shop.sayozuki.com（中身は `/shop` 以下。`proxy.ts` で振り分ける）

Vercel の本番の環境変数に `NEXT_PUBLIC_SPLIT_DOMAINS=true` を入れると、宿とお取り寄せのリンクがそれぞれのドメインを向き、sayozuki.com/shop は shop.sayozuki.com へ転送される。
**DNS がつながってから入れること**（先に入れると本番のアクセスが仮ページへ飛ぶ）。未設定のあいだ・プレビュー・ローカルでは今までどおり `/shop` で動く。

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
