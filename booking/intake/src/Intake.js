/**
 * 小夜月 予約受付（HP ⇄ 予約台帳）
 *
 * HP（Cloudflare Workers）から POST で呼ばれる受け口。お問い合わせフォームの申し込みを
 * 「問い合わせ」タブに1行足すことだけをする。（空室は予約管理の Worker から取る）
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

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var secret = PropertiesService.getScriptProperties().getProperty('INTAKE_SECRET');
    if (!secret || !sameText_(String(body.secret || ''), secret)) return json_({ ok: false, message: 'forbidden' });

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
