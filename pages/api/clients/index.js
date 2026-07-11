// pages/api/clients/index.js
// GET  /api/clients        → список клиентов (с фильтрами)
// POST /api/clients        → создать клиента

import { getSupabase, dbToClient, clientToDb, addSavedCalcs, addCloseReason, addTags, addCustom, addPkbFields, findMissingOptionalColumn } from '../../../lib/supabase'
import { apiError } from '../../../lib/apiError'
import { withAuth } from '../../../lib/auth'
import { logAction } from '../../../lib/actionLog'

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

    // Роль определяет видимость клиентов:
    // - manager: только свои (по полю manager)
    // - specialist: только где назначен ответственным (по полю responsible_manager)
    // - head / admin: все клиенты
    if (role === 'manager' && mid) {
      query = query.eq('manager', mid)
    } else if (role === 'specialist' && mid) {
      query = query.eq('responsible_manager', mid)
    }

    // Фильтры из query string
    const { stage, manager, search } = req.query
    if (stage)   query = query.eq('stage', stage)
    if (manager && role !== 'manager' && role !== 'specialist') query = query.eq('manager', manager)
    if (search)  query = query.or(
      `fio.ilike.%${escapeLike(search)}%,phone.ilike.%${escapeLike(search)}%,iin.ilike.%${escapeLike(search)}%`
    )

    // Применяем пагинацию
    const from = page * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1
    query = query.range(from, to)

    const { data, error } = await query

    if (error) return apiError(res, error)
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
    addSavedCalcs(row, client)
    addCloseReason(row, client)
    addTags(row, client)
    addCustom(row, client)
    addPkbFields(row, client)
    let { data, error } = await sb
      .from('clients')
      .insert(row)
      .select()
      .single()

    // Повтор без необязательных колонок, если миграции 008/010 не применены
    for (let missing = findMissingOptionalColumn(error, row); missing; missing = findMissingOptionalColumn(error, row)) {
      delete row[missing]
      ;({ data, error } = await sb.from('clients').insert(row).select().single())
    }

    if (error) return apiError(res, error)
    logAction({ action:'create', entity:'client', entityId:data.id, entityName:data.fio, user:req.user })
    return res.status(201).json({ client: dbToClient(data) })
  }

  return res.status(405).json({ error: 'Метод не разрешён' })
})
