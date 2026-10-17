@AGENTS.md

# このリポジトリについて

かみのやま温泉の湯宿「小夜月」の公式サイト（6言語）と、日本酒のお取り寄せEC。
GitHub は `samaraizu/sayozuki`。**public リポジトリなので、原価・売上試算・
個人情報・未公開の価格表を置かないこと。**

別案件と混ぜないこと。バスケットボールTシャツのEC は `samaraizu/basketball`、
世田谷餃子の業者向けEC は `samaraizu/setagaya-gyoza`。

- 宿情報（客室・料金・温泉・住所・予約URL）の単一の出所は `lib/site.ts`。
  画面側に数値や住所を直書きしない。更新場所の一覧は README.md の表にある。
- 宿のドメインは sayozuki.com、お取り寄せは shop.sayozuki.com。`proxy.ts` で振り分ける。
  `NEXT_PUBLIC_SPLIT_DOMAINS=true` は **DNS がつながってから** 入れる
  （先に入れると本番のアクセスが仮ページへ飛ぶ）。
- 支給写真は Google Drive の共有リンクで届く。curl で取得して `public/images/` に置き、
  `lib/site.ts` の `photos` にパスを書く。

# 作業前に必ず読むもの

ECサイト（`/shop`、`lib/shop.ts`、`lib/order.ts`、`components/shop/` など）に手を入れる依頼では、着手する前に毎回、次の Notion ページを読み込み、最新の要件に沿って作業すること。

- 日本酒ECサイト実装要件（小夜月株式会社）… Notion「小夜月」ページの中の「Claude Code 共有用 (1)」
  https://app.notion.com/p/3f0fb60c51a980e9adebcf04dfedbe15
  （2026-10 に移動。旧ページ 3ebfb60c51a9808a86e9c865731bc367 は削除済み）

要件は別の Claude Code セッションで随時更新されるため、以前読んだ内容に頼らず、その都度読み直す。依頼と要件が食い違う場合は、着手前にユーザーに確認する。
