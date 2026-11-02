/**
 * サーバー（GAS）と画面の両方で使う計算。
 * 画面側へは doGet で sayozukiLib.toString() をそのまま埋め込むので、
 * この関数の中では GAS の API（SpreadsheetApp など）を使わないこと。
 */
function sayozukiLib() {
  var CANCELLED = 'キャンセル';
  var SELLABLE = '販売可';
  var WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  // "2026-11-07" / "2026/11/07(土)" / "2026/11/7" を yyyy-MM-dd に。読めなければ ''
  function toIso(value) {
    if (value === null || value === undefined) return '';
    var m = String(value).match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
    if (!m) return '';
    var y = +m[1], mo = +m[2], d = +m[3];
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return '';
    return y + '-' + pad2(mo) + '-' + pad2(d);
  }

  function isoToUtc(iso) {
    var p = iso.split('-');
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }

  function addDays(iso, n) {
    var dt = new Date(isoToUtc(iso) + n * 86400000);
    return dt.getUTCFullYear() + '-' + pad2(dt.getUTCMonth() + 1) + '-' + pad2(dt.getUTCDate());
  }

  function nightsBetween(inIso, outIso) {
    if (!inIso || !outIso) return 0;
    return Math.round((isoToUtc(outIso) - isoToUtc(inIso)) / 86400000);
  }

  function weekday(iso) {
    return WEEKDAYS[new Date(isoToUtc(iso)).getUTCDay()];
  }

  // 11/7（土）
  function shortLabel(iso) {
    var p = iso.split('-');
    return (+p[1]) + '/' + (+p[2]) + '（' + weekday(iso) + '）';
  }

  // 既存GASと同じ重なり判定：自分のIN < 相手のOUT かつ 相手のIN < 自分のOUT
  function overlaps(aIn, aOut, bIn, bOut) {
    return aIn < bOut && bIn < aOut;
  }

  function toInt(value) {
    var n = parseInt(String(value === undefined || value === null ? '' : value).replace(/[^0-9\-]/g, ''), 10);
    return isNaN(n) ? 0 : n;
  }

  function isActive(b) {
    return b.status !== CANCELLED && !!b.checkIn && !!b.checkOut && b.checkIn < b.checkOut;
  }

  function people(b) {
    return toInt(b.adults) + toInt(b.children) + toInt(b.infants);
  }

  // AirbnbのiCal由来などで名前か人数が空の予約
  function needsInput(b) {
    var name = String(b.name || '').trim();
    return !name || name === 'Reserved' || people(b) === 0;
  }

  // 窮屈アラート：2名以上 × 2泊以上（止めはしない）
  function isTight(peopleCount, nights) {
    return peopleCount >= 2 && nights >= 2;
  }

  // 同じ部屋で日程が重なっている組。first = 最初に重なる夜
  function findConflicts(bookings) {
    var active = bookings.filter(isActive);
    var out = [];
    for (var i = 0; i < active.length; i++) {
      for (var j = i + 1; j < active.length; j++) {
        var a = active[i], b = active[j];
        if (a.room !== b.room) continue;
        if (!overlaps(a.checkIn, a.checkOut, b.checkIn, b.checkOut)) continue;
        out.push({ room: a.room, first: a.checkIn > b.checkIn ? a.checkIn : b.checkIn, a: a, b: b });
      }
    }
    out.sort(function (x, y) { return x.first < y.first ? -1 : x.first > y.first ? 1 : 0; });
    return out;
  }

  /**
   * 手動入力の部屋カード用。部屋ごとに入れられるかと、その理由を返す。
   * rooms: [{ name, capacity, state }]
   */
  function roomAvailability(rooms, bookings, inIso, outIso, peopleCount) {
    var okDates = nightsBetween(inIso, outIso) > 0;
    var active = bookings.filter(isActive);
    return rooms.map(function (r) {
      var res = { name: r.name, capacity: r.capacity, state: r.state, available: false, status: '', why: '', clash: null };
      if (r.state !== SELLABLE) {
        res.status = r.state || '停止';
        res.why = '今は売らない部屋';
        return res;
      }
      if (!okDates) {
        res.status = '—';
        res.why = '日付を入れて';
        return res;
      }
      var hit = null;
      for (var i = 0; i < active.length; i++) {
        var b = active[i];
        if (b.room === r.name && overlaps(inIso, outIso, b.checkIn, b.checkOut)) { hit = b; break; }
      }
      if (hit) {
        res.status = '埋まってる';
        res.why = (hit.channel || '') + ' ' + shortLabel(hit.checkIn).replace(/（.）/, '') + '〜' + shortLabel(hit.checkOut).replace(/（.）/, '');
        res.clash = hit;
        return res;
      }
      if (peopleCount > r.capacity) {
        res.status = '人数が入らない';
        res.why = '定員' + r.capacity + 'まで';
        return res;
      }
      res.available = true;
      res.status = '空いてる';
      res.why = '';
      return res;
    });
  }

  /**
   * カレンダーの並べ方。部屋ごとに、表示範囲に入る予約を帯にして段（lane）に振る。
   * 帯は泊まる夜の列にかかる（チェックアウト日の列にはかからない）。
   */
  function layoutWeek(rooms, bookings, startIso, days) {
    var endIso = addDays(startIso, days);
    var active = bookings.filter(isActive);
    return rooms.map(function (r) {
      var mine = active
        .filter(function (b) { return b.room === r.name && overlaps(b.checkIn, b.checkOut, startIso, endIso); })
        .sort(function (a, b) { return a.checkIn < b.checkIn ? -1 : a.checkIn > b.checkIn ? 1 : 0; });
      var laneEnds = [];
      var bars = mine.map(function (b) {
        var from = b.checkIn > startIso ? b.checkIn : startIso;
        var to = b.checkOut < endIso ? b.checkOut : endIso;
        var lane = 0;
        while (laneEnds[lane] && laneEnds[lane] > b.checkIn) lane++;
        laneEnds[lane] = b.checkOut;
        return {
          booking: b,
          col: nightsBetween(startIso, from),
          span: nightsBetween(from, to),
          clipStart: b.checkIn < startIso,
          clipEnd: b.checkOut > endIso,
          lane: lane
        };
      });
      var clashDays = [];
      for (var d = 0; d < days; d++) {
        var night = addDays(startIso, d);
        var count = mine.filter(function (b) { return b.checkIn <= night && night < b.checkOut; }).length;
        clashDays.push(count > 1);
      }
      return { room: r, bars: bars, lanes: Math.max(1, laneEnds.length), clashDays: clashDays };
    });
  }

  // 直販の予約番号：SZ-yyyyMMdd-乱数4桁。既存と被ったら引き直す
  function makeBookingNo(todayIso, existing, random) {
    var rnd = random || Math.random;
    var base = 'SZ-' + todayIso.replace(/-/g, '') + '-';
    for (var i = 0; i < 50; i++) {
      var no = base + String(Math.floor(rnd() * 10000) + 10000).slice(1);
      if (!existing[no]) return no;
    }
    throw new Error('予約番号が作れなかった');
  }

  var PAYMENTS = { '当日Square': '現地でSquare', 'あとで決める': '未収' };

  // 手動入力の中身チェック。問題なければ ''
  function validateManual(form, rooms, todayIso) {
    var inIso = toIso(form.checkIn), outIso = toIso(form.checkOut);
    if (!inIso || !outIso) return '日程を入れて';
    if (nightsBetween(inIso, outIso) <= 0) return 'チェックアウトがチェックインより前になってる';
    if (nightsBetween(inIso, outIso) > 60) return '60泊を超える予約は入れられない';
    if (todayIso && inIso < todayIso) return '過ぎた日のチェックインは入れられない';
    var room = null;
    for (var i = 0; i < rooms.length; i++) if (rooms[i].name === form.room) room = rooms[i];
    if (!room) return '部屋を選んで';
    if (room.state !== SELLABLE) return room.name + 'は今売ってない';
    var n = toInt(form.people);
    if (n < 1) return '人数を入れて';
    if (n > room.capacity) return room.name + 'は定員' + room.capacity + 'まで';
    if (!String(form.name || '').trim()) return 'ゲスト名を入れて';
    if (!String(form.contact || '').trim()) return '連絡先を入れて';
    if (!PAYMENTS[form.payment]) return '支払いを選んで';
    if (String(form.name).length > 100 || String(form.contact).length > 200 || String(form.memo || '').length > 1000) {
      return '入力が長すぎる';
    }
    return '';
  }

  return {
    CANCELLED: CANCELLED,
    SELLABLE: SELLABLE,
    PAYMENTS: PAYMENTS,
    toIso: toIso,
    addDays: addDays,
    nightsBetween: nightsBetween,
    weekday: weekday,
    shortLabel: shortLabel,
    overlaps: overlaps,
    toInt: toInt,
    isActive: isActive,
    people: people,
    needsInput: needsInput,
    isTight: isTight,
    findConflicts: findConflicts,
    roomAvailability: roomAvailability,
    layoutWeek: layoutWeek,
    makeBookingNo: makeBookingNo,
    validateManual: validateManual
  };
}

var Lib = sayozukiLib();
