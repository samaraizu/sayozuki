/**
 * 小夜月 予約受付（HP ⇄ 予約台帳）
 *
 * HP（Cloudflare Workers）から POST で呼ばれる受け口。できることは2つだけ。
 * - action なし          : ご予約フォームの申し込みを「問い合わせ」タブに1行足す
 * - action: availability : 部屋ごとの「埋まっている夜」を返す（HPの空室表示用。名前などは返さない）
 *
 * Googleログインのないサーバーから呼ぶので「自分として実行・全員がアクセス可」で配信し、
 * 中身の合言葉（INTAKE_SECRET）で照合する。予約管理の Webアプリとは別のプロジェクトにして、
 * 誰でも叩ける入口からは書き込み以外のことができないようにしている。
 *
 * 「予約」タブには書かない。問い合わせは空室確認前なので、既存GAS（Booking-System）が
 * 確定予約として扱わないよう、別のタブに置く。予約にするのは予約管理の画面から。
 *
 * スクリプトプロパティ（公開リポジトリなのでコードには書かない）
 * - SPREADSHEET_ID : 予約台帳のID
 * - INTAKE_SECRET  : HP側の BOOKING_INTAKE_SECRET と同じ値（長いランダム文字列）
 */

var SHEET_INQUIRIES = '問い合わせ';
// 予約管理の画面（booking/src/Code.js）と同じ見出し。列は見出し名でだけ触る
var INQUIRY_HEADERS = [
  '受付番号', '受付日時', '状態', '言語', 'お名前', 'メール', '電話',
  '到着日', '泊数', '人数', '希望の部屋', '食事', 'ご要望', '予約番号', '対応日時', '対応者'
];
var MEAL_TEXT = { none: '素泊まり', breakfast: '朝食付き', both: '1泊2食付き' };
var LIMITS = { name: 100, email: 200, tel: 50, room: 50, message: 2000, lang: 10 };
var AVAILABILITY_DAYS = 180; // 今日から何日先まで返すか
var CANCELLED = 'キャンセル';

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var secret = PropertiesService.getScriptProperties().getProperty('INTAKE_SECRET');
    if (!secret || !sameText_(String(body.secret || ''), secret)) return json_({ ok: false, message: 'forbidden' });

    if (body.action === 'availability') {
      return json_(availability_(SpreadsheetApp.openById(prop_('SPREADSHEET_ID'))));
    }

    var record = cleanRecord_(body.record || {});
    if (!record) return json_({ ok: false, message: 'bad record' });

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) return json_({ ok: false, message: 'busy' });
    try {
      var sheet = inquirySheet_(SpreadsheetApp.openById(prop_('SPREADSHEET_ID')));
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
      var idCol = headers.indexOf('受付番号');
      // 送り直し（タイムアウト後の再送など）で二重にしない
      if (idCol >= 0 && sheet.getLastRow() > 1) {
        var ids = sheet.getRange(2, idCol + 1, sheet.getLastRow() - 1, 1).getDisplayValues();
        for (var i = 0; i < ids.length; i++) if (ids[i][0] === record.id) return json_({ ok: true, duplicate: true });
      }
      sheet.appendRow(inquiryRow_(headers, record, Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm')));
    } finally {
      lock.releaseLock();
    }
    return json_({ ok: true });
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({ ok: false, message: 'error' });
  }
}

// 受付用のURLをブラウザで開いたとき用。何も返さない
function doGet() {
  return ContentService.createTextOutput('ok');
}

// ---------- 中身（GASのAPIを使わないので Node のテストでも動く） ----------

/** 届いた中身を台帳に入れてよい形にする。必須が欠けていれば null */
function cleanRecord_(r) {
  function text(v, max) { return String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max); }
  function int(v, min, max) {
    var n = parseInt(v, 10);
    if (isNaN(n)) return min;
    return Math.min(Math.max(n, min), max);
  }
  var id = text(r.id, 40);
  var name = text(r.name, LIMITS.name);
  var email = text(r.email, LIMITS.email);
  if (!/^HP-\d{8}-[0-9a-f]{6}$/.test(id) || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  var checkin = text(r.checkin, 10);
  return {
    id: id,
    lang: text(r.lang, LIMITS.lang),
    name: name,
    email: email,
    tel: text(r.tel, LIMITS.tel),
    checkin: /^\d{4}-\d{2}-\d{2}$/.test(checkin) ? checkin : '',
    nights: int(r.nights, 1, 30),
    guests: int(r.guests, 1, 20),
    room: text(r.room, LIMITS.room),
    meal: Object.prototype.hasOwnProperty.call(MEAL_TEXT, r.meal) ? MEAL_TEXT[r.meal] : '',
    message: text(r.message, LIMITS.message)
  };
}

/**
 * 見出しの並びに合わせて1行にする。文字は先頭に ' を付けて「文字として」入れる
 * （= や + で始まる入力が数式として動くのと、電話番号の先頭の0が消えるのを防ぐ）
 */
function inquiryRow_(headers, r, now) {
  function t(v) { return v === '' ? '' : "'" + v; }
  var values = {
    '受付番号': r.id,
    '受付日時': t(now),
    '状態': '未対応',
    '言語': r.lang,
    'お名前': t(r.name),
    'メール': t(r.email),
    '電話': t(r.tel),
    '到着日': t(r.checkin),
    '泊数': r.nights,
    '人数': r.guests,
    '希望の部屋': t(r.room),
    '食事': r.meal,
    'ご要望': t(r.message)
  };
  return headers.map(function (h) { return Object.prototype.hasOwnProperty.call(values, h) ? values[h] : ''; });
}

/**
 * 空室表示用。部屋ごとに、状態・定員と「埋まっている夜」（チェックイン日〜チェックアウト前日）を返す。
 * rooms   : 部屋タブの行 {部屋, 定員, 状態}
 * bookings: 予約タブの行 {部屋, ステータス, チェックイン, チェックアウト}
 * キャンセル以外はすべて埋まっている扱い（仮も含む）。部屋が空の予約は数えない
 */
function occupancy_(rooms, bookings, todayIso, days) {
  var until = addDays_(todayIso, days);
  var out = {};
  rooms.forEach(function (r) {
    var name = String(r['部屋'] || '').trim();
    if (!name) return;
    out[name] = { capacity: parseInt(r['定員'], 10) || 0, state: String(r['状態'] || '').trim() || '停止', booked: {} };
  });
  bookings.forEach(function (b) {
    var room = String(b['部屋'] || '').trim();
    if (!out[room] || String(b['ステータス'] || '').trim() === CANCELLED) return;
    var inIso = toIso_(b['チェックイン']), outIso = toIso_(b['チェックアウト']);
    if (!inIso || !outIso || inIso >= outIso) return;
    var night = inIso < todayIso ? todayIso : inIso;
    for (var i = 0; night < outIso && night < until && i < 400; i++) {
      out[room].booked[night] = true;
      night = addDays_(night, 1);
    }
  });
  return {
    ok: true,
    today: todayIso,
    until: until,
    rooms: Object.keys(out).map(function (name) {
      var r = out[name];
      return { name: name, capacity: r.capacity, state: r.state, booked: Object.keys(r.booked).sort() };
    })
  };
}

// "2026/11/07(土)" / "2026-11-07" を yyyy-MM-dd に。読めなければ ''
function toIso_(value) {
  var m = String(value === undefined || value === null ? '' : value).match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (!m) return '';
  var y = +m[1], mo = +m[2], d = +m[3];
  var dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return '';
  return dt.toISOString().slice(0, 10);
}

function addDays_(iso, n) {
  var p = iso.split('-');
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)).toISOString().slice(0, 10);
}

// 合言葉の照合（長さ以外で早く抜けない）
function sameText_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------- GAS ----------

function prop_(key) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error('スクリプトプロパティ ' + key + ' が未設定');
  return v;
}

function availability_(ss) {
  function table(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) throw new Error('タブ「' + name + '」がない');
    var values = sheet.getDataRange().getDisplayValues();
    var headers = values[0] || [];
    return values.slice(1).map(function (row) {
      var o = {};
      headers.forEach(function (h, i) { if (h) o[h] = row[i]; });
      return o;
    });
  }
  var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  return occupancy_(table('部屋'), table('予約'), today, AVAILABILITY_DAYS);
}

function inquirySheet_(ss) {
  var sheet = ss.getSheetByName(SHEET_INQUIRIES);
  if (sheet) return sheet;
  sheet = ss.insertSheet(SHEET_INQUIRIES, ss.getSheets().length);
  sheet.appendRow(INQUIRY_HEADERS);
  sheet.setFrozenRows(1);
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
