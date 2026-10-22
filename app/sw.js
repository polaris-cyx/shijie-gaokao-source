/* 离线缓存
 * 页面导航：网络优先，断网回落到缓存；
 * 静态资源：缓存优先 + 后台更新；
 * PDF：运行时缓存，不预缓存（体积大）。
 */
const V = '__BUILD_VERSION__';
const CACHE = 'shijie-' + V;
const ASSETS = [
  './', './index.html', './app.css', './app.js', './data.bundle.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      await Promise.all(ASSETS.map((url) =>
        fetch(new Request(url, { cache: 'reload' }))
          .then((res) => { if (res && res.status === 200 && res.type === 'basic') return c.put(url, res); })
          .catch(() => {})
      ));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function put(req, res) {
  if (!res || res.status !== 200) return res;
  if (req.method !== 'GET') return res;
  const copy = res.clone();
  caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => put(req, res))
        .catch(() => caches.match('./index.html').then((hit) => hit || caches.match(req)))
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const net = fetch(req).then((res) => put(req, res)).catch(() => hit);
      return hit || net;
    })
  );
});
