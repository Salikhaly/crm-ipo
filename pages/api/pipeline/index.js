// pages/api/pipeline/index.js
// GET  /api/pipeline  → все этапы воронки
// PUT  /api/pipeline  → обновить всю воронку (только admin)

import { getSupabase } from '../../../lib/supabase'
import { withAuth } from '../../../lib/auth'

export default withAuth(async function handler(req, res) {
  const sb = getSupabase()
  const { role } = req.user

  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('pipeline_stages')
      .select('*')
      .order('sort_order')

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({
      pipeline: data.map(p => ({ id: p.id, l: p.label, c: p.color }))
    })
  }

  if (req.method === 'PUT') {
    if (role !== 'admin') return res.status(403).json({ error: 'Только admin' })

    const { stages } = req.body
    if (!Array.isArray(stages)) return res.status(400).json({ error: 'stages должен быть массивом' })

    const rows = stages.map((s, i) => ({
      id:         s.id,
      label:      s.l,
      color:      s.c,
      sort_order: i + 1,
    }))

    // Удаляем старые и вставляем новые
    const { error } = await sb.from('pipeline_stages').upsert(rows, { onConflict: 'id' })
    if (error) return res.status(500).json({ error: error.message })

    return res.status(200).json({ ok: true, pipeline: stages })
  }

  return res.status(405).json({ error: 'Метод не разрешён' })
})
