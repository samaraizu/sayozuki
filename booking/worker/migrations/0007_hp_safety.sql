-- HPの事前決済の見回りを丈夫にする（2026-11-19）
-- mail_tries：確認メールを送ろうとした回数。失敗したら毎分の見回りで3回まで送り直す
--   mailed は 0 = まだ／1 = 送った／2 = 送っている途中
-- ip_hash：申込みの送り元（IPのハッシュ。生のIPは残さない）。同じ送り元からの押さえすぎを止める
ALTER TABLE hp_checkouts ADD COLUMN mail_tries INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hp_checkouts ADD COLUMN ip_hash TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS hp_checkouts_ip ON hp_checkouts (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS hp_checkouts_email ON hp_checkouts (email, status);
