// pages/api/clients/index.js
// GET  /api/clients        → список клиентов (с фильтрами)
// POST /api/clients        → создать клиента

import { getSupabase, dbToClient, clientToDb } from '../../../lib/supabase'
import { withAuth } from '../../../lib/auth'

// Экранирует спецсимволы PostgreSQL ILIKE: %, _, \
function escapeLike(s) {
  return s.replace(/[%_\\]/g, '\\$&')
}

export default withAuth(async function handler(req, res) {
  const sb = getSupabase()
  const { role, manager_id: mid } = req.user

  if (req.method === 'GET') {
    // Пагинация: по умолчанию 200 записей (Vercel limit protection)
    const PAGE_SIZE = 200
    const page = Math.max(0, parseInt(req.query.page || '0'))

    let query = sb.from('clients').select('*').order('created_at', { ascending: false })

    // Менеджер видит только своих клиентов
    if (role === 'manager' && mid) {
      query = query.eq('manager', mid)
    }

    // Фильтры из query string
    const { stage, manager, search } = req.query
    if (stage)   query = query.eq('stage', stage)
    if (manager && role !== 'manager') query = query.eq('manager', manager)
    if (search)  query = query.or(
      `fio.ilike.%${escapeLike(search)}%,phone.ilike.%${escapeLike(search)}%,iin.ilike.%${escapeLike(search)}%`
    )

    // Применяем пагинацию
    const from = page * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({
      clients:  data.map(dbToClient),
      page,
      pageSize: PAGE_SIZE,
      hasMore:  data.length === PAGE_SIZE,
    })
  }

  if (req.method === 'POST') {
    const client = req.body

    if (!client.id) {
      return res.status(400).json({ error: 'id обязателен' })
    }

    // Менеджер может создавать только себе
    if (role === 'manager') {
      client.manager = mid
    }

    const row = clientToDb(client)
    const { data, error } = await sb
      .from('clients')
      .insert(row)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ client: dbToClient(data) })
  }

  return res.status(405).json({ error: 'Метод не разрешён' })
})
