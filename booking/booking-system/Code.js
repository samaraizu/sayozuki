/**
 * 小夜月 予約台帳 — Airbnbメールの自動取り込み（Google Apps Script）
 *
 * 5分ごとにやること
 *   1. Gmailから Airbnb の「予約確定」「キャンセル」「予約変更」メールを探す
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
 *
 * Googleカレンダー：キャンセル以外の予約を「小夜月 予約」カレンダーに終日の予定で書く（泊まる夜の日に出る）。
 * 台帳を直せば次の実行でカレンダーも直る。カレンダー側で直しても台帳には戻らない（台帳が正）。
 *
 * 台帳の持ち主のGoogleアカウント（Airbnbのメールが届くアカウント）で作ること。
 * Gmailを読むのは、このスクリプトを作ったアカウントの受信箱だけ。
 *
 * スクリプトプロパティ（コードは公開リポジトリにも置くので、アドレスはここに書かない）
 *   NOTIFY_TO  … 通知メールを足す宛先（カンマ区切り）。スクリプトを作ったアカウントには何もしなくても送る
 *   calendarId … setupCalendar が自動で入れる。手で触らない
 *   CF_SYNC_URL   … Cloudflare版の予約管理（例 https://sayozuki-booking.xxx.workers.dev）。空なら同期しない
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
  // Googleカレンダー連携。予約をこの名前のカレンダーに書く（なければ自動で作る）。空にすると連携しない
  CALENDAR_NAME: '小夜月 予約',
};

// ===== シートの形 =====
const SHEETS = { RES: '予約', ROOMS: '部屋', AIRBNB: 'Airbnb', LOG: 'ログ' };

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
const LOG_COLS = ['日時', '種類', '予約番号', '件名', '結果', 'メッセージID', 'Gmail'];

const CHANNELS = ['Airbnb', '楽天', '直販'];
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
};
const DERIVED_TAGS = [TAG.DUP, TAG.ROOM_UNSET, TAG.NOT_FOR_SALE, TAG.OVER_CAP, TAG.TAX_CHILD];
const NOTIFY_DERIVED = [TAG.DUP, TAG.NOT_FOR_SALE, TAG.OVER_CAP];

const KIND_LABEL = { confirm: '予約確定', cancel: 'キャンセル', change: '予約変更' };
const CODE_RE = /HM[A-Z0-9]{8}(?![A-Z0-9])/;

// ===== 実行する関数 =====

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('スプレッドシートの「拡張機能 → Apps Script」から開いたエディタで実行して');
  ss.setSpreadsheetTimeZone('Asia/Tokyo');

  ensureSheet_(ss, SHEETS.RES, RES_COLS);
  const rooms = ensureSheet_(ss, SHEETS.ROOMS, ROOM_COLS);
  if (rooms.getLastRow() < 2) rooms.getRange(2, 1, ROOMS_INIT.length, ROOM_COLS.length).setValues(ROOMS_INIT);
  ensureSheet_(ss, SHEETS.AIRBNB, AIRBNB_COLS);
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

function dryRun() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss ? ss.getSpreadsheetTimeZone() : 'Asia/Tokyo';
  const found = searchAirbnbMail_(60, {});
  found.forEach(function (f) {
    const m = f.message;
    const refIso = Utilities.formatDate(m.getDate(), tz, 'yyyy-MM-dd');
    const p = parseMail_(f.kind, m.getSubject(), m.getPlainBody(), refIso);
    Logger.log(KIND_LABEL[f.kind] + '｜' + m.getSubject() + '\n' + JSON.stringify(p, null, 1));
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
    const log = loadTable_(mustSheet_(ss, SHEETS.LOG), LOG_COLS, [], tz, LOG_COLS.length);
    const ctx = makeCtx_(res, airbnb, rooms);
    const notes = [];
    const cf = cfConfig_();

    // 0. Cloudflare版のアプリで入れた予約を台帳に足す
    if (cf) pullFromCloudflare_(cf, ctx, todayIso, notes);

    const processed = {};
    log.rows.forEach(function (r) { const id = str_(r.v['メッセージID']); if (id) processed[id] = true; });

    // 1. Gmail
    const found = searchAirbnbMail_(opts.days, processed);
    let label = null;
    if (found.length) {
      try { label = GmailApp.getUserLabelByName(CONFIG.GMAIL_LABEL) || GmailApp.createLabel(CONFIG.GMAIL_LABEL); } catch (e) { label = null; }
    }
    found.forEach(function (f) {
      const m = f.message;
      const subject = m.getSubject();
      const refIso = Utilities.formatDate(m.getDate(), tz, 'yyyy-MM-dd');
      const link = 'https://mail.google.com/mail/?authuser=' + encodeURIComponent(me) + '#all/' + f.thread.getId();
      let p;
      try { p = parseMail_(f.kind, subject, m.getPlainBody(), refIso); }
      catch (e) { p = { ok: false, error: String((e && e.message) || e) }; }
      let result;
      if (p.ok) {
        try { result = applyMail_(ctx, p, refIso, notes); }
        catch (e) { result = '失敗：' + String((e && e.message) || e); notes.push('取り込みに失敗：' + subject + '\n  ' + link); }
      } else {
        result = '要手入力：' + p.error;
        notes.push('メールが読めなかった（' + KIND_LABEL[f.kind] + '）：' + subject + '\n  ' + link);
      }
      newRow_(log, {
        '日時': now, '種類': KIND_LABEL[f.kind], '予約番号': p.code || '', '件名': subject,
        '結果': result, 'メッセージID': m.getId(), 'Gmail': link,
      });
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
    saveTable_(log, tz);
    log.sheet.getRange('I1:J1').setValues([['最終実行', now]]);

    // 6. 台帳の中身を Cloudflare版に送る
    if (cf) pushToCloudflare_(cf, res, rooms, Utilities.formatDate(now, tz, 'yyyy/MM/dd HH:mm'), todayIso, notes);

    if (!opts.silent) sendNotes_(ss, notes);
    return { mails: found.length, notes: notes, calendar: calResult };
  } finally {
    lock.releaseLock();
  }
}

function searchAirbnbMail_(days, processed) {
  const q = 'from:automated@airbnb.com {subject:予約確定 subject:キャンセル subject:"ご予約が変更されました"} newer_than:' + days + 'd';
  const out = [];
  for (let start = 0; ; start += 100) {
    const threads = GmailApp.search(q, start, 100);
    threads.forEach(function (th) {
      th.getMessages().forEach(function (m) {
        if (processed[m.getId()]) return;
        if (!/airbnb\.com/i.test(m.getFrom())) return;
        const kind = classify_(m.getSubject());
        if (kind) out.push({ thread: th, message: m, kind: kind });
      });
    });
    if (threads.length < 100) break;
  }
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

function parseMail_(kind, subject, body, refIso) {
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
  const title = (tags.length ? '【要確認】' : '') + (str_(r.v['部屋']) || '部屋未設定') + '｜' + who +
    (people ? ' ' + people + '名' : '') + '（' + channel + '）';
  const desc = [
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
  const color = tags.length ? 'RED' : ({ 'Airbnb': 'ORANGE', '楽天': 'BLUE', '直販': 'YELLOW' }[channel] || 'GRAY');
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
    cfAppendPending_(ctx, got.bookings || []);
  } catch (e) {
    alertOnce_(cf.props, 'cfPullAlert', todayIso, notes, 'Cloudflare版から予約を受け取れなかった：' + String((e && e.message) || e));
  }
}

function cfAppendPending_(ctx, list) {
  let added = 0;
  list.forEach(function (b) {
    const no = str_(b['予約番号']);
    if (!no || ctx.byCode[no]) return;
    const vals = {};
    Object.keys(CF_FIELDS).forEach(function (h) {
      if (b[h] === undefined || b[h] === '') return;
      vals[h] = CF_NUMBER_COLS.indexOf(h) >= 0 && /^\d+$/.test(String(b[h])) ? Number(b[h]) : b[h];
    });
    ctx.byCode[no] = newRow_(ctx.res, vals);
    added++;
  });
  return added;
}

// 台帳の予約・部屋をまるごと送る（D1側は1回のトランザクションで置き換える）
function pushToCloudflare_(cf, res, rooms, lastImport, todayIso, notes) {
  try {
    cfFetch_(cf, '/api/sync/sheet', cfPayload_(res, rooms, lastImport));
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
  const l = lid && ctx.listings[lid];
  if (!str_(r.v['部屋']) && l && str_(l.v['部屋'])) set_(r, '部屋', str_(l.v['部屋']));
}

// ===== 台帳ルール（重複・準備中・定員・入湯税・泊数） =====

function applyRules_(ctx, todayIso, notes) {
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
    if (!room) tags.push(TAG.ROOM_UNSET + (lid ? ' 「Airbnb」タブでこのリスティングの部屋を選んで' : ' 部屋を選んで'));
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

function makeCtx_(res, airbnb, rooms) {
  const byCode = {};
  res.rows.forEach(function (r) { const c = str_(r.v['予約番号']); if (c) byCode[c] = r; });
  const listings = {};
  airbnb.rows.forEach(function (r) { const id = str_(r.v['リスティングID']); if (id) listings[id] = r; });
  const roomInfo = {};
  rooms.rows.forEach(function (r) {
    const n = str_(r.v['部屋']);
    if (n) roomInfo[n] = { cap: num_(r.v['定員']), state: str_(r.v['状態']) };
  });
  return { res: res, airbnb: airbnb, rooms: rooms, byCode: byCode, listings: listings, roomInfo: roomInfo };
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
