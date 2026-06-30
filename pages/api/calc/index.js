// pages/api/calc/index.js
// POST /api/calc { action, payload }
// Загружает актуальные настройки из БД (calc_settings + calc_programs)

import { withAuth }    from '../../../lib/auth'
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
    pgs.forEach(p => {
      programs[p.key] = {
        key:       p.key,
        name:      p.name,
        icon:      p.icon || '🏠',
        downRatio: parseFloat(p.down_ratio) || 0.20,
        desc:      p.desc_text || '',
        variants:  Array.isArray(p.variants) ? p.variants : [],
      }
    })

    _cfgCache = {
      mrp:        s?.mrp        || DEFAULT_CFG.mrp,
      pmNauryz:   s?.pm_nauryz  || DEFAULT_CFG.pmNauryz,
      pmOther:    s?.pm_other   || DEFAULT_CFG.pmOther,
      kd:         s?.kd         || DEFAULT_CFG.kd,
      programs:   Object.keys(programs).length > 0 ? programs : DEFAULT_PROGRAMS,
      nauryzKeys: ['nauryz10','nauryz20'],
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
    opv_var:            p => calcOpvVar(p),
    opv_eq:             p => calcOpvEq(p),
    buh:                p => calcBuh(p),
    scenario:           p => calcScenario(p),
    programs:           () => ({ ok: true, programs: Object.values(cfg.programs) }),
    settings:           () => ({ ok: true, mrp: cfg.mrp, pmNauryz: cfg.pmNauryz, pmOther: cfg.pmOther, kd: cfg.kd }),
  }

  if (!ACTIONS[action]) {
    return res.status(400).json({ error: `Unknown action: ${action}`, available: Object.keys(ACTIONS) })
  }

  try {
    const result = ACTIONS[action](payload || {})
    return res.status(200).json(result)
  } catch (err) {
    console.error(`[calc/${action}]`, err.message)
    return res.status(500).json({ error: err.message })
  }
})
