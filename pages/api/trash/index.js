// pages/api/trash/index.js
// Корзина клиентов (deleted_clients, миграция 015). Только admin/head.
//   GET             → список последних 200 удалённых
//   POST   {id}     → восстановить клиента (запись возвращается в clients)
//   DELETE {id}     → удалить навсегда
// Если миграция не применена — GET отвечает { ready:false }, UI показывает подсказку.

import { getSupabase } from '../../../lib/supabase'
import { withRole } from '../../../lib/auth'
import { apiError } from '../../../lib/apiError'
import { logAction } from '../../../lib/actionLog'

async function handler(req, res) {
  const sb = getSupabase()

  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('deleted_clients')
      .select('id, fio, phone, deleted_by, deleted_at')
      .order('deleted_at', { ascending: false })
      .limit(200)
    if (error) return res.status(200).json({ items: [], ready: false })
    return res.status(200).json({ items: data || [], ready: true })
  }

  if (req.method === 'POST') {
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id обязателен' })

    const { data: row, error: getErr } = await sb.from('deleted_clients').select('*').eq('id', id).maybeSingle()
    if (getErr || !row) return res.status(404).json({ error: 'Запись в корзине не найдена' })

    // Возвращаем клиента как был (data — полный дамп строки clients)
    const { error: insErr } = await sb.from('clients').insert(row.data)
    if (insErr) {
      // Скорее всего конфликт: телефон/ИИН уже занят новым клиентом
      return apiError(res, insErr, 409, 'Не удалось восстановить: телефон или ИИН уже занят другим клиентом')
    }
    await sb.from('deleted_clients').delete().eq('id', id)
    logAction({ action:'create', entity:'client', entityId:id, entityName:row.fio, detail:'восстановлен из корзины', user:req.user })
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id обязателен' })
    const { data: row } = await sb.from('deleted_clients').select('fio').eq('id', id).maybeSingle()
    const { error } = await sb.from('deleted_clients').delete().eq('id', id)
    if (error) return apiError(res, error)
    logAction({ action:'delete', entity:'client', entityId:id, entityName:row?.fio, detail:'из корзины навсегда', user:req.user })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Метод не разрешён' })
}

export default withRole('admin', 'head')(handler)
