// pages/api/managers/[id].js
// PUT    /api/managers/:id  → обновить
// DELETE /api/managers/:id  → удалить (только admin)

import { getSupabase } from '../../../lib/supabase'
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

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ manager: data })
  }

  if (req.method === 'DELETE') {
    if (role !== 'admin') return res.status(403).json({ error: 'Только admin' })
    const { error } = await sb.from('managers').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Метод не разрешён' })
})
