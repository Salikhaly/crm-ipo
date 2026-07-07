// pages/api/wa/webhook.js
// POST /api/wa/webhook
// Green API отправляет сюда все входящие сообщения и статусы доставки
//
// SETUP в Green API консоли:
//   Settings → Notifications → Webhook URL:
//   https://your-site.vercel.app/api/wa/webhook?secret=WEBHOOK_SECRET
//   (WEBHOOK_SECRET = значение из .env WEBHOOK_SECRET)

import { getSupabase } from '../../../lib/supabase'
import { apiError } from '../../../lib/apiError'
import { VALID_CHAT_STATUSES } from '../../../lib/waConstants'

// VALID_CHAT_STATUSES импортируется из lib/waConstants — не дублируйте здесь

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Только POST' })
  }

  // ── SECURITY: проверяем секрет вебхука ────────────────────
  const expectedSecret = process.env.WEBHOOK_SECRET
  const isPlaceholder  = !expectedSecret || expectedSecret === 'placeholder'
  if (isPlaceholder) {
    // Green API не настроен — возвращаем 200 чтобы не падать
    return res.status(200).json({ ok: false, skipped: 'webhook_not_configured' })
  }
  const provided = req.query.secret || req.headers['x-webhook-secret']
  if (!provided || provided !== expectedSecret) {
    console.warn('[webhook] Неверный секрет от', req.headers['x-forwarded-for'])
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const body = req.body
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Пустое тело запроса' })
    }

    const { typeWebhook, senderData, messageData } = body

    // ── Статус доставки / прочтения ──────────────────────────
    if (typeWebhook === 'outgoingMessageStatus') {
      const msgId     = body.idMessage || ''
      const rawStatus = body.status    || ''
      const statusMap = { sent: 'sent', delivered: 'delivered', read: 'read', failed: 'failed' }
      const mapped    = statusMap[rawStatus]  // только известные статусы

      if (msgId && mapped) {
        const sb = getSupabase()
        const { error } = await sb
          .from('wa_messages')
          .update({ status: mapped })
          .eq('id', msgId)
        if (error) console.error('[webhook] status update error:', error.message)
      }
      return res.status(200).json({ ok: true, handled: 'status' })
    }

    // ── Принимаем только входящие и исходящие сообщения ─────
    const ALLOWED = new Set(['incomingMessageReceived', 'outgoingMessageReceived'])
    if (!ALLOWED.has(typeWebhook)) {
      return res.status(200).json({ ok: true, skipped: typeWebhook })
    }

    // ── Валидация критических полей ──────────────────────────
    const chatId = senderData?.chatId ?? ''
    if (!chatId) {
      console.warn('Webhook: пустой chatId, typeWebhook=', typeWebhook)
      return res.status(200).json({ ok: true, skipped: 'empty_chatId' })
    }

    // Пропускаем группы и broadcast
    if (chatId.includes('@g.us') || chatId.includes('@broadcast')) {
      return res.status(200).json({ ok: true, skipped: 'group' })
    }

    const rawPhone  = chatId.replace('@c.us', '').replace('@g.us', '')
    const phone     = '+' + rawPhone
    const name      = (senderData?.senderName ?? senderData?.pushname ?? '').substring(0, 100)
    const direction = typeWebhook === 'incomingMessageReceived' ? 'in' : 'out'
    const msgId     = messageData?.idMessage ?? ''
    const ts        = messageData?.timestamp
    const sentAt    = ts && Number.isInteger(ts)
      ? new Date(ts * 1000).toISOString()
      : new Date().toISOString()

    // ── Тип и контент сообщения ──────────────────────────────
    const msgType = messageData?.typeMessage ?? 'textMessage'
    let type = 'text', text = '', mediaUrl = '', mediaName = '', mediaMime = '', mediaSize = 0

    switch (msgType) {
      case 'textMessage':
        type = 'text'
        text = (messageData?.textMessageData?.textMessage ?? '').substring(0, 4096)
        break
      case 'extendedTextMessage':
        type = 'text'
        text = (messageData?.extendedTextMessageData?.text ?? '').substring(0, 4096)
        break
      case 'imageMessage':
        type     = 'image'
        text     = (messageData?.imageMessageData?.caption ?? '').substring(0, 1024)
        mediaUrl = messageData?.imageMessageData?.downloadUrl ?? ''
        mediaMime = 'image/jpeg'
        break
      case 'videoMessage':
        type     = 'video'
        text     = (messageData?.videoMessageData?.caption ?? '').substring(0, 1024)
        mediaUrl  = messageData?.videoMessageData?.downloadUrl ?? ''
        mediaMime = 'video/mp4'
        break
      case 'audioMessage':
        type     = 'audio'
        mediaUrl  = messageData?.audioMessageData?.downloadUrl ?? ''
        mediaMime = 'audio/ogg'
        break
      case 'pttMessage':
        type     = 'voice'
        mediaUrl  = messageData?.pttMessageData?.downloadUrl ?? ''
        mediaMime = 'audio/ogg'
        break
      case 'documentMessage':
        type      = 'document'
        mediaUrl  = messageData?.documentMessageData?.downloadUrl ?? ''
        mediaName = (messageData?.documentMessageData?.fileName ?? 'document').substring(0, 255)
        mediaMime = messageData?.documentMessageData?.mimeType ?? ''
        mediaSize = parseInt(messageData?.documentMessageData?.fileSize ?? 0, 10) || 0
        break
      case 'stickerMessage':
        type      = 'image'
        mediaUrl  = messageData?.stickerMessageData?.downloadUrl ?? ''
        mediaMime = 'image/webp'
        text      = '[Стикер]'
        break
      default:
        type = 'text'
        text = `[${msgType}]`
    }

    const sb  = getSupabase()
    const now = new Date().toISOString()
    const preview = (text || `[${type}]`).substring(0, 200)

    // ── UPSERT чата (устраняет race condition) ───────────────
    // Если два вебхука от одного chatId приходят одновременно,
    // upsert с onConflict:'id' атомарно создаст или обновит запись
    const { data: existingChat } = await sb
      .from('wa_chats')
      .select('id, unread_count, client_id')
      .eq('id', chatId)
      .maybeSingle()   // maybeSingle() не бросает ошибку если 0 строк

    if (!existingChat) {
      // ── Новый чат: создаём клиента через upsert по номеру телефона ──
      // upsert на phone предотвращает дублирование при повторных вебхуках
      const { data: newClient, error: clientErr } = await sb
        .from('clients')
        .upsert({
          phone,
          fio:            name || phone,
          source:         'whatsapp',
          stage:          'new_lead',
          is_whatsapp:    true,
          wa_msg_preview: preview,
          date_in:        now.split('T')[0],
          created_at:     now,
          comments:       [],
          tasks:          [],
          payments:       [],
          accomp_stages:  {},
        }, { onConflict: 'phone', ignoreDuplicates: false })
        .select('id')
        .single()

      if (clientErr) {
        console.error('Client upsert error:', clientErr.message)
        // Попытка найти существующего клиента по номеру телефона (если upsert упал на constraint)
        const { data: existingClient } = await sb
          .from('clients')
          .select('id')
          .eq('phone', phone)
          .maybeSingle()

        if (existingClient) {
          // Клиент уже есть — просто привяжем чат к нему
          await sb.from('wa_chats').upsert({
            id:              chatId,
            phone,
            name:            name || phone,
            last_message:    preview,
            last_message_at: sentAt,
            unread_count:    direction === 'in' ? 1 : 0,
            client_id:       existingClient.id,
            status:          'new',
          }, { onConflict: 'id' })
        } else {
          // Клиент не создан и не найден — создаём чат с пометкой для ручной обработки
          await sb.from('wa_chats').upsert({
            id:              chatId,
            phone,
            name:            name || phone,
            last_message:    preview,
            last_message_at: sentAt,
            unread_count:    direction === 'in' ? 1 : 0,
            client_id:       null,
            status:          'new',   // остаётся в очереди для ручного назначения
          }, { onConflict: 'id' })
        }
      } else {
        // Клиент успешно создан/обновлён — создаём чат с привязкой
        await sb.from('wa_chats').upsert({
          id:              chatId,
          phone,
          name:            name || phone,
          last_message:    preview,
          last_message_at: sentAt,
          unread_count:    direction === 'in' ? 1 : 0,
          client_id:       newClient?.id ?? null,
          status:          'new',
        }, { onConflict: 'id' })
      }

    } else {
      // Обновляем существующий чат
      const newUnread = direction === 'in'
        ? (existingChat.unread_count || 0) + 1
        : (existingChat.unread_count || 0)

      await sb.from('wa_chats').update({
        ...(name ? { name } : {}),           // явная проверка: не затираем имя если name пустой
        last_message:    preview,
        last_message_at: sentAt,
        unread_count:    newUnread,
      }).eq('id', chatId)
    }

    // ── Сохраняем сообщение (защита от дублей через id) ──────
    if (msgId) {
      const { error: insertErr } = await sb.from('wa_messages').upsert({
        id:         msgId,
        chat_id:    chatId,
        direction,
        type,
        body:       text,
        media_url:  mediaUrl,
        media_name: mediaName,
        media_mime: mediaMime,
        media_size: mediaSize,
        author:     direction === 'out' ? 'CRM' : name,
        status:     direction === 'out' ? 'sent' : 'delivered',
        sent_at:    sentAt,
      }, { onConflict: 'id', ignoreDuplicates: true })  // ignoreDuplicates=true — не перезаписываем уже сохранённые

      if (insertErr) console.error('Message upsert error:', insertErr.message)
    }

    // ── №5: Автоответ новому лиду ─────────────────────────────
    // Только: первое сообщение (чата не было) + входящее + включено в настройках.
    // ВАЖНО: в Vercel serverless нельзя setTimeout после return (процесс замирает),
    // поэтому шлём синхронно до ответа. Green API ждёт ответ webhook до 10 сек — успеваем.
    if (!existingChat && direction === 'in') {
      try {
        const { data: settings } = await sb
          .from('calc_settings')
          .select('wa_auto_greeting, wa_auto_greeting_on')
          .eq('id', 'main')
          .maybeSingle()

        if (settings?.wa_auto_greeting_on && settings?.wa_auto_greeting?.trim()) {
          const GREEN_ID    = process.env.GREEN_API_ID
          const GREEN_TOKEN = process.env.GREEN_API_TOKEN
          if (GREEN_ID && GREEN_TOKEN) {
            const greeting = settings.wa_auto_greeting.trim()
            try {
              const r = await fetch(
                `https://api.green-api.com/waInstance${GREEN_ID}/sendMessage/${GREEN_TOKEN}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ chatId, message: greeting }),
                }
              )
              const d = await r.json()
              if (d.idMessage) {
                await sb.from('wa_messages').insert({
                  id: d.idMessage, chat_id: chatId, direction: 'out',
                  type: 'text', body: greeting, author: 'Автоответ',
                  status: 'sent', sent_at: new Date().toISOString(),
                })
                await sb.from('wa_chats').update({
                  last_message: greeting, last_message_at: new Date().toISOString(),
                }).eq('id', chatId)
              }
            } catch (e) { console.error('[auto-greeting]', e.message) }
          }
        }
      } catch (e) { console.error('[auto-greeting check]', e.message) }
    }

    return res.status(200).json({ ok: true, chatId, msgId, type, direction })

  } catch (err) {
    console.error('WA webhook error:', err)
    // Возвращаем 200 Green API чтобы не получить повторные попытки
    console.error('[webhook]', err.message)
    return res.status(200).json({ ok: false, error: 'Ошибка обработки webhook' })
  }
}
