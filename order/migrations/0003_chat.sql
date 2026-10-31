-- スタッフとのチャット（部屋ごと）と、スタッフのスマホへのプッシュ通知
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  sender TEXT NOT NULL,              -- guest | staff
  body TEXT NOT NULL,                -- 書いた人の言葉そのまま
  lang TEXT NOT NULL,                -- 書いた人の言語（ja / en / zht / zhs / ko）
  translated TEXT,                   -- 相手側の言語に訳したもの（訳せなかったとき・同じ言語のときは NULL）
  translated_lang TEXT,
  closed INTEGER NOT NULL DEFAULT 0, -- 1 = チェックアウトで閉じた会話（次のお客様には見せない）
  read_at TEXT,                      -- 相手が読んだ時刻
  created_at TEXT NOT NULL
);
CREATE INDEX idx_messages_room ON messages(room_id, closed, created_at);

-- スタッフのスマホ（ホーム画面に追加したスタッフ画面）ごとの通知の宛先
CREATE TABLE push_subs (
  endpoint TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

-- 通知用の鍵や、通知に出す最新の一文など
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
