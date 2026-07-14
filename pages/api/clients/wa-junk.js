// pages/api/clients/wa-junk.js
// GET  → кандидаты на чистку: авто-созданные из WhatsApp лиды, которые так и не
//        стали реальными (источник whatsapp, без договора, застряли в «Новый лид»).
// POST { ids } → мягко удалить выбранных в корзину (deleted_clients) — восстановимо.
// Только admin/head.

import { getSupabase, dbToClient } from '../../../lib/supabase'
import { apiError } from '../../../lib/apiError'
import { withRole } from '../../../lib/auth'
import { logAction } from '../../../lib/actionLog'

async function handler(req, res) {
  const sb = getSupabase()

  if (req.method === 'GET') {
    // Кандидаты: пришли из WhatsApp, без типа договора, в стадии «Новый лид».
    // Это авто-созданные до смены модели лиды, которые никуда не двинулись.
    const { data, error } = await sb
      .from('clients')
      .select('*')
      .eq('source', 'whatsapp')
      .eq('stage', 'new_lead')
      .order('created_at', { ascending: true })
    if (error) return apiError(res, error)
    // Дополнительно отсекаем тех, у кого уже есть договор или задачи (значит, в работе)
    const junk = (data || [])
      .map(dbToClient)
      .filter(c => !c.contractType && !(c.tasks || []).some(t => !t.done))
    return res.status(200).json({ clients: junk, total: junk.length })
  }

  if (req.method === 'POST') {
    const { ids } = req.body || {}
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'Нужен список ids' })
    const safeIds = ids.slice(0, 2000)

    // Копия в корзину (восстановимо), затем удаление из clients
    const { data: victims } = await sb.from('clients').select('*').in('id', safeIds)
    let trashed = 0
    for (const v of (victims || [])) {
      const { error: e } = await sb.from('deleted_clients').upsert({
        id: v.id, data: v, fio: v.fio || '', phone: v.phone || '',
        deleted_by: (req.user?.name || '') + ' (чистка WA)',
      })
      if (!e) trashed++
    }
    const { error } = await sb.from('clients').delete().in('id', safeIds)
    if (error) return apiError(res, error)
    logAction({ action: 'delete', entity: 'client', entityId: 'bulk',
      entityName: `${safeIds.length} WA-лидов`, detail: 'чистка WA → корзина', user: req.user })
    return res.status(200).json({ ok: true, deleted: safeIds.length, trashed })
  }

  return res.status(405).json({ error: 'Метод не разрешён' })
}

export default withRole('admin', 'head')(handler)
