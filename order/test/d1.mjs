// 本物の D1（wrangler の getPlatformProxy＝ローカルの workerd）に migrations を当てたものを作る。SQL が実際に動くかを確かめるテスト用
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';

export async function makeDb(dir = new URL('../migrations/', import.meta.url)) {
  const tmp = mkdtempSync(join(tmpdir(), 'sz-d1-'));
  const config = join(tmp, 'wrangler.json');
  writeFileSync(config, JSON.stringify({ name: 'test', compatibility_date: '2026-10-01', d1_databases: [{ binding: 'DB', database_name: 'test', database_id: 'test' }] }));
  const proxy = await getPlatformProxy({ configPath: config, persist: { path: join(tmp, 'state') } });
  const db = proxy.env.DB;
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(new URL(f, dir), 'utf8')
      .split('\n')
      .map((l) => l.replace(/--.*$/, ''))
      .join('\n');
    for (const stmt of sql.split(';').map((x) => x.trim()).filter(Boolean)) await db.prepare(stmt).run();
  }
  return { db, dispose: () => proxy.dispose() };
}
