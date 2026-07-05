// pages/api/calc-settings/index.js
// GET  → все настройки калькулятора (API + новый)
// POST → сохранить настройки

import { withRole }  from '../../../lib/auth'
import { getSupabase } from '../../../lib/supabase'
import { apiError, apiErrors } from '../../../lib/apiError'

async function handler(req, res) {
  const sb = getSupabase()

  // ── GET: вернуть все настройки ──────────────────────────────────
  if (req.method === 'GET') {
    const [settRes, progRes] = await Promise.all([
      sb.from('calc_settings').select('*').eq('id', 'main').single(),
      sb.from('calc_programs').select('*').eq('active', true).order('sort_order'),
    ])
    return res.status(200).json({
      ok:       true,
      settings: settRes.data  || null,
      programs: progRes.data  || [],
    })
  }

  // ── POST: сохранить настройки ───────────────────────────────────
  if (req.method === 'POST') {
    const { settings, programs } = req.body || {}
    const errs = []

    // Сохранение настроек (основные + расширенные)
    if (settings) {
      const {
        mrp, pm_nauryz, pm_other, kd,
        progs_data, expense_otbasy, expense_other,
        mrp_ref, deal_steps, insurance_pct,
        d50_table, rate_presets,
      } = settings

      const row = { id: 'main', updated_at: new Date().toISOString() }
      if (mrp         != null) row.mrp           = +mrp
      if (pm_nauryz   != null) row.pm_nauryz      = +pm_nauryz
      if (pm_other    != null) row.pm_other        = +pm_other
      if (kd          != null) row.kd             = kd
      if (progs_data  != null) row.progs_data      = progs_data
      if (expense_otbasy != null) row.expense_otbasy = expense_otbasy
      if (expense_other  != null) row.expense_other  = expense_other
      if (mrp_ref     != null) row.mrp_ref         = mrp_ref
      if (deal_steps  != null) row.deal_steps       = deal_steps
      if (d50_table   != null) row.d50_table        = d50_table
      if (rate_presets != null) row.rate_presets    = rate_presets
      if (insurance_pct != null) row.insurance_pct  = +insurance_pct

      const { error } = await sb.from('calc_settings').upsert(row)
      if (error) errs.push({ section: 'settings', error: process.env.NODE_ENV === 'development' ? error.message : 'DB error' })
    }

    // Сохранение программ API-калькулятора
    if (Array.isArray(programs)) {
      for (const p of programs) {
        const { error } = await sb.from('calc_programs').upsert({
          key:        p.key,
          name:       p.name,
          icon:       p.icon        || '🏠',
          down_ratio: p.downRatio   ?? 0.20,
          desc_text:  p.desc        || '',
          active:     p.active      !== false,
          sort_order: p.sortOrder   || 0,
          is_nauryz:  p.isNauryz    || false,
          variants:   p.variants    || [],
          updated_at: new Date().toISOString(),
        })
        if (error) errs.push({ section: 'program:' + p.key, error: process.env.NODE_ENV === 'development' ? error.message : 'DB error' })
      }
    }

    return res.status(200).json({ ok: errs.length === 0, errors: errs })
  }

  return apiErrors.methodNotAllowed(res)
}

export default withRole('admin', 'head')(handler)
