// pages/api/calc/index.js
// POST /api/calc { action, payload }
// Загружает актуальные настройки из БД (calc_settings + calc_programs)

import { withAuth }    from '../../../lib/auth'
import { apiError } from '../../../lib/apiError'
import { getSupabase } from '../../../lib/supabase'
import {
  calcMortgageByPrice,
  calcMortgageBySalary,
  calcBankApproval,
  calcOpvVar,
  calcOpvEq,
  calcBuh,
  calcScenario,
  DEFAULT_CFG,
  DEFAULT_PROGRAMS,
} from '../../../lib/calcEngine'

// Кэш настроек — не дёргаем БД на каждый клик
let _cfgCache    = null
let _cfgCachedAt = 0
const CFG_TTL_MS = 30_000  // 30 секунд

async function loadCfg(sb) {
  if (_cfgCache && Date.now() - _cfgCachedAt < CFG_TTL_MS) return _cfgCache

  try {
    const [settRes, progRes] = await Promise.all([
      sb.from('calc_settings').select('*').eq('id', 'main').maybeSingle(),
      sb.from('calc_programs').select('*').eq('active', true).order('sort_order'),
    ])

    const s   = settRes.data
    const pgs = progRes.data || []

    const programs = {}
    const nauryzKeys = []
    pgs.forEach(p => {
      // Варианты с coeff<=0 дают деление на ноль (Infinity/NaN в расчётах),
      // программа совсем без вариантов роняет variants[0] — отсеиваем на входе
      const variants = (Array.isArray(p.variants) ? p.variants : []).filter(v => +(v && v.coeff) > 0)
      if (!variants.length) return
      programs[p.key] = {
        key:       p.key,
        name:      p.name,
        icon:      p.icon || '🏠',
        downRatio: parseFloat(p.down_ratio) || 0.20,
        desc:      p.desc_text || '',
        variants,
      }
      // Собираем nauryzKeys из БД (колонка is_nauryz), а не из хардкода.
      // Иначе галочка «Наурыз ПМ» в админке игнорировалась и ПМ считался неверно.
      if (p.is_nauryz) nauryzKeys.push(p.key)
    })

    _cfgCache = {
      mrp:        +s?.mrp > 0 ? +s.mrp : DEFAULT_CFG.mrp,
      pmNauryz:   s?.pm_nauryz  || DEFAULT_CFG.pmNauryz,
      pmOther:    s?.pm_other   || DEFAULT_CFG.pmOther,
      kd:         s?.kd         || DEFAULT_CFG.kd,
      // Шаблоны документов (миграция 013) — null если колонки/данных нет, фронт возьмёт дефолт
      docTemplates: Array.isArray(s?.doc_templates) && s.doc_templates.length ? s.doc_templates : null,
      // Доп. поля карточки (миграция 014) — конфигурация полей, доступна всем ролям
      customFields: Array.isArray(s?.custom_fields) ? s.custom_fields : [],
      // Налоговые константы (миграция 016) — правки из админки, дефолт в движке
      taxConfig: (s?.tax_config && typeof s.tax_config === 'object') ? s.tax_config : null,
      // Маршруты сопровождения по группам программ (миграция 015) — правки из админки
      accompTemplates: (s?.accomp_templates && typeof s.accomp_templates === 'object') ? s.accomp_templates : null,
      programs:   Object.keys(programs).length > 0 ? programs : DEFAULT_PROGRAMS,
      // Если в БD есть программы — берём их nauryzKeys; иначе дефолтные
      nauryzKeys: Object.keys(programs).length > 0 ? nauryzKeys : DEFAULT_CFG.nauryzKeys,
    }
    _cfgCachedAt = Date.now()
    return _cfgCache
  } catch (e) {
    console.error('[calc/loadCfg]', e.message)
    return DEFAULT_CFG
  }
}

export default withAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST' })

  const { action, payload } = req.body || {}
  if (!action) return res.status(400).json({ error: 'action required' })

  const sb  = getSupabase()
  const cfg = await loadCfg(sb)

  // Сброс кэша при сохранении настроек
  if (action === 'invalidate_cache') {
    _cfgCache    = null
    _cfgCachedAt = 0
    return res.status(200).json({ ok: true })
  }

  const ACTIONS = {
    mortgage_by_price:  p => calcMortgageByPrice(p, cfg),
    mortgage_by_salary: p => calcMortgageBySalary(p, cfg),
    bank_approval:      p => calcBankApproval(p, cfg),
    opv_var:            p => calcOpvVar(p, cfg.taxConfig),
    opv_eq:             p => calcOpvEq(p, cfg.taxConfig),
    buh:                p => calcBuh(p, cfg.taxConfig),
    scenario:           p => calcScenario(p, cfg.taxConfig),
    programs:           () => ({ ok: true, programs: Object.values(cfg.programs) }),
    settings:           () => ({ ok: true, mrp: cfg.mrp, pmNauryz: cfg.pmNauryz, pmOther: cfg.pmOther, kd: cfg.kd }),
    // Шаблоны документов — доступны любой роли (менеджер формирует договор из карточки)
    doc_templates:      () => ({ ok: true, templates: cfg.docTemplates }),
    // Доп. поля карточки — доступны любой роли (рендер в карточке клиента)
    custom_fields:      () => ({ ok: true, fields: cfg.customFields || [] }),
    // Маршруты сопровождения — карточка строит этапы по ним (fallback — хардкод)
    accomp_templates:   () => ({ ok: true, templates: cfg.accompTemplates }),
  }

  if (!ACTIONS[action]) {
    return res.status(400).json({ error: `Unknown action: ${action}`, available: Object.keys(ACTIONS) })
  }

  try {
    const result = ACTIONS[action](payload || {})
    return res.status(200).json(result)
  } catch (err) {
    console.error(`[calc/${action}]`, err.message)  // server log — не передаётся клиенту
    return apiError(res, err)
  }
})
