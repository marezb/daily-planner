const CACHE_NAME = 'daily-planner-v4';

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([
                './',
                './index.html',
                './style.css',
                './app.js',
                './manifest.json',
                './icon-192.png',
                './icon-512.png',
                'https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js'
            ]);
        })
    );
});

self.addEventListener('activate', (event) => {
    // Usunięcie starych cache'y przy aktualizacji Service Workera
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.url.startsWith('https://graph.microsoft.com') || 
        event.request.url.startsWith('https://alcdn.msauth.net') ||
        event.request.url.startsWith('https://www.googleapis.com')) {
        return;
    }
    
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});
