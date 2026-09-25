const CACHE = 'site-sketch-1.8.0-20260925-175149';
const FILES = ['./', 'index.html', 'sketch/index.html', 'agwest-russel.csv', 'manifest.webmanifest',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
// fetch every file past the browser's own cache (GitHub Pages lets it keep pages for 10 minutes)
const fresh = url => fetch(new Request(url, { cache: 'reload' }));
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => fresh(f).then(r => {
    if (!r.ok) throw new Error('could not fetch ' + f);
    return c.put(f, r);
  })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !fonts) return;
  const page = url.origin === location.origin && (req.mode === 'navigate' || /(\/|\.html|\.webmanifest)$/.test(url.pathname));
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = () => cache.match(req, { ignoreSearch: url.origin === location.origin });
    if (page) {
      // pages: the network first, so a new version shows straight away; the saved copy after 4 s or with no signal
      try {
        const res = await Promise.race([
          fetch(req, { cache: 'no-cache' }),
          new Promise((_, no) => setTimeout(() => no(new Error('slow')), 4000)),
        ]);
        if (res && res.ok) { cache.put(url.pathname.endsWith('/') ? './' : req, res.clone()); return res; }
        return (await hit()) || res;
      } catch (err) { return (await hit()) || Response.error(); }
    }
    // icons, fonts, sample: the saved copy at once, refreshed in the background
    const saved = await hit();
    const net = fetch(req, { cache: 'no-cache' }).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => saved);
    return saved || net;
  }));
});
