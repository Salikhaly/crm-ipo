// pages/api/wa/chats.js
// GET  /api/wa/chats              → список WA чатов (с фильтрами: ?search=, ?status=, ?assigned_to=)
// GET  /api/wa/chats?id=xxx       → сообщения конкретного чата
// PATCH /api/wa/chats             → назначить менеджера или сменить статус

import { getSupabase } from '../../../lib/supabase'
import { withAuth } from '../../../lib/auth'
import { VALID_CHAT_STATUSES } from '../../../lib/waConstants'

export default withAuth(async function handler(req, res) {
  const sb = getSupabase()

  // ── GET ────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { id, mark_read, search, status, assigned_to } = req.query

    // Сообщения конкретного чата
    if (id) {
      let query = sb
        .from('wa_messages')
        .select('*')
        .eq('chat_id', id)
        .order('sent_at', { ascending: true })

      // Инкрементальный фетч: поддерживаем after_id (стабильный курсор) и legacy after (timestamp)
      if (req.query.after_id) {
        // Надёжный курсор по id — не зависит от расхождения часов серверов
        query = query.gt('id', req.query.after_id)
      } else if (req.query.after) {
        // Legacy: курсор по sent_at (оставлен для обратной совместимости)
        query = query.gt('sent_at', req.query.after)
      } else {
        // Полный фетч: ограничиваем последними 200 сообщениями для производительности
        query = query.limit(200)  // MAX_MESSAGES_FETCH — полный фетч ограничен
      }

      const { data: messages, error } = await query
      if (error) return res.status(500).json({ error: error.message })

      if (mark_read === '1') {
        await sb.from('wa_chats').update({ unread_count: 0 }).eq('id', id)
      }

      // Данные реального времени — не кешируем инкрементальные запросы
      if (req.query.after_id || req.query.after) {
        res.setHeader('Cache-Control', 'no-store')
      }

      return res.status(200).json({ messages: messages || [] })
    }

    // Список чатов с фильтрами
    let query = sb
      .from('wa_chats')
      .select('*, clients(fio, phone, stage), managers!wa_chats_assigned_to_fkey(name)')
      .order('last_message_at', { ascending: false })

    if (status && status !== 'all')    query = query.eq('status', status)
    if (assigned_to)                   query = query.eq('assigned_to', assigned_to)

    const { data: chats, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    let result = chats || []

    // Поиск по имени/номеру (в памяти, т.к. ilike сложнее с join)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(c =>
        (c.name||'').toLowerCase().includes(q) ||
        (c.phone||'').includes(q)
      )
    }

    return res.status(200).json({ chats: result })
  }

  // ── PATCH ─────────────────────────────────────────────
  if (req.method === 'PATCH') {
    const { chatId, managerId, status, markRead } = req.body

    if (!chatId) return res.status(400).json({ error: 'chatId обязателен' })

    const upd = {}
    if (managerId !== undefined) upd.assigned_to = managerId || null
    if (status    !== undefined) {
      if (!VALID_CHAT_STATUSES.includes(status)) {
        return res.status(400).json({ error: `Недопустимый статус: ${status}. Допустимые: ${VALID_CHAT_STATUSES.join(', ')}` })
      }
      upd.status = status
    }
    if (req.body.clientId !== undefined) upd.client_id = req.body.clientId || null
    if (markRead === true) upd.unread_count = 0

    if (Object.keys(upd).length === 0) {
      return res.status(400).json({ error: 'Нечего обновлять' })
    }

    const { data, error } = await sb
      .from('wa_chats')
      .update(upd)
      .eq('id', chatId)
      .select()
      .maybeSingle()

    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Чат не найден' })

    return res.status(200).json({ ok: true, chat: data })
  }

  return res.status(405).json({ error: 'Метод не разрешён' })
})
