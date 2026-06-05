// pages/api/clients/[id].js
// GET    /api/clients/:id  → один клиент
// PUT    /api/clients/:id  → обновить клиента
// DELETE /api/clients/:id  → удалить клиента

import { getSupabase, dbToClient, clientToDb } from '../../../lib/supabase'
import { withAuth } from '../../../lib/auth'

export default withAuth(async function handler(req, res) {
  const sb = getSupabase()
  const { id } = req.query
  const { role, mid } = req.user

  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('clients')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) return res.status(404).json({ error: 'Клиент не найден' })

    // Менеджер видит только своих
    if (role === 'manager' && data.manager !== mid) {
      return res.status(403).json({ error: 'Нет доступа' })
    }

    return res.status(200).json({ client: dbToClient(data) })
  }

  if (req.method === 'PUT') {
    const client = req.body

    // SEC FIX: проверяем владельца ДО обновления
    if (role === 'manager') {
      const { data: existing } = await sb
        .from('clients').select('manager').eq('id', id).single()
      if (!existing || existing.manager !== mid) {
        return res.status(403).json({ error: 'Нет доступа к этому клиенту' })
      }
      client.manager = mid  // менеджер не может переназначить
    }

    const row = clientToDb(client)
    delete row.id // не обновляем id

    const { data, error } = await sb
      .from('clients')
      .update(row)
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ client: dbToClient(data) })
  }

  if (req.method === 'DELETE') {
    // Только admin и head могут удалять
    if (role === 'manager' || role === 'specialist') {
      return res.status(403).json({ error: 'Нет доступа для удаления' })
    }

    const { error } = await sb.from('clients').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Метод не разрешён' })
})
