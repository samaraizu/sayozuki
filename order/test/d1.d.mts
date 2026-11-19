export function makeDb(dir?: URL): Promise<{ db: D1Database; dispose: () => Promise<void> }>;
