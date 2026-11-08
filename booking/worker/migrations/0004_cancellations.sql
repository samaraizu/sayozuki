-- 予約管理アプリの「キャンセル」。直販の予約をキャンセルにした記録（HPで前払いの予約は Square で返金）。
-- 台帳スプシが正本なので、取り込みGASが /api/sync/pending でこれを受け取り、台帳のステータスを「キャンセル」にする。
-- 台帳がキャンセルを返してくるまで（applied = 0 のあいだ）は、台帳から来た値で D1 のステータスを戻さない。
CREATE TABLE IF NOT EXISTS cancellations (
  no TEXT PRIMARY KEY,                     -- 予約番号
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  actor TEXT NOT NULL,                     -- 押した人
  reason TEXT NOT NULL DEFAULT '',
  days_before INTEGER NOT NULL,            -- ご到着日まであと何日だったか
  rate INTEGER NOT NULL,                   -- 規定のキャンセル料（%）
  paid INTEGER NOT NULL DEFAULT 0,         -- 支払額（円）
  fee INTEGER NOT NULL DEFAULT 0,          -- キャンセル料（円）
  refund INTEGER NOT NULL DEFAULT 0,       -- 返金した額（円。HPで前払いのときだけ）
  refund_id TEXT NOT NULL DEFAULT '',      -- Square の返金ID
  note TEXT NOT NULL DEFAULT '',           -- 台帳のメモに足す1行
  applied INTEGER NOT NULL DEFAULT 0       -- 台帳に反映されたか
);
CREATE INDEX IF NOT EXISTS cancellations_applied ON cancellations (applied);
