// pages/api/wa/send.js
// POST /api/wa/send
// Отправляет сообщение клиенту через Green API
// Body: { chatId, phone, text, author }

import { getSupabase } from '../../../lib/supabase'
import { withAuth } from '../../../lib/auth'

export default withAuth(async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Только POST' })
  }

  const { chatId, phone, text, author } = req.body

  if (!phone || !text) {
    return res.status(400).json({ error: 'phone и text обязательны' })
  }

  const GREEN_ID    = process.env.GREEN_API_ID
  const GREEN_TOKEN = process.env.GREEN_API_TOKEN

  if (!GREEN_ID || !GREEN_TOKEN || GREEN_ID === 'placeholder' || GREEN_TOKEN === 'placeholder') {
    return res.status(503).json({
      error: 'WhatsApp не подключён. Обратитесь к администратору для настройки Green API.'
    })
  }

  try {
    // Форматируем номер: +77001234567 → 77001234567@c.us
    const rawPhone = phone.replace(/\D/g, '')
    const waPhone  = rawPhone.startsWith('7') ? rawPhone : '7' + rawPhone
    const waId     = chatId || (waPhone + '@c.us')

    // Отправляем через Green API
    // Токен передаётся в URL-пути, как требует Green API REST API
    const greenRes = await fetch(
      `https://api.green-api.com/waInstance${GREEN_ID}/sendMessage/${GREEN_TOKEN}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ chatId: waId, message: text }),
      }
    )

    const greenData = await greenRes.json()

    if (!greenRes.ok || !greenData.idMessage) {
      console.error('Green API error:', greenData)
      return res.status(502).json({ error: 'Green API: ' + JSON.stringify(greenData) })
    }

    // Сохраняем исходящее сообщение в БД
    const sb = getSupabase()

    await sb.from('wa_messages').insert({
      id:        greenData.idMessage,
      chat_id:   waId,
      direction: 'out',
      type:      'text',
      body:      text,
      author:    author || req.user.name || 'CRM',
      status:    'sent',
      sent_at:   new Date().toISOString(),
    })

    // Обновляем чат — upsert создаёт запись если её ещё нет
    const rawPhone2 = phone.replace(/\D/g, '')
    const waPhone2  = rawPhone2.startsWith('7') ? rawPhone2 : '7' + rawPhone2
    const { data: existChat } = await sb.from('wa_chats').select('id').eq('id', waId).maybeSingle()
    if (existChat) {
      await sb.from('wa_chats').update({
        last_message:    text,
        last_message_at: new Date().toISOString(),
      }).eq('id', waId)
    } else {
      await sb.from('wa_chats').insert({
        id:              waId,
        phone:           '+' + waPhone2,
        name:            '+' + waPhone2,
        last_message:    text,
        last_message_at: new Date().toISOString(),
        unread_count:    0,
        status:          'new',
      })
    }

    return res.status(200).json({
      ok:        true,
      messageId: greenData.idMessage,
    })
  } catch (err) {
    console.error('send-wa error:', err)
    return res.status(500).json({ error: err.message })
  }
})
