/** @type {import('next').NextConfig} */

// ─── HTTP Security Headers ───────────────────────────────────────────────────
// Закрывает аудит C3: нет CSP, HSTS, X-Frame-Options и других заголовков.
const securityHeaders = [
  // Запрет встраивания в iframe → защита от clickjacking
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  // Запрет MIME sniffing
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // Политика referrer
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // HSTS: браузер 2 года использует только HTTPS
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // Отключаем лишние браузерные API
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  // Content Security Policy
  // unsafe-inline нужен пока используются inline-styles (весь index.js)
  // После рефакторинга на CSS-модули — убрать 'unsafe-inline'
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
      "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://*.supabase.co https://api.green-api.com https://sentry.io https://cdn.jsdelivr.net https://fonts.googleapis.com https://fonts.gstatic.com",
      // Голосовые и видео из WhatsApp лежат в Supabase Storage, а запасная ссылка —
      // на CDN Green API (digitaloceanspaces). С одним 'self' браузер резал их молча:
      // «violates media-src» — плеер был пустой, и это принимали за битый файл/кодек.
      // Фото работали только потому, что img-src ниже разрешает https: целиком.
      "media-src 'self' blob: data: https://*.supabase.co https://*.digitaloceanspaces.com https://api.green-api.com",
      "object-src 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const nextConfig = {
  // Включить Strict Mode (скрывался баги с двойными useEffect)
  // Закрывает аудит M4
  reactStrictMode: false,

  swcMinify: true,

  async headers() {
    return [
      {
        // Применяем заголовки ко всем маршрутам
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
