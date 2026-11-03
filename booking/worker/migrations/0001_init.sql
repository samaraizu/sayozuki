-- 予約台帳（スプレッドシートの代わり）
-- 移行中は、取り込みGAS（booking-system）が5分ごとにスプシの中身をここへ送ってくる（source='sheet'）。
-- アプリで入れた予約は source='app'。GASがそれを受け取ってスプシにも足すと in_sheet=1 になり、
-- 以後はスプシ側の値（泊数・入湯税・要確認など）で上書きされる。
-- IF NOT EXISTS は、最初の表作りをダッシュボード側でやっても migrations apply が通るようにするため。

CREATE TABLE IF NOT EXISTS rooms (
  name TEXT PRIMARY KEY,
  capacity INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT '停止',   -- 販売可／準備中／停止
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  no TEXT UNIQUE,                        -- 予約番号。スプシで空の行は NULL
  source TEXT NOT NULL CHECK (source IN ('app', 'sheet')),
  in_sheet INTEGER NOT NULL DEFAULT 0,   -- スプシにも載っているか
  seen INTEGER NOT NULL DEFAULT 0,       -- 最後に同期で見かけた回（同期のたびに増える）
  channel TEXT NOT NULL DEFAULT '',      -- 媒体
  status TEXT NOT NULL DEFAULT '',       -- ステータス
  flag TEXT NOT NULL DEFAULT '',         -- 要確認
  room TEXT NOT NULL DEFAULT '',
  check_in TEXT NOT NULL DEFAULT '',     -- yyyy-MM-dd
  check_out TEXT NOT NULL DEFAULT '',
  adults TEXT NOT NULL DEFAULT '',
  children TEXT NOT NULL DEFAULT '',
  infants TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',         -- 代表者名
  contact TEXT NOT NULL DEFAULT '',
  arrival TEXT NOT NULL DEFAULT '',
  meals TEXT NOT NULL DEFAULT '',
  guest_paid TEXT NOT NULL DEFAULT '',
  payment TEXT NOT NULL DEFAULT '',      -- 支払い状況
  tax TEXT NOT NULL DEFAULT '',          -- 入湯税
  tax_collected TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  memo TEXT NOT NULL DEFAULT '',
  booked_on TEXT NOT NULL DEFAULT '',    -- 予約日
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS bookings_room_dates ON bookings (room, check_in, check_out);
CREATE INDEX IF NOT EXISTS bookings_pending ON bookings (source, in_sheet);

-- 誰が・いつ・何をしたか
CREATE TABLE IF NOT EXISTS op_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  no TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT ''
);

-- 最終取り込み時刻・同期の回数など
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
