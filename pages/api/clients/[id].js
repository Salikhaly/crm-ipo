// pages/api/clients/[id].js
// GET    /api/clients/:id  → один клиент
// PUT    /api/clients/:id  → обновить клиента
// DELETE /api/clients/:id  → удалить клиента

import { getSupabase, dbToClient, clientToDb } from '../../../lib/supabase'
import { withAuth } from '../../../lib/auth'

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
      .from('clients').select('manager, stage, comments').eq('id', id).maybeSingle()
    if (!existing) return res.status(404).json({ error: 'Клиент не найден' })

    // SEC FIX: проверяем владельца ДО обновления
    if (role === 'manager') {
      if (existing.manager !== mid) {
        return res.status(403).json({ error: 'Нет доступа к этому клиенту' })
      }
      client.manager = mid  // менеджер не может переназначить
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
