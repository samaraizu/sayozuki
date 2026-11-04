-- スタッフ画面で編集するメニューの、Squareに持てない情報（4言語の訳・一時停止）
CREATE TABLE menu_meta (
  item_id TEXT PRIMARY KEY,          -- Squareの商品（ITEM）のid
  names TEXT,                        -- {"en":…,"zht":…,"zhs":…,"ko":…}
  descs TEXT,
  paused INTEGER NOT NULL DEFAULT 0, -- 1 = 一時的に注文を止める（ゲスト画面では「売り切れ」）
  updated_at TEXT NOT NULL
);
