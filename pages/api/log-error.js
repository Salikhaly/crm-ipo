// pages/api/log-error.js
// №9: Лёгкий мониторинг ошибок фронтенда без внешних сервисов.
// Фронт шлёт сюда пойманные window.onerror / unhandledrejection,
// пишем в Supabase error_logs. Смотреть: Supabase → Table Editor → error_logs.

import { getSupabase } from '../../lib/supabase'

// Простая защита от флуда: не больше 20 ошибок/мин с инстанса
let _count = 0
let _windowStart = Date.now()

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const now = Date.now()
  if (now - _windowStart > 60_000) { _windowStart = now; _count = 0 }
  if (++_count > 20) return res.status(429).json({ ok: false })

  try {
    const { message, stack, url, userName } = req.body || {}
    if (!message) return res.status(400).json({ error: 'message required' })

    const sb = getSupabase()
    await sb.from('error_logs').insert({
      message:    String(message).slice(0, 500),
      stack:      String(stack || '').slice(0, 3000),
      url:        String(url || '').slice(0, 300),
      user_name:  String(userName || '').slice(0, 100),
      user_agent: String(req.headers['user-agent'] || '').slice(0, 300),
    })
    return res.status(200).json({ ok: true })
  } catch (e) {
    // Логгер не должен сам создавать ошибки
    return res.status(200).json({ ok: false })
  }
}
