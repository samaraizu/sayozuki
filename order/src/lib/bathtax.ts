import { addDays } from './time';

/** 入湯税 = 課税対象人数 × 泊数 × 税率（12歳未満などの免除者は課税対象に含めない） */
export const bathTaxAmount = (taxable: number, nights: number, rateYen: number) =>
  Math.max(0, Math.floor(taxable)) * Math.max(0, Math.floor(nights)) * Math.max(0, Math.floor(rateYen));

export interface StayForLedger {
  room: string;
  checkin_date: string;
  nights: number;
  guests_taxable: number;
  guests_exempt: number;
}

export interface LedgerRow {
  date: string;
  rooms: number;
  taxable: number;
  exempt: number;
  tax: number;
}

/** 入湯税の帳簿（日別の入湯客数・免除者数・税額）。1泊ごとに1日として計上する */
export function buildLedger(stays: StayForLedger[], month: string, rateYen: number): LedgerRow[] {
  const map = new Map<string, LedgerRow>();
  for (const s of stays) {
    for (let i = 0; i < s.nights; i++) {
      const date = addDays(s.checkin_date, i);
      if (!date.startsWith(month)) continue;
      const row = map.get(date) ?? { date, rooms: 0, taxable: 0, exempt: 0, tax: 0 };
      row.rooms += 1;
      row.taxable += s.guests_taxable;
      row.exempt += s.guests_exempt;
      row.tax += s.guests_taxable * rateYen;
      map.set(date, row);
    }
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function ledgerCsv(rows: LedgerRow[]) {
  const head = '日付,客室数,課税対象人数,課税免除人数,入湯税額';
  const body = rows.map((r) => [r.date, r.rooms, r.taxable, r.exempt, r.tax].join(','));
  const total = rows.reduce((a, r) => ({ taxable: a.taxable + r.taxable, exempt: a.exempt + r.exempt, tax: a.tax + r.tax }), { taxable: 0, exempt: 0, tax: 0 });
  return '﻿' + [head, ...body, `合計,,${total.taxable},${total.exempt},${total.tax}`].join('\r\n') + '\r\n';
}
