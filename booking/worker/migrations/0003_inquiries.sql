-- HPのお問い合わせフォームの申し込み。予約管理アプリの「問い合わせ」に出す。
-- 「予約にする」で手動入力に引き継ぐと 予約済み（booking_no に予約番号）、「見送り」で閉じる。
CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,                     -- 受付番号（HPが決める。送り直しても二重にならない）
  received_at TEXT NOT NULL,               -- 受付日時（yyyy/MM/dd HH:mm、日本時間）
  status TEXT NOT NULL DEFAULT '未対応' CHECK (status IN ('未対応', '予約済み', '見送り')),
  lang TEXT NOT NULL DEFAULT 'ja',
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  tel TEXT NOT NULL DEFAULT '',
  check_in TEXT NOT NULL DEFAULT '',       -- yyyy-MM-dd（未定は空）
  nights INTEGER NOT NULL DEFAULT 1,
  guests INTEGER NOT NULL DEFAULT 1,
  room TEXT NOT NULL DEFAULT '',           -- HPの客室名（例「201号室」）
  meal TEXT NOT NULL DEFAULT '',           -- 素泊まり／朝食付き／1泊2食付き
  message TEXT NOT NULL DEFAULT '',
  booking_no TEXT NOT NULL DEFAULT '',
  handled_at TEXT NOT NULL DEFAULT '',
  handled_by TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS inquiries_status ON inquiries (status, received_at);
