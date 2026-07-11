// pages/api/clients/merge.js
// POST { primaryId, secondaryId } — объединить два дубля (admin/head).
// Данные сливаются по правилам lib/mergeClients, WhatsApp-чаты дубля
// перелинковываются на главного, дубль уезжает в корзину (или удаляется,
// если миграция 015 не применена).

import { getSupabase, dbToClient, clientToDb, addSavedCalcs, addCloseReason, addTags, addCustom, addPkbFields, findMissingOptionalColumn } from '../../../lib/supabase'
import { mergeClients } from '../../../lib/mergeClients'
import { withRole } from '../../../lib/auth'
import { apiError } from '../../../lib/apiError'
import { logAction } from '../../../lib/actionLog'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { primaryId, secondaryId } = req.body || {}
  if (!primaryId || !secondaryId || primaryId === secondaryId) {
    return res.status(400).json({ error: 'Нужны два разных клиента' })
  }

  const sb = getSupabase()
  const [{ data: pRow }, { data: sRow }] = await Promise.all([
    sb.from('clients').select('*').eq('id', primaryId).maybeSingle(),
    sb.from('clients').select('*').eq('id', secondaryId).maybeSingle(),
  ])
  if (!pRow || !sRow) return res.status(404).json({ error: 'Клиент не найден' })

  const merged = mergeClients(dbToClient(pRow), dbToClient(sRow), { userName: req.user?.name })

  // 1) Дубль в корзину (если есть таблица) и удаление — ДО обновления главного,
  //    чтобы освободить уникальный телефон/ИИН
  await sb.from('deleted_clients').upsert({
    id: sRow.id, data: sRow, fio: sRow.fio || '', phone: sRow.phone || '',
    deleted_by: (req.user?.name || '') + ' (объединение)',
  })
  const { error: delErr } = await sb.from('clients').delete().eq('id', secondaryId)
  if (delErr) return apiError(res, delErr)

  // 2) Обновляем главного объединёнными данными
  const row = clientToDb(merged)
  delete row.id
  addSavedCalcs(row, merged); addCloseReason(row, merged); addTags(row, merged); addCustom(row, merged); addPkbFields(row, merged)
  let { data, error } = await sb.from('clients').update(row).eq('id', primaryId).select().single()
  for (let missing = findMissingOptionalColumn(error, row); missing; missing = findMissingOptionalColumn(error, row)) {
    delete row[missing]
    ;({ data, error } = await sb.from('clients').update(row).eq('id', primaryId).select().single())
  }
  if (error) return apiError(res, error)

  // 3) WhatsApp-чаты дубля → на главного
  await sb.from('wa_chats').update({ client_id: primaryId }).eq('client_id', secondaryId)

  logAction({ action:'update', entity:'client', entityId:primaryId, entityName:merged.fio,
    detail:`объединение: поглощён ${sRow.fio || sRow.phone || secondaryId}`, user:req.user })

  return res.status(200).json({ ok: true, client: dbToClient(data) })
}

export default withRole('admin', 'head')(handler)
