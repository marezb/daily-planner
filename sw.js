const CACHE_NAME = 'daily-planner-v3';

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([
                './',
                './index.html',
                './style.css',
                './app.js',
                './manifest.json',
                'https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js'
            ]);
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
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
