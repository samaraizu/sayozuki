-- HPの予約フォームからの事前決済。予約は bookings に「仮」で入れて部屋を押さえ、
-- Squareで払われたら「確定」にする。期限までに払われなければ予約の行を消して部屋を戻す。
-- 決済待ちのあいだはスプシに送らない（取り込みGASがカレンダーや通知を出さないように）。
CREATE TABLE IF NOT EXISTS hp_checkouts (
  no TEXT PRIMARY KEY,                    -- 予約番号（bookings.no）
  view_key TEXT NOT NULL,                 -- 完了画面で予約を見るための鍵（予約番号だけでは見られない）
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'failed')),
  amount INTEGER NOT NULL,                -- 事前決済の額（円、税込）
  email TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL DEFAULT 'ja',
  summary TEXT NOT NULL DEFAULT '',       -- 確認メール用の明細（JSON）
  link_id TEXT NOT NULL DEFAULT '',       -- Squareの支払いリンク
  order_id TEXT NOT NULL DEFAULT '',
  pay_url TEXT NOT NULL DEFAULT '',
  expires_at TEXT NOT NULL,               -- これを過ぎて払われていなければ部屋を戻す
  mailed INTEGER NOT NULL DEFAULT 0,      -- 確認メールを送ったか
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  paid_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS hp_checkouts_pending ON hp_checkouts (status, expires_at);
