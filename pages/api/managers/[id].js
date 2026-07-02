// pages/api/managers/[id].js
// PUT    /api/managers/:id  → обновить
// DELETE /api/managers/:id  → удалить (только admin)

import { getSupabase } from '../../../lib/supabase'
import { apiError } from '../../../lib/apiError'
import { withAuth } from '../../../lib/auth'

export default withAuth(async function handler(req, res) {
  const sb = getSupabase()
  const { id } = req.query
  const { role } = req.user

  if (role !== 'admin' && role !== 'head') {
    return res.status(403).json({ error: 'Нет доступа' })
  }

  if (req.method === 'PUT') {
    const m = req.body
    const { data, error } = await sb
      .from('managers')
      .update({
        name:   m.name,
        phone:  m.phone  || '',
        role:   m.role   || 'manager',
        color:  m.color  || '#3b82f6',
        active: m.active !== false,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return apiError(res, error)
    return res.status(200).json({ manager: data })
  }

  if (req.method === 'DELETE') {
    if (role !== 'admin') return res.status(403).json({ error: 'Только admin' })

    // Проверяем наличие клиентов у этого менеджера
    const { count, error: countErr } = await sb
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('manager', id)

    if (countErr) return res.status(500).json({ error: countErr.message })

    if (count > 0) {
      return res.status(400).json({
        error: `У менеджера ${count} клиент(ов). Переназначьте их другому менеджеру перед удалением.`,
        clientCount: count,
      })
    }

    // Также проверяем responsible_manager
    const { count: respCount, error: respErr } = await sb
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('responsible_manager', id)

    if (respErr) return res.status(500).json({ error: respErr.message })

    if (respCount > 0) {
      return res.status(400).json({
        error: `Менеджер является ответственным у ${respCount} клиент(ов). Снимите назначение перед удалением.`,
        clientCount: respCount,
      })
    }

    const { error } = await sb.from('managers').delete().eq('id', id)
    if (error) return apiError(res, error)
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Метод не разрешён' })
})
