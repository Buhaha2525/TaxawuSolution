// Service Worker - Taxawu Solution
const CACHE_NAME = 'aquasass-v1';
const urlsToCache = [
    '/',
    '/dashboard',
    '/distributeur',
    '/login',
    '/register',
    '/profil',
    '/admin',
    '/css/dashboard.css',
    '/css/distributeur-dashboard.css',
    '/css/admin.css',
    '/css/login.css',
    '/css/style.css',
    '/css/profil.css',
    '/js/dashboard.js',
    '/js/distributeur-dashboard.js',
    '/js/admin.js',
    '/js/login.js',
    '/js/register.js',
    '/vendor/chartjs/chart.min.js',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png'
];

// Installation
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('✅ Service Worker: Cache ouvert');
            return cache.addAll(urlsToCache).catch(err => {
                console.log('⚠️ Cache partiel:', err);
            });
        })
    );
    self.skipWaiting();
});

// Activation
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
    console.log('✅ Service Worker: Activé');
});

// Fetch (stratégie Cache First pour les assets, Network First pour les pages)
self.addEventListener('fetch', (event) => {
    // Ne pas cacher les appels API
    if (event.request.url.includes('/api/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then((response) => {
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return response;
            });
        })
    );
});