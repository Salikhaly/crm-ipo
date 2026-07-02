// pages/api/calc-settings/index.js
// GET  — загрузить настройки (все роли)
// PUT  — сохранить настройки (только admin)
// DELETE — удалить программу или быстрый ответ (только admin)

import { getSupabase }  from '../../../lib/supabase'
import { apiError } from '../../../lib/apiError'
import { withAuth }     from '../../../lib/auth'

export default withAuth(async function handler(req, res) {
  const sb   = getSupabase()
  const role = req.user?.role

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const [settRes, progRes, qrRes] = await Promise.all([
      sb.from('calc_settings').select('*').eq('id', 'main').maybeSingle(),
      sb.from('calc_programs').select('*').eq('active', true).order('sort_order'),
      sb.from('wa_quick_replies').select('*').eq('active', true).order('sort_order'),
    ])
    return res.status(200).json({
      ok:       true,
      settings: settRes.data || null,
      programs: progRes.data || [],
      replies:  qrRes.data   || [],
    })
  }

  // ── PUT — только admin ───────────────────────────────────────────────────
  if (req.method === 'PUT') {
    if (role !== 'admin') return res.status(403).json({ error: 'Только техник (admin)' })

    const { settings, programs, replies } = req.body || {}
    const errs = []

    // Основные настройки МРП / ПМ / КД
    if (settings) {
      const { error } = await sb.from('calc_settings').upsert({
        id:         'main',
        mrp:        +settings.mrp       || 4325,
        pm_nauryz:  +settings.pmNauryz  || 10,
        pm_other:   +settings.pmOther   || 13,
        kd:         settings.kd         || undefined,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      if (error) errs.push({ section: 'settings', error: process.env.NODE_ENV === 'development' ? error.message : 'DB error' })
    }

    // Программы (upsert по key)
    if (Array.isArray(programs)) {
      for (const p of programs) {
        const { error } = await sb.from('calc_programs').upsert({
          key:        p.key,
          name:       p.name,
          icon:       p.icon       || '🏠',
          down_ratio: +p.downRatio || 0.20,
          desc_text:  p.desc       || '',
          active:     p.active     !== false,
          sort_order: +p.sortOrder || 0,
          variants:   p.variants   || [],
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })
        if (error) errs.push({ section: 'program:' + p.key, error: process.env.NODE_ENV === 'development' ? error.message : 'DB error' })
      }
    }

    // Быстрые ответы (upsert по id)
    if (Array.isArray(replies)) {
      for (const r of replies) {
        const row = {
          trigger:    r.trigger,
          title:      r.title,
          body:       r.body,
          category:   r.category   || 'general',
          active:     r.active     !== false,
          sort_order: +r.sortOrder || 0,
        }
        if (r.id && !r.id.startsWith('reply_')) row.id = r.id  // сохраняем UUID если он настоящий
        const { error } = await sb.from('wa_quick_replies').upsert(row, { onConflict: 'id' })
        if (error) errs.push({ section: 'reply:' + r.trigger, error: process.env.NODE_ENV === 'development' ? error.message : 'DB error' })
      }
    }

    return res.status(errs.length ? 207 : 200).json({ ok: !errs.length, errors: errs })
  }

  // ── DELETE ───────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (role !== 'admin') return res.status(403).json({ error: 'Только техник (admin)' })

    const { replyId, programKey } = req.body || {}

    if (replyId) {
      const { error } = await sb.from('wa_quick_replies').delete().eq('id', replyId)
      if (error) return apiError(res, error)
    }
    if (programKey) {
      // Деактивируем, не удаляем — чтобы не ломать расчёты по старым клиентам
      const { error } = await sb.from('calc_programs').update({ active: false }).eq('key', programKey)
      if (error) return apiError(res, error)
    }
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Метод не поддерживается' })
})
