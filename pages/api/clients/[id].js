// pages/api/clients/[id].js
// GET    /api/clients/:id  → один клиент
// PUT    /api/clients/:id  → обновить клиента
// DELETE /api/clients/:id  → удалить клиента

import { getSupabase, dbToClient, clientToDb, addSavedCalcs, addCloseReason, addTags, addCustom, addPkbFields, findMissingOptionalColumn } from '../../../lib/supabase'
import { apiError } from '../../../lib/apiError'
import { withAuth } from '../../../lib/auth'
import { logAction } from '../../../lib/actionLog'

export default withAuth(async function handler(req, res) {
  const sb = getSupabase()
  const { id } = req.query
  const { role, manager_id: mid } = req.user

  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('clients')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!data) return res.status(404).json({ error: 'Клиент не найден' })

    // Менеджер видит только своих; специалист — только где он ответственный
    if (role === 'manager' && data.manager !== mid) {
      return res.status(403).json({ error: 'Нет доступа' })
    }
    if (role === 'specialist' && data.responsible_manager !== mid) {
      return res.status(403).json({ error: 'Нет доступа' })
    }

    return res.status(200).json({ client: dbToClient(data) })
  }

  if (req.method === 'PUT') {
    const client = req.body

    // ── Валидация бизнес-полей ────────────────────────────────
    if (client.iin && !/^\d{12}$/.test(client.iin)) {
      return res.status(400).json({ error: 'ИИН должен содержать ровно 12 цифр' })
    }
    if (client.phone) {
      const digits = client.phone.replace(/\D/g, '')
      if (digits.length < 10 || digits.length > 12) {
        return res.status(400).json({ error: 'Неверный формат телефона' })
      }
    }
    // Проверка платежей: paidAmount не может превышать amount
    if (Array.isArray(client.payments)) {
      for (const p of client.payments) {
        if (p.paidAmount !== undefined && p.amount !== undefined && +p.paidAmount > +p.amount) {
          return res.status(400).json({ error: `Оплата "${p.label||p.id}" превышает сумму договора` })
        }
      }
    }
    // contractAmount не может быть отрицательным
    if (client.contractAmount !== undefined && +client.contractAmount < 0) {
      return res.status(400).json({ error: 'Сумма договора не может быть отрицательной' })
    }

    // Загружаем текущее состояние для аудит-лога и проверки доступа
    const { data: existing } = await sb
      .from('clients').select('manager, responsible_manager, stage, comments').eq('id', id).maybeSingle()
    if (!existing) return res.status(404).json({ error: 'Клиент не найден' })

    // SEC FIX: проверяем владельца ДО обновления
    if (role === 'manager') {
      if (existing.manager !== mid) {
        return res.status(403).json({ error: 'Нет доступа к этому клиенту' })
      }
      client.manager = mid  // менеджер не может переназначить
    }
    if (role === 'specialist') {
      if (existing.responsible_manager !== mid) {
        return res.status(403).json({ error: 'Нет доступа к этому клиенту' })
      }
    }

    const row = clientToDb(client)
    delete row.id // не обновляем id

    // ── Аудит-лог: фиксируем смену этапа воронки ─────────────
    if (client.stage && existing && client.stage !== existing.stage) {
      const now = new Date().toLocaleString('ru', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })
      const auditEntry = {
        id:        `audit_${Date.now()}`,
        type:      'stage_change',
        text:      `Этап изменён: ${existing.stage} → ${client.stage}`,
        author:    req.user.name,
        authorId:  req.user.id,
        createdAt: now,
        isAudit:   true,
      }
      // Используем comments из БД как источник истины для аудита (не из запроса),
      // чтобы предотвратить случайное затирание истории устаревшим payload'ом клиента.
      const dbComments      = Array.isArray(existing.comments)  ? existing.comments  : []
      const requestComments = Array.isArray(row.comments)        ? row.comments        : []
      // Пользовательские комментарии — из запроса (не-аудитные),
      // аудитные записи — из БД + новая запись.
      const userComments  = requestComments.filter(c => !c.isAudit)
      const auditComments = dbComments.filter(c => c.isAudit)
      row.comments = [...userComments, ...auditComments, auditEntry]
    }

    addSavedCalcs(row, client)
    addCloseReason(row, client)
    addTags(row, client)
    addCustom(row, client)
    addPkbFields(row, client)

    let { data, error } = await sb
      .from('clients')
      .update(row)
      .eq('id', id)
      .select()
      .single()

    // Если необязательной колонки ещё нет (миграции 008/010 не запущены) — повторяем без неё
    for (let missing = findMissingOptionalColumn(error, row); missing; missing = findMissingOptionalColumn(error, row)) {
      delete row[missing]
      ;({ data, error } = await sb.from('clients').update(row).eq('id', id).select().single())
    }

    if (error) return apiError(res, error)

    // Журнал: смена этапа фиксируется отдельно (детальнее), прочие правки — как update
    if (client.stage && existing && client.stage !== existing.stage) {
      logAction({ action:'stage', entity:'client', entityId:id, entityName:client.fio,
        detail:`${existing.stage} → ${client.stage}`, user:req.user })
    } else {
      logAction({ action:'update', entity:'client', entityId:id, entityName:client.fio, user:req.user })
    }
    return res.status(200).json({ client: dbToClient(data) })
  }

  if (req.method === 'DELETE') {
    // Только admin и head могут удалять
    if (role === 'manager' || role === 'specialist') {
      return res.status(403).json({ error: 'Нет доступа для удаления' })
    }

    // Мягкое удаление: полная копия клиента уезжает в корзину (deleted_clients,
    // миграция 015) — восстановление из админки. Если таблицы ещё нет —
    // деградация до старого поведения (безвозвратное удаление).
    const { data: victim } = await sb.from('clients').select('*').eq('id', id).maybeSingle()
    let trashed = false
    if (victim) {
      const { error: trashErr } = await sb.from('deleted_clients').upsert({
        id: victim.id, data: victim, fio: victim.fio || '', phone: victim.phone || '',
        deleted_by: req.user?.name || '',
      })
      trashed = !trashErr
    }
    const { error } = await sb.from('clients').delete().eq('id', id)
    if (error) return apiError(res, error)
    logAction({ action:'delete', entity:'client', entityId:id, entityName:victim?.fio,
      detail: trashed ? 'в корзину' : 'безвозвратно (нет миграции 015)', user:req.user })
    return res.status(200).json({ ok: true, trashed })
  }

  return res.status(405).json({ error: 'Метод не разрешён' })
})
