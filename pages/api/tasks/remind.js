// pages/api/tasks/remind.js
// №3: Утренние напоминания менеджерам в WhatsApp о задачах на сегодня.
// Вызывается Vercel Cron (см. vercel.json) или вручную:
//   GET /api/tasks/remind?secret=WEBHOOK_SECRET
//
// Логика: собирает невыполненные задачи с дедлайном <= сегодня по всем клиентам,
// группирует по менеджеру, шлёт каждому менеджеру (у кого есть phone) сводку.
// Паузы 5 сек между отправками — защита от бана WhatsApp.

import { getSupabase } from '../../../lib/supabase'

const sleep = ms => new Promise(r => setTimeout(r, ms))

export default async function handler(req, res) {
  // Защита: Vercel Cron шлёт Authorization: Bearer CRON_SECRET автоматически
  // (если env CRON_SECRET задан). Ручной вызов: ?secret=WEBHOOK_SECRET
  const secret = req.query.secret || (req.headers.authorization || '').replace('Bearer ', '')
  const valid = (process.env.CRON_SECRET && secret === process.env.CRON_SECRET)
             || (process.env.WEBHOOK_SECRET && secret === process.env.WEBHOOK_SECRET)
  if (!valid) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const GREEN_ID    = process.env.GREEN_API_ID
  const GREEN_TOKEN = process.env.GREEN_API_TOKEN
  if (!GREEN_ID || !GREEN_TOKEN) {
    return res.status(503).json({ error: 'Green API не настроен' })
  }

  const sb = getSupabase()

  // Клиенты с задачами + менеджеры
  const [{ data: clients, error: cErr }, { data: managers, error: mErr }] = await Promise.all([
    sb.from('clients').select('id, fio, manager, tasks').not('tasks', 'eq', '[]'),
    sb.from('managers').select('id, name, phone').eq('active', true),
  ])
  if (cErr || mErr) return res.status(500).json({ error: 'DB error' })

  const today = new Date().toISOString().split('T')[0]

  // Группируем просроченные/сегодняшние задачи по менеджеру
  const byManager = {}
  for (const c of clients || []) {
    for (const t of (c.tasks || [])) {
      if (t.done) continue
      if (!t.due || t.due > today) continue   // только сегодня и просроченные
      if (!c.manager) continue
      if (!byManager[c.manager]) byManager[c.manager] = []
      byManager[c.manager].push({
        client:  c.fio || 'Без имени',
        text:    (t.type ? t.type + ' ' : '') + (t.text || ''),
        overdue: t.due < today,
        due:     t.due,
      })
    }
  }

  const results = []
  for (const [mid, tasks] of Object.entries(byManager)) {
    const mgr = (managers || []).find(m => m.id === mid)
    if (!mgr?.phone) { results.push({ manager: mid, skipped: 'нет телефона' }); continue }

    // Формируем сводку (максимум 15 задач чтобы сообщение не раздувалось)
    const overdue = tasks.filter(t => t.overdue)
    const todays  = tasks.filter(t => !t.overdue)
    const lines = [`Доброе утро, ${mgr.name?.split(' ')[0] || ''}! 📋`, '']
    if (todays.length) {
      lines.push(`*Задачи на сегодня (${todays.length}):*`)
      todays.slice(0, 10).forEach(t => lines.push(`• ${t.client}: ${t.text}`))
      lines.push('')
    }
    if (overdue.length) {
      lines.push(`⚠️ *Просрочено (${overdue.length}):*`)
      overdue.slice(0, 5).forEach(t => lines.push(`• ${t.client}: ${t.text} (${t.due})`))
      lines.push('')
    }
    lines.push('Хорошего дня! 💪 — CRM')

    const rawPhone = mgr.phone.replace(/\D/g, '')
    const waPhone  = rawPhone.startsWith('7') ? rawPhone : '7' + rawPhone

    try {
      const r = await fetch(
        `https://api.green-api.com/waInstance${GREEN_ID}/sendMessage/${GREEN_TOKEN}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: waPhone + '@c.us', message: lines.join('\n') }),
        }
      )
      const d = await r.json()
      results.push({ manager: mgr.name, tasks: tasks.length, sent: !!d.idMessage })
    } catch (e) {
      results.push({ manager: mgr.name, error: e.message })
    }

    // Пауза между менеджерами — anti-ban
    await sleep(5000)
  }

  return res.status(200).json({ ok: true, date: today, reminders: results })
}
