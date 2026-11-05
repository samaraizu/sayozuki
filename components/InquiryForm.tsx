"use client";

import { useActionState, useEffect, useState } from "react";
import { submitInquiry, type InquiryState } from "@/app/actions";
import { roomStatus, type Availability, type RoomStatus } from "@/lib/availability";
import { fmt, type Dict, type Locale } from "@/lib/i18n";
import { rooms } from "@/lib/site";

const initialState: InquiryState = { status: "idle" };

const field =
  "mt-1.5 w-full rounded-xl border border-steel bg-mist px-3 py-3 text-[16px] text-navy outline-none transition-colors focus:border-sea focus:ring-2 focus:ring-sea/20";
const label = "block text-[13px] font-bold text-navy";

export function InquiryForm({
  lang,
  t,
  roomNames,
}: {
  lang: Locale;
  t: Dict["form"];
  roomNames: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(submitInquiry, initialState);

  if (state.status === "ok") {
    return (
      <div className="rounded-[22px] bg-mint px-6 py-12 text-center" role="status">
        <p className="font-serif text-xl font-semibold text-pine">{t.thanks}</p>
        <p className="mt-4 text-sm leading-7">
          {state.message ?? t.ok}
        </p>
      </div>
    );
  }

  return (
    <Fields
      key={state.key ?? "init"}
      lang={lang}
      t={t}
      roomNames={roomNames}
      state={state}
      formAction={formAction}
      pending={pending}
    />
  );
}

/** 空室の読み込み状態 */
type Avail = { status: "idle" | "error" } | { status: "ready"; data: Availability };

const STATUS_LABEL = {
  free: "availFree",
  full: "availFull",
  over: "availOver",
  closed: "availClosed",
  unknown: "availUnknown",
} as const satisfies Record<RoomStatus, keyof Dict["form"]>;

/** 選べない客室（満室・定員超え・準備中）。宿で確認のものは選べる */
const blocked = (s: RoomStatus | undefined) => s === "full" || s === "over" || s === "closed";

function Fields({
  lang,
  t,
  roomNames,
  state,
  formAction,
  pending,
}: {
  lang: Locale;
  t: Dict["form"];
  roomNames: Record<string, string>;
  state: InquiryState;
  formAction: (payload: FormData) => void;
  pending: boolean;
}) {
  const err = state.errors ?? {};
  const v = state.values ?? {};
  const [checkin, setCheckin] = useState(v.checkin ?? "");
  const [nights, setNights] = useState(v.nights || "1");
  const [guests, setGuests] = useState(v.guests || "2");
  const [room, setRoom] = useState(v.room ?? "");
  const [avail, setAvail] = useState<Avail>({ status: "idle" });

  // 到着日が入ったら、空室を1回だけ読みにいく（読み終わるまでは「確認しています」）
  const wantAvail = !!checkin && avail.status === "idle";
  useEffect(() => {
    if (!wantAvail) return;
    let alive = true;
    fetch("/api/availability")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setAvail(d?.ok ? { status: "ready", data: d as Availability } : { status: "error" });
      })
      .catch(() => alive && setAvail({ status: "error" }));
    return () => {
      alive = false;
    };
  }, [wantAvail]);

  const statuses: Partial<Record<string, RoomStatus>> = {};
  if (avail.status === "ready" && /^\d{4}-\d{2}-\d{2}$/.test(checkin)) {
    for (const r of rooms) {
      statuses[r.name] = roomStatus(avail.data, r, checkin, Number(nights) || 1, Number(guests) || 1);
    }
  }
  const showStatus = Object.keys(statuses).length > 0;
  const freeCount = rooms.filter((r) => statuses[r.name] === "free").length;
  const anyOpen = rooms.some((r) => !blocked(statuses[r.name]));
  // 選んでいた客室が日程や人数の変更で選べなくなったら、指定なしに戻す
  const pickedRoom = room && blocked(statuses[room]) ? "" : room;

  return (
    <form action={formAction} className="relative grid gap-7 sm:grid-cols-2" noValidate>
      <input type="hidden" name="lang" value={lang} />
      <div>
        <label htmlFor="name" className={label}>
          {t.name}<span className="ml-1 text-sea">*</span>
        </label>
        <input id="name" name="name" defaultValue={v.name} autoComplete="name" className={field} aria-invalid={!!err.name} />
        {err.name && <p className="mt-1 text-xs text-[#B3261E]">{err.name}</p>}
      </div>

      <div>
        <label htmlFor="email" className={label}>
          {t.email}<span className="ml-1 text-sea">*</span>
        </label>
        <input
          id="email"
          name="email" defaultValue={v.email}
          type="email"
          autoComplete="email"
          className={field}
          aria-invalid={!!err.email}
        />
        {err.email && <p className="mt-1 text-xs text-[#B3261E]">{err.email}</p>}
      </div>

      <div>
        <label htmlFor="tel" className={label}>
          {t.tel}
        </label>
        <input id="tel" name="tel" defaultValue={v.tel} type="tel" autoComplete="tel" className={field} />
      </div>

      <div>
        <label htmlFor="checkin" className={label}>
          {t.checkin}
        </label>
        <input
          id="checkin"
          name="checkin"
          value={checkin}
          onChange={(e) => setCheckin(e.target.value)}
          type="date"
          className={field}
          aria-invalid={!!err.checkin}
        />
        {err.checkin && <p className="mt-1 text-xs text-[#B3261E]">{err.checkin}</p>}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label htmlFor="nights" className={label}>
            {t.nights}
          </label>
          <select id="nights" name="nights" className={field} value={nights} onChange={(e) => setNights(e.target.value)}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {fmt(t.nightUnit, { n })}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="guests" className={label}>
            {t.guests}<span className="ml-1 text-sea">*</span>
          </label>
          <select
            id="guests"
            name="guests"
            className={field}
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
            aria-invalid={!!err.guests}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {fmt(t.guestUnit, { n })}
              </option>
            ))}
          </select>
          {err.guests && <p className="mt-1 text-xs text-[#B3261E]">{err.guests}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="room" className={label}>
          {t.room}
        </label>
        <select
          id="room"
          name="room"
          className={field}
          value={pickedRoom}
          onChange={(e) => setRoom(e.target.value)}
          aria-invalid={!!err.room}
        >
          <option value="">{t.roomAny}</option>
          {rooms.map((r) => {
            const st = statuses[r.name];
            return (
              <option key={r.name} value={r.name} disabled={blocked(st)}>
                {fmt(t.roomOption, { room: roomNames[r.name] ?? r.name, n: r.capacity })}
                {st && st !== "free" ? ` — ${t[STATUS_LABEL[st]]}` : ""}
              </option>
            );
          })}
        </select>
        {err.room && <p className="mt-1 text-xs text-[#B3261E]">{err.room}</p>}
      </div>

      <section className="sm:col-span-2 rounded-[22px] border border-frost bg-mist px-5 py-5" aria-labelledby="avail-title" aria-live="polite">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="avail-title" className="text-[13px] font-bold">
            {t.availTitle}
          </h3>
          {showStatus && freeCount > 0 && (
            <p className="text-[13px] font-bold text-pine">{fmt(t.availCount, { n: freeCount })}</p>
          )}
        </div>
        {!checkin ? (
          <p className="mt-2 text-[13px] text-slate">{t.availPick}</p>
        ) : avail.status === "error" ? (
          <p className="mt-2 text-[13px] text-slate">{t.availError}</p>
        ) : !showStatus ? (
          <p className="mt-2 text-[13px] text-slate">{t.availLoading}</p>
        ) : (
          <>
            {!anyOpen && <p className="mt-2 text-[13px] font-bold text-sea-deep">{t.availNone}</p>}
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {rooms.map((r) => {
                const st = statuses[r.name] ?? "unknown";
                const can = !blocked(st);
                const on = pickedRoom === r.name;
                return (
                  <li key={r.name}>
                    <button
                      type="button"
                      disabled={!can}
                      aria-pressed={on}
                      onClick={() => setRoom(on ? "" : r.name)}
                      className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left text-[14px] transition-colors ${
                        on
                          ? "border-2 border-sea bg-sel"
                          : can
                            ? "border-steel bg-white hover:border-sea"
                            : "cursor-not-allowed border-dashed border-dash bg-navy/[0.04] text-slate"
                      }`}
                    >
                      <span>{fmt(t.roomOption, { room: roomNames[r.name] ?? r.name, n: r.capacity })}</span>
                      <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[12px] font-bold ${st === "free" ? "bg-mint text-pine" : "text-slate"}`}>
                        {t[STATUS_LABEL[st]]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs leading-6 text-slate">{t.availNote}</p>
          </>
        )}
      </section>

      <fieldset className="sm:col-span-2">
        <legend className={label}>{t.meal}</legend>
        <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-[15px]">
          {[
            ["none", t.mealNone],
            ["breakfast", t.mealBreakfast],
            ["both", t.mealBoth],
          ].map(([value, text]) => (
            <label key={value} className="flex cursor-pointer items-center gap-2">
              <input type="radio" name="meal" value={value} defaultChecked={value === (v.meal || "none")} className="accent-sea" />
              {text}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="sm:col-span-2">
        <label htmlFor="message" className={label}>
          {t.message}
        </label>
        <textarea id="message" name="message" defaultValue={v.message} rows={4} className={`${field} resize-y`} />
      </div>

      {/* ボット対策の見えない欄 */}
      <div aria-hidden className="absolute -left-[9999px]">
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="sm:col-span-2">
        {state.status === "error" && state.message && (
          <p className="mb-4 text-sm text-[#B3261E]" role="alert">
            {state.message}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="h-14 w-full rounded-2xl bg-grad px-10 text-[15px] font-bold text-white shadow-cta transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 sm:w-auto"
        >
          {pending ? t.sending : t.submit}
        </button>
        <p className="mt-4 text-xs leading-6 text-slate">
          {t.disclaimer}
        </p>
      </div>
    </form>
  );
}
