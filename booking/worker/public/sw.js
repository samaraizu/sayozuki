// 予約管理のサービスワーカー：通知の合図を受けたら、最新の一文を取りにいって表示する（src/push.ts）
async function show() {
  let title = '小夜月 予約';
  let body = '新しいお知らせがあります';
  let link = '/';
  try {
    // ログイン中のクッキーで取る。ログインが切れていたら決まり文句のまま出す
    const r = await fetch('/api/push/latest', { credentials: 'same-origin', cache: 'no-store' });
    if (r.ok) {
      const d = await r.json();
      if (d.title) title = d.title;
      if (d.body) body = d.body;
      if (d.link) link = d.link;
    }
  } catch {}
  // iPhoneは合図ごとに必ず通知を出す必要がある
  return self.registration.showNotification(title, { body, tag: 'sz-' + Date.now(), icon: '/icon-192.png', badge: '/icon-192.png', data: { link } });
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (e) => e.waitUntil(show()));
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      for (const c of cs) {
        if ('focus' in c) return c.navigate(link).then((w) => (w || c).focus());
      }
      return self.clients.openWindow(link);
    }),
  );
});
