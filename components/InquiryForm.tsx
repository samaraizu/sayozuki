"use client";

import { useActionState } from "react";
import { submitInquiry, type InquiryState } from "@/app/actions";
import { rooms } from "@/lib/site";

const initialState: InquiryState = { status: "idle" };

const field =
  "w-full border-b border-ink/25 bg-transparent py-2.5 text-[15px] outline-none transition-colors focus:border-moon";
const label = "block text-xs tracking-[0.15em] text-ink/60";

export function InquiryForm() {
  const [state, formAction, pending] = useActionState(submitInquiry, initialState);

  if (state.status === "ok") {
    return (
      <div className="border border-ink/15 px-6 py-12 text-center" role="status">
        <p className="font-serif text-lg">ありがとうございます</p>
        <p className="mt-4 text-sm leading-7 text-ink/70">
          {state.message ?? "お問い合わせを承りました。"}
        </p>
      </div>
    );
  }

  const err = state.errors ?? {};

  return (
    <form action={formAction} className="relative grid gap-7 sm:grid-cols-2" noValidate>
      <div>
        <label htmlFor="name" className={label}>
          お名前<span className="ml-1 text-moon">*</span>
        </label>
        <input id="name" name="name" autoComplete="name" className={field} aria-invalid={!!err.name} />
        {err.name && <p className="mt-1 text-xs text-red-700">{err.name}</p>}
      </div>

      <div>
        <label htmlFor="email" className={label}>
          メールアドレス<span className="ml-1 text-moon">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className={field}
          aria-invalid={!!err.email}
        />
        {err.email && <p className="mt-1 text-xs text-red-700">{err.email}</p>}
      </div>

      <div>
        <label htmlFor="tel" className={label}>
          電話番号
        </label>
        <input id="tel" name="tel" type="tel" autoComplete="tel" className={field} />
      </div>

      <div>
        <label htmlFor="checkin" className={label}>
          ご到着日
        </label>
        <input id="checkin" name="checkin" type="date" className={field} aria-invalid={!!err.checkin} />
        {err.checkin && <p className="mt-1 text-xs text-red-700">{err.checkin}</p>}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label htmlFor="nights" className={label}>
            泊数
          </label>
          <select id="nights" name="nights" className={field} defaultValue="1">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}泊
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="guests" className={label}>
            人数<span className="ml-1 text-moon">*</span>
          </label>
          <select id="guests" name="guests" className={field} defaultValue="2" aria-invalid={!!err.guests}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}名
              </option>
            ))}
          </select>
          {err.guests && <p className="mt-1 text-xs text-red-700">{err.guests}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="room" className={label}>
          ご希望の客室
        </label>
        <select id="room" name="room" className={field} defaultValue="">
          <option value="">指定なし</option>
          {rooms.map((r) => (
            <option key={r.name} value={r.name}>
              {r.name}（〜{r.capacity}名）
            </option>
          ))}
        </select>
      </div>

      <fieldset className="sm:col-span-2">
        <legend className={label}>お食事</legend>
        <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-[15px]">
          {[
            ["none", "素泊まり"],
            ["breakfast", "朝食付き"],
            ["both", "1泊2食付き"],
          ].map(([value, text]) => (
            <label key={value} className="flex cursor-pointer items-center gap-2">
              <input type="radio" name="meal" value={value} defaultChecked={value === "none"} className="accent-moon" />
              {text}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="sm:col-span-2">
        <label htmlFor="message" className={label}>
          ご要望・ご質問
        </label>
        <textarea id="message" name="message" rows={4} className={`${field} resize-y`} />
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
          className="w-full bg-ink px-8 py-4 text-sm tracking-[0.3em] text-washi transition-opacity hover:opacity-85 disabled:opacity-50 sm:w-auto"
        >
          {pending ? "送信しています…" : "この内容で問い合わせる"}
        </button>
        <p className="mt-4 text-xs leading-6 text-ink/50">
          お問い合わせの時点ではご予約は確定しません。空室を確認のうえ、宿よりご連絡いたします。
        </p>
      </div>
    </form>
  );
}
