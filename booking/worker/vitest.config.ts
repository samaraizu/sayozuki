import { defineConfig } from 'vitest/config';

// Node で動かすテストでは cloudflare:workers がないので、中身のない代わりを使う
export default defineConfig({
  resolve: { alias: { 'cloudflare:workers': new URL('./test/stub-cloudflare-workers.ts', import.meta.url).pathname } },
});
