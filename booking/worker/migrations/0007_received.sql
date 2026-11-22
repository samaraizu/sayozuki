-- 受取額（OTAの手数料を引いた手取り）。予約管理アプリの売上の月表示で使う。台帳の「受取額」から同期で入る
ALTER TABLE bookings ADD COLUMN received TEXT NOT NULL DEFAULT '';
