import '../styles/globals.css'
import Head from 'next/head'
import { useEffect } from 'react'

export default function App({ Component, pageProps }) {
  // Регистрируем service worker — CRM становится устанавливаемым приложением.
  // SW не кэширует данные (см. public/sw.js), только иконки — без риска устаревания.
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  return (
    <>
      <Head>
        {/* viewport-fit=cover — включает env(safe-area-inset-*) на телефонах с вырезом/жестовой панелью */}
        <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"/>
        <meta name="theme-color" content="#0f172a"/>
        {/* mobile-web-app-capable — актуальная замена deprecated apple-* (было предупреждение в консоли) */}
        <meta name="mobile-web-app-capable" content="yes"/>
        <meta name="apple-mobile-web-app-capable" content="yes"/>
        {/* default (непрозрачный статус-бар): при black-translucent контент PWA
            рисовался ПОД часами/батареей — «экран кривой», верх приложения перекрыт */}
        <meta name="apple-mobile-web-app-status-bar-style" content="default"/>
        <meta name="apple-mobile-web-app-title" content="Ипотека CRM"/>
        <link rel="manifest" href="/manifest.webmanifest"/>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
        <link rel="icon" type="image/png" href="/icon-192.png"/>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css"/>
        <title>Ипотека CRM</title>
      </Head>
      <Component {...pageProps} />
    </>
  )
}
