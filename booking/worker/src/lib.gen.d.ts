// lib.gen.js（../src/lib.js から作る）の型。使う分だけ
export interface Room { name: string; capacity: number; state: string }
export interface BookingLike {
  room: string; checkIn: string; checkOut: string; status: string;
  adults?: string; children?: string; infants?: string; name?: string; no?: string;
}
export interface Availability { name: string; capacity: number; state: string; available: boolean; status: string; why: string }
export declare const Lib: {
  CANCELLED: string;
  SELLABLE: string;
  PAYMENTS: Record<string, string>;
  toIso(v: unknown): string;
  addDays(iso: string, n: number): string;
  nightsBetween(a: string, b: string): number;
  toInt(v: unknown): number;
  isActive(b: BookingLike): boolean;
  roomAvailability(rooms: Room[], bookings: BookingLike[], inIso: string, outIso: string, people: number): Availability[];
  makeBookingNo(todayIso: string, existing: Record<string, boolean>, random?: () => number): string;
  validateManual(form: Record<string, unknown>, rooms: Room[], todayIso: string): string;
  CANCEL_POLICY: { minDays: number; rate: number; label: string }[];
  cancelPolicy(checkInIso: string, todayIso: string): { daysBefore: number; rate: number; label: string };
  cancelAmounts(paid: unknown, rate: number): { paid: number; fee: number; refund: number };
};
