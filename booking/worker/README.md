# 小夜月 予約管理（Cloudflare版）

予約台帳を Googleスプレッドシートから Cloudflare D1 に移すための Worker。
HP（Worker「sayozuki」）・客室オーダー（「sayozuki-order」）と同じ Cloudflare アカウントで動く。

画面と空室判定は GAS版と同じもの（`../src/`）を `npm run build` で組み立てて使う。
GAS版を止めるまでは、画面の直しは `../src/` でやれば両方に効く。

## 移行のあいだの仕組み（第1段）

```
Airbnbメール ─→ 取り込みGAS（5分ごと）─→ 予約台帳スプシ
                    │  ↑ はじめに：アプリで入れた予約を台帳の末尾に足す（GET /api/sync/pending）
                    │  └ おわりに：台帳の予約・部屋をまるごと送る（POST /api/sync/sheet）
                    ↓
              Cloudflare D1 ←─ 予約管理アプリ（この Worker）←─ 本人・海斗のスマホ
```

台帳に書くのは取り込みGASだけのまま。アプリで入れた直販も5分以内に台帳に載り、
泊数・入湯税・要確認・Googleカレンダー・通知メールがかかる。台帳を手で直した内容も次の同期でD1に入る。
GoogleのカギをCloudflareに置かずに済むよう、行き来はすべてGASから呼ぶ形にしてある。

二重予約は、D1への書き込みを「重なる予約がないときだけ1行入れる」1文で行って防ぐ（2人が同時に押しても片方だけ入る）。
Airbnbとの衝突は、取り込みGASの [重複] とカレンダーの赤表示で拾う（GAS版と同じ）。

| 場所 | 中身 |
| --- | --- |
| `src/index.ts` | 入口。`/api/board` `/api/bookings`（画面用）、`/api/sync/*`（取り込みGAS用） |
| `src/auth.ts` | 「Googleでログイン」、ログイン状態のクッキー、`ALLOWED_EMAILS` との照合、同期の合言葉 |
| `public/login.html` | ログイン画面（`/login`） |
| `src/db.ts` | D1の読み書き。手動入力、スプシとの同期 |
| `migrations/` | D1の表（`rooms` `bookings` `op_log` `meta`） |
| `scripts/build.mjs` | `../src/` から `public/index.html` と `src/lib.gen.js` を作る（どちらも gitignore） |

D1 `sayozuki-booking` は作成済み（IDは `wrangler.jsonc`）。表は最初のデプロイで作られる。

## 最初のセットアップ

### 1. デプロイ

Cloudflare のダッシュボード → Workers & Pages → 作成 →「Gitリポジトリをインポート」で `samaraizu/sayozuki` を選ぶ（HPと同じやり方）。

| 項目 | 値 |
| --- | --- |
| プロジェクト名 | `sayozuki-booking` |
| ルートディレクトリ | `booking/worker` |
| ビルドコマンド | `npm ci` |
| デプロイコマンド | `npm run deploy` |
| プレビュー（ブランチのビルド） | オフ（HP・客室オーダーと同じ理由） |

`npm run deploy` が、画面の組み立て → D1の表の作成・更新 → デプロイ まで続けてやる。
手元から出すなら `npm ci && npx wrangler login && npm run deploy`。

URL は `https://booking.sayozuki.com`（2026-11-08 にカスタムドメインを接続）。workers.dev とプレビューURLは止めている（`wrangler.jsonc` の `workers_dev: false`・`preview_urls: false`）。
ログインのクッキーはドメインごとなので、URL を変えたら「Googleでログイン」し直す。

### 2. 「Googleでログイン」の鍵を作る（Google Cloud。カード登録は要らない）

ログインは Worker の中で完結させる（Cloudflare Access / Zero Trust は使わない。Free でも支払い情報の登録が要るため）。

1. https://console.cloud.google.com/ に自分のGoogleアカウントで入り、上のプロジェクト選択 →「新しいプロジェクト」→ 名前 `sayozuki-booking` →「作成」
2. https://console.cloud.google.com/auth/overview（Google Auth Platform）→「開始」。
   アプリ名「小夜月 予約」、サポートメールは自分 → 対象は **外部** → 連絡先は自分 → ポリシーに同意 →「作成」
3. 「対象」→ テストユーザーに本人と海斗のGoogleアカウントを足す。公開ステータスは「テスト中」のままでよい
   （求めるのは `openid` `email` だけなので、未確認アプリの警告も7日での失効も出ない）
4. 「クライアント」→「クライアントを作成」→ 種類 **ウェブ アプリケーション**、名前 `sayozuki-booking`、
   承認済みのリダイレクト URI に `https://booking.sayozuki.com/api/auth/callback` →「作成」
   （戻り先はログインを始めたドメインから作るので、使うドメインごとに要る）
5. 出てきた **クライアントID** と **クライアントシークレット** を控える。
   シークレットはこの画面を閉じると二度と見られないので「JSONをダウンロード」もしておく（なくしたら作り直す）

6か月ログインがないクライアントは Google が自動で消す（30日以内なら戻せる）。

### 3. Secrets

Worker「sayozuki-booking」→ 設定 → 変数とシークレット →「追加」で、種類を **シークレット** にして入れる
（「テキスト」にすると次のデプロイで消える）。

| 名前 | 値 |
| --- | --- |
| `GOOGLE_CLIENT_ID` | 手順2のクライアントID |
| `GOOGLE_CLIENT_SECRET` | 手順2のクライアントシークレット |
| `SESSION_SECRET` | 長い乱数（ログイン状態のクッキーの署名） |
| `ALLOWED_EMAILS` | 使う人のGoogleアカウント（カンマ区切り） |
| `SYNC_TOKEN` | 長い乱数（取り込みGASとの合言葉。手順4でも使う） |

乱数は `openssl rand -hex 32` で作る（Mac なら `openssl rand -hex 32 | pbcopy` でコピーまで済む）。
`SESSION_SECRET` と `SYNC_TOKEN` は別の値にする。どちらも32文字未満だと受け付けない。
手元からなら `npx wrangler secret put 名前` でも入れられる。

- 入れる前に開くと、ログイン画面に「ログインの設定がまだ終わっていない」と出る
- `ALLOWED_EMAILS` から消した人は、ログイン済みでも次の操作から入れなくなる
- `SESSION_SECRET` を変えると全員ログアウトになる
- ログインは30日もつ。ログアウトは `/api/auth/logout`

### 4. 取り込みGASをつなぐ

1. 台帳スプシ →「拡張機能」→「Apps Script」→「コード.gs」に `../booking-system/Code.js` を丸ごと貼って保存
2. プロジェクトの設定 → スクリプト プロパティに2つ足す

   | プロパティ | 値 |
   | --- | --- |
   | `CF_SYNC_URL` | `https://booking.sayozuki.com` |
   | `CF_SYNC_TOKEN` | 手順3の `SYNC_TOKEN` と同じ値 |

3. エディタで `run` を1回手で実行。実行ログにエラーがなく、アプリを開いて台帳の予約が出ればつながっている。
   送れなかったときは、いつもの通知メールに「Cloudflare版に台帳を送れなかった」が1日1回届く

### 5. 確かめる

アプリで直販を1件入れる → 5分以内に台帳の末尾に載り、泊数・入湯税が埋まる → アプリの帯にもそれが出る。
確かめた行は、台帳でステータスを「キャンセル」にする（行は消さない）。

## 手元で動かす

```bash
cd booking/worker
npm ci
npm run db:local
printf 'DEV_EMAIL=dev@example.com\nALLOWED_EMAILS=dev@example.com\nSYNC_TOKEN=%s\n' "$(openssl rand -hex 32)" > .dev.vars
npm run dev
```

`http://localhost:8787` で開く。`DEV_EMAIL` は localhost のときだけログインの代わりに使われる（本番には入れない）。
手元で本物のログインを試すなら、`.dev.vars` から `DEV_EMAIL` を消して `GOOGLE_CLIENT_ID` `GOOGLE_CLIENT_SECRET` `SESSION_SECRET` を足し、
クライアントのリダイレクト URI に `http://localhost:8787/api/auth/callback` を足す。
中身は空なので、`/api/sync/sheet` に部屋と予約のJSONを送って入れる。

## HPの事前決済

HP（Worker「sayozuki」）の `/reserve` から入る予約。HPからはサービスバインディングの `HpApi`（`src/index.ts`）だけを呼ぶ。インターネットには出していない入口。

| 場所 | 中身 |
| --- | --- |
| `src/hp.ts` | 空室カレンダー、部屋の押さえ（「仮」で1行）と支払いリンク、完了画面の確認、毎分の見回り |
| `src/square.ts` | Square の支払いリンク・注文の確認・リンクの削除。`SQUARE_MOCK=1` で払ったことにする（手元だけ） |
| `src/mail.ts` | 確認メール（Resend） |
| `migrations/0002_hp_checkout.sql` | `hp_checkouts`（決済待ち・済み・期限切れ） |

- 押さえてから30分（`HOLD_MINUTES`）で払われなければ、毎分の cron が支払いリンクを消して仮の行を消す
- 払われたら `bookings` を「確定」・支払い状況「HPで決済済」にし、お客様と `MAIL_TO` に確認メールを1回だけ送る
- 決済待ちは `/api/sync/pending` に出さない（台帳には払われてから載る）
- 期限切れのあとに払われたら（ふつうは起きない）、操作ログと `MAIL_TO` に「返金か手で予約」を知らせる

Secrets（Worker「sayozuki-booking」→ 設定 → 変数とシークレット、種類は **シークレット**）

| 名前 | 値 |
| --- | --- |
| `SQUARE_ACCESS_TOKEN` | 客室オーダー（sayozuki-order）と同じ Square の本番アクセストークン |
| `SQUARE_LOCATION_ID` | 同じロケーションID |
| `RESEND_API_KEY` | HPのお問い合わせと同じ Resend のキー |
| `MAIL_FROM` | 確認メールの送信元（例 `小夜月 <info@sayozuki.com>`。Resend で認証したドメイン） |
| `MAIL_TO` | 新しいHP予約の通知先（カンマ区切り） |

`SQUARE_ENV` は `wrangler.jsonc` の vars で `production`。sandbox で試すときだけ `sandbox` にする。
台帳の取り込みGAS（`../booking-system/Code.js`）の支払い状況の選択肢に「HPで決済済」を足したので、GASにも貼り直す。

手元で HP と一緒に動かす（HPのルートで）：

```bash
npx opennextjs-cloudflare build && npx opennextjs-cloudflare populateCache local
```

```bash
npx wrangler d1 migrations apply sayozuki-booking --local -c booking/worker/wrangler.jsonc --persist-to .wrangler/state
```

```bash
npx wrangler dev -c wrangler.jsonc -c booking/worker/wrangler.jsonc --local
```

`booking/worker/.dev.vars` に `SQUARE_MOCK=1` を入れておくと、Square を呼ばずに完了画面まで通る。部屋は `wrangler d1 execute` で入れる。

## キャンセル

予約管理アプリで予約を開くと、下に「キャンセル」とキャンセル規定のメモが出る（直販の予約だけ。Airbnb・楽天はそのサイトでキャンセルする）。

| ご到着日まで | キャンセル料 |
| --- | --- |
| 7日前まで | 無料 |
| 6日前〜2日前 | 支払額の30% |
| 前日 | 支払額の50% |
| 当日・連絡なしの不泊 | 支払額の100% |

- HPで前払いの予約（支払い状況「HPで決済済」）は、規定どおりの返金額が入った状態で出る。額は直せる（規定より多く返すときなど）。押すと Square で返金し、予約を「キャンセル」にする
- 現地払い・未収の予約は返金しない。規定のキャンセル料の額だけ出す（請求するかは宿の判断）
- 台帳（スプシ）は取り込みGASが次の同期（5分以内）で「キャンセル」にし、メモに1行足す（`src/cancel.ts`、`cancellations` 表、`/api/sync/pending` の `cancels`）。台帳がキャンセルになるまでは、台帳の値で D1 のステータスを戻さない
- 規定は `../src/lib.js` の `CANCEL_POLICY`。HPの `lib/site.ts` の `cancellationPolicy` と `lib/i18n` の `book.policy` もそろえる
- 返金の idempotency key は予約番号から作るので、押し直しても二重に返金しない。Square で返金できなかったときはキャンセルもしない

## この先（第2段・第3段）

- 取り込みGASの Gmail 読み取り・iCal 照合・入湯税・要確認の計算を Worker に移し、台帳スプシを使わなくする
  （AirbnbのメールはGmailのフィルタで転送して Email Worker で受ける。sayozuki.com のDNSが Cloudflare に来てから）
- 予約の編集・キャンセルの画面（スプシで直せなくなるので要る）
- 新規予約・要確認のWebプッシュ通知とホーム画面アプリ化（客室オーダーのスタッフ通知と同じ仕組み）
- 入湯税の月次集計などのCSV書き出し
