// pages/api/checklists/index.js
// GET  /api/checklists        → все шаблоны чек-листов
// PUT  /api/checklists        → обновить шаблон (только admin)

import { getSupabase } from '../../../lib/supabase'
import { withAuth } from '../../../lib/auth'

export default withAuth(async function handler(req, res) {
  const sb = getSupabase()
  const { role } = req.user

  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('checklist_templates')
      .select('*')

    if (error) return res.status(500).json({ error: error.message })

    // Превращаем в { 'Сбор документов': [...items] }
    const map = {}
    ;(data || []).forEach(t => { map[t.stage_name] = t.items || [] })

    return res.status(200).json({ checklists: map })
  }

  if (req.method === 'PUT') {
    if (role !== 'admin') return res.status(403).json({ error: 'Только admin' })

    const { stage_name, items } = req.body
    if (!stage_name) return res.status(400).json({ error: 'stage_name обязателен' })

    const { error } = await sb
      .from('checklist_templates')
      .upsert({ stage_name, items: items || [] }, { onConflict: 'stage_name' })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Метод не разрешён' })
})
