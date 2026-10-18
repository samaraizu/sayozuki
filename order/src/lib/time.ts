// 日本時間で判定するためのヘルパー（Workersの時計はUTC）
const JST_OFFSET_MIN = 9 * 60;

export const nowIso = () => new Date().toISOString();

export function jstParts(d = new Date()) {
  const t = new Date(d.getTime() + JST_OFFSET_MIN * 60_000);
  return {
    date: t.toISOString().slice(0, 10),
    minutes: t.getUTCHours() * 60 + t.getUTCMinutes()
  };
}

export const hhmmToMin = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** open〜close の間なら注文可。closeが日をまたぐ設定（例 06:00〜01:00）にも対応 */
export function withinWindow(open: string, close: string, d = new Date()) {
  const now = jstParts(d).minutes;
  const o = hhmmToMin(open);
  const c = hhmmToMin(close);
  return o <= c ? now >= o && now < c : now >= o || now < c;
}

export function addDays(date: string, n: number) {
  const t = new Date(date + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
