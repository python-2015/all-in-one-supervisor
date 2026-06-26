// 全能监督 - Service Worker
const CACHE_NAME = 'qiannengjiandu-v1.0.0';
const ASSETS = [
    './',
    './app.html',
    './index.html',
    './style.css',
    './dark.css',
    './script.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// 安装：预缓存所有资源
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// 拦截请求：网络优先，失败时用缓存
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // 成功响应：更新缓存
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            })
            .catch(() => {
                // 网络失败：返回缓存
                return caches.match(event.request).then((cached) => {
                    if (cached) return cached;
                    // 都没有：返回兜底 HTML
                    if (event.request.mode === 'navigate') {
                        return caches.match('./app.html');
                    }
                });
            })
    );
});
