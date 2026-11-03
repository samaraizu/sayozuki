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
| `src/auth.ts` | Cloudflare Access のトークンの確認、`ALLOWED_EMAILS` との照合、同期の合言葉 |
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

URL は `https://sayozuki-booking.toneclown17.workers.dev`。

### 2. ログインを Cloudflare Access で絞る

1. Worker「sayozuki-booking」→ 設定 → ドメインとルート → `workers.dev` の「…」→ **Cloudflare Access を有効にする**。
   出てきた **AUD（Application Audience）タグ** と **JWKS のURL**（`https://（チーム名）.cloudflareaccess.com/cdn-cgi/access/certs`）を控える
2. Zero Trust → Access → アプリケーションで、いまできたアプリのポリシーを「メールアドレスが本人と海斗のどちらか」に絞る。
   ログイン方法は Google（なければワンタイムPIN）
3. 同じ画面で **もう1つアプリを足す**（セルフホスト）：ドメイン `sayozuki-booking.toneclown17.workers.dev`、パス `api/sync/`、
   ポリシーのアクションは **Bypass（全員）**。取り込みGASはログインできないので、このパスだけ Access を外し、Worker が合言葉で確かめる

### 3. Secrets

```bash
cd booking/worker
npx wrangler secret put ACCESS_TEAM_DOMAIN   # https://（チーム名）.cloudflareaccess.com
npx wrangler secret put ACCESS_AUD           # 手順2で控えたAUDタグ
npx wrangler secret put ALLOWED_EMAILS       # 本人と海斗のアドレス（カンマ区切り）
npx wrangler secret put SYNC_TOKEN           # 下で作る長い乱数
```

合言葉は `openssl rand -hex 32` で作る（32文字未満だと同期を受け付けない）。ダッシュボードの Worker → 設定 → 変数とシークレット からでも入れられる。

### 4. 取り込みGASをつなぐ

1. 台帳スプシ →「拡張機能」→「Apps Script」→「コード.gs」に `../booking-system/Code.js` を丸ごと貼って保存
2. プロジェクトの設定 → スクリプト プロパティに2つ足す

   | プロパティ | 値 |
   | --- | --- |
   | `CF_SYNC_URL` | `https://sayozuki-booking.toneclown17.workers.dev` |
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

`http://localhost:8787` で開く。`DEV_EMAIL` は localhost のときだけ Access の代わりに使われる（本番には入れない）。
中身は空なので、`/api/sync/sheet` に部屋と予約のJSONを送って入れる。

## この先（第2段・第3段）

- 取り込みGASの Gmail 読み取り・iCal 照合・入湯税・要確認の計算を Worker に移し、台帳スプシを使わなくする
  （AirbnbのメールはGmailのフィルタで転送して Email Worker で受ける。sayozuki.com のDNSが Cloudflare に来てから）
- 予約の編集・キャンセルの画面（スプシで直せなくなるので要る）
- 新規予約・要確認のWebプッシュ通知とホーム画面アプリ化（客室オーダーのスタッフ通知と同じ仕組み）
- 入湯税の月次集計などのCSV書き出し
