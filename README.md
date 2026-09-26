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
| ページの文章・構成 | `app/page.tsx` |

料理の写真は `photos.meal` に入れると「お食事」欄に表示されます。

## ご予約フォーム

直接のお問い合わせは Resend でメール通知します。`.env.local.example` を `.env.local` にコピーして値を入れてください。
未設定のあいだは送信せず、内容をサーバーのログに出します。
