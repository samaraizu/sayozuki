// スタッフ画面のサービスワーカー：通知の合図を受けたら、最新の一文を取りにいって表示する
const pinFromIdb = () =>
  new Promise((resolve) => {
    try {
      const req = indexedDB.open('syz', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => {
        const g = req.result.transaction('kv').objectStore('kv').get('pin');
        g.onsuccess = () => resolve(g.result || null);
        g.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

async function show() {
  let body = '新しい注文・リクエスト・メッセージが届きました';
  let link = '/staff/';
  try {
    const pin = await pinFromIdb();
    if (pin) {
      const r = await fetch('/staff/api/push/latest', { headers: { authorization: 'Bearer ' + pin }, cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        if (d.text) body = d.text;
        if (d.link) link = d.link;
      }
    }
  } catch {}
  // iPhoneは合図ごとに必ず通知を出す必要がある
  return self.registration.showNotification('小夜月', { body, tag: 'syz-' + Date.now(), icon: '/staff/icon-192.png', badge: '/staff/icon-192.png', data: { link } });
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (e) => e.waitUntil(show()));
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || '/staff/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      for (const c of cs) {
        if (c.url.includes('/staff/') && 'navigate' in c) return c.navigate(link).then((w) => (w || c).focus());
      }
      return self.clients.openWindow(link);
    })
  );
});
