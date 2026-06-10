// pages/api/calc/index.js
// Единый endpoint для всех расчётов калькулятора
// POST /api/calc  { action, payload }
// Не требует авторизации — калькулятор открыт для всех пользователей CRM

import { withAuth } from '../../../lib/auth'
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

const ACTIONS = {
  mortgage_by_price:  (p) => calcMortgageByPrice(p),
  mortgage_by_salary: (p) => calcMortgageBySalary(p),
  bank_approval:      (p) => calcBankApproval(p),
  opv_var:            (p) => calcOpvVar(p),
  opv_eq:             (p) => calcOpvEq(p),
  buh:                (p) => calcBuh(p),
  scenario:           (p) => calcScenario(p),
  programs:           ()  => ({ ok: true, programs: Object.values(DEFAULT_PROGRAMS) }),
  settings:           ()  => ({ ok: true, mrp: DEFAULT_CFG.mrp, kd: DEFAULT_CFG.kd }),
}

export default withAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { action, payload } = req.body || {}

  if (!action || !ACTIONS[action]) {
    return res.status(400).json({
      error: `Неизвестное действие: ${action}`,
      available: Object.keys(ACTIONS),
    })
  }

  try {
    const result = ACTIONS[action](payload || {})
    return res.status(200).json(result)
  } catch (err) {
    console.error(`[calc/${action}]`, err.message)
    return res.status(500).json({ error: err.message })
  }
})
