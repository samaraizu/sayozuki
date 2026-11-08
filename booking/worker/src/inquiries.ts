/**
 * HPのお問い合わせ（D1 の inquiries）。
 * - addInquiry   : HPから（HpApi.addInquiry）。受付番号が同じなら二重に入れない
 * - openInquiries: 予約管理の画面（/api/board）に出す未対応のもの
 * - closeInquiry : 「見送り」
 * 「予約にする」で保存したときの 予約済み は db.ts の createBooking が同じバッチで付ける
 */
import { UserError, nowText, type Env } from './env';
import { notify } from './push';

const MEAL = { none: '素泊まり', breakfast: '朝食付き', both: '1泊2食付き' } as const;

export interface InquiryInput {
  id: string;
  lang: string;
  name: string;
  email: string;
  tel: string;
  checkin: string;
  nights: number;
  guests: number;
  room: string;
  /** none / breakfast / both */
  meal: string;
  message: string;
}

const clip = (v: unknown, n: number) =>
  String(v ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, n);
const int = (v: unknown, min: number, max: number) => {
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? min : Math.min(Math.max(n, min), max);
};

/** 入れてよい形にする。必須が欠けていれば null */
export function cleanInquiry(r: Partial<InquiryInput>) {
  const id = clip(r.id, 40);
  const name = clip(r.name, 100);
  const email = clip(r.email, 200);
  if (!/^HP-\d{8}-[0-9a-f]{6}$/.test(id) || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const checkin = clip(r.checkin, 10);
  const meal = String(r.meal ?? '');
  return {
    id,
    lang: clip(r.lang, 10) || 'ja',
    name,
    email,
    tel: clip(r.tel, 50),
    checkIn: /^\d{4}-\d{2}-\d{2}$/.test(checkin) ? checkin : '',
    nights: int(r.nights, 1, 30),
    guests: int(r.guests, 1, 20),
    room: clip(r.room, 50),
    meal: Object.prototype.hasOwnProperty.call(MEAL, meal) ? MEAL[meal as keyof typeof MEAL] : '',
    message: clip(r.message, 2000),
  };
}

export async function addInquiry(env: Env, input: InquiryInput): Promise<{ ok: boolean; duplicate?: boolean }> {
  const q = cleanInquiry(input);
  if (!q) return { ok: false };
  const res = await env.DB.prepare(
    `INSERT INTO inquiries (id, received_at, lang, name, email, tel, check_in, nights, guests, room, meal, message)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12) ON CONFLICT(id) DO NOTHING`,
  )
    .bind(q.id, nowText(), q.lang, q.name, q.email, q.tel, q.checkIn, q.nights, q.guests, q.room, q.meal, q.message)
    .run();
  if (res.meta.changes) {
    const when = q.checkIn ? `${+q.checkIn.slice(5, 7)}/${+q.checkIn.slice(8)}〜${q.nights}泊 ` : '';
    await notify(env, '小夜月 予約：HPからの問い合わせ', `${q.name}様 ${when}${q.guests}名${q.room ? ' ' + q.room : ''}`);
  }
  return { ok: true, duplicate: !res.meta.changes };
}

/** 画面（App.html の inquiries）と同じ形 */
export async function openInquiries(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT id, received_at AS receivedAt, status, lang, name, email, tel, check_in AS checkIn, nights, guests, room, meal, message
       FROM inquiries WHERE status = '未対応' ORDER BY received_at DESC LIMIT 200`,
    )
    .all<Record<string, string | number>>();
  return results;
}

export async function closeInquiry(env: Env, email: string, body: { id?: string; reason?: string }) {
  const id = clip(body?.id, 40);
  const reason = clip(body?.reason, 200);
  if (!id) throw new UserError('問い合わせが選ばれていない');
  const row = await env.DB.prepare('SELECT name, status FROM inquiries WHERE id = ?').bind(id).first<{ name: string; status: string }>();
  if (!row) throw new UserError(`問い合わせ ${id} が見つからない`);
  if (row.status !== '未対応') throw new UserError(`この問い合わせはもう「${row.status}」になってる`);
  const [res] = await env.DB.batch([
    env.DB.prepare(
      "UPDATE inquiries SET status = '見送り', handled_at = ?2, handled_by = ?3 WHERE id = ?1 AND status = '未対応'",
    ).bind(id, nowText(), email),
    env.DB.prepare("INSERT INTO op_log (actor, action, no, detail) VALUES (?1, '問い合わせを見送り', '', ?2)").bind(
      email,
      `${id} ${row.name}${reason ? ' ' + reason : ''}`,
    ),
  ]);
  if (!res.meta.changes) throw new UserError('ほかの人が先に対応した。画面を開き直して');
  return { ok: true, id };
}
