/**
 * 予約の「食事」をあとから手で入れる（予約の中身 →「食事を入れる」）。
 * - Airbnb：予約が入った時点でメッセージで聞き、その答えを入れる（Airbnbには食事の申込欄がない）
 * - HP・ほかのサイト：申込のときにお客様が選んでいるので、直すときだけ使う
 * 当日になって言われても用意できないので、お客様が自分で食事を足す入口は作らない
 * D1 の食事をすぐ書き換え、台帳には取り込みGASが次の同期（5分以内）で書く（meal_plans.applied）
 */
import { Lib } from './lib.gen.js';
import { UserError, todayIso, type Env } from './env';

export interface MealForm {
  no?: string;
  plan?: { dinner?: number | string; breakfast?: number | string }[];
  note?: string;
}

export async function setMeals(env: Env, email: string, form: MealForm, now = new Date()) {
  const no = String(form?.no ?? '').trim().slice(0, 40);
  const note = String(form?.note ?? '').trim().slice(0, 100);
  if (!no) throw new UserError('予約番号がない');

  const b = await env.DB.prepare('SELECT no, status, room, check_in, check_out, name, meals FROM bookings WHERE no = ?')
    .bind(no)
    .first<{ no: string; status: string; room: string; check_in: string; check_out: string; name: string; meals: string }>();
  if (!b) throw new UserError(`予約 ${no} が見つからない`);
  if (b.status === Lib.CANCELLED) throw new UserError('キャンセルになった予約');
  if (b.status === '仮') throw new UserError('決済待ちの予約。払われてから入れて');
  const nights = Lib.nightsBetween(b.check_in, b.check_out);
  if (nights < 1 || nights > 60) throw new UserError('日程がおかしい予約。台帳を確かめて');
  if (b.check_out < todayIso(now)) throw new UserError('もう終わった予約');
  if (!Array.isArray(form?.plan) || form.plan.length !== nights) throw new UserError('泊数と食事の行の数が合わない。開き直して');

  const plan = Lib.cleanMealPlan(form.plan, nights);
  const meals = Lib.mealText(b.check_in, plan, note);
  await env.DB.batch([
    env.DB.prepare(`UPDATE bookings SET meals = ?2, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE no = ?1`).bind(no, meals),
    env.DB.prepare(
      `INSERT INTO meal_plans (no, meals, plan, note, actor) VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(no) DO UPDATE SET meals = excluded.meals, plan = excluded.plan, note = excluded.note, actor = excluded.actor,
         at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), applied = 0`,
    ).bind(no, meals, JSON.stringify(plan), note, email),
    env.DB.prepare("INSERT INTO op_log (actor, action, no, detail) VALUES (?1, '食事', ?2, ?3)").bind(
      email,
      no,
      `${b.room} ${b.check_in}〜${b.check_out} ${b.name} ${b.meals || '（空）'} → ${meals}`,
    ),
  ]);
  return { ok: true, no, meals };
}

/** 画面で前の入力を出すため。台帳で食事が書き換えられていたら（meals が違えば）使わない */
export async function readMealPlans(db: D1Database, sinceIso: string) {
  const { results } = await db
    .prepare(
      `SELECT m.no AS no, m.meals AS meals, m.plan AS plan, m.note AS note FROM meal_plans m JOIN bookings b ON b.no = m.no
       WHERE b.check_out >= ? AND b.meals = m.meals`,
    )
    .bind(sinceIso)
    .all<{ no: string; meals: string; plan: string; note: string }>();
  return results.map((r) => {
    let plan: unknown = [];
    try { plan = JSON.parse(r.plan); } catch {}
    return { no: r.no, meals: r.meals, plan, note: r.note };
  });
}
