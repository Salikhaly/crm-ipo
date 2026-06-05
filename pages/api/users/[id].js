// pages/api/users/[id].js
// PUT    /api/users/:id  → обновить (только admin)
// DELETE /api/users/:id  → удалить (только admin)

import { getSupabase } from '../../../lib/supabase'
import { withAuth } from '../../../lib/auth'

export default withAuth(async function handler(req, res) {
  const sb = getSupabase()
  const { id } = req.query
  const { role } = req.user

  if (role !== 'admin') {
    return res.status(403).json({ error: 'Только для администратора' })
  }

  if (req.method === 'PUT') {
    const u = req.body
    const { data, error } = await sb
      .from('users')
      .update({
        name:       u.name       || '',
        login:      u.login,
        pwd:        u.pwd,
        role:       u.role       || 'manager',
        manager_id: u.mid        || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ user: data })
  }

  if (req.method === 'DELETE') {
    const { error } = await sb.from('users').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Метод не разрешён' })
})
