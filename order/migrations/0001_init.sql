-- 滞在（チェックインごとに1件。客室QRのトークンはここに紐づく）
CREATE TABLE stays (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  room TEXT NOT NULL,
  guests_taxable INTEGER NOT NULL DEFAULT 0,
  guests_exempt INTEGER NOT NULL DEFAULT 0,
  nights INTEGER NOT NULL DEFAULT 1,
  checkin_date TEXT NOT NULL,           -- YYYY-MM-DD（日本時間）
  status TEXT NOT NULL DEFAULT 'active', -- active | checkout_pending | settled
  dnd INTEGER NOT NULL DEFAULT 0,
  square_order_id TEXT,
  payment_link_id TEXT,
  payment_url TEXT,
  settled_method TEXT,                  -- square | manual | none
  bath_tax_yen INTEGER,                 -- 精算時に確定した入湯税額
  created_at TEXT NOT NULL,
  settled_at TEXT
);
CREATE INDEX idx_stays_status ON stays(status);
CREATE INDEX idx_stays_checkin ON stays(checkin_date);
CREATE INDEX idx_stays_square_order ON stays(square_order_id);

-- 客室からの注文
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  stay_id TEXT NOT NULL REFERENCES stays(id),
  delivery TEXT NOT NULL DEFAULT 'door', -- door | hand
  status TEXT NOT NULL DEFAULT 'new',    -- new | delivered | canceled
  total INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  delivered_at TEXT
);
CREATE INDEX idx_orders_stay ON orders(stay_id);
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

-- 0円リクエスト（日本茶セット・湯たんぽなど）
CREATE TABLE requests (
  id TEXT PRIMARY KEY,
  stay_id TEXT NOT NULL REFERENCES stays(id),
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',    -- new | done
  created_at TEXT NOT NULL,
  done_at TEXT
);
CREATE INDEX idx_requests_stay ON requests(stay_id);
CREATE INDEX idx_requests_status ON requests(status);
