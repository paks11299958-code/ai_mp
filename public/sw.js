const CACHE_NAME = 'ai-chat-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 외부 도메인 요청은 SW에서 처리하지 않음
  if (!request.url.startsWith(self.location.origin)) return;

  // API 요청 및 POST 요청은 캐시 없이 그대로 통과
  if (request.url.includes('/api/') || request.url.includes('/api-proxy')) return;
  if (request.method !== 'GET') return;

  // 페이지 이동 요청: 네트워크 우선, 실패 시 캐시된 index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/'))
    );
    return;
  }

  // 정적 자산 (GET만): 캐시 우선
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
        return response;
      });
    })
  );
});
