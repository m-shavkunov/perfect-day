const scope = new URL(self.registration.scope)
const shellUrl = new URL('index.html', scope).href
const precache = new Set(shellFiles.map(file => new URL(file, scope).href))
const cachePrefix = 'perfect-day-shell:' + scope.href + ':'
const cacheName = cachePrefix + buildId

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(
    [...precache].map(url => new Request(url, { cache: 'reload', credentials: 'omit' })),
  )))
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith(cachePrefix) && key !== cacheName).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || request.headers.has('authorization') || url.origin !== scope.origin
    || !url.pathname.startsWith(scope.pathname) || url.pathname === '/api' || url.pathname.startsWith('/api/')) return

  const cachedUrl = precache.has(url.href) ? url.href : request.mode === 'navigate' ? shellUrl : null
  if (!cachedUrl) return
  event.respondWith(caches.open(cacheName).then(cache => cache.match(cachedUrl)).then(response => response ?? fetch(request)))
})
