-- 手元（--local）の確認用の客室。本番のD1には流さないこと（idが推測できる）。
-- 開くURL：http://127.0.0.1:8787/?r=local-dev-201 など
INSERT OR IGNORE INTO rooms (id, name, sort, created_at) VALUES
  ('local-dev-201', '201号室', 1, datetime('now')),
  ('local-dev-zao', '蔵王', 2, datetime('now')),
  ('local-dev-gassan', '月山', 3, datetime('now')),
  ('local-dev-301', '301号室', 4, datetime('now')),
  ('local-dev-302', '302号室', 5, datetime('now')),
  ('local-dev-304', '304号室', 6, datetime('now'));
