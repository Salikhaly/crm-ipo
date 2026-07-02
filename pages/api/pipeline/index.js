// pages/api/pipeline/index.js
// GET  /api/pipeline  → все этапы воронки
// PUT  /api/pipeline  → обновить всю воронку (только admin)

import { getSupabase } from '../../../lib/supabase'
import { apiError } from '../../../lib/apiError'
import { withAuth } from '../../../lib/auth'

export default withAuth(async function handler(req, res) {
  const sb = getSupabase()
  const { role } = req.user

  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('pipeline_stages')
      .select('*')
      .order('sort_order')

    if (error) return apiError(res, error)
    return res.status(200).json({
      pipeline: data.map(p => ({ id: p.id, l: p.label, c: p.color }))
    })
  }

  if (req.method === 'PUT') {
    if (role !== 'admin') return res.status(403).json({ error: 'Только admin' })

    const { stages } = req.body
    if (!Array.isArray(stages) || stages.length === 0) {
      return res.status(400).json({ error: 'stages должен быть непустым массивом' })
    }

    // Получаем текущие этапы воронки
    const { data: existing } = await sb.from('pipeline_stages').select('id')
    const newIds     = new Set(stages.map(s => s.id))
    const removedIds = (existing || []).map(s => s.id).filter(id => !newIds.has(id))

    // Проверяем, есть ли клиенты на удаляемых этапах
    if (removedIds.length > 0) {
      const { count } = await sb
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .in('stage', removedIds)

      if (count > 0) {
        return res.status(400).json({
          error: `Нельзя удалить этапы: на них находятся ${count} клиент(ов). Переместите клиентов на другой этап сначала.`,
          affectedCount: count,
          removedStages: removedIds,
        })
      }

      // Безопасно: удаляем убранные этапы
      await sb.from('pipeline_stages').delete().in('id', removedIds)
    }

    const rows = stages.map((s, i) => ({
      id:         s.id,
      label:      s.l,
      color:      s.c,
      sort_order: i + 1,
    }))

    // Upsert оставшихся / новых этапов
    const { error } = await sb.from('pipeline_stages').upsert(rows, { onConflict: 'id' })
    if (error) return apiError(res, error)

    return res.status(200).json({ ok: true, pipeline: stages })
  }

  return res.status(405).json({ error: 'Метод не разрешён' })
})
