"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { startReservation, type ReserveState } from "@/app/reserve-actions";
import { addDays, roomStatus, type Availability, type RoomStatus } from "@/lib/availability";
import { fmt, formatYen, htmlLang, type Dict, type Locale } from "@/lib/i18n";
import { isBusyNight, quote, type MealPlan } from "@/lib/pricing";
import { ARRIVAL_TIMES, HOLD_MINUTES } from "@/lib/reserve-config";
import { bookingRules, meals, rooms } from "@/lib/site";

type Avail = { status: "loading" | "error" } | { status: "ready"; data: Availability };

const initial: ReserveState = {};
const field =
  "mt-1.5 h-12 w-full rounded-xl border border-steel bg-mist px-3 text-[16px] text-navy outline-none focus:border-sea focus:ring-2 focus:ring-sea/20";
const card = "rounded-[22px] bg-white p-5 shadow-soft md:p-7";

const STATUS_KEY = {
  free: "availFree",
  full: "availFull",
  over: "availOver",
  closed: "availClosed",
  unknown: "availUnknown",
} as const satisfies Record<RoomStatus, keyof Dict["form"]>;

const isIso = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** 月の最初の日（yyyy-MM-01）から、その月のマス目（前の月の空きマスは null） */
function monthCells(first: string) {
  const [y, m] = first.split("-").map(Number);
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => addDays(first, i))];
}
const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;
const shiftMonth = (first: string, n: number) => {
  const [y, m] = first.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
};

export function Reservation({ lang, t, roomNames }: { lang: Locale; t: Dict; roomNames: Record<string, string> }) {
  const b = t.book;
  const [state, action, pending] = useActionState(startReservation, initial);
  const [avail, setAvail] = useState<Avail>({ status: "loading" });
  const [guests, setGuests] = useState(2);
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [room, setRoom] = useState("");
  // 朝食・夕食はそれぞれオン・オフ。送るときは素泊まり／朝食／夕食／両方の1つにまとめる
  const [breakfast, setBreakfast] = useState(false);
  const [dinner, setDinner] = useState(false);
  const plan: MealPlan = breakfast && dinner ? "both" : breakfast ? "breakfast" : dinner ? "dinner" : "none";
  const [month, setMonth] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);

  const yen = (n: number) => formatYen(lang, n);
  const dateLabel = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(htmlLang[lang], { month: "short", day: "numeric", weekday: "short", timeZone: "UTC" });

  // 空室を読む。トップの検索から来たら、日程と人数を引き継ぐ
  useEffect(() => {
    let alive = true;
    fetch("/api/availability")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (!d?.ok) return setAvail({ status: "error" });
        const data = d as Availability;
        setAvail({ status: "ready", data });
        const p = new URLSearchParams(window.location.search);
        const g = parseInt(p.get("guests") ?? "", 10);
        if (g >= 1 && g <= 5) setGuests(g);
        const inp = p.get("in");
        const n = parseInt(p.get("nights") ?? "", 10);
        if (isIso(inp) && inp >= data.today && inp < data.until) {
          setCheckIn(inp);
          if (n >= 1 && n <= bookingRules.maxNights) setCheckOut(addDays(inp, n));
          setMonth(monthStart(inp));
        } else setMonth(monthStart(data.today));
      })
      .catch(() => alive && setAvail({ status: "error" }));
    return () => {
      alive = false;
    };
  }, []);

  const data = avail.status === "ready" ? avail.data : null;
  const nights = checkIn && checkOut ? Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86400000) : 0;

  /** その夜に、この人数で泊まれる部屋の数（受け付ける範囲の全日ぶんを先に数える） */
  const freeCounts = useMemo(() => {
    const m = new Map<string, number>();
    if (!data) return m;
    for (let d = data.today; d < data.until; d = addDays(d, 1)) {
      m.set(d, rooms.filter((r) => roomStatus(data, r, d, 1, guests) === "free").length);
    }
    return m;
  }, [data, guests]);
  const freeOn = (date: string) => freeCounts.get(date) ?? 0;

  /** チェックインから date まで（date の朝に出発）続けて泊まれる部屋があるか */
  const canStayUntil = (inIso: string, outIso: string) => {
    if (!data) return false;
    const n = Math.round((Date.parse(outIso) - Date.parse(inIso)) / 86400000);
    if (n < 1 || n > bookingRules.maxNights) return false;
    return rooms.some((r) => roomStatus(data, r, inIso, n, guests) === "free");
  };

  const pickDay = (iso: string) => {
    if (!data) return;
    if (checkIn && !checkOut && iso > checkIn && canStayUntil(checkIn, iso)) {
      setCheckOut(iso);
      return;
    }
    if (iso >= data.today && iso < data.until && freeOn(iso) > 0) {
      setCheckIn(iso);
      setCheckOut(null);
      setRoom("");
    }
  };

  const statuses = useMemo(() => {
    const out: Record<string, RoomStatus> = {};
    if (data && checkIn && nights) for (const r of rooms) out[r.name] = roomStatus(data, r, checkIn, nights, guests);
    return out;
  }, [data, checkIn, nights, guests]);
  const freeRooms = rooms.filter((r) => statuses[r.name] === "free");
  const pickedRoom = room && statuses[room] === "free" ? room : "";
  const q = pickedRoom && checkIn && nights ? quote(pickedRoom, checkIn, nights, guests, plan) : null;

  const errorText =
    state.error === "unavailable"
      ? b.errUnavailable
      : state.error === "payment"
        ? b.errPayment
        : state.error === "agree"
          ? b.errAgree
          : state.error === "offline"
            ? b.offline
            : state.error === "invalid"
              ? b.errInvalid
              : "";

  if (avail.status === "error") {
    return <p className={`${card} text-[15px] leading-8 text-slate`}>{b.offline}</p>;
  }

  const first = month ?? (data ? monthStart(data.today) : null);
  const canPrev = !!data && !!first && first > monthStart(data.today);
  const canNext = !!data && !!first && shiftMonth(first, 1) < data.until;

  const renderMonth = (start: string) => {
    const [y, m] = start.split("-").map(Number);
    return (
      <div>
        <p className="mb-2 text-center font-bold">{fmt(b.monthLabel, { y, m })}</p>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate">
          {b.weekdays.map((w, i) => (
            <span key={w} className={`py-1 ${i === 0 ? "text-[#C2413B]" : i === 6 ? "text-sea" : ""}`}>
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthCells(start).map((iso, i) => {
            if (!iso) return <span key={`e${i}`} />;
            const free = data && iso >= data.today && iso < data.until ? freeOn(iso) : 0;
            const choosingOut = !!checkIn && !checkOut;
            const asOut = choosingOut && iso > checkIn! && canStayUntil(checkIn!, iso);
            const enabled = asOut || free > 0;
            const inRange = checkIn && checkOut && iso > checkIn && iso < checkOut;
            const isEdge = iso === checkIn || iso === checkOut;
            const busy = isBusyNight(iso);
            return (
              <button
                key={iso}
                type="button"
                disabled={!enabled}
                onClick={() => pickDay(iso)}
                aria-pressed={isEdge}
                aria-label={`${dateLabel(iso)} ${free > 0 ? fmt(b.dayFree, { n: free }) : b.dayFull}`}
                className={`flex h-14 flex-col items-center justify-center rounded-xl text-[14px] transition-colors md:h-16 ${
                  isEdge
                    ? "bg-grad font-bold text-white shadow-soft"
                    : inRange
                      ? "bg-sel font-bold text-navy"
                      : enabled
                        ? "bg-white text-navy ring-1 ring-frost hover:ring-sea"
                        : "cursor-not-allowed text-slate/50"
                }`}
              >
                <span className="leading-none">{Number(iso.slice(8))}</span>
                <span className={`mt-1 text-[10px] leading-none ${isEdge ? "text-white/90" : free > 0 ? "text-pine" : ""}`}>
                  {data && iso >= data.today && iso < data.until ? (free > 0 ? fmt(b.dayFree, { n: free }) : b.dayFull) : ""}
                </span>
                {busy && !isEdge && <span aria-hidden className="mt-0.5 size-1 rounded-full bg-[#C2413B]" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <form action={action} className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
      {/* 公式サイト最安値のお知らせ。割引率は lib/site.ts の bookingRules.directDiscount */}
      <div className="flex flex-col gap-1 rounded-[20px] border border-wood/40 bg-kinari/60 px-5 py-4 lg:col-span-2 md:flex-row md:items-center md:gap-4">
        <span className="self-start rounded-full bg-wood px-3 py-1 text-[12px] font-bold text-white md:self-auto">{fmt(b.bestRateBadge, { pct: bookingRules.directDiscount })}</span>
        <span className="font-mincho text-[17px] font-bold">{b.bestRateTitle}</span>
        <span className="text-[13px] text-slate">{fmt(b.bestRateBody, { pct: bookingRules.directDiscount })}</span>
      </div>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="room" value={pickedRoom} />
      <input type="hidden" name="checkIn" value={checkIn ?? ""} />
      <input type="hidden" name="nights" value={nights || ""} />
      <input type="hidden" name="guests" value={guests} />
      <input type="hidden" name="meal" value={plan} />

      <div className="flex min-w-0 flex-col gap-4">
        {/* 1. 日程と人数 */}
        <section className={card} aria-labelledby="st-dates">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="st-dates" className="flex items-center gap-2 font-mincho text-xl font-semibold">
              <span className="flex size-7 items-center justify-center rounded-full bg-grad font-sans text-[13px] text-white">1</span>
              {b.stepDates}
            </h2>
            <div className="flex items-center gap-2" role="group" aria-label={b.guests}>
              <span className="text-[13px] font-bold text-slate">{b.guests}</span>
              <div className="flex items-center gap-1 rounded-full bg-sky p-1">
                <button type="button" aria-label="−" disabled={guests <= 1} onClick={() => { setGuests(guests - 1); setRoom(""); }} className="size-9 rounded-full text-lg disabled:opacity-40">
                  −
                </button>
                <output className="min-w-12 text-center font-bold">{fmt(t.form.guestUnit, { n: guests })}</output>
                <button type="button" aria-label="+" disabled={guests >= 5} onClick={() => { setGuests(guests + 1); setRoom(""); }} className="size-9 rounded-full bg-grad text-lg text-white disabled:opacity-40">
                  +
                </button>
              </div>
            </div>
          </div>

          <p className="mt-4 rounded-2xl bg-sky px-4 py-3 text-[14px] font-bold" aria-live="polite">
            {checkIn && checkOut
              ? fmt(b.picked, { in: dateLabel(checkIn), out: dateLabel(checkOut), n: nights })
              : checkIn
                ? `${dateLabel(checkIn)} → ${b.pickOut}`
                : b.pickIn}
            {checkIn && (
              <button type="button" onClick={() => { setCheckIn(null); setCheckOut(null); setRoom(""); }} className="ml-3 text-[13px] font-medium text-sea-deep underline underline-offset-4">
                {b.reset}
              </button>
            )}
          </p>

          {!data || !first ? (
            <p className="mt-6 text-[14px] text-slate">{t.form.availLoading}</p>
          ) : (
            <>
              <div className="mt-4 flex items-center justify-between">
                <button type="button" disabled={!canPrev} onClick={() => setMonth(shiftMonth(first, -1))} className="h-10 rounded-full px-4 text-[13px] font-bold text-sea-deep disabled:opacity-30">
                  ← {b.prevMonth}
                </button>
                <button type="button" disabled={!canNext} onClick={() => setMonth(shiftMonth(first, 1))} className="h-10 rounded-full px-4 text-[13px] font-bold text-sea-deep disabled:opacity-30">
                  {b.nextMonth} →
                </button>
              </div>
              <div className="mt-2 grid gap-6 md:grid-cols-2">
                {renderMonth(first)}
                <div className="hidden md:block">{renderMonth(shiftMonth(first, 1))}</div>
              </div>
              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-slate">
                <li className="flex items-center gap-1.5"><span className="size-3 rounded bg-white ring-1 ring-frost" />{b.legendFree}</li>
                <li className="flex items-center gap-1.5"><span className="size-3 rounded bg-navy/10" />{b.legendFull}</li>
                <li className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-[#C2413B]" />{b.legendBusy}</li>
              </ul>
              {checkIn && !checkOut && <p className="mt-2 text-[12px] text-slate">{fmt(b.tooLong, { n: bookingRules.maxNights })}</p>}
            </>
          )}
        </section>

        {/* 2. 部屋 */}
        {checkIn && checkOut && data && (
          <section className={card} aria-labelledby="st-room">
            <h2 id="st-room" className="flex items-center gap-2 font-mincho text-xl font-semibold">
              <span className="flex size-7 items-center justify-center rounded-full bg-grad font-sans text-[13px] text-white">2</span>
              {b.stepRoom}
            </h2>
            {freeRooms.length === 0 && <p className="mt-3 text-[14px] font-bold text-sea-deep">{b.noRooms}</p>}
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {rooms.map((r) => {
                const st = statuses[r.name] ?? "unknown";
                const can = st === "free";
                const on = pickedRoom === r.name;
                const rq = can ? quote(r.name, checkIn, nights, guests, "none") : null;
                return (
                  <li key={r.name}>
                    <button
                      type="button"
                      disabled={!can}
                      aria-pressed={on}
                      onClick={() => setRoom(r.name)}
                      className={`flex w-full flex-col gap-1.5 rounded-[18px] border p-4 text-left transition-colors ${
                        on ? "border-2 border-sea bg-sel" : can ? "border-steel bg-white hover:border-sea" : "cursor-not-allowed border-dashed border-dash bg-navy/[0.04] text-slate"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-mincho text-lg font-semibold">{roomNames[r.name] ?? r.name}</span>
                        <span className={`rounded-lg px-2 py-0.5 text-[12px] font-bold ${can ? "bg-mint text-pine" : ""}`}>
                          {on ? b.selected : t.form[STATUS_KEY[st]]}
                        </span>
                      </span>
                      <span className="text-[12px] text-slate">{fmt(t.rooms.capacity, { n: r.capacity })}</span>
                      {rq && (
                        <span className="text-[17px] font-bold tabular-nums">
                          <s className="mr-2 text-[12px] font-medium text-slate">{fmt(b.listPrice, { price: yen(rq.roomList) })}</s>
                          {yen(rq.roomTotal)}
                          <span className="ml-2 text-[12px] font-medium text-slate">{fmt(b.perStay, { n: nights, guests })}</span>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* 3. 食事：日程が決まったら出す（部屋を選ぶ前でも付けられる） */}
        {checkIn && checkOut && (
          <section className={card} aria-labelledby="st-meal">
            <h2 id="st-meal" className="flex items-center gap-2 font-mincho text-xl font-semibold">
              <span className="flex size-7 items-center justify-center rounded-full bg-grad font-sans text-[13px] text-white">3</span>
              {b.stepMeal}
            </h2>
            <p className="mt-2 text-[13px] text-slate">{b.mealHint}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["breakfast", t.price.breakfast, meals.breakfast, breakfast, setBreakfast],
                  ["dinner", t.price.dinner, meals.dinner, dinner, setDinner],
                ] as const
              ).map(([key, label, price, on, set]) => (
                <label
                  key={key}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 ${on ? "border-2 border-sea bg-sel" : "border-steel bg-white"}`}
                >
                  <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="size-5 shrink-0 accent-sea" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[15px] font-bold">{label}</span>
                    <span className="text-[12px] text-slate">{fmt(b.mealPrice, { price: yen(price) })}</span>
                  </span>
                  {nights > 0 && (
                    <span className={`shrink-0 text-right text-[12px] ${on ? "font-bold text-navy" : "text-slate"}`}>
                      {fmt(b.mealTotal, { guests, nights, price: yen(price * guests * nights) })}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </section>
        )}

        {/* 4. お客様 */}
        {pickedRoom && (
          <section className={card} aria-labelledby="st-guest">
            <h2 id="st-guest" className="flex items-center gap-2 font-mincho text-xl font-semibold">
              <span className="flex size-7 items-center justify-center rounded-full bg-grad font-sans text-[13px] text-white">4</span>
              {b.stepGuest}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-[13px] font-bold">
                {t.form.name}
                <span className="ml-1 text-sea">*</span>
                <input name="name" required autoComplete="name" maxLength={100} className={field} aria-invalid={state.fields?.includes("name")} />
              </label>
              <label className="text-[13px] font-bold">
                {t.form.email}
                <span className="ml-1 text-sea">*</span>
                <input name="email" type="email" required autoComplete="email" maxLength={200} className={field} aria-invalid={state.fields?.includes("email")} />
              </label>
              <label className="text-[13px] font-bold">
                {t.form.tel}
                <span className="ml-1 text-sea">*</span>
                <input name="tel" type="tel" required autoComplete="tel" maxLength={50} className={field} aria-invalid={state.fields?.includes("tel")} />
              </label>
              <label className="text-[13px] font-bold">
                {b.arrival}
                <select name="arrival" defaultValue="" className={field}>
                  <option value="">{b.arrivalUndecided}</option>
                  {ARRIVAL_TIMES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[13px] font-bold sm:col-span-2">
                {b.memo}
                <textarea name="memo" rows={3} maxLength={1000} className={`${field} h-auto py-3`} />
              </label>
            </div>
          </section>
        )}
      </div>

      {/* ご予約内容とお支払い */}
      <aside className={`${card} flex flex-col gap-4 lg:sticky lg:top-4`} aria-labelledby="st-sum">
        <h2 id="st-sum" className="font-mincho text-xl font-semibold">{b.stepConfirm}</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[14px]">
          <dt className="text-slate">{b.summaryRoom}</dt>
          <dd className="text-right font-bold">{pickedRoom ? roomNames[pickedRoom] ?? pickedRoom : "—"}</dd>
          <dt className="text-slate">{b.summaryDates}</dt>
          <dd className="text-right font-bold">{checkIn && checkOut ? `${dateLabel(checkIn)} → ${dateLabel(checkOut)}` : "—"}</dd>
          <dt className="text-slate">{b.summaryGuests}</dt>
          <dd className="text-right font-bold">{fmt(t.form.guestUnit, { n: guests })}</dd>
          <dt className="text-slate">{b.summaryMeal}</dt>
          <dd className="text-right font-bold">{{ none: t.form.mealNone, breakfast: t.form.mealBreakfast, dinner: b.mealDinner, both: t.form.mealBoth }[plan]}</dd>
        </dl>
        {q && (
          <div className="flex flex-col gap-1.5 border-t border-frost pt-4 text-[14px]">
            <p className="flex justify-between gap-3">
              <span>{fmt(b.stay, { n: q.nights })}</span>
              <span className="tabular-nums">{yen(q.roomList)}</span>
            </p>
            {q.extraGuests > 0 && <p className="text-[12px] text-slate">{fmt(b.extra, { n: q.extraGuests })}</p>}
            {q.busyNights > 0 && <p className="text-[12px] text-slate">{fmt(b.busy, { n: q.busyNights })}</p>}
            {q.discount > 0 && (
              <p className="flex justify-between gap-3 font-bold text-umber">
                <span>{fmt(b.discountLine, { pct: bookingRules.directDiscount })}</span>
                <span className="tabular-nums">−{yen(q.discount)}</span>
              </p>
            )}
            {q.breakfast > 0 && (
              <p className="flex justify-between gap-3">
                <span>{b.breakfast}</span>
                <span className="tabular-nums">{yen(q.breakfast)}</span>
              </p>
            )}
            {q.dinner > 0 && (
              <p className="flex justify-between gap-3">
                <span>{b.dinner}</span>
                <span className="tabular-nums">{yen(q.dinner)}</span>
              </p>
            )}
            <p className="mt-2 flex items-baseline justify-between gap-3 rounded-2xl bg-sky px-4 py-3">
              <span className="text-[13px] font-bold">{b.total}</span>
              <span className="text-[24px] font-bold tabular-nums text-sea-deep">{yen(q.total)}</span>
            </p>
            <p className="text-[12px] text-slate">{fmt(b.bathTax, { price: yen(q.bathTax) })}</p>
          </div>
        )}

        <details className="rounded-2xl border border-frost px-4 py-3 text-[13px]" open>
          <summary className="cursor-pointer font-bold">{b.policyTitle}</summary>
          <ul className="mt-2 space-y-1 text-slate">
            {b.policy.map((p) => (
              <li key={p}>・{p}</li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] leading-5 text-slate">{b.policyNote}</p>
        </details>

        <label className="flex items-start gap-2.5 text-[14px] font-bold">
          <input type="checkbox" name="agree" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-5 accent-sea" />
          {b.agree}
        </label>

        {errorText && (
          <p role="alert" className="rounded-2xl bg-[#FDECEA] px-4 py-3 text-[13px] font-bold text-[#B3261E]">
            {errorText}
          </p>
        )}

        <button
          type="submit"
          disabled={!q || !agree || pending}
          className="h-14 rounded-2xl bg-wood hover:bg-wood-deep text-[16px] font-bold text-white shadow-cta transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {pending ? b.paying : b.pay}
        </button>
        <p className="text-[12px] leading-5 text-slate">{fmt(b.payNote, { min: HOLD_MINUTES })}</p>
        <p className="text-[12px] leading-5 text-slate">{b.secure}</p>
      </aside>
    </form>
  );
}
