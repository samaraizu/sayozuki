# 小夜月 予約管理（Webアプリ）

予約台帳（Googleスプレッドシート）を、スマホとPCから見て入れるための画面。
本人と海斗の2人だけが使う。Google Apps Script（GAS）の HtmlService で配信するので、追加の月額はゼロ。

第1段でできること：

- **4週間カレンダー**：縦に部屋、横に今日から28日（スマホは横スクロール、部屋の列は左に固定）。矢印で1週間ずつ動く。媒体ごとに色分け、準備中の部屋はグレー、ダブルブッキングは赤、名前や人数が空の予約は「要入力」
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
| `src/Index.html` `Styles.html` `App.html` | 画面（夜寄せのダーク、ロゴはしっぽり明朝、本文は Zen Kaku Gothic New） |
| `src/Denied.html` | 許可されていないアカウントで開いたときの画面 |
| `test/` | `lib.js` のテスト（Node） |
| `dev/preview.mjs` | GASなしで画面を確かめるプレビュー（ダミーデータ） |

## 最初のセットアップ

公開リポジトリなので、**スプシIDとメールアドレスはコードに書かずスクリプトプロパティに入れる**。
スクリプトIDの入る `.clasp.json` もコミットしない。

コードの反映は GitHub Actions（`.github/workflows/booking-deploy.yml`）がやる。人がやるのは最初の1回の準備だけ。

1. https://script.google.com/home/usersettings で「Google Apps Script API」をオンにする（台帳の持ち主のアカウントで）

2. https://script.google.com で「新しいプロジェクト」を作り、名前を「小夜月 予約管理」にする（既存の Booking-System には足さない）。
   左の歯車「プロジェクトの設定」にある**スクリプトID**を控える。中身の `コード.gs` は空のままでいい（Actions が上書きする）

3. 同じ「プロジェクトの設定」の**スクリプト プロパティ**に2つ入れる

   | プロパティ | 値 |
   | --- | --- |
   | `SPREADSHEET_ID` | 予約台帳のID（URLの `/d/` と `/edit` の間） |
   | `ALLOWED_EMAILS` | 本人と海斗のGoogleアカウント（カンマ区切り） |

4. 台帳スプシを海斗のアカウントに**編集者**で共有する（アプリは開いた人の権限で台帳を読み書きする）

5. GitHub が GAS に書き込むための認証情報を作る。Node の入ったPCで1回だけ：

   ```bash
   npx @google/clasp@3.4.1 login
   ```

   台帳の持ち主のアカウントで許可すると、`~/.clasprc.json` ができる。

6. GitHub のリポジトリ → Settings → Secrets and variables → Actions →「New repository secret」で2つ入れる

   | Secret | 値 |
   | --- | --- |
   | `CLASPRC_JSON` | `~/.clasprc.json` の中身を丸ごと（Mac なら `pbcopy < ~/.clasprc.json` でコピー） |
   | `BOOKING_SCRIPT_ID` | 手順2のスクリプトID |

   `CLASPRC_JSON` は台帳の持ち主のGoogleアカウントの鍵なので、ほかには貼らない。入れたら手元の `~/.clasprc.json` は消していい

7. GitHub の Actions →「booking-deploy」→「Run workflow」。終わったら実行結果の Summary に `/exec` のURLと**デプロイID**が出る。
   デプロイIDを Secret `BOOKING_DEPLOYMENT_ID` に入れる（次から同じURLのまま新しい版に差し替わる）

8. `/exec` のURLを2人のスマホで開いて「ホーム画面に追加」。最初に開いたときにGoogleの許可画面が出るので許可する。
   「このアプリは確認されていません」と出たら「詳細」→「移動」で進む。
   権限を1つずつ選ぶ画面では「すべて選択」にチェックする（台帳の権限が外れていると、開いたときに許可画面がもう一度出る）

ウェブアプリの設定（開いた人として実行／Googleアカウントを持つ全員）は `src/appsscript.json` に書いてあり、デプロイのたびにそのまま使われる。
許可リストとの照合は `Session.getActiveUser()` のメールで行う。「自分として実行」にすると閲覧者のメールが取れないので使わない。

## 更新のしかた

`booking/` を触るPRでは `.github/workflows/booking.yml` が `npm test` を回す。
`main` にマージされて `booking/src/` が変わっていれば、`booking-deploy` がテスト → `clasp push` → 同じデプロイの新しい版、まで自動でやる。URLは変わらない。
Secrets が未設定のあいだは反映を飛ばすだけで、失敗にはしない。

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
