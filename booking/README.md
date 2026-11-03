# 小夜月 予約管理（Webアプリ）

予約台帳（Googleスプレッドシート）を、スマホとPCから見て入れるための画面。
本人と海斗の2人だけが使う。Google Apps Script（GAS）の HtmlService で配信するので、追加の月額はゼロ。

> **Cloudflare（Workers + D1）へ移行中**（2026-11-04〜）。台帳の置き場をスプシから D1 に移していく。
> Cloudflare版は `worker/`、手順は `worker/README.md`。移行のあいだは取り込みGASがスプシと D1 をつなぎ、
> 画面と空室判定は GAS版・Cloudflare版とも `src/` のものを使う。

第1段でできること：

- **4週間カレンダー**：縦に部屋、横に今日から28日（スマホは横スクロール、部屋の列は左に固定）。矢印で1週間ずつ動く。直販は明るい青、Airbnbは明るいグレー、楽天は枠線だけの帯。準備中の部屋は斜線、ダブルブッキングと名前や人数が空の予約（要入力）は赤
- **手動入力**：直販（電話・HP・知人）の予約を入れる。空き部屋だけ選べて、2名以上×2泊以上なら窮屈アラート
- 予約の帯をタップすると中身が見られる（見るだけ。編集は台帳で）

## 役割分担

データの正本はスプシ。このアプリは画面と入力だけ。

| 仕事 | 担当 |
| --- | --- |
| Airbnbのメール・iCal取り込み、重複・定員超えの検知、入湯税、Googleカレンダー反映、通知メール | 既存GAS「Booking-System」（5分ごと） |
| カレンダー表示、直販の入力、保存直前の空室チェック、操作ログ | このアプリ |

台帳のルール（既存GASが見出し名で列を読み、行番号で差分を書くため）

- 列は**見出し名**でだけ触る。列の並びが変わっても動く
- 並べ替え・行挿入・行削除はしない。**新規は末尾に1行足すだけ**
- 直販の予約番号は `SZ-yyyyMMdd-4桁`、日付は `yyyy-MM-dd`、タイムゾーンは Asia/Tokyo
- 書き込むたびに「誰が・いつ・何を」を `操作ログ` タブに残す（なければ自動で作る）

## ファイル

| 場所 | 中身 |
| --- | --- |
| `src/Code.js` | サーバー側。`doGet`、ログイン確認、台帳の読み書き、保存時のロック |
| `src/lib.js` | 空室判定・重なり判定・カレンダーの並べ方など。**サーバーと画面の両方で同じものを使う** |
| `src/Index.html` `Styles.html` `App.html` | 画面（夜寄せのダーク、ロゴはしっぽり明朝、本文は Zen Kaku Gothic New）。色は金（直販・操作・今日）と赤（問題）の2つだけで、ほかはグレーの濃淡 |
| `src/Denied.html` | 許可されていないアカウントで開いたときの画面 |
| `test/` | `lib.js` のテスト（Node） |
| `dev/preview.mjs` | GASなしで画面を確かめるプレビュー（ダミーデータ） |

## 最初のセットアップ

公開リポジトリなので、**スプシID・メールアドレス・スクリプトID・デプロイIDはここに書かない**。
スプシIDと許可するアドレスはGASのスクリプトプロパティ、スクリプトIDとデプロイIDはGitHubのSecretsに入れる。`.clasp.json` もコミットしない。

### いまの状態（2026-11-03）

- GASプロジェクト「小夜月 予約管理」は作成済み。**持ち主は会社のGoogle Workspaceアカウント（sayozuki.com）**
- スクリプトプロパティ（`SPREADSHEET_ID`・`ALLOWED_EMAILS`）は設定済みで、ウェブアプリとして公開済み。URL・スクリプトID・デプロイIDは社内のNotionに控えてある
- 台帳スプシは海斗に編集者で共有済み
- GitHubからの自動反映（Secrets）はまだ。つなぐまでは下の「更新のしかた」の手作業で反映する

### 個人のGmailでは作らない

2026-11-02 時点で、個人のGmailアカウントで作ったウェブアプリは、持ち主が開いても「現在、ファイルを開くことができません」になった。1行だけのテストアプリでも、シークレットウィンドウでも同じだった。sayozuki.com のアカウントで作ったものは開ける。

なので、GASプロジェクトの持ち主と `clasp login` は **sayozuki.com のアカウント**にする。台帳スプシの持ち主（個人のGmail）とは別でいい。アプリは開いた人の権限で台帳を読み書きするので、台帳が使う人に共有されていれば動く。

開くURLはアカウントで形が違う（デプロイIDはNotion）。

- sayozuki.com のアカウント：`https://script.google.com/a/macros/sayozuki.com/s/（デプロイID）/exec`
- Gmail のアカウント：`https://script.google.com/macros/s/（デプロイID）/exec`

### GitHubからの自動反映をつなぐ（1回だけ）

1. **sayozuki.com のアカウントで** https://script.google.com/home/usersettings を開き、「Google Apps Script API」をオンにする

2. Node の入ったPCで1回だけ：

   ```bash
   npx @google/clasp@3.4.1 login
   ```

   **sayozuki.com のアカウントで**許可すると、`~/.clasprc.json` ができる。

3. GitHub のリポジトリ → Settings → Secrets and variables → Actions →「New repository secret」で**3つとも**入れる

   | Secret | 値 |
   | --- | --- |
   | `CLASPRC_JSON` | `~/.clasprc.json` の中身を丸ごと（Mac なら `pbcopy < ~/.clasprc.json` でコピー） |
   | `BOOKING_SCRIPT_ID` | 「小夜月 予約管理」のスクリプトID（GASの「プロジェクトの設定」） |
   | `BOOKING_DEPLOYMENT_ID` | 今のウェブアプリのデプロイID（GASの「デプロイ」→「デプロイを管理」） |

   **`BOOKING_DEPLOYMENT_ID` を空のまま動かさない。** 空だと別URLのデプロイが新しく作られて、今のURLは更新されなくなる。
   `CLASPRC_JSON` は sayozuki.com アカウントの鍵なので、ほかには貼らない。入れたら手元の `~/.clasprc.json` は消していい

4. GitHub の Actions →「booking-deploy」→「Run workflow」。実行結果の Summary に出るURLが今のURLと同じなら完了

### 一から作り直すとき

1. sayozuki.com のアカウントで https://script.google.com →「新しいプロジェクト」→ 名前を「小夜月 予約管理」にする（既存の Booking-System には足さない）

2. 「プロジェクトの設定」の**スクリプト プロパティ**に2つ入れる

   | プロパティ | 値 |
   | --- | --- |
   | `SPREADSHEET_ID` | 予約台帳のID（URLの `/d/` と `/edit` の間） |
   | `ALLOWED_EMAILS` | 使う人のGoogleアカウント（カンマ区切り）。sayozuki.com のアカウントで開く人はそれも入れる |

3. 台帳スプシを使う人のアカウントに**編集者**で共有する

4. 上の「自動反映をつなぐ」を、`BOOKING_DEPLOYMENT_ID` だけ空にしてやる。Summary に出たデプロイIDを `BOOKING_DEPLOYMENT_ID` に入れる

### 使う人が最初にやること

URLをスマホで開いて「ホーム画面に追加」。最初に開いたときにGoogleの許可画面が出るので許可する。

- 「このアプリは確認されていません」と出たら「詳細」→「移動」で進む
- 権限を1つずつ選ぶ画面では「すべて選択」にチェックする。台帳の権限が外れていると、開いたときに許可画面がもう一度出る
- 許可画面のアプリ名が「無題のプロジェクト」になっていても、デベロッパー欄が sayozuki.com のアドレスなら同じアプリ

ウェブアプリの設定（開いた人として実行／Googleアカウントを持つ全員）と使う権限（スプレッドシート・メールアドレスの2つ）は `src/appsscript.json` に書いてあり、デプロイのたびにそのまま使われる。
許可リストとの照合は `Session.getActiveUser()` のメールで行う。「自分として実行」にすると閲覧者のメールが取れないので使わない。

## 更新のしかた

`booking/` を触るPRでは `.github/workflows/booking.yml` が `npm test` を回す。
`main` にマージされて `booking/src/` が変わっていれば、`booking-deploy` がテスト → `clasp push` → 同じデプロイの新しい版、まで自動でやる。URLは変わらない。
Secrets が未設定のあいだは反映を飛ばすだけで、失敗にはしない。

**Secretsをつなぐまでの手作業**：sayozuki.com のアカウントでGASエディタを開き、変わったファイルの中身を `src/` のものに貼り替えて保存 →「デプロイ」→「デプロイを管理」→ 鉛筆（編集）→ バージョンを「新バージョン」→「デプロイ」。URLは変わらない。

手元から直接出すこともできる（`.clasp.json.example` をコピーしてスクリプトIDを入れてから）：

```bash
cd booking
npm test
BOOKING_DEPLOYMENT_ID=（デプロイID） npm run deploy
```

**ロールバック**はGASエディタの「デプロイ」→「デプロイを管理」で前のバージョンに戻す。

## 手元で画面を見る

```bash
cd booking
npm run preview
```

http://localhost:4178/preview.html にダミーデータで出る。保存も画面の中だけで動く。

## できないこと・あとでやること

- **Webプッシュ通知とPWA化**：HtmlService は service worker を登録できないので不可。通知は当面、既存GASのGmail通知。プッシュが必須になったら、Sheets API 経由で別ホスティングに移す
- **予約の編集・キャンセル**：第1段は見るだけ。台帳で直す
- **キャンセル規定**：未定なので画面に出さない
- **楽天を閉じて／Airbnbを更新して の通知**：出していない。当面はAirbnbだけ自動取り込みで、他の媒体の在庫を閉じるのは手作業（2026-11-02 決定）

## 既存GAS（Booking-System）

コードの写しと説明は [`booking-system/`](booking-system/README.md)。札の意味、タブの中身、スクリプトプロパティ、本番への反映のしかたはそこにある。テストは `test/booking-system*.test.mjs` で、`npm test` に含まれる。
