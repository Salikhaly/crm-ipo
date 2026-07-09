// pages/api/logs/index.js
// GET /api/logs → журнал действий (последние 200). Только admin/head.
// Таблица action_logs создаётся миграцией 014; до неё возвращаем пустой список.

import { getSupabase } from '../../../lib/supabase'
import { withRole } from '../../../lib/auth'

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })

  try {
    const sb = getSupabase()
    const { data, error } = await sb
      .from('action_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    // Таблицы ещё нет (миграция 014 не применена) — не ошибка для клиента
    if (error) return res.status(200).json({ logs: [], ready: false })

    return res.status(200).json({ logs: data || [], ready: true })
  } catch (e) {
    return res.status(200).json({ logs: [], ready: false })
  }
}

export default withRole('admin', 'head')(handler)
