-- 食事をあとから手で入れた記録（予約管理の予約の中身 →「食事を入れる」）。
-- Airbnb には食事の申込欄がないので、予約が入ったらメッセージで聞いて、その答えをここに入れる。
-- HP・ほかのサイトの予約は申込のときに食事を選んでいるので、直すときだけ使う。
-- 台帳スプシが正本なので、取り込みGASが /api/sync/pending でこれを受け取り、台帳の「食事」列に書く。
-- 台帳が同じ値を返してくるまで（applied = 0 のあいだ）は、台帳から来た値で D1 の食事を戻さない。
CREATE TABLE IF NOT EXISTS meal_plans (
  no TEXT PRIMARY KEY,                     -- 予約番号
  meals TEXT NOT NULL,                     -- 台帳の「食事」列に入れる1行（Lib.mealText）
  plan TEXT NOT NULL DEFAULT '[]',         -- 泊ごとの人数 [{ dinner, breakfast }]（JSON）
  note TEXT NOT NULL DEFAULT '',           -- 料理・時間・アレルギーなど
  actor TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  applied INTEGER NOT NULL DEFAULT 0       -- 台帳に反映されたか
);
CREATE INDEX IF NOT EXISTS meal_plans_applied ON meal_plans (applied);
