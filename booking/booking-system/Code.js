/**
 * 小夜月 予約台帳 — Airbnb・Agodaメールの自動取り込み（Google Apps Script）
 *
 * 5分ごとにやること
 *   1. Gmailから Airbnb・Agoda の「予約確定」「キャンセル」「予約変更」メールを探す
 *   2. 中身を読んで「予約」タブに書く（AIは使わない。メールの決まった位置から文字を抜く）
 *   3. 「Airbnb」タブにiCal URLを入れたリスティングは、Airbnbのカレンダーと日程を照合する
 *   4. 同じ部屋・同じ日の重複、準備中の部屋への予約、定員超えを「要確認」に出す
 *   5. 新しく要確認が出たら、メールで知らせる
 *
 * 使う関数
 *   setup  … 最初に1回だけ。タブを作って、過去1年分のメールを取り込んで、5分ごとの自動実行を入れる
 *   run    … 自動で5分ごとに動く。手で押してもいい
 *   dryRun … シートに書かずに、直近60日のメールの読み取り結果だけを「実行ログ」に出す（確認用）
 *   setupCalendar … Googleカレンダー連携を足したときに1回だけ。カレンダーを作って、今ある予約を書く
 *   setupAgoda … Agodaの取り込みを足したときに1回だけ。「Agoda」タブを作り、媒体の選択肢にAgodaを足す
 *   importPast … 過去1年分のメールをさかのぼって取り込む（ふだんの run は直近14日だけ）。並べ替えはしない
 *   useThisAccount … 取り込みを、今エディタを開いているアカウントで動かす（そのアカウントのGmailを読む）
 *   refreshAgoda … Agodaの読み方を直したあとに1回。直近60日のAgodaのメールを読み直して台帳を上書きする
 *
 * Googleカレンダー：キャンセル以外の予約を「小夜月 予約」カレンダーに終日の予定で書く（泊まる夜の日に出る）。
 * 「仮」（HPの決済待ちなど）も【仮】を付けて灰色で出す。
 * 台帳を直せば次の実行でカレンダーも直る。カレンダー側で直しても台帳には戻らない（台帳が正）。
 *
 * 台帳の持ち主のGoogleアカウント（Airbnbのメールが届くアカウント）で作ること。
 * Gmailを読むのは、このスクリプトを作ったアカウントの受信箱だけ。
 *
 * スクリプトプロパティ（コードは公開リポジトリにも置くので、アドレスはここに書かない）
 *   NOTIFY_TO  … 通知メールを足す宛先（カンマ区切り）。スクリプトを作ったアカウントには何もしなくても送る
 *   calendarId … setupCalendar が自動で入れる。手で触らない
 *   CF_SYNC_URL   … Cloudflare版の予約管理（https://booking.sayozuki.com）。空なら同期しない
 *   CF_SYNC_TOKEN … Cloudflare版と同じ合言葉（Worker の Secret SYNC_TOKEN と同じ値）
 *
 * Cloudflare版への移行中は、毎回の実行で
 *   はじめに：Cloudflare版のアプリで入れた予約のうち、まだ台帳にないものを台帳の末尾に足す
 *   おわりに：台帳（予約・部屋）の中身をまるごと Cloudflare版のD1に送る
 * 台帳に書くのはこのGASだけのまま。泊数・入湯税・要確認・カレンダー・通知はアプリの予約にもかかる。
 */

// ===== 設定 =====
const CONFIG = {
  // 新規予約でも通知するか（海斗にはAirbnbのメールが届かないのでオン）
  NOTIFY_NEW_BOOKING: true,
  // ふだんの取り込みで遡る日数／setupで最初に遡る日数
  SEARCH_DAYS: 14,
  FIRST_IMPORT_DAYS: 365,
  // 入湯税（上山市）：2026/4/1以降の予約は1人1泊300円、それより前の予約は150円
  ONSEN_TAX: { newRate: 300, oldRate: 150, changeDate: '2026-04-01' },
  // iCalが何時間取れなかったら知らせるか
  ICAL_ALERT_HOURS: 6,
  // 取り込んだメールに付けるGmailラベル（目印だけ。処理済みの判定は「ログ」タブでやる）
  GMAIL_LABEL: '小夜月/Airbnb取り込み済み',
  GMAIL_LABEL_AGODA: '小夜月/Agoda取り込み済み',
  // Googleカレンダー連携。予約をこの名前のカレンダーに書く（なければ自動で作る）。空にすると連携しない
  CALENDAR_NAME: '小夜月 予約',
};

// ===== シートの形 =====
const SHEETS = { RES: '予約', ROOMS: '部屋', AIRBNB: 'Airbnb', AGODA: 'Agoda', LOG: 'ログ' };

const RES_COLS = [
  '媒体', '予約番号', 'ステータス', '要確認', '部屋', 'チェックイン', 'チェックアウト', '泊数',
  '大人', '子ども', '乳幼児', '代表者名', '連絡先', '到着予定', '食事',
  'ゲスト支払額', '受取額', '支払い状況', '入湯税', '入湯税の徴収',
  'リスティングID', '予約URL', '予約日', '更新日時', 'メモ', 'カレンダーID', 'カレンダー同期',
];
const SYSTEM_COLS = ['更新日時', 'カレンダーID', 'カレンダー同期'];
const DATE_COLS = ['チェックイン', 'チェックアウト', '予約日'];
const ROOM_COLS = ['部屋', '定員', '状態'];
const ROOMS_INIT = [
  ['301', 4, '販売可'], ['302', 1, '販売可'], ['月山', 4, '販売可'], ['蔵王', 4, '販売可'],
  ['201', 5, '準備中'], ['303', 1, '準備中'],
];
const AIRBNB_COLS = ['リスティングID', 'Airbnbでの名前', '部屋', 'iCal URL', 'iCal最終取得', 'iCal予約数'];
// Agodaの部屋タイプ → 部屋。1つのタイプが複数の部屋にまたがるなら「部屋」は空のままにして、予約ごとに選ぶ
const AGODA_COLS = ['Agodaの部屋タイプ', '部屋', '最初に見た日'];
const LOG_COLS = ['日時', '種類', '予約番号', '件名', '結果', 'メッセージID', 'Gmail'];

const CHANNELS = ['Airbnb', 'Agoda', '楽天', '直販'];
const STATUSES = ['仮', '確定', '滞在中', 'チェックアウト済', 'キャンセル'];
const PAY_STATUSES = ['媒体で決済済', '現地でSquare', 'HPで決済済', '未収'];
const TAX_STATUSES = ['未', '徴収済', '対象外'];
const ROOM_STATES = ['販売可', '準備中', '停止'];

// 「要確認」に書く札。上の5つは毎回計算し直す（直れば自動で消える）。下の5つは人が消すまで残る
const TAG = {
  DUP: '[重複]',
  ROOM_UNSET: '[部屋未設定]',
  NOT_FOR_SALE: '[準備中の部屋]',
  OVER_CAP: '[定員超え]',
  TAX_CHILD: '[入湯税]',
  CHANGED: '[変更]',
  GUESTS: '[人数要確認]',
  ICAL_DATES: '[iCalで日程変更]',
  ICAL_MISSING: '[iCalにない]',
  ICAL_ONLY: '[メールなし]',
  AGODA_READ: '[Agoda要確認]',
};
const DERIVED_TAGS = [TAG.DUP, TAG.ROOM_UNSET, TAG.NOT_FOR_SALE, TAG.OVER_CAP, TAG.TAX_CHILD];
const NOTIFY_DERIVED = [TAG.DUP, TAG.NOT_FOR_SALE, TAG.OVER_CAP];

const KIND_LABEL = { confirm: '予約確定', cancel: 'キャンセル', change: '予約変更' };
const CODE_RE = /HM[A-Z0-9]{8}(?![A-Z0-9])/;
// 件名「Agoda予約ID 1700000001 - 予約確定 Hotel ホテル所在国: Japan」（英語版は Agoda Booking ID）
const AGODA_SUBJECT_RE = /Agoda\s*(?:予約\s*ID|Booking\s*ID)\s*[:：#]?\s*(\d{6,12})/i;

function kindLabel_(f) { return (f.source === 'agoda' ? 'Agoda ' : '') + KIND_LABEL[f.kind]; }

// ===== 実行する関数 =====

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('スプレッドシートの「拡張機能 → Apps Script」から開いたエディタで実行して');
  ss.setSpreadsheetTimeZone('Asia/Tokyo');

  ensureSheet_(ss, SHEETS.RES, RES_COLS);
  const rooms = ensureSheet_(ss, SHEETS.ROOMS, ROOM_COLS);
  if (rooms.getLastRow() < 2) rooms.getRange(2, 1, ROOMS_INIT.length, ROOM_COLS.length).setValues(ROOMS_INIT);
  ensureSheet_(ss, SHEETS.AIRBNB, AIRBNB_COLS);
  ensureSheet_(ss, SHEETS.AGODA, AGODA_COLS);
  ensureSheet_(ss, SHEETS.LOG, LOG_COLS);
  formatSheets_(ss);

  ['シート1', 'Sheet1'].forEach(function (n) {
    const s = ss.getSheetByName(n);
    if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
  ss.setActiveSheet(ss.getSheetByName(SHEETS.RES));

  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'run'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('run').timeBased().everyMinutes(5).create();

  const r = runCore_({ silent: true, days: CONFIG.FIRST_IMPORT_DAYS });
  sortReservations_(ss);

  Logger.log('セットアップ完了。メール ' + (r ? r.mails : 0) + ' 通を取り込んだ。5分ごとの自動実行も入れた');
  Logger.log('次は「Airbnb」タブで、各リスティングの「部屋」を選んで');
  if (r && r.notes.length) Logger.log('気になる点：\n' + r.notes.join('\n'));
}

function run() {
  runCore_({ silent: false, days: CONFIG.SEARCH_DAYS });
}

function setupCalendar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('スプレッドシートの「拡張機能 → Apps Script」から開いたエディタで実行して');
  if (!CONFIG.CALENDAR_NAME) throw new Error('CONFIG.CALENDAR_NAME が空');
  const res = ensureSheet_(ss, SHEETS.RES, RES_COLS);
  const idx = headerIndex_(res);
  ['カレンダーID', 'カレンダー同期'].forEach(function (n) { res.hideColumns(idx[n] + 1); });
  const cal = getCalendar_();
  const r = runCore_({ silent: true, days: CONFIG.SEARCH_DAYS });
  Logger.log('Googleカレンダー「' + cal.getName() + '」に予約を書いた（' + (r ? r.calendar : '') + '）');
  Logger.log('calendar.google.com の左の「マイカレンダー」に出てる');
}

// 動いている台帳に、Agodaのタブと媒体の選択肢を足す（setup と違って並べ替えも取り込みもしない。何度押してもいい）
function setupAgoda() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('スプレッドシートの「拡張機能 → Apps Script」から開いたエディタで実行して');
  const ag = ensureSheet_(ss, SHEETS.AGODA, AGODA_COLS);
  const rooms = mustSheet_(ss, SHEETS.ROOMS);
  const res = mustSheet_(ss, SHEETS.RES);
  const roomList = SpreadsheetApp.newDataValidation().requireValueInRange(rooms.getRange('A2:A'), true).setAllowInvalid(true).build();
  const agIdx = headerIndex_(ag);
  ag.getRange(2, agIdx['部屋'] + 1, ag.getMaxRows() - 1, 1).setDataValidation(roomList);
  ag.getRange(2, agIdx['最初に見た日'] + 1, ag.getMaxRows() - 1, 1).setNumberFormat('yyyy/mm/dd');
  ag.setColumnWidth(agIdx['Agodaの部屋タイプ'] + 1, 360);
  const resIdx = headerIndex_(res);
  res.getRange(2, resIdx['媒体'] + 1, res.getMaxRows() - 1, 1)
    .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(CHANNELS, true).setAllowInvalid(true).build());
  Logger.log('「Agoda」タブを作った。Agodaの予約メールが来ると部屋タイプが足されるので、「部屋」を選んで');
}

// 過去のメールをさかのぼって取り込む（Agodaを足したときなど）。setup と違って並べ替えはしない。
// 取り込み済みのメールは「ログ」タブで飛ばすので、何度押してもいい。通知メールは出さず、結果は実行ログに出す
function importPast() {
  const r = runCore_({ silent: true, days: CONFIG.FIRST_IMPORT_DAYS });
  if (!r) return;
  Logger.log('過去' + CONFIG.FIRST_IMPORT_DAYS + '日のメールを見て、新しく ' + r.mails + ' 通を取り込んだ');
  if (r.notes.length) Logger.log('気になる点：\n' + r.notes.join('\n'));
}

// Agodaのメールが拾えないときの確認用。直近60日のAgodaらしいメールを、差出人・件名・判定結果つきで実行ログに出す
function checkAgodaMail() {
  const threads = GmailApp.search('{from:agoda subject:Agoda} newer_than:60d', 0, 50);
  Logger.log('このスクリプトが読んでいるGmail：' + Session.getEffectiveUser().getEmail() + '／見つかったスレッド ' + threads.length + '件');
  threads.forEach(function (th) {
    th.getMessages().forEach(function (m) {
      const kind = (/agoda/i.test(m.getFrom()) || isForwardedFrom_(m, /agoda/i)) ? classifyAgoda_(m.getSubject()) : '（差出人にagodaがない）';
      Logger.log((kind || '読まない') + '｜' + m.getFrom() + '｜' + m.getSubject());
    });
  });
}

// 取り込みを、今エディタを開いているアカウントで動かす（そのアカウントのGmailを読むようになる）。
// 並べ替えも取り込みもしない。前のアカウントの自動実行は、前のアカウントで「トリガー」画面から消す
// Agodaの読み方を直したあとに1回。直近60日のAgodaのメールを読み直し、台帳の名前・人数・部屋タイプ・金額を上書きする。
// 手で選んだ部屋はそのまま。通知メールは出さず、結果は実行ログに出す
function refreshAgoda() {
  const r = runCore_({ silent: true, days: 60, refreshAgoda: true });
  if (!r) return;
  Logger.log('Agodaのメールを読み直した');
  if (r.notes.length) Logger.log('気になる点：\n' + r.notes.join('\n'));
}

function useThisAccount() {
  const me = Session.getEffectiveUser().getEmail();
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'run'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('run').timeBased().everyMinutes(5).create();
  Logger.log('5分ごとの取り込みを ' + me + ' で入れた。これからはこのアカウントのGmailを読む');
  if (CONFIG.CALENDAR_NAME) {
    try { Logger.log('カレンダー「' + getCalendar_().getName() + '」に書ける'); }
    catch (e) { Logger.log('要対応：' + String((e && e.message) || e)); }
  }
  Logger.log('前のアカウントの自動実行は、前のアカウントで Apps Script の「トリガー」（時計のアイコン）から run を消して');
}

function dryRun() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss ? ss.getSpreadsheetTimeZone() : 'Asia/Tokyo';
  const found = searchMail_(60, {});
  found.forEach(function (f) {
    const m = f.message;
    const refIso = Utilities.formatDate(m.getDate(), tz, 'yyyy-MM-dd');
    const p = parseMail_(f, m.getSubject(), m.getPlainBody(), refIso);
    Logger.log(kindLabel_(f) + '｜' + m.getSubject() + '\n' + JSON.stringify(p, null, 1));
  });
  Logger.log(found.length + '通を読んだ（シートには書いてない）');
}

// ===== 本体 =====

function runCore_(opts) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) { Logger.log('前の実行がまだ動いてるのでスキップ'); return null; }
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tz = ss.getSpreadsheetTimeZone();
    const now = new Date();
    const todayIso = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
    const me = Session.getEffectiveUser().getEmail();

    const res = loadTable_(mustSheet_(ss, SHEETS.RES), RES_COLS, DATE_COLS, tz);
    const airbnb = loadTable_(mustSheet_(ss, SHEETS.AIRBNB), AIRBNB_COLS, [], tz);
    const rooms = loadTable_(mustSheet_(ss, SHEETS.ROOMS), ROOM_COLS, [], tz);
    const agoda = loadTable_(ss.getSheetByName(SHEETS.AGODA) || ensureSheet_(ss, SHEETS.AGODA, AGODA_COLS), AGODA_COLS, ['最初に見た日'], tz);
    const log = loadTable_(mustSheet_(ss, SHEETS.LOG), LOG_COLS, [], tz, LOG_COLS.length);
    const ctx = makeCtx_(res, airbnb, rooms, agoda);
    const notes = [];
    const cf = cfConfig_();

    // 0. Cloudflare版のアプリで入れた予約を台帳に足す
    if (cf) pullFromCloudflare_(cf, ctx, todayIso, notes);

    const processed = {};
    log.rows.forEach(function (r) { const id = str_(r.v['メッセージID']); if (id) processed[id] = true; });

    // 1. Gmail
    const found = searchMail_(opts.days, processed, opts);
    const labels = {};
    const labelFor = function (source) {
      const name = source === 'agoda' ? CONFIG.GMAIL_LABEL_AGODA : CONFIG.GMAIL_LABEL;
      if (!(name in labels)) {
        try { labels[name] = GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name); } catch (e) { labels[name] = null; }
      }
      return labels[name];
    };
    found.forEach(function (f) {
      const m = f.message;
      const subject = m.getSubject();
      const refIso = Utilities.formatDate(m.getDate(), tz, 'yyyy-MM-dd');
      const link = 'https://mail.google.com/mail/?authuser=' + encodeURIComponent(me) + '#all/' + f.thread.getId();
      let p;
      try { p = parseMail_(f, subject, m.getPlainBody(), refIso); }
      catch (e) { p = { ok: false, error: String((e && e.message) || e) }; }
      if (opts.refreshAgoda && f.source === 'agoda') p.refresh = true;
      let result;
      if (p.ok) {
        try { result = applyMail_(ctx, p, refIso, notes); }
        catch (e) { result = '失敗：' + String((e && e.message) || e); notes.push('取り込みに失敗：' + subject + '\n  ' + link); }
      } else {
        result = '要手入力：' + p.error;
        notes.push('メールが読めなかった（' + kindLabel_(f) + '）：' + subject + '\n  ' + link);
      }
      newRow_(log, {
        '日時': now, '種類': kindLabel_(f), '予約番号': p.code || '', '件名': subject,
        '結果': result, 'メッセージID': m.getId(), 'Gmail': link,
      });
      const label = labelFor(f.source);
      if (label) { try { f.thread.addLabel(label); } catch (e) { /* 目印なので失敗しても続ける */ } }
    });

    // 2. iCal
    syncIcal_(ctx, todayIso, now, notes, log);

    // 3. 台帳ルール
    applyRules_(ctx, todayIso, notes);

    // 4. Googleカレンダー
    const calResult = syncCalendar_(ctx, ss.getUrl(), todayIso, notes);

    // 5. 保存
    touchUpdated_(res, now);
    saveTable_(res, tz);
    saveTable_(airbnb, tz);
    saveTable_(agoda, tz);
    saveTable_(log, tz);
    log.sheet.getRange('I1:J1').setValues([['最終実行', now]]);

    // 6. 台帳の中身を Cloudflare版に送る
    //    この回の通知メールと同じ文も渡す（Cloudflare版がスマホにプッシュ通知で出す）
    if (cf) pushToCloudflare_(cf, res, rooms, Utilities.formatDate(now, tz, 'yyyy/MM/dd HH:mm'), todayIso, notes, opts.silent ? [] : notes.slice());

    if (!opts.silent) sendNotes_(ss, notes);
    return { mails: found.length, notes: notes, calendar: calResult };
  } finally {
    lock.releaseLock();
  }
}

// 媒体ごとの探し方。from で送り主を確かめ、件名で種類を決める（件名が合わないメールは読まない）
const MAIL_SOURCES = [
  { source: 'airbnb', q: 'from:automated@airbnb.com {subject:予約確定 subject:キャンセル subject:"ご予約が変更されました"}', from: /airbnb\.com/i, classify: function (s) { return classify_(s); } },
  { source: 'agoda', q: '{from:agoda subject:Agoda}', from: /agoda/i, forwarded: true, classify: function (s) { return classifyAgoda_(s); } },
];

// 手で転送したメール（件名が「Fwd:」「転送:」で始まり、本文の転送元ヘッダーが agoda.com）も読む
function isForwardedFrom_(m, re) {
  if (!/^\s*(?:Fwd?|転送)\s*[:：]/i.test(m.getSubject())) return false;
  const head = String(m.getPlainBody() || '').slice(0, 1500);
  return /(?:From|差出人|送信者)\s*[:：][^\n]*/i.test(head) && re.test((head.match(/(?:From|差出人|送信者)\s*[:：][^\n]*/i) || [''])[0]);
}

function searchMail_(days, processed, opts) {
  const out = [];
  const again = !!(opts && opts.refreshAgoda);
  MAIL_SOURCES.forEach(function (src) {
    const q = src.q + ' newer_than:' + days + 'd';
    for (let start = 0; ; start += 100) {
      const threads = GmailApp.search(q, start, 100);
      threads.forEach(function (th) {
        th.getMessages().forEach(function (m) {
          if (processed[m.getId()] && !(again && src.source === 'agoda')) return;
          if (!src.from.test(m.getFrom()) && !(src.forwarded && isForwardedFrom_(m, src.from))) return;
          const kind = src.classify(m.getSubject());
          if (kind) out.push({ thread: th, message: m, kind: kind, source: src.source });
        });
      });
      if (threads.length < 100) break;
    }
  });
  out.sort(function (a, b) { return a.message.getDate() - b.message.getDate(); });
  return out;
}

function sendNotes_(ss, notes) {
  if (!notes.length) return;
  const extra = String(PropertiesService.getScriptProperties().getProperty('NOTIFY_TO') || '')
    .split(',').map(function (s) { return s.trim(); });
  const to = [Session.getEffectiveUser().getEmail()].concat(extra).filter(Boolean).join(',');
  const subject = notes.length === 1
    ? '【小夜月】' + notes[0].split('\n')[0].slice(0, 60)
    : '【小夜月】要確認 ' + notes.length + '件';
  const body = notes.map(function (n) { return '・' + n; }).join('\n') + '\n\n予約台帳：' + ss.getUrl();
  GmailApp.sendEmail(to, subject, body);
}

// ===== メールの読み取り（AIなし。決まった位置から文字を抜く） =====

function classify_(subject) {
  const s = String(subject || '');
  if (/^予約確定/.test(s)) return 'confirm';
  if (/ご予約が変更されました/.test(s)) return 'change';
  if (/キャンセル/.test(s) && /予約/.test(s)) return 'cancel';
  return null;
}

function parseMail_(f, subject, body, refIso) {
  if (f.source === 'agoda') return parseAgoda_(f.kind, subject, body, refIso);
  const kind = f.kind;
  if (kind === 'confirm') return parseConfirmation_(subject, body, refIso);
  if (kind === 'cancel') return parseCancellation_(subject, body, refIso);
  if (kind === 'change') return parseChange_(subject, body);
  return { ok: false, error: '種類がわからない' };
}

function parseConfirmation_(subject, rawBody, refIso) {
  const body = clean_(rawBody);
  const fail = function (msg, code) { return { ok: false, kind: 'confirm', error: msg, code: code || '' }; };

  const code = firstGroup_(body, /確認コード\s*(HM[A-Z0-9]{8})(?![A-Z0-9])/) ||
               firstGroup_(body, /reservations\/details\/(HM[A-Z0-9]{8})(?![A-Z0-9])/);
  if (!code) return fail('確認コードが見つからない');

  const k = body.search(/チェックイン\s*チェックアウト/);
  if (k < 0) return fail('チェックイン・チェックアウトの欄が見つからない', code);
  const seg = body.slice(k, k + 160);
  const ds = allMatches_(seg, /(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日/g);
  if (ds.length < 2) return fail('日付が2つ読めない', code);
  const checkIn = resolveStart_(num_(ds[0][1]), num_(ds[0][2]), num_(ds[0][3]), refIso);
  const checkOut = resolveEnd_(num_(ds[1][1]), num_(ds[1][2]), num_(ds[1][3]), checkIn);
  if (nights_(checkIn, checkOut) <= 0 || nights_(checkIn, checkOut) > 120) return fail('日付がおかしい：' + checkIn + '〜' + checkOut, code);
  const times = seg.match(/(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})/);

  const gLine = firstGroup_(body, /ゲスト人数\n([^\n]+)/);
  const g = gLine ? parseGuests_(gLine) : { adults: 0, children: 0, infants: 0, warn: 'ゲスト人数の欄が見つからない' };

  const listingId = firstGroup_(body, /\/rooms\/(\d{6,})/) || firstGroup_(body, /\/hosting\/listings\/(\d{6,})/);
  const listingTitle = listingId ? listingTitle_(body, listingId) : '';

  let name = firstGroup_(body, new RegExp('reservations/details/' + code + '\\S* ([^\\n\\[]+)'));
  if (!name || /^https?:/.test(name)) name = firstGroup_(String(subject || ''), /予約確定\s*-\s*(.+?)さんが/);

  return {
    ok: true, kind: 'confirm', code: code,
    checkIn: checkIn, checkOut: checkOut, checkInTime: times ? times[1] : '',
    adults: g.adults, children: g.children, infants: g.infants, warn: g.warn,
    name: (name || '').trim(),
    listingId: listingId || '', listingTitle: listingTitle,
    guestTotal: yen_(firstGroup_(body, /合計[（(]JPY[)）]\s*[¥￥]\s*([\d,]+)/)),
    payout: yen_(firstGroup_(body, /ホスティング収入\s*[¥￥]\s*([\d,]+)/)),
  };
}

function parseCancellation_(subject, rawBody, refIso) {
  const body = clean_(rawBody);
  const subj = clean_(subject);
  const code = firstGroup_(subj, /[（(](HM[A-Z0-9]{8})[)）]/) ||
               firstGroup_(body, /reservations\/details\/(HM[A-Z0-9]{8})(?![A-Z0-9])/) ||
               firstGroup_(body, /[（(](HM[A-Z0-9]{8})[)）]/);
  if (!code) return { ok: false, kind: 'cancel', error: '確認コードが見つからない', code: '' };

  const out = { ok: true, kind: 'cancel', code: code, checkIn: '', checkOut: '', guests: '', listingId: '', listingTitle: '', canceledBy: '' };
  out.listingId = firstGroup_(body, /リスティング\s*#\s*(\d{6,})/) || '';
  if (out.listingId) {
    const t = body.match(new RegExp('reservations/details/' + code + '\\S* ([^\\n\\[]+)'));
    if (t && !/^https?:/.test(t[1])) out.listingTitle = t[1].trim();
  }
  const rangeRe = /(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日\s*[～〜~\-–]\s*(?:(\d{4})年)?(?:(\d{1,2})月)?(\d{1,2})日(?:\s*,\s*(\d+)人)?/;
  const m = body.match(rangeRe) || subj.match(rangeRe);
  if (m) {
    out.checkIn = resolveStart_(num_(m[1]), num_(m[2]), num_(m[3]), refIso);
    out.checkOut = resolveEnd_(num_(m[4]), num_(m[5]) || num_(m[2]), num_(m[6]), out.checkIn);
    out.guests = m[7] ? Number(m[7]) : '';
  }
  if (/ゲストの.+?さんにより/.test(body)) out.canceledBy = 'ゲスト';
  return out;
}

function parseChange_(subject, rawBody) {
  const body = clean_(rawBody);
  const code = firstGroup_(body, /reservations\/details\/(HM[A-Z0-9]{8})(?![A-Z0-9])/);
  if (!code) return { ok: false, kind: 'change', error: '確認コードが見つからない', code: '' };
  const name = firstGroup_(body, /\n(.+?)さんとのご予約が変更されました/) || '';
  return { ok: true, kind: 'change', code: code, name: name.trim() };
}

function parseGuests_(line) {
  const take = function (re) { const m = line.match(re); return m ? Number(m[1]) : 0; };
  const g = {
    adults: take(/大人\s*(\d+)\s*[人名]/),
    children: take(/(?:子ども|子供|こども|お子様|児童)\s*(\d+)\s*[人名]/),
    infants: take(/乳幼児\s*(\d+)\s*[人名]/),
    warn: '',
  };
  const rest = line.replace(/(?:大人|子ども|子供|こども|お子様|児童|乳幼児)\s*\d+\s*[人名]/g, '');
  if (!g.adults) g.warn = 'ゲスト人数が読めない：' + line;
  else if (/\d/.test(rest)) g.warn = 'ゲスト人数に読めない部分がある：' + line;
  return g;
}

function listingTitle_(body, id) {
  const ls = body.split('\n');
  for (let i = 0; i < ls.length; i++) {
    if (ls[i].indexOf('/rooms/' + id) >= 0 && /^https?:/.test(ls[i])) {
      for (let j = i + 1; j < Math.min(ls.length, i + 6); j++) {
        const s = ls[j].trim();
        if (!s || /^\[?https?:/.test(s)) continue;
        return s.replace(/[、,]$/, '');
      }
    }
  }
  return '';
}


// ===== Agodaのメールの読み取り =====
// 件名で予約IDと種類を決め、本文は「見出し → 値」を探して読む（表の並びが変わっても読めるように、見出しの近くを探す）。
// 読めなかった欄は [Agoda要確認] に書いて台帳に出す。日程が読めないときは行を作らず「要手入力」で知らせる

function classifyAgoda_(subject) {
  const s = clean_(subject).replace(/\n/g, ' ');
  const i = s.search(AGODA_SUBJECT_RE);
  if (i < 0) return null;
  const tail = s.slice(i).replace(/ホテル所在国.*$/, '');
  if (/キャンセル|取り?消|cancel/i.test(tail)) return 'cancel';
  if (/変更|修正|amend|modif|change/i.test(tail)) return 'change';
  if (/確定|予約完了|新規|confirm|new\s*booking/i.test(tail)) return 'confirm';
  return null;
}

const MONTHS_ = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

// 文字列の中の最初の日付（2026年11月20日 / 2026/11/20 / 2026-11-20 / 20 Nov 2026 / Nov 20, 2026）
function findDates_(s) {
  const out = [];
  const add = function (idx, y, m, d) {
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000) out.push({ idx: idx, iso: iso_(y, m, d) });
  };
  let m;
  const a = /(\d{4})\s*[年\/\-.]\s*(\d{1,2})\s*[月\/\-.]\s*(\d{1,2})/g;
  while ((m = a.exec(s))) add(m.index, num_(m[1]), num_(m[2]), num_(m[3]));
  const b = /(\d{1,2})[\s\-]+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?[\s,\-]+(\d{4})/gi;
  while ((m = b.exec(s))) add(m.index, num_(m[3]), MONTHS_[m[2].toLowerCase()], num_(m[1]));
  const c = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/gi;
  while ((m = c.exec(s))) add(m.index, num_(m[3]), MONTHS_[m[1].toLowerCase()], num_(m[2]));
  out.sort(function (x, y) { return x.idx - y.idx; });
  return out.map(function (x) { return x.iso; });
}

// 見出しの後ろ（maxLen 文字以内）を返す
function afterLabel_(body, labelRe, maxLen) {
  const m = body.match(new RegExp('(?:' + labelRe + ')', 'i'));
  return m ? body.slice(m.index + m[0].length, m.index + m[0].length + (maxLen || 120)) : '';
}

function agodaYen_(body, labelRe) {
  const seg = afterLabel_(body, labelRe, 80);
  const m = seg.match(/(?:JPY|¥|￥)\s*([\d,]+(?:\.\d+)?)/) || seg.match(/([\d,]+(?:\.\d+)?)\s*(?:JPY|円)/);
  if (!m || !/\d/.test(m[1])) return '';
  return Math.round(Number(m[1].replace(/,/g, '')));
}

// Agodaの予約確認書（HTMLメール）の表。getPlainBody では見出しのセルが1行ずつ並び、そのあとに値のセルが並ぶ。
// 太字は *Room Type* のように * で囲まれるので、読む前に * を外す
//   Room Type / 客室タイプ / No. of Rooms / 部屋数 / Occupancy / 宿泊可能人数 / No. of Extra Bed / エキストラベッド数 :
//   Japanese Room / 1 / 2 Adults / 0
function agodaRoomRow_(body) {
  const m = body.match(/エキストラベッド数\s*[:：]?|No\.? of Extra Beds?\s*[:：]?(?!\s*\n?\s*エキストラ)/i);
  if (!m) return null;
  const seg = body.slice(m.index + m[0].length, m.index + m[0].length + 300);
  const lines = seg.split('\n').map(function (x) { return x.trim(); }).filter(function (x) { return x && !/^[:：]$/.test(x); });
  if (!lines.length) return null;
  // 1行にまとまっている形（Japanese Room 1 2 Adults 0）
  const one = lines[0].match(/^(.+?)\s+(\d+)\s+(\d+\s*Adults?\b.*?)(?:\s+\d+)?$/i);
  if (one) return { roomType: one[1].trim(), rooms: Number(one[2]), occupancy: one[3] };
  if (lines.length < 3 || !/^\d+$/.test(lines[1])) return null;
  return { roomType: lines[0], rooms: Number(lines[1]), occupancy: lines[2] };
}

function parseAgoda_(kind, subject, rawBody, refIso) {
  const body = clean_(String(rawBody || '').replace(/\*/g, ''));
  const subj = clean_(subject);
  const code = firstGroup_(subj, AGODA_SUBJECT_RE) ||
               firstGroup_(body, /(?:予約\s*ID|Booking\s*ID)\s*[:：#]?\s*(\d{6,12})/i);
  if (!code) return { ok: false, kind: kind, error: '予約IDが見つからない', code: '' };
  const out = { ok: true, kind: kind, channel: 'Agoda', code: code, warns: [] };

  // 日程（Check-in チェックイン / 15-Nov-2026 (15-11-2026)）
  const inSeg = afterLabel_(body, 'チェックイン日?|到着日|Check[- ]?in(?: date)?|Arrival', 160);
  const outSeg = afterLabel_(body, 'チェックアウト日?|出発日|Check[- ]?out(?: date)?|Departure', 160);
  const ins = findDates_(inSeg), outs = findDates_(outSeg);
  out.checkIn = ins[0] || '';
  out.checkOut = outs.filter(function (d) { return d > out.checkIn; })[0] || ins.filter(function (d) { return d > out.checkIn; })[0] || '';
  if (!out.checkIn || !out.checkOut) {
    const all = findDates_(body.replace(/予約日[^\n]*|Booking date[^\n]*|Booked on[^\n]*/gi, ''));
    if (!out.checkIn && all.length >= 2) { out.checkIn = all[0]; out.checkOut = all.filter(function (d) { return d > all[0]; })[0] || ''; }
  }
  const n = (out.checkIn && out.checkOut) ? nights_(out.checkIn, out.checkOut) : 0;
  if (n <= 0 || n > 120) {
    out.checkIn = ''; out.checkOut = '';
    if (kind === 'confirm') return { ok: false, kind: kind, error: '日程が読めない', code: code };
  }
  if (kind === 'cancel') return out;

  // 部屋タイプ・部屋数・人数（表の1行目）
  const row = agodaRoomRow_(body);
  out.roomType = row ? row.roomType : '';
  if (!out.roomType) out.warns.push('部屋タイプが読めない');
  if (row && row.rooms > 1) out.warns.push(row.rooms + '室の予約。台帳は1行なので、残りの部屋は手で足して');
  const occ = row ? row.occupancy : body;
  const adults = occ.match(/(\d+)[ \t]*Adults?\b/i) || occ.match(/大人[ \t]*[:：]?[ \t]*(\d+)/) || occ.match(/(\d+)[ \t]*名?の?大人/);
  const kids = occ.match(/(\d+)[ \t]*(?:Child(?:ren)?|Kids?)\b/i) || occ.match(/(?:子ども|子供|こども|お子様|児童)[ \t]*[:：]?[ \t]*(\d+)/);
  out.adults = adults ? Number(adults[1]) : 0;
  out.children = kids ? Number(kids[1]) : 0;
  if (!adults) out.warns.push('人数が読めない');

  // 名前・電話（予約者情報：顧客情報 - 氏名: YI WAH TSANG, 電話番号:000 00000）
  out.name = (firstGroup_(body, /氏名[ \t]*[:：][ \t]*([^,，\n]+)/) || '').trim();
  if (!out.name) {
    const first = firstGroup_(body, /(?:宿泊者氏名[（(]名[)）]|Customer First Name)[^\n]*\n([^\n]+)/i).trim();
    const last = firstGroup_(body, /(?:宿泊者氏名[（(]姓[)）]|Customer Last Name)[^\n]*\n([^\n]+)/i).trim();
    out.name = [first, last].filter(function (x) { return x && !/Customer|宿泊者/.test(x); }).join(' ');
  }
  if (!out.name) out.warns.push('名前が読めない');
  out.contact = (firstGroup_(body, /電話番号[ \t]*[:：][ \t]*([+\d][\d \-()]{4,})/) || '').trim();

  // 金額（表示販売料金＝お客様の支払額、卸値＝受け取る額）・支払い
  out.guestTotal = agodaYen_(body, '表示販売料金|Reference sell rate|販売料金|お支払い総額|合計金額|Total (?:price|amount|charge)');
  out.payout = agodaYen_(body, '卸値|Net rate|ネット料金|ネット金額');
  out.payAtHotel = /現地払い|現地決済|(?:ホテル|施設)で(?:お)?支払|Pay at (?:the )?(?:hotel|property)|Hotel collect/i.test(body);

  // 特別なリクエスト（見出しの後ろの但し書き（…）を飛ばし、キャンセルポリシーの手前まで）
  const sr = body.match(/Special Requests?([\s\S]*?)(?:Cancellation Policy|キャンセルポリシー|$)/i);
  out.request = sr ? sr[1].replace(/特別なリクエスト/g, '').replace(/[（(][\s\S]*?[)）]/g, '').replace(/\s+/g, ' ').trim() : '';
  if (/^(?:なし|無し|-|—|N\/?A|None)?$/i.test(out.request)) out.request = '';
  out.request = out.request.slice(0, 100);
  out.url = firstGroup_(body, /(https:\/\/ycs\.agoda\.com\/\S+)/) || '';
  return out;
}

// ===== iCal =====

function parseIcal_(text) {
  const t = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '');
  const out = [];
  const re = /BEGIN:VEVENT\n([\s\S]*?)END:VEVENT/g;
  let m;
  while ((m = re.exec(t))) {
    const block = m[1];
    const field = function (k) {
      const mm = block.match(new RegExp('^' + k + '(?:;[^:\\n]*)?:(.*)$', 'm'));
      return mm ? mm[1].trim() : '';
    };
    const start = icsDate_(field('DTSTART'));
    const end = icsDate_(field('DTEND'));
    if (!start || !end) continue;
    const desc = field('DESCRIPTION');
    const code = firstGroup_(desc, /(?:details\/|code=)(HM[A-Z0-9]{8})(?![A-Z0-9])/) || (desc.match(CODE_RE) || [''])[0];
    out.push({ start: start, end: end, summary: field('SUMMARY'), code: code });
  }
  return out;
}

function syncIcal_(ctx, todayIso, now, notes, log) {
  const props = PropertiesService.getScriptProperties();
  ctx.airbnb.rows.forEach(function (ar) {
    const url = str_(ar.v['iCal URL']);
    const lid = str_(ar.v['リスティングID']);
    if (!url || !lid) return;
    const key = 'icalAlert_' + lid;
    let events;
    try {
      const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
      if (resp.getResponseCode() !== 200) throw new Error('HTTP ' + resp.getResponseCode());
      const text = resp.getContentText('UTF-8');
      if (text.indexOf('BEGIN:VCALENDAR') < 0) throw new Error('iCalの形式じゃない');
      events = parseIcal_(text);
    } catch (e) {
      const last = ar.v['iCal最終取得'];
      const hours = (last instanceof Date) ? (now - last) / 36e5 : Infinity;
      if (hours >= CONFIG.ICAL_ALERT_HOURS && !props.getProperty(key)) {
        props.setProperty(key, '1');
        const msg = String((e && e.message) || e);
        notes.push('AirbnbのiCalが' + CONFIG.ICAL_ALERT_HOURS + '時間以上取れてない（' + (str_(ar.v['部屋']) || lid) + '）：' + msg);
        newRow_(log, { '日時': now, '種類': 'iCal', '結果': '取得失敗（' + (str_(ar.v['部屋']) || lid) + '）：' + msg });
      }
      return;
    }
    props.deleteProperty(key);
    const booked = events.filter(function (e) { return e.code; });
    set_(ar, 'iCal最終取得', now);
    set_(ar, 'iCal予約数', booked.length);
    applyIcal_(ctx, lid, booked, todayIso, notes);
  });
}

function applyIcal_(ctx, lid, events, todayIso, notes) {
  const seen = {};
  events.forEach(function (ev) {
    seen[ev.code] = true;
    let r = ctx.byCode[ev.code];
    if (!r) {
      if (ev.end < todayIso) return;
      r = newRow_(ctx.res, {
        '媒体': 'Airbnb', '予約番号': ev.code, 'ステータス': '確定', 'リスティングID': lid,
        'チェックイン': ev.start, 'チェックアウト': ev.end, '支払い状況': '媒体で決済済', '入湯税の徴収': '未',
        '予約URL': airbnbUrl_(ev.code),
      });
      ctx.byCode[ev.code] = r;
      fillRoom_(ctx, r);
      addTag_(r, TAG.ICAL_ONLY + ' カレンダーにだけある予約。名前・人数を予約画面で確認');
      return; // メールが後から来ることが多いので、ここでは通知しない（台帳では赤く出る）
    }
    if (isCancelled_(r)) return;
    if (!str_(r.v['リスティングID'])) set_(r, 'リスティングID', lid);
    const oi = r.v['チェックイン'], oo = r.v['チェックアウト'];
    if (oi !== ev.start || oo !== ev.end) {
      if (oi && oo) {
        const t = TAG.ICAL_DATES + ' ' + md_(oi) + '〜' + md_(oo) + ' → ' + md_(ev.start) + '〜' + md_(ev.end);
        if (addTag_(r, t)) notes.push(ev.code + ' の日程がAirbnbで変わってた：' + md_(oi) + '〜' + md_(oo) + ' → ' + md_(ev.start) + '〜' + md_(ev.end));
      }
      set_(r, 'チェックイン', ev.start);
      set_(r, 'チェックアウト', ev.end);
    }
  });
  ctx.res.rows.forEach(function (r) {
    if (str_(r.v['リスティングID']) !== lid || str_(r.v['媒体']) !== 'Airbnb' || isCancelled_(r)) return;
    const code = str_(r.v['予約番号']);
    if (!code || seen[code]) return;
    if (!r.v['チェックイン'] || r.v['チェックイン'] < todayIso) return;
    if (!r.v['予約日'] || r.v['予約日'] >= todayIso) return; // 今日入った予約はカレンダー反映待ちのことがある
    if (addTag_(r, TAG.ICAL_MISSING + ' Airbnbのカレンダーに見当たらない。キャンセルされてないか予約画面で確認')) {
      notes.push(rowLabel_(r) + '：Airbnbのカレンダーに見当たらない。キャンセルされてないか確認');
    }
  });
}

// ===== Googleカレンダー =====

function getCalendar_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('calendarId');
  let cal = id ? CalendarApp.getCalendarById(id) : null;
  // 別のアカウントで動かしていて、カレンダーが共有されていないとき。新しく作るとカレンダーが2つに分かれるので作らない
  if (id && !cal) throw new Error('「' + CONFIG.CALENDAR_NAME + '」カレンダーが開けない。持ち主から ' + Session.getEffectiveUser().getEmail() + ' に「予定の変更」の権限で共有して');
  if (!cal) {
    const found = CalendarApp.getOwnedCalendarsByName(CONFIG.CALENDAR_NAME);
    cal = found.length ? found[0] : CalendarApp.createCalendar(CONFIG.CALENDAR_NAME, { timeZone: 'Asia/Tokyo' });
    props.setProperty('calendarId', cal.getId());
  }
  return cal;
}

// 予約1件をカレンダーの予定にした形。キャンセルや日付なしは null（＝予定を消す）
function calendarPlan_(r, ssUrl) {
  if (!CONFIG.CALENDAR_NAME || isCancelled_(r)) return null;
  const s = r.v['チェックイン'], e = r.v['チェックアウト'];
  if (!s || !e || nights_(s, e) <= 0) return null;
  const tags = tagsOf_(r).filter(function (t) { return t.indexOf(TAG.TAX_CHILD) !== 0; });
  const adults = num_(r.v['大人']), kids = num_(r.v['子ども']), babies = num_(r.v['乳幼児']);
  const people = adults + kids + babies;
  const channel = str_(r.v['媒体']) || '?';
  const who = str_(r.v['代表者名']) || str_(r.v['予約番号']) || '名前なし';
  const tentative = str_(r.v['ステータス']) === '仮';
  const title = (tentative ? '【仮】' : '') + (tags.length ? '【要確認】' : '') + (str_(r.v['部屋']) || '部屋未設定') + '｜' + who +
    (people ? ' ' + people + '名' : '') + '（' + channel + '）';
  const desc = [
    (tentative ? 'ステータス：仮（まだ確定していない。HPの申込みは決済されなければ取り消し）\n' : '') +
    '予約番号：' + (str_(r.v['予約番号']) || '—'),
    '日程：' + md_(s) + ' チェックイン 〜 ' + md_(e) + ' チェックアウト（' + nights_(s, e) + '泊）',
    '人数：大人' + adults + (kids ? '・子ども' + kids : '') + (babies ? '・乳幼児' + babies : ''),
    str_(r.v['到着予定']) ? '到着予定：' + str_(r.v['到着予定']) : '',
    str_(r.v['連絡先']) ? '連絡先：' + str_(r.v['連絡先']) : '',
    str_(r.v['食事']) ? '食事：' + str_(r.v['食事']) : '',
    tags.length ? '\n要確認：\n' + tags.join('\n') : '',
    str_(r.v['メモ']) ? '\nメモ：' + str_(r.v['メモ']) : '',
    '',
    str_(r.v['予約URL']) ? '予約画面：' + str_(r.v['予約URL']) : '',
    '予約台帳：' + ssUrl,
  ].filter(function (x, i) { return x !== '' || i === 8; }).join('\n');
  const color = tags.length ? 'RED' : tentative ? 'GRAY' : ({ 'Airbnb': 'ORANGE', 'Agoda': 'MAUVE', '楽天': 'BLUE', '直販': 'YELLOW' }[channel] || 'GRAY');
  return { title: title, start: s, end: e, desc: desc, color: color, sig: hash_([title, s, e, desc, color].join('|')) };
}

function syncCalendar_(ctx, ssUrl, todayIso, notes) {
  if (!CONFIG.CALENDAR_NAME) return '連携オフ';
  const rows = ctx.res.rows.filter(function (r) { return hasData_(r) || str_(r.v['カレンダーID']); });
  const plans = rows.map(function (r) { return { r: r, ev: calendarPlan_(r, ssUrl) }; });
  const todo = plans.filter(function (p) {
    const id = str_(p.r.v['カレンダーID']);
    return p.ev ? (!id || p.ev.sig !== str_(p.r.v['カレンダー同期'])) : !!id;
  });
  if (!todo.length) return '変更なし';

  const props = PropertiesService.getScriptProperties();
  let cal;
  try { cal = getCalendar_(); }
  catch (e) { alertOnce_(props, 'calAlert', todayIso, notes, 'Googleカレンダーに書けなかった：' + String((e && e.message) || e)); return 'カレンダーが開けない'; }
  const tz = Session.getScriptTimeZone();
  let made = 0, updated = 0, removed = 0, failed = 0, lastErr = '';
  todo.forEach(function (p) {
    const r = p.r, ev = p.ev, id = str_(r.v['カレンダーID']);
    try {
      if (!ev) {
        const old = cal.getEventById(id);
        if (old) old.deleteEvent();
        set_(r, 'カレンダーID', '');
        set_(r, 'カレンダー同期', '');
        removed++;
        return;
      }
      const start = Utilities.parseDate(ev.start, tz, 'yyyy-MM-dd');
      const end = Utilities.parseDate(ev.end, tz, 'yyyy-MM-dd');
      let e = id ? cal.getEventById(id) : null;
      if (!e) {
        e = cal.createAllDayEvent(ev.title, start, end, { description: ev.desc });
        set_(r, 'カレンダーID', e.getId());
        made++;
      } else {
        e.setTitle(ev.title);
        e.setAllDayDates(start, end);
        e.setDescription(ev.desc);
        updated++;
      }
      e.setColor(CalendarApp.EventColor[ev.color]);
      set_(r, 'カレンダー同期', ev.sig);
    } catch (err) {
      failed++;
      lastErr = String((err && err.message) || err);
    }
  });
  if (failed) alertOnce_(props, 'calAlert', todayIso, notes, 'Googleカレンダーに書けなかった予約が' + failed + '件：' + lastErr);
  else props.deleteProperty('calAlert');
  return '追加' + made + '・更新' + updated + '・削除' + removed + (failed ? '・失敗' + failed : '');
}

function alertOnce_(props, key, todayIso, notes, msg) {
  if (props.getProperty(key) === todayIso) return;
  props.setProperty(key, todayIso);
  notes.push(msg);
}

// ===== Cloudflare版の予約管理との同期（移行中だけ） =====

// 台帳の見出し → Cloudflare版の名前
const CF_FIELDS = {
  '媒体': 'channel', '予約番号': 'no', 'ステータス': 'status', '要確認': 'flag', '部屋': 'room',
  'チェックイン': 'checkIn', 'チェックアウト': 'checkOut', '大人': 'adults', '子ども': 'children', '乳幼児': 'infants',
  '代表者名': 'name', '連絡先': 'contact', '到着予定': 'arrival', '食事': 'meals', 'ゲスト支払額': 'guestPaid',
  '支払い状況': 'payment', '入湯税': 'tax', '入湯税の徴収': 'taxCollected', '予約URL': 'url', 'メモ': 'memo', '予約日': 'bookedOn',
};
const CF_NUMBER_COLS = ['大人', '子ども', '乳幼児', 'ゲスト支払額'];

function cfConfig_() {
  const props = PropertiesService.getScriptProperties();
  const url = str_(props.getProperty('CF_SYNC_URL')).replace(/\/+$/, '');
  const token = str_(props.getProperty('CF_SYNC_TOKEN'));
  if (!url || !token) return null;
  return { url: url, token: token, props: props };
}

function cfFetch_(cf, path, payload) {
  const opts = { muteHttpExceptions: true, followRedirects: false, headers: { Authorization: 'Bearer ' + cf.token } };
  if (payload) { opts.method = 'post'; opts.contentType = 'application/json'; opts.payload = JSON.stringify(payload); }
  const resp = UrlFetchApp.fetch(cf.url + path, opts);
  const code = resp.getResponseCode();
  let body = null;
  try { body = JSON.parse(resp.getContentText()); } catch (e) { body = null; }
  if (code !== 200 || !body || !body.ok) {
    throw new Error('Cloudflare版 ' + path + ' が ' + code + '：' + (body && body.message ? body.message : resp.getContentText().slice(0, 120)));
  }
  return body;
}

// アプリで入れて、まだ台帳にない予約を末尾に足す（予約番号で重複を防ぐ）
function pullFromCloudflare_(cf, ctx, todayIso, notes) {
  try {
    const got = cfFetch_(cf, '/api/sync/pending');
    cfAppendPending_(ctx, got.bookings || [], notes);
    cfApplyCancels_(ctx, got.cancels || [], notes);
    cfApplyHpResults_(ctx, got.hpResults || [], notes);
    cfApplyMeals_(ctx, got.meals || [], notes);
  } catch (e) {
    alertOnce_(cf.props, 'cfPullAlert', todayIso, notes, 'Cloudflare版から予約を受け取れなかった：' + String((e && e.message) || e));
  }
}

// notes を渡すと、足した予約を「新しい予約」として通知メールに載せる（Airbnbの取り込みと同じメール・同じ宛先）
function cfAppendPending_(ctx, list, notes) {
  let added = 0;
  list.forEach(function (b) {
    const no = str_(b['予約番号']);
    if (!no || ctx.byCode[no]) return;
    const vals = {};
    Object.keys(CF_FIELDS).forEach(function (h) {
      if (b[h] === undefined || b[h] === '') return;
      vals[h] = CF_NUMBER_COLS.indexOf(h) >= 0 && /^\d+$/.test(String(b[h])) ? Number(b[h]) : b[h];
    });
    const r = newRow_(ctx.res, vals);
    ctx.byCode[no] = r;
    added++;
    if (notes && CONFIG.NOTIFY_NEW_BOOKING) {
      const status = str_(vals['ステータス']);
      const from = str_(vals['支払い状況']) === 'HPで決済済' ? 'HP' : 'アプリ';
      if (status === '仮') notes.push('新しい申込み（HP・決済待ち）：' + rowLabel_(r));
      else if (status === 'キャンセル') notes.push('HPの申込み（決済されず取り消し）：' + rowLabel_(r));
      else notes.push('新しい予約（' + from + '）：' + rowLabel_(r));
    }
  });
  return added;
}

// アプリの「キャンセル」を台帳に反映する（ステータスをキャンセルにし、メモに1行足す。行は消さない）
function cfApplyCancels_(ctx, list, notes) {
  let done = 0;
  list.forEach(function (c) {
    const r = ctx.byCode[str_(c['予約番号'])];
    if (!r || isCancelled_(r)) return;
    set_(r, 'ステータス', 'キャンセル');
    const note = str_(c['メモ']);
    if (note && str_(r.v['メモ']).indexOf(note) < 0) set_(r, 'メモ', str_(r.v['メモ']) ? str_(r.v['メモ']) + '\n' + note : note);
    done++;
    if (notes) notes.push('キャンセル（アプリ）：' + rowLabel_(r) + (note ? '\n  ' + note : ''));
  });
  return done;
}

// HPの申込みの決済結果を台帳に書く。台帳で「仮」のままの行だけが対象（毎回同じものが届いても二重にしない）
//   確定：ステータスを確定、支払い状況を HPで決済済 に
//   キャンセル：ステータスをキャンセルにし、メモに理由を1行足す（行は消さない）
function cfApplyHpResults_(ctx, list, notes) {
  let done = 0;
  list.forEach(function (h) {
    const r = ctx.byCode[str_(h['予約番号'])];
    const status = str_(h['ステータス']);
    if (!r || str_(r.v['ステータス']) !== '仮' || (status !== '確定' && status !== 'キャンセル')) return;
    set_(r, 'ステータス', status);
    if (status === '確定') {
      if (str_(h['支払い状況'])) set_(r, '支払い状況', str_(h['支払い状況']));
      if (notes && CONFIG.NOTIFY_NEW_BOOKING) notes.push('HPの申込みが決済された（確定）：' + rowLabel_(r));
    } else {
      const note = str_(h['メモ']);
      if (note && str_(r.v['メモ']).indexOf(note) < 0) set_(r, 'メモ', str_(r.v['メモ']) ? str_(r.v['メモ']) + '\n' + note : note);
      if (notes) notes.push('HPの申込みは決済されず取り消し：' + rowLabel_(r));
    }
    done++;
  });
  return done;
}

// アプリで入れた食事（Airbnbはメッセージで聞いた答え）を台帳の「食事」列に書く
function cfApplyMeals_(ctx, list, notes) {
  let done = 0;
  list.forEach(function (m) {
    const r = ctx.byCode[str_(m['予約番号'])];
    const meals = str_(m['食事']);
    if (!r || !meals || isCancelled_(r) || str_(r.v['食事']) === meals) return;
    set_(r, '食事', meals);
    done++;
    if (notes) notes.push('食事（アプリ）：' + rowLabel_(r) + '\n  ' + meals);
  });
  return done;
}

// 台帳の予約・部屋をまるごと送る（D1側は1回のトランザクションで置き換える）
function pushToCloudflare_(cf, res, rooms, lastImport, todayIso, notes, notify) {
  try {
    const payload = cfPayload_(res, rooms, lastImport);
    payload.notes = notify || [];
    cfFetch_(cf, '/api/sync/sheet', payload);
    cf.props.deleteProperty('cfPushAlert');
  } catch (e) {
    alertOnce_(cf.props, 'cfPushAlert', todayIso, notes, 'Cloudflare版に台帳を送れなかった：' + String((e && e.message) || e));
  }
}

function cfPayload_(res, rooms, lastImport) {
  return {
    lastImport: lastImport,
    rooms: rooms.rows
      .filter(function (r) { return str_(r.v['部屋']); })
      .map(function (r) { return { name: str_(r.v['部屋']), capacity: num_(r.v['定員']), state: str_(r.v['状態']) }; }),
    bookings: res.rows.filter(hasData_).map(function (r) {
      const o = {};
      Object.keys(CF_FIELDS).forEach(function (h) { o[CF_FIELDS[h]] = str_(r.v[h]); });
      return o;
    }),
  };
}

// ===== メールの中身を台帳に反映 =====

function applyMail_(ctx, p, refIso, notes) {
  if (p.channel === 'Agoda') return applyAgoda_(ctx, p, refIso, notes);
  if (p.kind === 'confirm') return applyConfirm_(ctx, p, refIso, notes);
  if (p.kind === 'cancel') return applyCancel_(ctx, p, notes);
  if (p.kind === 'change') return applyChange_(ctx, p, notes);
  return '何もしてない';
}

function applyConfirm_(ctx, p, refIso, notes) {
  ensureListing_(ctx, p.listingId, p.listingTitle, notes);
  const vals = {
    '媒体': 'Airbnb', '予約番号': p.code, 'ステータス': '確定', 'リスティングID': p.listingId,
    'チェックイン': p.checkIn, 'チェックアウト': p.checkOut,
    '大人': p.adults || '', '子ども': p.children || '', '乳幼児': p.infants || '',
    '代表者名': p.name, '到着予定': p.checkInTime,
    'ゲスト支払額': p.guestTotal, '受取額': p.payout,
    '支払い状況': '媒体で決済済', '入湯税の徴収': '未',
    '予約URL': airbnbUrl_(p.code), '予約日': refIso,
  };
  let r = ctx.byCode[p.code];
  const created = !r;
  if (created) {
    r = newRow_(ctx.res, vals);
    ctx.byCode[p.code] = r;
  } else {
    Object.keys(vals).forEach(function (k) { if (isBlank_(r.v[k])) set_(r, k, vals[k]); });
  }
  removeTag_(r, TAG.ICAL_ONLY);
  fillRoom_(ctx, r);
  if (p.warn && addTag_(r, TAG.GUESTS + ' ' + p.warn)) notes.push(rowLabel_(r) + '：' + p.warn);
  if (created && CONFIG.NOTIFY_NEW_BOOKING) notes.push('新しい予約：' + rowLabel_(r));
  return created ? '追加' : '既にあった（空欄だけ埋めた）';
}

function applyCancel_(ctx, p, notes) {
  ensureListing_(ctx, p.listingId, p.listingTitle, notes);
  let r = ctx.byCode[p.code];
  const existed = !!r;
  if (!r) {
    r = newRow_(ctx.res, {
      '媒体': 'Airbnb', '予約番号': p.code, 'ステータス': 'キャンセル', 'リスティングID': p.listingId,
      'チェックイン': p.checkIn, 'チェックアウト': p.checkOut, '大人': p.guests, '予約URL': airbnbUrl_(p.code),
    });
    ctx.byCode[p.code] = r;
  } else if (isCancelled_(r)) {
    return '既にキャンセルだった';
  } else {
    set_(r, 'ステータス', 'キャンセル');
  }
  removeTag_(r, TAG.ICAL_MISSING);
  fillRoom_(ctx, r);
  notes.push('キャンセル' + (p.canceledBy ? '（' + p.canceledBy + '）' : '') + '：' + rowLabel_(r));
  return existed ? 'キャンセルにした' : 'キャンセル（台帳になかったので行を足した）';
}

function applyChange_(ctx, p, notes) {
  let r = ctx.byCode[p.code];
  if (!r) {
    r = newRow_(ctx.res, { '媒体': 'Airbnb', '予約番号': p.code, 'ステータス': '確定', '代表者名': p.name, '予約URL': airbnbUrl_(p.code) });
    ctx.byCode[p.code] = r;
  }
  addTag_(r, TAG.CHANGED + ' Airbnbで予約内容が変わった。日程と人数を予約画面で確認');
  notes.push('予約変更：' + rowLabel_(r) + '。メールには新しい内容が書かれてないので、予約画面で確認（iCalを入れてれば日程は自動で直る）');
  return '変更ありの札を付けた';
}

// ===== Agodaのメールを台帳に反映 =====
// 予約番号はAgodaの予約ID（数字）。「リスティングID」列にはAgodaの部屋タイプ名を入れ、「Agoda」タブで部屋に紐付ける

function applyAgoda_(ctx, p, refIso, notes) {
  if (p.kind === 'cancel') return applyAgodaCancel_(ctx, p, notes);
  ensureAgodaType_(ctx, p.roomType, refIso, notes);
  const memo = p.request ? 'Agodaの要望：' + p.request : '';
  const vals = {
    '媒体': 'Agoda', '予約番号': p.code, 'ステータス': '確定', 'リスティングID': p.roomType || '',
    'チェックイン': p.checkIn, 'チェックアウト': p.checkOut,
    '大人': p.adults || '', '子ども': p.children || '',
    '代表者名': p.name || '', '連絡先': p.contact || '', 'ゲスト支払額': p.guestTotal, '受取額': p.payout,
    '支払い状況': p.payAtHotel ? '未収' : '媒体で決済済', '入湯税の徴収': '未',
    '予約URL': p.url || '', '予約日': refIso, 'メモ': memo,
  };
  let r = ctx.byCode[p.code];
  const created = !r;
  let result;
  if (created) {
    if (!p.checkIn) {
      r = newRow_(ctx.res, { '媒体': 'Agoda', '予約番号': p.code, 'ステータス': '確定', '代表者名': p.name || '', 'リスティングID': p.roomType || '' });
    } else {
      r = newRow_(ctx.res, vals);
    }
    ctx.byCode[p.code] = r;
    result = '追加';
  } else if (p.kind === 'change') {
    const oi = r.v['チェックイン'], oo = r.v['チェックアウト'];
    if (p.checkIn && (oi !== p.checkIn || oo !== p.checkOut)) {
      set_(r, 'チェックイン', p.checkIn);
      set_(r, 'チェックアウト', p.checkOut);
      notes.push(p.code + ' の日程がAgodaで変わった：' + md_(oi) + '〜' + md_(oo) + ' → ' + md_(p.checkIn) + '〜' + md_(p.checkOut));
    }
    ['大人', '子ども', '代表者名', 'ゲスト支払額', '受取額'].forEach(function (k) { if (!isBlank_(vals[k])) set_(r, k, vals[k]); });
    if (p.roomType && str_(r.v['リスティングID']) !== p.roomType) { set_(r, 'リスティングID', p.roomType); set_(r, '部屋', ''); }
    result = '変更を反映した';
  } else if (p.refresh) {
    // 読み方を直したあとの読み直し。メールから入れた欄を新しい読み取りで上書きする（手で選んだ部屋・手で書いたメモは残す）
    ['大人', '子ども', '代表者名', '連絡先', 'ゲスト支払額', '受取額', '支払い状況'].forEach(function (k) { if (!isBlank_(vals[k])) set_(r, k, vals[k]); });
    if (p.roomType) set_(r, 'リスティングID', p.roomType);
    const memo0 = str_(r.v['メモ']);
    if (!memo0 || memo0.indexOf('Agodaの要望：') === 0) set_(r, 'メモ', memo);
    removeTag_(r, TAG.AGODA_READ);
    result = '読み直した';
  } else {
    Object.keys(vals).forEach(function (k) { if (isBlank_(r.v[k])) set_(r, k, vals[k]); });
    result = '既にあった（空欄だけ埋めた）';
  }
  if (isCancelled_(r) && p.kind === 'confirm' && !created) return result;
  fillRoom_(ctx, r);
  if (p.kind === 'change') {
    addTag_(r, TAG.CHANGED + ' Agodaで予約内容が変わった。日程・人数・部屋をYCSで確認');
    notes.push('予約変更（Agoda）：' + rowLabel_(r) + (p.checkIn ? '' : '。メールから日程が読めないので、YCSで確認'));
  }
  if (p.warns && p.warns.length) {
    const t = TAG.AGODA_READ + ' ' + p.warns.join('、') + '。YCSで確認';
    if (addTag_(r, t)) notes.push(rowLabel_(r) + '：Agodaのメールで' + p.warns.join('、'));
  }
  if (created && p.kind === 'confirm' && CONFIG.NOTIFY_NEW_BOOKING) notes.push('新しい予約（Agoda）：' + rowLabel_(r));
  return result;
}

function applyAgodaCancel_(ctx, p, notes) {
  let r = ctx.byCode[p.code];
  const existed = !!r;
  if (!r) {
    r = newRow_(ctx.res, {
      '媒体': 'Agoda', '予約番号': p.code, 'ステータス': 'キャンセル',
      'チェックイン': p.checkIn || '', 'チェックアウト': p.checkOut || '',
    });
    ctx.byCode[p.code] = r;
  } else if (isCancelled_(r)) {
    return '既にキャンセルだった';
  } else {
    set_(r, 'ステータス', 'キャンセル');
  }
  notes.push('キャンセル（Agoda）：' + rowLabel_(r));
  return existed ? 'キャンセルにした' : 'キャンセル（台帳になかったので行を足した）';
}

function ensureAgodaType_(ctx, type, refIso, notes) {
  if (!type || !ctx.agoda || ctx.agodaTypes[type]) return;
  ctx.agodaTypes[type] = newRow_(ctx.agoda, { 'Agodaの部屋タイプ': type, '最初に見た日': refIso });
  notes.push('新しいAgodaの部屋タイプを見つけた（' + type + '）。「Agoda」タブで部屋を選んで（複数の部屋にまたがるタイプなら空のままにして、予約ごとに選ぶ）');
}

function ensureListing_(ctx, id, title, notes) {
  if (!id) return;
  const r = ctx.listings[id];
  if (!r) {
    ctx.listings[id] = newRow_(ctx.airbnb, { 'リスティングID': String(id), 'Airbnbでの名前': title || '' });
    notes.push('新しいAirbnbリスティングを見つけた（' + (title || id) + '）。「Airbnb」タブで部屋を選んで');
  } else if (title) {
    set_(r, 'Airbnbでの名前', title);
  }
}

function fillRoom_(ctx, r) {
  const lid = str_(r.v['リスティングID']);
  const map = str_(r.v['媒体']) === 'Agoda' ? ctx.agodaTypes : ctx.listings;
  const l = lid && map[lid];
  const room = l ? str_(l.v['部屋']) : '';
  if (!str_(r.v['部屋']) && room && !/[,、，\s]/.test(room)) set_(r, '部屋', room);
}

// ===== 台帳ルール（重複・準備中・定員・入湯税・泊数） =====

// Agodaのメールには部屋タイプしか書いていないので、部屋が空の予約は人数と空きを見て部屋を決める。
// 候補は「Agoda」タブの「部屋」（「302,月山」のようにカンマで複数書ける。空ならすべての販売可の部屋）。
// 定員が足りて、その日程に重なる予約がない部屋のうち、定員の小さい順（同じなら「部屋」タブの並び順）で選ぶ
function autoRoomAgoda_(ctx, todayIso, notes) {
  const order = ctx.rooms ? ctx.rooms.rows.map(function (r) { return str_(r.v['部屋']); }).filter(Boolean) : Object.keys(ctx.roomInfo);
  const active = ctx.res.rows.filter(function (r) {
    return hasData_(r) && !isCancelled_(r) && r.v['チェックイン'] && r.v['チェックアウト'];
  });
  const todo = active
    .filter(function (r) { return str_(r.v['媒体']) === 'Agoda' && !str_(r.v['部屋']) && r.v['チェックアウト'] > todayIso; })
    .sort(function (a, b) { return a.v['チェックイン'] < b.v['チェックイン'] ? -1 : 1; });
  todo.forEach(function (r) {
    const type = ctx.agodaTypes[str_(r.v['リスティングID'])];
    const listed = type ? str_(type.v['部屋']).split(/[,、，\s]+/).filter(Boolean) : [];
    const people = Math.max(1, num_(r.v['大人']) + num_(r.v['子ども']));
    const cands = (listed.length ? listed : order).filter(function (name) {
      const info = ctx.roomInfo[name];
      if (!info || info.state !== '販売可' || (info.cap && info.cap < people)) return false;
      return !active.some(function (o) {
        return o !== r && str_(o.v['部屋']) === name && o.v['チェックイン'] < r.v['チェックアウト'] && r.v['チェックイン'] < o.v['チェックアウト'];
      });
    });
    cands.sort(function (a, b) {
      return (ctx.roomInfo[a].cap || 99) - (ctx.roomInfo[b].cap || 99) || order.indexOf(a) - order.indexOf(b);
    });
    if (!cands.length) return; // 空きがなければ [部屋未設定] のまま（人が決める）
    set_(r, '部屋', cands[0]);
    const memo = str_(r.v['メモ']);
    const line = '部屋は人数と空きから自動で決めた（' + cands[0] + '）';
    if (memo.indexOf(line) < 0) set_(r, 'メモ', memo ? memo + '\n' + line : line);
    notes.push('Agodaの予約の部屋を ' + cands[0] + ' にした：' + shortLabel_(r));
  });
}

function applyRules_(ctx, todayIso, notes) {
  autoRoomAgoda_(ctx, todayIso, notes);
  const rows = ctx.res.rows.filter(hasData_);
  const derived = new Map();
  rows.forEach(function (r) { derived.set(r, []); });

  rows.forEach(function (r) {
    fillRoom_(ctx, r);
    const inIso = r.v['チェックイン'], outIso = r.v['チェックアウト'];
    const n = (inIso && outIso) ? nights_(inIso, outIso) : 0;
    if (n > 0) set_(r, '泊数', n);
    if (isCancelled_(r)) { set_(r, '入湯税', ''); return; }

    const tags = derived.get(r);
    const room = str_(r.v['部屋']);
    const lid = str_(r.v['リスティングID']);
    const upcoming = !outIso || outIso >= todayIso;
    const agodaRow = str_(r.v['媒体']) === 'Agoda';
    if (!room) tags.push(TAG.ROOM_UNSET + (!lid ? ' 部屋を選んで'
      : agodaRow ? ' 人数に合う空き部屋が見つからなかった。この予約の部屋を選んで'
      : ' 「Airbnb」タブでこのリスティングの部屋を選んで'));
    const info = room ? ctx.roomInfo[room] : null;
    if (info && upcoming && info.state && info.state !== '販売可') tags.push(TAG.NOT_FOR_SALE + ' ' + room + 'は「' + info.state + '」');
    const adults = num_(r.v['大人']), kids = num_(r.v['子ども']);
    if (info && info.cap && upcoming && adults + kids > info.cap) tags.push(TAG.OVER_CAP + ' ' + room + 'は定員' + info.cap + '、予約は' + (adults + kids) + '名');
    if (kids > 0) tags.push(TAG.TAX_CHILD + ' 子どもの入湯税は市に確認中。今は大人だけで計算');

    if (n > 0 && adults > 0) {
      const booked = r.v['予約日'];
      const rate = (booked && booked < CONFIG.ONSEN_TAX.changeDate) ? CONFIG.ONSEN_TAX.oldRate : CONFIG.ONSEN_TAX.newRate;
      set_(r, '入湯税', adults * n * rate);
    }
  });

  const active = rows.filter(function (r) {
    return !isCancelled_(r) && str_(r.v['部屋']) && r.v['チェックイン'] && r.v['チェックアウト'] && r.v['チェックアウト'] >= todayIso;
  });
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i], b = active[j];
      if (str_(a.v['部屋']) !== str_(b.v['部屋'])) continue;
      if (a.v['チェックイン'] < b.v['チェックアウト'] && b.v['チェックイン'] < a.v['チェックアウト']) {
        derived.get(a).push(TAG.DUP + ' ' + shortLabel_(b) + 'と重なってる');
        derived.get(b).push(TAG.DUP + ' ' + shortLabel_(a) + 'と重なってる');
      }
    }
  }

  rows.forEach(function (r) {
    const before = tagsOf_(r);
    const kept = before.filter(function (t) { return !DERIVED_TAGS.some(function (p) { return t.indexOf(p) === 0; }); });
    const after = kept.concat(derived.get(r));
    if (after.join('\n') !== before.join('\n')) set_(r, '要確認', after.join('\n'));
    derived.get(r).forEach(function (t) {
      const shouldNotify = NOTIFY_DERIVED.some(function (p) { return t.indexOf(p) === 0; });
      if (shouldNotify && before.indexOf(t) < 0) notes.push(rowLabel_(r) + '：' + t);
    });
  });
}

// ===== シートの読み書き =====

function makeCtx_(res, airbnb, rooms, agoda) {
  const byCode = {};
  res.rows.forEach(function (r) { const c = str_(r.v['予約番号']); if (c) byCode[c] = r; });
  const listings = {};
  airbnb.rows.forEach(function (r) { const id = str_(r.v['リスティングID']); if (id) listings[id] = r; });
  const roomInfo = {};
  rooms.rows.forEach(function (r) {
    const n = str_(r.v['部屋']);
    if (n) roomInfo[n] = { cap: num_(r.v['定員']), state: str_(r.v['状態']) };
  });
  const agodaTypes = {};
  if (agoda) agoda.rows.forEach(function (r) { const t = str_(r.v['Agodaの部屋タイプ']); if (t) agodaTypes[t] = r; });
  return { res: res, airbnb: airbnb, rooms: rooms, agoda: agoda || null, byCode: byCode, listings: listings, agodaTypes: agodaTypes, roomInfo: roomInfo };
}

function loadTable_(sheet, requiredCols, dateCols, tz, fixedWidth) {
  const lastCol = fixedWidth ? Math.min(sheet.getLastColumn(), fixedWidth) : sheet.getLastColumn();
  const headers = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); }) : [];
  requiredCols.forEach(function (c) {
    if (headers.indexOf(c) < 0) { headers.push(c); sheet.getRange(1, headers.length).setValue(c); }
  });
  const idx = {};
  headers.forEach(function (h, i) { if (h && !(h in idx)) idx[h] = i; });
  const rows = [];
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    values.forEach(function (arr, i) {
      const v = {};
      Object.keys(idx).forEach(function (h) {
        let x = arr[idx[h]];
        if (dateCols.indexOf(h) >= 0) x = toIso_(x, tz);
        else x = timeText_(h, x, tz);
        v[h] = x;
      });
      rows.push({ _row: i + 2, v: v, dirty: {}, isNew: false });
    });
  }
  return { sheet: sheet, headers: headers, idx: idx, rows: rows, dateCols: dateCols };
}

// 時刻だけの列（到着予定）。スプシは「15:00」を 1899/12/30 15:00 の日時として返すので、
// そのまま文字にすると「Sat Dec 30 1899 15:00:00 GMT+0900 …」になる。読むときに「15:00」に直す
const TIME_COLS = ['到着予定'];
function timeText_(h, x, tz) {
  if (TIME_COLS.indexOf(h) < 0 || Object.prototype.toString.call(x) !== '[object Date]') return x;
  return Utilities.formatDate(x, tz, 'HH:mm');
}

function saveTable_(t, tz) {
  const sh = t.sheet;
  const toCell = function (h, x) {
    if (x === undefined || x === null) return '';
    if (t.dateCols.indexOf(h) >= 0) return x ? fromIso_(x, tz) : '';
    return x;
  };
  t.rows.forEach(function (r) {
    if (r.isNew) return;
    Object.keys(r.dirty).forEach(function (h) {
      sh.getRange(r._row, t.idx[h] + 1).setValue(toCell(h, r.v[h]));
    });
    r.dirty = {};
  });
  const news = t.rows.filter(function (r) { return r.isNew; });
  if (news.length) {
    const start = sh.getLastRow() + 1;
    const arr = news.map(function (r) { return t.headers.map(function (h) { return h ? toCell(h, r.v[h]) : ''; }); });
    sh.getRange(start, 1, arr.length, t.headers.length).setValues(arr);
    news.forEach(function (r, i) { r._row = start + i; r.isNew = false; r.dirty = {}; });
  }
}

function touchUpdated_(t, now) {
  t.rows.forEach(function (r) {
    const keys = Object.keys(r.dirty).filter(function (k) { return SYSTEM_COLS.indexOf(k) < 0; });
    if (r.isNew || keys.length) { r.v['更新日時'] = now; r.dirty['更新日時'] = true; }
  });
}

function newRow_(t, vals) {
  const r = { _row: null, v: {}, dirty: {}, isNew: true };
  Object.keys(vals).forEach(function (k) { r.v[k] = vals[k]; });
  t.rows.push(r);
  return r;
}

function set_(r, key, val) {
  if (same_(r.v[key], val)) return false;
  r.v[key] = val;
  r.dirty[key] = true;
  return true;
}

function ensureSheet_(ss, name, cols) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  const lastCol = sh.getLastColumn();
  const headers = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); }) : [];
  cols.forEach(function (c) { if (headers.indexOf(c) < 0) headers.push(c); });
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#1F2430').setFontColor('#ECE9E1');
  sh.setFrozenRows(1);
  return sh;
}

function formatSheets_(ss) {
  const res = ss.getSheetByName(SHEETS.RES);
  const rooms = ss.getSheetByName(SHEETS.ROOMS);
  const airbnb = ss.getSheetByName(SHEETS.AIRBNB);
  const log = ss.getSheetByName(SHEETS.LOG);
  const list = function (arr) { return SpreadsheetApp.newDataValidation().requireValueInList(arr, true).setAllowInvalid(true).build(); };
  const roomList = SpreadsheetApp.newDataValidation().requireValueInRange(rooms.getRange('A2:A'), true).setAllowInvalid(true).build();
  const col = function (sh, name) { return headerIndex_(sh)[name] + 1; };
  const colRange = function (sh, name) { return sh.getRange(2, col(sh, name), sh.getMaxRows() - 1, 1); };

  colRange(res, '媒体').setDataValidation(list(CHANNELS));
  colRange(res, 'ステータス').setDataValidation(list(STATUSES));
  colRange(res, '部屋').setDataValidation(roomList);
  colRange(res, '支払い状況').setDataValidation(list(PAY_STATUSES));
  colRange(res, '入湯税の徴収').setDataValidation(list(TAX_STATUSES));
  DATE_COLS.forEach(function (n) { colRange(res, n).setNumberFormat('yyyy/mm/dd(ddd)'); });
  colRange(res, '更新日時').setNumberFormat('yyyy/mm/dd hh:mm');
  ['ゲスト支払額', '受取額', '入湯税'].forEach(function (n) { colRange(res, n).setNumberFormat('"¥"#,##0'); });
  ['予約番号', 'リスティングID'].forEach(function (n) { colRange(res, n).setNumberFormat('@'); });
  colRange(res, '要確認').setWrap(true);
  res.setColumnWidth(col(res, '要確認'), 300);
  res.setColumnWidth(col(res, '代表者名'), 160);
  res.setFrozenColumns(2);

  const lastColLetter = letter_(res.getLastColumn());
  const all = res.getRange('A2:' + lastColLetter + res.getMaxRows());
  const s = letter_(col(res, 'ステータス')), t = letter_(col(res, '要確認'));
  res.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + s + '2="キャンセル"')
      .setFontColor('#9AA0A6').setRanges([all]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + t + '2<>""')
      .setBackground('#FCE8E6').setRanges([all]).build(),
  ]);

  colRange(rooms, '状態').setDataValidation(list(ROOM_STATES));

  colRange(airbnb, 'リスティングID').setNumberFormat('@');
  colRange(airbnb, '部屋').setDataValidation(roomList);
  colRange(airbnb, 'iCal最終取得').setNumberFormat('yyyy/mm/dd hh:mm');
  airbnb.setColumnWidth(col(airbnb, 'リスティングID'), 170);
  airbnb.setColumnWidth(col(airbnb, 'Airbnbでの名前'), 360);
  airbnb.setColumnWidth(col(airbnb, 'iCal URL'), 320);

  colRange(log, '日時').setNumberFormat('yyyy/mm/dd hh:mm');
  log.getRange('J1').setNumberFormat('yyyy/mm/dd hh:mm');
  log.setColumnWidth(col(log, '件名'), 360);
}

function sortReservations_(ss) {
  const sh = ss.getSheetByName(SHEETS.RES);
  const last = sh.getLastRow();
  if (last > 2) sh.getRange(2, 1, last - 1, sh.getLastColumn()).sort({ column: headerIndex_(sh)['チェックイン'] + 1, ascending: true });
}

function headerIndex_(sh) {
  const idx = {};
  sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].forEach(function (h, i) { h = String(h).trim(); if (h && !(h in idx)) idx[h] = i; });
  return idx;
}

function mustSheet_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error('「' + name + '」タブがない。先に setup を実行して');
  return sh;
}

// ===== 小物 =====

function clean_(s) {
  return String(s || '')
    .replace(/[⁠​-‍﻿­͏]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t 　]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{2,}/g, '\n');
}

function firstGroup_(s, re) { const m = String(s || '').match(re); return m ? m[1] : ''; }

function allMatches_(s, re) {
  const out = [];
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(s))) out.push(m);
  return out;
}

function resolveStart_(y, m, d, refIso) {
  if (y) return iso_(y, m, d);
  const ref = ymd_(refIso);
  let year = ref.y;
  if (Date.UTC(year, m - 1, d) < utc_(refIso) - 60 * 864e5) year += 1;
  return iso_(year, m, d);
}

function resolveEnd_(y, m, d, startIso) {
  if (y) return iso_(y, m, d);
  let year = ymd_(startIso).y;
  if (Date.UTC(year, m - 1, d) <= utc_(startIso)) year += 1;
  return iso_(year, m, d);
}

function ymd_(iso) { const p = String(iso).split('-').map(Number); return { y: p[0], m: p[1], d: p[2] }; }
function iso_(y, m, d) { return y + '-' + pad2_(m) + '-' + pad2_(d); }
function utc_(iso) { const p = ymd_(iso); return Date.UTC(p.y, p.m - 1, p.d); }
function nights_(a, b) { return Math.round((utc_(b) - utc_(a)) / 864e5); }
function pad2_(n) { return ('0' + n).slice(-2); }
function md_(iso) { if (!iso) return '?'; const p = ymd_(iso); return p.m + '/' + p.d; }
function icsDate_(v) { const m = String(v || '').match(/(\d{4})(\d{2})(\d{2})/); return m ? m[1] + '-' + m[2] + '-' + m[3] : ''; }

function toIso_(x, tz) {
  if (x === '' || x === null || x === undefined) return '';
  if (Object.prototype.toString.call(x) === '[object Date]') return isNaN(x.getTime()) ? '' : Utilities.formatDate(x, tz, 'yyyy-MM-dd');
  const m = String(x).trim().match(/^(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
  return m ? iso_(Number(m[1]), Number(m[2]), Number(m[3])) : '';
}

function fromIso_(iso, tz) { return Utilities.parseDate(iso, tz, 'yyyy-MM-dd'); }

function str_(x) { return (x === null || x === undefined) ? '' : String(x).trim(); }
function num_(x) { const n = Number(x); return isFinite(n) ? n : 0; }
function yen_(s) { return s ? Number(String(s).replace(/,/g, '')) : ''; }
function isBlank_(x) { return x === '' || x === null || x === undefined || (typeof x === 'string' && !x.trim()); }
function isCancelled_(r) { return str_(r.v['ステータス']) === 'キャンセル'; }
function hasData_(r) { return !!(str_(r.v['予約番号']) || r.v['チェックイン'] || str_(r.v['代表者名'])); }
function airbnbUrl_(code) { return 'https://www.airbnb.jp/hosting/reservations/details/' + code; }

function same_(a, b) {
  const n = function (x) {
    if (x === null || x === undefined) return '';
    if (Object.prototype.toString.call(x) === '[object Date]') return 'd' + x.getTime();
    return String(x);
  };
  return n(a) === n(b);
}

function tagsOf_(r) { return String(r.v['要確認'] || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean); }

function addTag_(r, text) {
  const t = tagsOf_(r);
  if (t.indexOf(text) >= 0) return false;
  t.push(text);
  set_(r, '要確認', t.join('\n'));
  return true;
}

function removeTag_(r, prefix) {
  const t = tagsOf_(r);
  const kept = t.filter(function (x) { return x.indexOf(prefix) !== 0; });
  if (kept.length !== t.length) set_(r, '要確認', kept.join('\n'));
}

function shortLabel_(r) {
  return md_(r.v['チェックイン']) + '〜' + md_(r.v['チェックアウト']) + ' ' +
    (str_(r.v['代表者名']) || str_(r.v['予約番号']) || '名前なし') + '（' + (str_(r.v['媒体']) || '?') + '）';
}

function rowLabel_(r) { return (str_(r.v['部屋']) || '部屋未設定') + ' ' + shortLabel_(r); }

function hash_(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

function letter_(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
