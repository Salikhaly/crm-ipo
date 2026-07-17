// pages/api/calc-settings/index.js
// GET         → все настройки калькулятора (API + новый) + быстрые ответы WhatsApp
// POST / PUT  → сохранить настройки / программы / шаблоны WA
// DELETE      → удалить шаблон WA ({replyId}) или программу ({programKey})
//
// ВАЖНО про методы: фронт (lib/api.js) шлёт сохранение PUT-ом, а удаление DELETE-ом.
// Раньше обработчик знал только GET и POST → каждая кнопка «Сохранить» в админке
// (налоги, договоры, поля карточки, маршруты, WhatsApp) молча ловила 405, и в базе
// так и лежали null-ы. Принимаем оба метода — upsert идемпотентен.

import { withRole }  from '../../../lib/auth'
import { getSupabase } from '../../../lib/supabase'
import { apiError, apiErrors } from '../../../lib/apiError'

// Фронт отдаёт camelCase, в таблице snake_case
const replyToDb = (r, i) => ({
  id:         r.id,
  trigger:    String(r.trigger || '').trim(),
  title:      String(r.title   || '').trim(),
  body:       String(r.body    || ''),
  category:   r.category || 'general',
  active:     r.active !== false,
  sort_order: r.sortOrder ?? i,
})

async function handler(req, res) {
  const sb = getSupabase()

  // ── GET: вернуть все настройки ──────────────────────────────────
  if (req.method === 'GET') {
    const [settRes, progRes, repRes] = await Promise.all([
      sb.from('calc_settings').select('*').eq('id', 'main').single(),
      sb.from('calc_programs').select('*').eq('active', true).order('sort_order'),
      sb.from('wa_quick_replies').select('*').order('sort_order'),
    ])
    return res.status(200).json({
      ok:       true,
      settings: settRes.data  || null,
      programs: progRes.data  || [],
      // Нет таблицы (миграция 005 не применена) — не роняем настройки целиком
      replies:  repRes.error ? [] : (repRes.data || []),
    })
  }

  // ── DELETE: шаблон WA или программа ─────────────────────────────
  if (req.method === 'DELETE') {
    const { replyId, programKey } = req.body || {}
    if (replyId) {
      const { error } = await sb.from('wa_quick_replies').delete().eq('id', replyId)
      if (error) return res.status(500).json({ error: 'Не удалось удалить шаблон' })
      return res.status(200).json({ ok: true })
    }
    if (programKey) {
      const { error } = await sb.from('calc_programs').delete().eq('key', programKey)
      if (error) return res.status(500).json({ error: 'Не удалось удалить программу' })
      return res.status(200).json({ ok: true })
    }
    return res.status(400).json({ error: 'Нужен replyId или programKey' })
  }

  // ── POST/PUT: сохранить настройки ───────────────────────────────
  if (req.method === 'POST' || req.method === 'PUT') {
    const { settings, programs, replies } = req.body || {}
    const errs = []

    // Сохранение настроек (основные + расширенные)
    if (settings) {
      const {
        mrp, pm_nauryz, pm_other, kd,
        progs_data, expense_otbasy, expense_other,
        mrp_ref, deal_steps, insurance_pct,
        d50_table, rate_presets,
        wa_auto_greeting, wa_auto_greeting_on, wa_round_robin, wa_config,
        doc_templates, custom_fields, accomp_templates, tax_config,
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
      if (wa_auto_greeting    != null) row.wa_auto_greeting    = String(wa_auto_greeting)
      if (wa_auto_greeting_on != null) row.wa_auto_greeting_on = !!wa_auto_greeting_on
      if (wa_round_robin      != null) row.wa_round_robin      = !!wa_round_robin
      if (wa_config           != null) row.wa_config           = wa_config
      if (doc_templates       != null) row.doc_templates       = doc_templates
      if (custom_fields       != null) row.custom_fields       = custom_fields
      if (accomp_templates    != null) row.accomp_templates    = accomp_templates
      if (tax_config          != null) row.tax_config          = tax_config
      if (insurance_pct != null) row.insurance_pct  = +insurance_pct

      // Fallback: необязательные колонки (миграции 011/013/014/015 могут быть не применены) —
      // при ошибке "column ... does not exist" убираем колонку и повторяем
      let { error } = await sb.from('calc_settings').upsert(row)
      for (const col of ['wa_round_robin', 'wa_config', 'doc_templates', 'custom_fields', 'accomp_templates', 'tax_config']) {
        if (error && (error.message || '').includes(col) && col in row) {
          delete row[col]
          ;({ error } = await sb.from('calc_settings').upsert(row))
        }
      }
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

    // Сохранение шаблонов WhatsApp. trigger в таблице UNIQUE — два шаблона с одной
    // командой «/» дают внятную ошибку в UI, а не молчаливую потерю текста.
    if (Array.isArray(replies)) {
      for (let i = 0; i < replies.length; i++) {
        const row = replyToDb(replies[i], i)
        if (!row.trigger || !row.title) {
          errs.push({ section: 'reply:' + (row.trigger || row.id), error: 'Нужны команда и название' })
          continue
        }
        const { error } = await sb.from('wa_quick_replies').upsert(row)
        if (error) {
          const dup = (error.message || '').includes('duplicate') || error.code === '23505'
          errs.push({
            section: 'reply:' + row.trigger,
            error: dup ? `Команда ${row.trigger} уже занята другим шаблоном`
                       : (process.env.NODE_ENV === 'development' ? error.message : 'DB error'),
          })
        }
      }
    }

    return res.status(200).json({ ok: errs.length === 0, errors: errs })
  }

  return apiErrors.methodNotAllowed(res)
}

export default withRole('admin', 'head')(handler)
