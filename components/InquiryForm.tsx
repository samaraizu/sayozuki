"use client";

import { useActionState } from "react";
import { submitInquiry, type InquiryState } from "@/app/actions";
import { fmt, type Dict, type Locale } from "@/lib/i18n";
import { rooms } from "@/lib/site";

const initialState: InquiryState = { status: "idle" };

const field =
  "mt-1.5 w-full border border-line bg-white px-3 py-2.5 text-[15px] outline-none transition-colors focus:border-green";
const label = "block text-[13px] font-bold";

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
      <div className="border border-line bg-green-soft px-6 py-12 text-center" role="status">
        <p className="text-lg font-bold text-green">{t.thanks}</p>
        <p className="mt-4 text-sm leading-7">
          {state.message ?? t.ok}
        </p>
      </div>
    );
  }

  const err = state.errors ?? {};
  const v = state.values ?? {};

  return (
    <form key={state.key ?? "init"} action={formAction} className="relative grid gap-7 sm:grid-cols-2" noValidate>
      <input type="hidden" name="lang" value={lang} />
      <div>
        <label htmlFor="name" className={label}>
          {t.name}<span className="ml-1 text-moon">*</span>
        </label>
        <input id="name" name="name" defaultValue={v.name} autoComplete="name" className={field} aria-invalid={!!err.name} />
        {err.name && <p className="mt-1 text-xs text-red-700">{err.name}</p>}
      </div>

      <div>
        <label htmlFor="email" className={label}>
          {t.email}<span className="ml-1 text-moon">*</span>
        </label>
        <input
          id="email"
          name="email" defaultValue={v.email}
          type="email"
          autoComplete="email"
          className={field}
          aria-invalid={!!err.email}
        />
        {err.email && <p className="mt-1 text-xs text-red-700">{err.email}</p>}
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
        <input id="checkin" name="checkin" defaultValue={v.checkin} type="date" className={field} aria-invalid={!!err.checkin} />
        {err.checkin && <p className="mt-1 text-xs text-red-700">{err.checkin}</p>}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label htmlFor="nights" className={label}>
            {t.nights}
          </label>
          <select id="nights" name="nights" className={field} defaultValue={v.nights || "1"}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {fmt(t.nightUnit, { n })}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="guests" className={label}>
            {t.guests}<span className="ml-1 text-moon">*</span>
          </label>
          <select id="guests" name="guests" className={field} defaultValue={v.guests || "2"} aria-invalid={!!err.guests}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {fmt(t.guestUnit, { n })}
              </option>
            ))}
          </select>
          {err.guests && <p className="mt-1 text-xs text-red-700">{err.guests}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="room" className={label}>
          {t.room}
        </label>
        <select id="room" name="room" className={field} defaultValue={v.room ?? ""}>
          <option value="">{t.roomAny}</option>
          {rooms.map((r) => (
            <option key={r.name} value={r.name}>
              {fmt(t.roomOption, { room: roomNames[r.name] ?? r.name, n: r.capacity })}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="sm:col-span-2">
        <legend className={label}>{t.meal}</legend>
        <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-[15px]">
          {[
            ["none", t.mealNone],
            ["breakfast", t.mealBreakfast],
            ["both", t.mealBoth],
          ].map(([value, text]) => (
            <label key={value} className="flex cursor-pointer items-center gap-2">
              <input type="radio" name="meal" value={value} defaultChecked={value === (v.meal || "none")} className="accent-moon" />
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
          <p className="mb-4 text-sm text-red-700" role="alert">
            {state.message}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full bg-green px-10 py-4 text-sm font-bold text-white transition-opacity hover:opacity-85 disabled:opacity-50 sm:w-auto"
        >
          {pending ? t.sending : t.submit}
        </button>
        <p className="mt-4 text-xs leading-6 text-sub">
          {t.disclaimer}
        </p>
      </div>
    </form>
  );
}
