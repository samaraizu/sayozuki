-- スマホへのプッシュ通知（予約管理アプリを「ホーム画面に追加」して「通知をオンにする」を押した端末）
CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT PRIMARY KEY,
  email TEXT NOT NULL,                    -- オンにした人。ALLOWED_EMAILS から外れたら送らない
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 通知に出した文。スマホ側（sw.js）は合図を受けたら /api/push/latest で最新を取りにくる
CREATE TABLE IF NOT EXISTS push_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT NOT NULL DEFAULT '/'
);
