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
  const { role, mid } = req.user

  if (req.method === 'GET') {
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

    const { data, error } = await query

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ clients: data.map(dbToClient) })
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
