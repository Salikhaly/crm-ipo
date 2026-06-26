// pages/api/managers/index.js
// GET  /api/managers  → все менеджеры
// POST /api/managers  → создать (только admin)

import { getSupabase } from '../../../lib/supabase'
import { withAuth } from '../../../lib/auth'

export default withAuth(async function handler(req, res) {
  const sb = getSupabase()
  const { role } = req.user

  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('managers')
      .select('*')
      .order('created_at')

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ managers: data })
  }

  if (req.method === 'POST') {
    if (role !== 'admin' && role !== 'head') {
      return res.status(403).json({ error: 'Нет доступа' })
    }

    const m = req.body
    if (!m.name) return res.status(400).json({ error: 'name обязателен' })

    const { data, error } = await sb
      .from('managers')
      .insert({
        id:     m.id,
        name:   m.name,
        phone:  m.phone  || '',
        role:   m.role   || 'manager',
        color:  m.color  || '#3b82f6',
        active: m.active !== false,
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ manager: data })
  }

  return res.status(405).json({ error: 'Метод не разрешён' })
})
