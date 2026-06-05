// pages/api/dashboard/index.js
// GET /api/dashboard  → все метрики для дашборда

import { getSupabase } from '../../../lib/supabase'
import { withAuth } from '../../../lib/auth'

export default withAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Только GET' })

  const sb = getSupabase()
  const { role, mid } = req.user
  const today = new Date().toISOString().split('T')[0]
  const now   = new Date()
  const moStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`

  // Строим запрос с учётом роли
  let query = sb.from('clients').select(
    'id, manager, stage, contract_type, contract_amount, payments, tasks, created_at, is_whatsapp'
  )
  if (role === 'manager' && mid) query = query.eq('manager', mid)

  const [clientsRes, managersRes, waChatsRes] = await Promise.all([
    query,
    sb.from('managers').select('id, name, color').eq('active', true),
    sb.from('wa_chats').select('id, unread_count, status').eq('status', 'new'),
  ])

  if (clientsRes.error) return res.status(500).json({ error: clientsRes.error.message })

  const clients  = clientsRes.data  || []
  const managers = managersRes.data || []
  const waNew    = waChatsRes.data  || []

  const withCt  = clients.filter(c => c.contract_type)
  const rev     = withCt.reduce((s, c) => s + (c.contract_amount || 0), 0)
  const paidRev = clients
    .flatMap(c => c.payments || [])
    .filter(p => p.status === 'paid')
    .reduce((s, p) => s + (p.paidAmount || 0), 0)

  const allTasks    = clients.flatMap(c => c.tasks || [])
  const openTasks   = allTasks.filter(t => !t.done)
  const overdueTasks = openTasks.filter(t => t.due && t.due < today)
  const waUnread    = waNew.reduce((s, c) => s + (c.unread_count || 0), 0)

  // Воронка
  const funnelMap = {}
  clients.forEach(c => { funnelMap[c.stage] = (funnelMap[c.stage] || 0) + 1 })

  // Топ менеджеры
  const mgrStats = managers.map(m => {
    const mc  = clients.filter(c => c.manager === m.id)
    const ct  = mc.filter(c => c.contract_type)
    const r   = ct.reduce((s, c) => s + (c.contract_amount || 0), 0)
    return { ...m, leads: mc.length, contracts: ct.length, rev: r, conv: mc.length ? Math.round(ct.length / mc.length * 100) : 0 }
  }).sort((a, b) => b.rev - a.rev)

  // Последние клиенты
  const recent = clients
    .sort((a, b) => b.created_at?.localeCompare(a.created_at || '') || 0)
    .slice(0, 8)

  return res.status(200).json({
    metrics: {
      total:       clients.length,
      thisMonth:   clients.filter(c => c.created_at >= moStart).length,
      contracts:   withCt.length,
      conversion:  clients.length ? Math.round(withCt.length / clients.length * 100) : 0,
      rev,
      paidRev,
      openTasks:   openTasks.length,
      overdueTasks: overdueTasks.length,
      waUnread,
      waNewLeads:  clients.filter(c => c.is_whatsapp && c.stage === 'new_lead').length,
      closed:      clients.filter(c => c.stage === 'closed').length,
    },
    funnel:   funnelMap,
    managers: mgrStats,
    recent,
  })
})
