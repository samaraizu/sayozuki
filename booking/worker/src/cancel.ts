/**
 * 予約管理アプリの「キャンセル」（直販の予約だけ）。
 * - キャンセル料は Lib.cancelPolicy（7日前まで無料／6〜2日前30%／前日50%／当日・不泊100%）。支払額に掛ける
 * - HPで前払いの予約（hp_checkouts が paid）は、返金額を Square で返金する。額は画面で直せる（規定より多く返すときなど）
 * - 現地払い・未収の予約は返金しない。キャンセル料を請求するかは宿が決める（画面に額だけ出す）
 * - D1 の予約を「キャンセル」にし、台帳には取り込みGASが次の同期（5分以内）で反映する（cancellations.applied）
 * Airbnb・楽天の予約はそれぞれのサイトでキャンセルする（メールの取り込みで台帳に入る）
 */
import { Lib } from './lib.gen.js';
import { UserError, nowText, todayIso, type Env } from './env';
import { refundOrder } from './square';

export interface CancelForm {
  no?: string;
  /** 返金する額（円）。HPで前払いのときだけ使う。省略なら規定どおり */
  refund?: number | string;
  reason?: string;
}

export async function cancelBooking(env: Env, email: string, form: CancelForm, now = new Date()) {
  const no = String(form?.no ?? '').trim().slice(0, 40);
  const reason = String(form?.reason ?? '').trim().slice(0, 200);
  if (!no) throw new UserError('予約番号がない');

  const b = await env.DB.prepare('SELECT no, channel, status, room, check_in, check_out, name, guest_paid FROM bookings WHERE no = ?')
    .bind(no)
    .first<{ no: string; channel: string; status: string; room: string; check_in: string; check_out: string; name: string; guest_paid: string }>();
  if (!b) throw new UserError(`予約 ${no} が見つからない`);
  if (b.channel !== '直販') throw new UserError(`${b.channel || '媒体'}の予約は、そのサイトでキャンセルして`);
  if (b.status === 'キャンセル') throw new UserError('もうキャンセルになってる');
  if (b.status === '仮') throw new UserError('決済待ちの予約。30分で自動で取り消される');

  const today = todayIso(now);
  const policy = Lib.cancelPolicy(b.check_in, today);
  const hp = await env.DB.prepare("SELECT amount, order_id FROM hp_checkouts WHERE no = ? AND status = 'paid'")
    .bind(no)
    .first<{ amount: number; order_id: string }>();
  const paid = hp ? Number(hp.amount) : Lib.toInt(b.guest_paid);
  const rule = Lib.cancelAmounts(paid, policy.rate);

  let refund = 0;
  let refundId = '';
  if (hp) {
    const asked = form.refund === undefined || form.refund === '' ? rule.refund : Lib.toInt(form.refund);
    if (asked < 0 || asked > rule.paid) throw new UserError(`返金額は 0〜${rule.paid.toLocaleString('ja-JP')}円 で`);
    refund = asked;
    if (refund > 0) {
      try {
        const r = await refundOrder(env, { no, orderId: hp.order_id, amount: refund, reason: `小夜月 ${no} キャンセル` });
        refundId = r.id;
      } catch (e) {
        console.error('返金できなかった', no, e);
        throw new UserError('Square で返金できなかった。キャンセルはしていない。Square の管理画面を確かめて');
      }
    }
  }
  // キャンセル料：前払いなら「支払額−返金額」、前払いでなければ規定の額（請求するかは宿の判断）
  const fee = hp ? rule.paid - refund : rule.fee;
  const yen = (n: number) => n.toLocaleString('ja-JP') + '円';
  const note = hp
    ? `${nowText(now)} キャンセル（${policy.label}・規定${policy.rate}%）支払${yen(rule.paid)}・返金${yen(refund)}・キャンセル料${yen(fee)}${reason ? '・' + reason : ''}`
    : `${nowText(now)} キャンセル（${policy.label}・規定${policy.rate}%）規定のキャンセル料${yen(rule.fee)}（前払いなし。請求は宿の判断）${reason ? '・' + reason : ''}`;

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE bookings SET status = 'キャンセル', memo = CASE WHEN memo = '' THEN ?2 ELSE memo || char(10) || ?2 END,
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE no = ?1`,
    ).bind(no, note),
    env.DB.prepare(
      `INSERT INTO cancellations (no, actor, reason, days_before, rate, paid, fee, refund, refund_id, note)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
       ON CONFLICT(no) DO UPDATE SET at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), actor = excluded.actor, reason = excluded.reason,
         days_before = excluded.days_before, rate = excluded.rate, paid = excluded.paid, fee = excluded.fee,
         refund = excluded.refund, refund_id = excluded.refund_id, note = excluded.note, applied = 0`,
    ).bind(no, email, reason, policy.daysBefore, policy.rate, rule.paid, fee, refund, refundId, note),
    env.DB.prepare("INSERT INTO op_log (actor, action, no, detail) VALUES (?1, 'キャンセル', ?2, ?3)").bind(
      email,
      no,
      `${b.room} ${b.check_in}〜${b.check_out} ${b.name} ${note}`,
    ),
  ]);
  return { ok: true, no, rate: policy.rate, paid: rule.paid, refund, fee };
}
