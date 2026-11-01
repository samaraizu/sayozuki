import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// ビルド時に作ったページを Workers の静的アセットから読む（R2 は使わない・未有効）。
// これがないと /en などの [lang] ページ（dynamicParams = false）が見つからず 404 になる。
// 読み取り専用なので、revalidate などでページを作り直す処理を足すときは R2 などに替える。
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
