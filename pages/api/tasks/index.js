// pages/api/tasks/index.js
// GET /api/tasks?status=open|all  → задачи по всем клиентам

import { getSupabase } from '../../../lib/supabase'
import { withAuth } from '../../../lib/auth'

export default withAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Только GET' })

  const sb = getSupabase()
  const { role, mid } = req.user
  const { status = 'open' } = req.query
  const today = new Date().toISOString().split('T')[0]

  let query = sb.from('clients').select('id, fio, phone, manager, tasks')
  if (role === 'manager' && mid) query = query.eq('manager', mid)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  // Разворачиваем задачи
  const allTasks = (data || []).flatMap(c =>
    (c.tasks || []).map(t => ({
      ...t,
      clientId:   c.id,
      clientFio:  c.fio,
      clientPhone: c.phone,
      manager:    c.manager,
    }))
  )

  const filtered = status === 'open'
    ? allTasks.filter(t => !t.done)
    : allTasks

  const overdue  = filtered.filter(t => !t.done && t.due && t.due < today)
  const todayT   = filtered.filter(t => !t.done && t.due === today)
  const upcoming = filtered.filter(t => !t.done && t.due && t.due > today)
  const noDue    = filtered.filter(t => !t.done && !t.due)
  const done     = allTasks.filter(t => t.done)

  return res.status(200).json({
    overdue,
    today:    todayT,
    upcoming,
    noDue,
    done:     done.slice(0, 50), // последние 50 выполненных
    counts: {
      open:    filtered.filter(t => !t.done).length,
      overdue: overdue.length,
      done:    done.length,
      total:   allTasks.length,
    },
  })
})
