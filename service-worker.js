// MarketDx Service Worker
// Enables offline functionality and caching

const CACHE_NAME = 'marketdx-v2-cache';
const API_CACHE = 'marketdx-api-cache';
const CACHE_URLS = [
  '/',
  '/index.html',
  '/login.html',
  '/dashboard.html',
  '/offline.html',
  '/manifest.json',
  '/assets/css/main.css',
  '/assets/js/app.js',
];

// Install event - cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CACHE_URLS).catch(e => {
        console.log('Cache add error:', e);
        return;
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== API_CACHE)
          .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - cache + network strategy
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return event.respondWith(
      fetch(event.request).catch(() => {
        return new Response('Offline - Action unavailable', {status: 503});
      })
    );
  }

  // API calls - network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const cache = caches.open(API_CACHE);
            cache.then(c => c.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then(cached => {
            return cached || new Response(
              JSON.stringify({offline: true, cached: true}),
              {headers: {'Content-Type': 'application/json'}}
            );
          });
        })
    );
    return;
  }

  // HTML pages - cache first, network fallback
  if (event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => cached || fetch(event.request))
        .catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // Other assets - cache first
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
  );
});

// Background sync (when back online)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  try {
    // Sync pending diagnoses
    const pending = await getPendingDiagnoses();
    for (const diag of pending) {
      await fetch('/api/diagnosis/save', {
        method: 'POST',
        body: JSON.stringify(diag)
      });
    }
  } catch (e) {
    console.log('Sync error:', e);
  }
}

async function getPendingDiagnoses() {
  // Get from IndexedDB or localStorage
  return [];
}
