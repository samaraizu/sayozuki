/**
 * 小夜月 予約管理 Webアプリ（第1段：4週間カレンダー・手動入力）
 *
 * 予約台帳スプシの画面と入力だけを受け持つ。重複・定員超え・入湯税・
 * Googleカレンダー反映は既存GAS（Booking-System）の5分ごとの実行に任せる。
 *
 * 台帳のルール（既存GASが見出し名で列を読み、行番号で差分を書くため）
 * - 列は見出し名でだけ触る
 * - 並べ替え・行挿入・行削除はしない。新規は末尾に足すだけ
 *
 * スクリプトプロパティ（公開リポジトリなのでコードには書かない）
 * - SPREADSHEET_ID : 予約台帳のID
 * - ALLOWED_EMAILS : 入れる人のGoogleアカウント（カンマ区切り）
 */

var SHEET_BOOKINGS = '予約';
var SHEET_ROOMS = '部屋';
var SHEET_IMPORT_LOG = 'ログ';
var SHEET_AUDIT = '操作ログ';
var AUDIT_HEADERS = ['日時', '誰が', '操作', '予約番号', '内容'];
var TZ = 'Asia/Tokyo';

// 予約タブの見出し名 → 画面で使う名前
var BOOKING_FIELDS = {
  channel: '媒体',
  no: '予約番号',
  status: 'ステータス',
  flag: '要確認',
  room: '部屋',
  checkIn: 'チェックイン',
  checkOut: 'チェックアウト',
  adults: '大人',
  children: '子ども',
  infants: '乳幼児',
  name: '代表者名',
  contact: '連絡先',
  arrival: '到着予定',
  meals: '食事',
  guestPaid: 'ゲスト支払額',
  payment: '支払い状況',
  tax: '入湯税',
  taxCollected: '入湯税の徴収',
  url: '予約URL',
  memo: 'メモ'
};

function UserError(message) {
  this.message = message;
}

// ---------- 配信 ----------

function doGet() {
  // 許可画面で権限を1つずつ選べるので、台帳（スプシ）のチェックが外れたまま通ることがある。
  // 足りない権限があれば、ここで実行を止めて許可画面をもう一度出す
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
  var email = currentEmail_();
  if (!isAllowed_(email)) {
    var denied = HtmlService.createTemplateFromFile('Denied');
    denied.email = email;
    return denied.evaluate().setTitle('小夜月 予約').addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('小夜月 予約')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

function include_(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

// 画面にも同じ計算を載せる（lib.js の中身をそのまま渡す）
function libSource_() {
  return 'var Lib = (' + sayozukiLib.toString() + ')();';
}

// ---------- 画面から呼ぶ関数（google.script.run） ----------

function getBoard() {
  return api_(function (email) {
    var ss = openBook_();
    return {
      today: todayIso_(),
      user: email,
      rooms: readRooms_(ss),
      bookings: readBookings_(ss).map(publicBooking_),
      lastImport: readLastImport_(ss)
    };
  });
}

function createBooking(form) {
  return api_(function (email) {
    form = form || {};
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) throw new UserError('混み合ってる。少し待ってもう一度押して');
    try {
      var ss = openBook_();
      var today = todayIso_();
      var rooms = readRooms_(ss);
      var problem = Lib.validateManual(form, rooms, today);
      if (problem) throw new UserError(problem);

      var inIso = Lib.toIso(form.checkIn);
      var outIso = Lib.toIso(form.checkOut);
      var bookings = readBookings_(ss);
      // 保存の直前に、もう一度空室を確かめる
      var clash = Lib.roomAvailability(
        rooms.filter(function (r) { return r.name === form.room; }),
        bookings, inIso, outIso, Lib.toInt(form.people)
      )[0];
      if (!clash.available) {
        throw new UserError(form.room + 'はその日程で' + clash.status + '（' + clash.why + '）。カレンダーを開き直して');
      }

      var existing = {};
      bookings.forEach(function (b) { existing[b.no] = true; });
      var no = Lib.makeBookingNo(today, existing);
      var nights = Lib.nightsBetween(inIso, outIso);
      var price = Lib.toInt(form.price);
      var meals = [form.breakfast ? '朝食' : '', form.dinner ? '夕食' : ''].filter(String).join('・');

      appendByHeader_(ss.getSheetByName(SHEET_BOOKINGS), {
        '媒体': '直販',
        '予約番号': no,
        'ステータス': '確定',
        '部屋': form.room,
        'チェックイン': inIso,
        'チェックアウト': outIso,
        '大人': Lib.toInt(form.people),
        '代表者名': String(form.name).trim(),
        '連絡先': String(form.contact).trim(),
        '到着予定': String(form.arrival || ''),
        '食事': meals,
        'ゲスト支払額': price > 0 ? price * nights : '',
        '支払い状況': Lib.PAYMENTS[form.payment],
        '予約日': today,
        '更新日時': nowText_(),
        'メモ': String(form.memo || '').trim()
      });
      audit_(ss, email, '手動入力', no,
        form.room + ' ' + inIso + '〜' + outIso + ' ' + Lib.toInt(form.people) + '名 ' + String(form.name).trim());
      return { no: no };
    } finally {
      lock.releaseLock();
    }
  });
}

// ---------- 中身 ----------

function api_(fn) {
  try {
    var email = currentEmail_();
    if (!isAllowed_(email)) return { ok: false, message: 'このアカウントでは使えない（' + (email || '不明') + '）' };
    var result = fn(email) || {};
    result.ok = true;
    return result;
  } catch (e) {
    if (e instanceof UserError) return { ok: false, message: e.message };
    console.error(e && e.stack ? e.stack : e);
    return { ok: false, message: 'うまくいかなかった。時間をおいてもう一度試して（' + (e && e.message ? e.message : e) + '）' };
  }
}

function prop_(key) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error('スクリプトプロパティ ' + key + ' が未設定');
  return v;
}

function currentEmail_() {
  return String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
}

function isAllowed_(email) {
  if (!email) return false;
  var list = String(PropertiesService.getScriptProperties().getProperty('ALLOWED_EMAILS') || '')
    .split(',')
    .map(function (s) { return s.trim().toLowerCase(); })
    .filter(String);
  return list.indexOf(email) >= 0;
}

function openBook_() {
  return SpreadsheetApp.openById(prop_('SPREADSHEET_ID'));
}

function todayIso_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function nowText_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy/MM/dd HH:mm');
}

// 見出し行（1行目）を見て、2行目以降を {見出し名: 表示値} の配列にする
function readTable_(sheet) {
  if (!sheet) throw new Error('タブが見つからない');
  var values = sheet.getDataRange().getDisplayValues();
  var headers = values[0] || [];
  return values.slice(1).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { if (h) obj[h] = row[i]; });
    return obj;
  });
}

function readRooms_(ss) {
  return readTable_(ss.getSheetByName(SHEET_ROOMS))
    .filter(function (r) { return String(r['部屋'] || '').trim(); })
    .map(function (r) {
      return {
        name: String(r['部屋']).trim(),
        capacity: Lib.toInt(r['定員']),
        state: String(r['状態'] || '').trim() || '停止'
      };
    });
}

function readBookings_(ss) {
  return readTable_(ss.getSheetByName(SHEET_BOOKINGS))
    .filter(function (r) { return String(r['予約番号'] || '').trim() || String(r['部屋'] || '').trim(); })
    .map(function (r) {
      var b = {};
      Object.keys(BOOKING_FIELDS).forEach(function (k) { b[k] = String(r[BOOKING_FIELDS[k]] || '').trim(); });
      b.checkIn = Lib.toIso(b.checkIn);
      b.checkOut = Lib.toIso(b.checkOut);
      return b;
    });
}

// 画面に渡す形。URLは http(s) のときだけ
function publicBooking_(b) {
  var out = {};
  Object.keys(b).forEach(function (k) { out[k] = b[k]; });
  if (!/^https?:\/\//i.test(out.url)) out.url = '';
  return out;
}

// 既存GASの「ログ」タブ1行目にある「最終実行」の隣の値
function readLastImport_(ss) {
  var sheet = ss.getSheetByName(SHEET_IMPORT_LOG);
  if (!sheet) return '';
  var head = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  var i = head.indexOf('最終実行');
  return i >= 0 && i + 1 < head.length ? head[i + 1] : '';
}

// 見出し名で値を並べて末尾に1行足す。知らない見出しの列は空のまま
function appendByHeader_(sheet, record) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  Object.keys(record).forEach(function (key) {
    if (headers.indexOf(key) < 0) throw new Error('予約タブに「' + key + '」の列がない');
  });
  sheet.appendRow(headers.map(function (h) {
    return Object.prototype.hasOwnProperty.call(record, h) ? record[h] : '';
  }));
}

// 「誰が・いつ・何を」を操作ログタブに残す（タブがなければ末尾に作る）
function audit_(ss, email, action, no, detail) {
  var sheet = ss.getSheetByName(SHEET_AUDIT);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_AUDIT, ss.getSheets().length);
    sheet.appendRow(AUDIT_HEADERS);
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([nowText_(), email, action, no, detail]);
}
