import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// ページはほぼ静的なので、R2 のキャッシュは使わない（R2 も未有効）
export default defineCloudflareConfig({});
