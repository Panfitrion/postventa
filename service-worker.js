const CACHE_NAME = 'pedidos-b2b-v1';
const urlsToCache = [
    '/',
    './index.html',      // Asegúrate de que este nombre esté correctamente en minúsculas.
    './Style.css',
    './script.js',
    './appstore.png',
    './manifest.json',
    './app.js'           // Asegúrate de que este archivo exista en tu proyecto.
];

// Instalar Service Worker y almacenar recursos en cache
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Cache abierta y recursos cacheados.');
                return cache.addAll(urlsToCache);
            })
    );
});

// Interceptar solicitudes y servir desde cache
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Devuelve el recurso del cache si existe
                return response || fetch(event.request);
            })
    );
});

// Opcional: Activar el Service Worker y limpiar recursos antiguos de cache
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName); // Elimina caches viejos
                    }
                })
            );
        })
    );
});