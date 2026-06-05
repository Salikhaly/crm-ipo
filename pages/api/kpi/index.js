// pages/api/kpi/index.js
// GET /api/kpi?period=week|month|all
// Возвращает статистику по менеджерам

import { getSupabase } from '../../../lib/supabase'
import { withAuth } from '../../../lib/auth'

export default withAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Только GET' })

  const sb = getSupabase()
  const { period = 'month' } = req.query

  // Определяем дату начала периода
  const now = new Date()
  let dateFrom = '2000-01-01'
  if (period === 'week') {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay() + 1)
    dateFrom = d.toISOString().split('T')[0]
  } else if (period === 'month') {
    dateFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  }

  // Загружаем всё нужное параллельно
  const [clientsRes, managersRes] = await Promise.all([
    sb.from('clients').select('id, manager, stage, contract_type, contract_amount, payments, tasks, created_at'),
    sb.from('managers').select('*').eq('active', true),
  ])

  if (clientsRes.error) return res.status(500).json({ error: clientsRes.error.message })
  if (managersRes.error) return res.status(500).json({ error: managersRes.error.message })

  const clients  = clientsRes.data  || []
  const managers = managersRes.data || []

  const approvalStages = ['approval', 'deal', 'issuance', 'closed']

  const stats = managers.map(m => {
    const all     = clients.filter(c => c.manager === m.id)
    const period_ = all.filter(c => c.created_at >= dateFrom)
    const ct      = all.filter(c => c.contract_type)
    const pCt     = period_.filter(c => c.contract_type)

    const rev     = ct.reduce((s, c) => s + (c.contract_amount || 0), 0)
    const pRev    = pCt.reduce((s, c) => s + (c.contract_amount || 0), 0)

    const paidRev = all
      .flatMap(c => c.payments || [])
      .filter(p => p.status === 'paid')
      .reduce((s, p) => s + (p.paidAmount || 0), 0)

    const approved = all.filter(c => approvalStages.includes(c.stage))
    const closed   = all.filter(c => c.stage === 'closed')
    const inWork   = all.filter(c => !['new_lead', 'closed'].includes(c.stage))

    const tasks       = all.flatMap(c => c.tasks || [])
    const doneTasks   = tasks.filter(t => t.done)
    const today       = new Date().toISOString().split('T')[0]
    const overdue     = tasks.filter(t => !t.done && t.due && t.due < today)

    const conv   = all.length    ? Math.round(ct.length / all.length * 100)       : 0
    const convCA = ct.length     ? Math.round(approved.length / ct.length * 100)  : 0

    return {
      manager:    m,
      all:        all.length,
      pLeads:     period_.length,
      contracts:  ct.length,
      pCt:        pCt.length,
      rev,
      pRev,
      paidRev,
      approved:   approved.length,
      closed:     closed.length,
      inWork:     inWork.length,
      conv,
      convCA,
      tasks:      tasks.length,
      doneTasks:  doneTasks.length,
      overdue:    overdue.length,
    }
  }).sort((a, b) => b.rev - a.rev)

  // Итого
  const totals = {
    clients:   clients.length,
    contracts: clients.filter(c => c.contract_type).length,
    rev:       clients.reduce((s, c) => s + (c.contract_amount || 0), 0),
    paidRev:   clients
      .flatMap(c => c.payments || [])
      .filter(p => p.status === 'paid')
      .reduce((s, p) => s + (p.paidAmount || 0), 0),
    closed:    clients.filter(c => c.stage === 'closed').length,
  }

  return res.status(200).json({ stats, totals, period, dateFrom })
})
