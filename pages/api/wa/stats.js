// pages/api/wa/stats.js
// GET /api/wa/stats → аналитика WhatsApp для руководителя:
// объём чатов по статусам/категориям/менеджерам, входящие/исходящие,
// «ждут ответа» (последнее сообщение от клиента), сегодняшняя активность.
// Специалистам — 403 (нет бизнес-смысла). Менеджер/руководитель/техник — видят.

import { getSupabase } from '../../../lib/supabase'
import { apiError } from '../../../lib/apiError'
import { withAuth } from '../../../lib/auth'
import { WA_CHAT_CATS } from '../../../lib/waConstants'

export default withAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Только GET' })
  if (req.user?.role === 'specialist') return res.status(403).json({ error: 'Нет доступа' })

  try {
    const sb = getSupabase()
    const [{ data: chats }, { data: managers }] = await Promise.all([
      sb.from('wa_chats').select('id, assigned_to, status, category, unread_count, client_id, last_message_at'),
      sb.from('managers').select('id, name'),
    ])
    const mgrName = Object.fromEntries((managers || []).map(m => [m.id, m.name]))

    // Сообщения: тянем постранично (потолок PostgREST 1000), нужны direction/author/sent_at/chat_id
    const msgs = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('wa_messages')
        .select('chat_id, direction, author, sent_at').range(from, from + 999)
      if (error) break
      msgs.push(...(data || []))
      if (!data || data.length < 1000 || msgs.length >= 100000) break
    }

    const todayStr = new Date().toISOString().slice(0, 10)
    const isToday = (d) => (d || '').slice(0, 10) === todayStr

    // Последнее сообщение в каждом чате (по sent_at) → «ждёт ответа», если оно входящее
    const lastByChat = {}
    for (const m of msgs) {
      const cur = lastByChat[m.chat_id]
      if (!cur || (m.sent_at || '') > (cur.sent_at || '')) lastByChat[m.chat_id] = m
    }

    const byStatus   = { new: 0, in_work: 0, done: 0 }
    const byCategory = Object.fromEntries(WA_CHAT_CATS.map(c => [c.id, 0]))
    let unread = 0, notInBase = 0, waitingReply = 0
    const perMgr = {}   // id → { chats, unanswered }

    for (const c of (chats || [])) {
      if (c.status in byStatus) byStatus[c.status]++
      if (c.category && c.category in byCategory) byCategory[c.category]++
      unread += c.unread_count || 0
      if (!c.client_id) notInBase++
      const last = lastByChat[c.id]
      const waiting = last && last.direction === 'in'
      if (waiting) waitingReply++
      const mid = c.assigned_to || '—'
      if (!perMgr[mid]) perMgr[mid] = { id: mid, name: mgrName[mid] || 'Не назначен', chats: 0, unanswered: 0 }
      perMgr[mid].chats++
      if (waiting) perMgr[mid].unanswered++
    }

    let totalIn = 0, totalOut = 0, todayIn = 0, todayOut = 0
    const outByAuthor = {}
    for (const m of msgs) {
      if (m.direction === 'in')  { totalIn++;  if (isToday(m.sent_at)) todayIn++ }
      if (m.direction === 'out') { totalOut++; if (isToday(m.sent_at)) todayOut++
        const a = m.author || '—'; outByAuthor[a] = (outByAuthor[a] || 0) + 1 }
    }

    return res.status(200).json({
      totals: { chats: (chats || []).length, unread, notInBase, waitingReply,
                messages: msgs.length, totalIn, totalOut, todayIn, todayOut },
      byStatus,
      byCategory,
      perManager: Object.values(perMgr).sort((a, b) => b.chats - a.chats),
      outByAuthor: Object.entries(outByAuthor).map(([author, count]) => ({ author, count }))
        .sort((a, b) => b.count - a.count).slice(0, 10),
    })
  } catch (err) {
    return apiError(res, err)
  }
})
