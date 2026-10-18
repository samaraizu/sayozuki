-- 固定QR方式へ移行：滞在ごとのトークンと入湯税をやめ、部屋単位で注文と精算を持つ
DROP TABLE IF EXISTS order_lines;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS requests;
DROP TABLE IF EXISTS stays;

-- 客室（QRのURLには推測できないランダムなidを使う）
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  dnd INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- 精算（スタッフが「精算する」を押した単位）
CREATE TABLE settlements (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending | settled | canceled
  total INTEGER NOT NULL,
  square_order_id TEXT,
  payment_link_id TEXT,
  payment_url TEXT,
  method TEXT,                            -- square | manual
  created_at TEXT NOT NULL,
  settled_at TEXT
);
CREATE INDEX idx_settlements_room ON settlements(room_id, status);
CREATE INDEX idx_settlements_square ON settlements(square_order_id);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  delivery TEXT NOT NULL DEFAULT 'door',
  status TEXT NOT NULL DEFAULT 'new',     -- new | delivered | canceled
  total INTEGER NOT NULL,
  settlement_id TEXT REFERENCES settlements(id), -- NULLなら未精算
  created_at TEXT NOT NULL,
  delivered_at TEXT
);
CREATE INDEX idx_orders_room ON orders(room_id, settlement_id);
CREATE INDEX idx_orders_status ON orders(status);

CREATE TABLE order_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id),
  variation_id TEXT NOT NULL,
  name TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  tracked INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_lines_order ON order_lines(order_id);
CREATE INDEX idx_lines_variation ON order_lines(variation_id);

CREATE TABLE requests (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',     -- new | done
  created_at TEXT NOT NULL,
  done_at TEXT
);
CREATE INDEX idx_requests_room ON requests(room_id, status);
