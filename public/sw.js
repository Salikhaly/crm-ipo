// public/sw.js — минимальный service worker для установки CRM как приложения.
// НАМЕРЕННО не кэшируем API и HTML: CRM работает с живыми данными (клиенты,
// WhatsApp), устаревший кэш опаснее пользы. Кэшируем только статические иконки,
// чтобы приложение было «устанавливаемым» и иконка грузилась офлайн.
const CACHE = 'ipoteka-crm-v1'
const ASSETS = ['/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/manifest.webmanifest']

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  // Только GET наших статических иконок — из кэша, если есть. Всё остальное
  // (навигация, API) идёт в сеть как обычно, без вмешательства SW.
  if (e.request.method === 'GET' && ASSETS.includes(url.pathname)) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)))
  }
})
