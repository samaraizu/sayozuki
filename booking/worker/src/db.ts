import { Lib, type Room } from './lib.gen.js';
import { UserError, nowText, todayIso, type Env } from './env';
import { openInquiries } from './inquiries';
import { notify, summarizeNotes } from './push';

// 画面・同期で使う名前 → D1の列 → スプシの見出し
export const FIELDS = [
  ['channel', 'channel', '媒体'],
  ['no', 'no', '予約番号'],
  ['status', 'status', 'ステータス'],
  ['flag', 'flag', '要確認'],
  ['room', 'room', '部屋'],
  ['checkIn', 'check_in', 'チェックイン'],
  ['checkOut', 'check_out', 'チェックアウト'],
  ['adults', 'adults', '大人'],
  ['children', 'children', '子ども'],
  ['infants', 'infants', '乳幼児'],
  ['name', 'name', '代表者名'],
  ['contact', 'contact', '連絡先'],
  ['arrival', 'arrival', '到着予定'],
  ['meals', 'meals', '食事'],
  ['guestPaid', 'guest_paid', 'ゲスト支払額'],
  ['payment', 'payment', '支払い状況'],
  ['tax', 'tax', '入湯税'],
  ['taxCollected', 'tax_collected', '入湯税の徴収'],
  ['url', 'url', '予約URL'],
  ['memo', 'memo', 'メモ'],
  ['bookedOn', 'booked_on', '予約日'],
] as const;

type Key = (typeof FIELDS)[number][0];
export type Booking = Record<Key, string>;
type Row = Record<string, string | number | null>;

const SELECT_COLS = FIELDS.map(([k, c]) => `${c} AS ${k}`).join(', ');

function toBooking(r: Row): Booking {
  const b = {} as Booking;
  for (const [k] of FIELDS) b[k] = r[k] === null || r[k] === undefined ? '' : String(r[k]);
  return b;
}

// ---------- 画面 ----------

export async function readRooms(db: D1Database): Promise<Room[]> {
  const { results } = await db.prepare('SELECT name, capacity, state FROM rooms ORDER BY sort, name').all<Room>();
  return results.map((r) => ({ name: String(r.name), capacity: Number(r.capacity) || 0, state: String(r.state || '停止') }));
}

export async function readBookings(db: D1Database, sinceIso: string): Promise<Booking[]> {
  const { results } = await db
    .prepare(`SELECT ${SELECT_COLS} FROM bookings WHERE check_out >= ? OR check_out = '' ORDER BY check_in, id`)
    .bind(sinceIso)
    .all<Row>();
  return results.map(toBooking).map((b) => ({ ...b, url: /^https?:\/\//i.test(b.url) ? b.url : '' }));
}

export async function getBoard(env: Env, email: string) {
  const today = todayIso();
  const [rooms, bookings, meta, inquiries] = await Promise.all([
    readRooms(env.DB),
    // カレンダーは今日から先しか出さない。重なりの判定に足りるよう少し前から
    readBookings(env.DB, Lib.addDays(today, -62)),
    env.DB.prepare("SELECT value FROM meta WHERE key = 'lastImport'").first<{ value: string }>(),
    openInquiries(env.DB),
  ]);
  return { ok: true, today, user: email, rooms, bookings, lastImport: meta ? meta.value : '', inquiries };
}

// ---------- 手動入力 ----------

export interface ManualForm {
  checkIn?: string; checkOut?: string; people?: number | string; room?: string;
  name?: string; contact?: string; arrival?: string; price?: string | number;
  payment?: string; breakfast?: boolean; dinner?: boolean; memo?: string;
  /** HPのお問い合わせから「予約にする」で来たとき。保存と同時に 予約済み にする */
  inquiryId?: string;
}

export async function createBooking(env: Env, email: string, form: ManualForm, random?: () => number) {
  form = form || {};
  const today = todayIso();
  const rooms = await readRooms(env.DB);
  const problem = Lib.validateManual(form as Record<string, unknown>, rooms, today);
  if (problem) throw new UserError(problem);

  const inIso = Lib.toIso(form.checkIn);
  const outIso = Lib.toIso(form.checkOut);
  const people = Lib.toInt(form.people);
  const nights = Lib.nightsBetween(inIso, outIso);
  const price = Lib.toInt(form.price);
  const meals = [form.breakfast ? '朝食' : '', form.dinner ? '夕食' : ''].filter(Boolean).join('・');
  const name = String(form.name || '').trim();
  const contact = String(form.contact || '').trim();
  const memo = String(form.memo || '').trim();
  const room = String(form.room);
  const inquiryId = String(form.inquiryId || '').trim().slice(0, 40);
  if (inquiryId) {
    const q = await env.DB.prepare('SELECT status FROM inquiries WHERE id = ?').bind(inquiryId).first<{ status: string }>();
    if (!q) throw new UserError(`問い合わせ ${inquiryId} が見つからない`);
    if (q.status !== '未対応') throw new UserError(`この問い合わせはもう「${q.status}」になってる。画面を開き直して`);
  }

  const prefix = 'SZ-' + today.replace(/-/g, '') + '-';
  const { results } = await env.DB.prepare('SELECT no FROM bookings WHERE no LIKE ?').bind(prefix + '%').all<{ no: string }>();
  const existing: Record<string, boolean> = {};
  for (const r of results) existing[r.no] = true;
  const no = Lib.makeBookingNo(today, existing, random);

  // 空室の確認と書き込みを1つの文で。重なる予約がある・部屋が売れない状態なら1行も入らない
  const insert = env.DB.prepare(
    `INSERT INTO bookings (no, source, channel, status, room, check_in, check_out, adults, name, contact, arrival, meals,
       guest_paid, payment, memo, booked_on, created_by)
     SELECT ?1, 'app', '直販', '確定', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14
     WHERE EXISTS (SELECT 1 FROM rooms WHERE name = ?2 AND state = '販売可' AND capacity >= ?15)
       AND NOT EXISTS (
         SELECT 1 FROM bookings
         WHERE room = ?2 AND status <> 'キャンセル' AND check_in <> '' AND check_out <> ''
           AND check_in < ?4 AND ?3 < check_out
       )`,
  ).bind(
    no, room, inIso, outIso, String(people), name, contact, String(form.arrival || ''), meals,
    price > 0 ? String(price * nights) : '', Lib.PAYMENTS[String(form.payment)], memo, today, email, people,
  );
  const audit = env.DB.prepare(
    `INSERT INTO op_log (actor, action, no, detail)
     SELECT ?1, ?4, ?2, ?3 WHERE EXISTS (SELECT 1 FROM bookings WHERE no = ?2 AND source = 'app' AND created_by = ?1)`,
  ).bind(email, no, `${room} ${inIso}〜${outIso} ${people}名 ${name}${inquiryId ? `（${inquiryId}）` : ''}`, inquiryId ? '問い合わせから予約' : '手動入力');
  // 問い合わせから来たなら、予約が入ったときだけ 予約済み にする
  const markInquiry = env.DB.prepare(
    `UPDATE inquiries SET status = '予約済み', booking_no = ?2, handled_at = ?3, handled_by = ?4
     WHERE id = ?1 AND status = '未対応' AND EXISTS (SELECT 1 FROM bookings WHERE no = ?2 AND source = 'app' AND created_by = ?4)`,
  ).bind(inquiryId, no, nowText(), email);

  const [res] = await env.DB.batch(inquiryId ? [insert, audit, markInquiry] : [insert, audit]);
  if (!res.meta.changes) {
    // なぜ入らなかったかを、画面と同じ言い方で返す
    const bookings = await readBookings(env.DB, Lib.addDays(today, -62));
    const a = Lib.roomAvailability(rooms.filter((r) => r.name === room), bookings, inIso, outIso, people)[0];
    const why = a && !a.available ? `${room}はその日程で${a.status}${a.why ? '（' + a.why + '）' : ''}` : `${room}に入れられなかった`;
    throw new UserError(why + '。カレンダーを開き直して');
  }
  return { ok: true, no };
}

// ---------- 取り込みGASとの同期（移行中だけ） ----------

export interface SyncPayload {
  rooms: { name: string; capacity: number | string; state: string }[];
  bookings: Partial<Booking>[];
  lastImport?: string;
  /** この回に取り込みGASが通知メールで送った文（新しい予約・要確認など）。同じものをスマホにも出す */
  notes?: string[];
}

/** アプリで入れて、まだスプシに載っていない予約（GASがスプシに足す）。スプシの見出し名で返す */
export async function pendingForSheet(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT ${SELECT_COLS}, created_at AS createdAt FROM bookings WHERE source = 'app' AND in_sheet = 0
       -- HPの予約は払われるまで送らない（決済待ちの仮でカレンダーや通知が出ないように）
       AND NOT EXISTS (SELECT 1 FROM hp_checkouts h WHERE h.no = bookings.no AND h.status <> 'paid')
     ORDER BY id`,
  ).all<Row>();
  // アプリでキャンセルにした、台帳に載っている予約。GASが台帳のステータスを「キャンセル」にし、メモに1行足す
  const cancels = await env.DB.prepare(
    `SELECT c.no AS no, c.note AS note FROM cancellations c JOIN bookings b ON b.no = c.no
     WHERE c.applied = 0 AND b.in_sheet = 1 ORDER BY c.at`,
  ).all<{ no: string; note: string }>();
  return {
    ok: true,
    bookings: results.map((r) => {
      const b = toBooking(r);
      const out: Record<string, string> = {};
      for (const [k, , sheet] of FIELDS) if (b[k] !== '') out[sheet] = b[k];
      return out;
    }),
    cancels: cancels.results.map((c) => ({ '予約番号': c.no, 'メモ': c.note })),
  };
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());

/**
 * スプシの中身でD1を上書きする。1回のバッチ（＝1つのトランザクション）でやるので、途中で止まっても半端にならない。
 * - 予約番号のある行：同じ番号があれば上書き（アプリで入れた予約なら in_sheet=1 にする）、なければ足す。スプシ内で番号が重なれば後の行
 * - 予約番号のない行：毎回入れ直す
 * - 今回のスプシにない行（スプシ由来・スプシに載ったことのあるアプリ由来）は消す
 * - まだスプシに載っていないアプリの予約は触らない
 */
export async function syncFromSheet(env: Env, body: SyncPayload) {
  const rooms = Array.isArray(body?.rooms) ? body.rooms.filter((r) => str(r.name)) : [];
  const bookings = Array.isArray(body?.bookings)
    ? body.bookings.filter((b) => str(b.no) || str(b.room) || str(b.checkIn))
    : [];
  if (!rooms.length) throw new UserError('部屋が0件。送り元の読み込みがおかしいので同期しない');

  const current = await env.DB.prepare("SELECT COUNT(*) AS n FROM bookings WHERE source = 'sheet' OR in_sheet = 1").first<{ n: number }>();
  const before = current ? Number(current.n) : 0;
  // 読み込みの失敗で台帳を丸ごと消さないための歯止め
  if (before >= 10 && bookings.length < before / 2) {
    throw new UserError(`予約が ${before} 件から ${bookings.length} 件に減る。送り元を確かめるまで同期しない`);
  }

  const genRow = await env.DB.prepare("SELECT value FROM meta WHERE key = 'syncGen'").first<{ value: string }>();
  const gen = (genRow ? Number(genRow.value) : 0) + 1;

  // 行ごとに文を作ると無料プランの「1回あたり50クエリ」を超えるので、
  // 全行を1つのJSONで渡し、SQLite の json_each で1文にまとめて書く
  const rows = bookings.map((b) => {
    const o: Record<string, string | null> = {};
    for (const [k, c] of FIELDS) o[c] = k === 'checkIn' || k === 'checkOut' || k === 'bookedOn' ? Lib.toIso(b[k]) : str(b[k]);
    if (!o.no) o.no = null; // 予約番号のない行は NULL（UNIQUE にかからない）
    return o;
  });
  const cols = FIELDS.map(([, c]) => c);
  const upsert = `INSERT INTO bookings (${cols.join(', ')}, source, in_sheet, seen)
    SELECT ${cols.map((c) => `json_extract(value, '$.${c}')`).join(', ')}, 'sheet', 1, ?2 FROM json_each(?1) WHERE true
    ON CONFLICT(no) DO UPDATE SET ${cols.filter((c) => c !== 'no').map((c) => `${c} = excluded.${c}`).join(', ')},
      in_sheet = 1, seen = excluded.seen, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`;
  const roomRows = rooms.map((r, i) => ({ name: str(r.name), capacity: Lib.toInt(r.capacity), state: str(r.state) || '停止', sort: i }));
  const metaRows = [
    { key: 'syncGen', value: String(gen) },
    { key: 'lastSync', value: nowText() },
    ...(str(body.lastImport) ? [{ key: 'lastImport', value: str(body.lastImport) }] : []),
  ];

  const stmts: D1PreparedStatement[] = [
    env.DB.prepare(upsert).bind(JSON.stringify(rows), gen),
    env.DB.prepare("DELETE FROM bookings WHERE (source = 'sheet' OR in_sheet = 1) AND seen <> ?").bind(gen),
    // アプリでのキャンセル：台帳もキャンセルになっていれば反映済み。まだなら台帳の値で戻さない
    env.DB.prepare(
      `UPDATE cancellations SET applied = 1
       WHERE applied = 0 AND no IN (SELECT no FROM bookings WHERE status = 'キャンセル' AND in_sheet = 1)`,
    ),
    env.DB.prepare("UPDATE bookings SET status = 'キャンセル' WHERE no IN (SELECT no FROM cancellations WHERE applied = 0)"),
    env.DB.prepare('DELETE FROM rooms'),
    env.DB.prepare(
      `INSERT INTO rooms (name, capacity, state, sort)
       SELECT json_extract(value, '$.name'), json_extract(value, '$.capacity'), json_extract(value, '$.state'), json_extract(value, '$.sort')
       FROM json_each(?1) WHERE true ON CONFLICT(name) DO NOTHING`,
    ).bind(JSON.stringify(roomRows)),
    env.DB.prepare(
      `INSERT INTO meta (key, value) SELECT json_extract(value, '$.key'), json_extract(value, '$.value') FROM json_each(?1) WHERE true
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).bind(JSON.stringify(metaRows)),
  ];
  await env.DB.batch(stmts);
  const n = summarizeNotes(body.notes);
  if (n) await notify(env, n.title, n.body);
  const after = await env.DB.prepare('SELECT COUNT(*) AS n FROM bookings').first<{ n: number }>();
  return { ok: true, gen, rooms: rooms.length, received: bookings.length, total: after ? Number(after.n) : 0 };
}
