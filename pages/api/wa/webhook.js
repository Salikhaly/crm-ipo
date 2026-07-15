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

// Ссылки Green API на входящие медиа временные (живут несколько дней). Для
// ипотеки документы клиента должны храниться долго → зеркалим файл в постоянный
// публичный bucket Supabase. Best-effort: любая ошибка/таймаут → оставляем
// ссылку Green (сообщение всё равно сохранится). Таймаут 6с и лимит 20МБ, чтобы
// не выйти за 10-секундный бюджет ответа вебхуку.
// Текущее время в Казахстане (Asia/Almaty, UTC+5) как 'HH:MM' — сервер в UTC
function nowAlmatyHM() {
  try {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Almaty', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date())
    const hh = p.find(x => x.type === 'hour').value
    const mm = p.find(x => x.type === 'minute').value
    return `${hh}:${mm}`
  } catch (e) {
    return new Date().toISOString().slice(11, 16)  // фолбэк: UTC
  }
}
// Нерабочее время: текущий момент вне [from, to). Сравнение строк 'HH:MM' корректно.
function isOffHours(from, to) {
  const now = nowAlmatyHM()
  return !(now >= (from || '09:00') && now < (to || '18:00'))
}

async function mirrorIncomingMedia(sb, url, chatId, msgId, mime, name) {
  try {
    if (!url) return ''
    const ac = new AbortController()
    const t  = setTimeout(() => ac.abort(), 6000)
    let r
    try { r = await fetch(url, { signal: ac.signal }) } finally { clearTimeout(t) }
    if (!r || !r.ok) return ''
    const declared = +r.headers.get('content-length') || 0
    if (declared > 20 * 1024 * 1024) return ''
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length > 20 * 1024 * 1024) return ''
    const BUCKET = 'wa-media'
    try { await sb.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 20 * 1024 * 1024 }) } catch (e) { /* уже есть */ }
    const safe = String(name || 'file').replace(/[^\w.\-]/g, '_').slice(0, 80)
    const path = `${chatId.replace('@c.us', '')}/in_${msgId}_${safe}`
    const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: mime || 'application/octet-stream', upsert: true })
    if (error) return ''
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  } catch (e) {
    console.error('[wa mirror in]', e.message)
    return ''
  }
}

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

    // ВРЕМЕННАЯ ДИАГНОСТИКА (снять после разбора входящих): что реально шлёт Green
    console.log('[WA HOOK]', 'type=' + typeWebhook, 'chatId=' + (senderData?.chatId || '-'),
      'msgType=' + (messageData?.typeMessage || '-'), 'idMessage=' + (body.idMessage || '-'))

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
    const direction = typeWebhook === 'incomingMessageReceived' ? 'in' : 'out'
    // Имя клиента: входящее — pushname отправителя (senderName); исходящее с
    // телефона — senderName это имя ВЛАДЕЛЬЦА номера, поэтому берём только
    // chatName (имя собеседника). Одинокие суррогаты (обрезанные эмодзи) чистим.
    const rawName = direction === 'in'
      ? (senderData?.senderName || senderData?.chatName || '')
      : (senderData?.chatName || '')
    const name = String(rawName).substring(0, 100)
      .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
      .replace(/(^|[^\uD800-\uDBFF])([\uDC00-\uDFFF])/g, '$1')
    // idMessage/timestamp приходят в КОРНЕ тела вебхука (не в messageData!) —
    // раньше msgId был пуст и входящие сообщения не сохранялись вовсе
    // Стабильный id: если Green не прислал idMessage — строим из chatId+времени,
    // чтобы сообщение ВСЕГДА сохранилось (иначе входящие молча пропадали)
    const msgIdRaw  = body.idMessage ?? messageData?.idMessage ?? ''
    const msgId     = msgIdRaw || ('wa_' + chatId.replace('@c.us','') + '_' + (body.timestamp || Date.now()))
    const ts        = body.timestamp ?? messageData?.timestamp
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
      case 'quotedMessage':
        // Ответ-цитата: собственный текст лежит в extendedTextMessageData
        type = 'text'
        text = (messageData?.extendedTextMessageData?.text ?? '').substring(0, 4096) || '[Цитата]'
        break
      case 'locationMessage': {
        const loc = messageData?.locationMessageData || {}
        type = 'text'
        text = ('📍 Локация: ' + (loc.nameLocation || '') + ' ' + (loc.latitude ?? '') + ',' + (loc.longitude ?? '')).trim()
        break
      }
      case 'contactMessage':
        type = 'text'
        text = '👤 Контакт: ' + (messageData?.contactMessageData?.displayName ?? '')
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
      // ── Новый чат: клиента сначала ИЩЕМ по номеру, создаём только если нет ──
      // Ранее здесь был upsert по phone: без unique constraint он падал (42P10),
      // а с constraint — затирал бы карточку существующего клиента (fio, stage,
      // comments → пустые). Существующего клиента не трогаем — только линкуем чат.
      // Решение владельца: не всякий, кто написал — реальный лид. Клиента в базе
      // НЕ создаём автоматически (иначе база засоряется). Если номер уже есть в
      // базе — привязываем чат к нему. Нет — чат живёт в мессенджере (client_id
      // null), менеджер переводит его в базу кнопкой «В CRM базу».
      const tail = String(phone || '').replace(/\D/g, '').slice(-10)
      let clientId = null
      if (tail.length === 10) {
        const { data: found } = await sb
          .from('clients').select('id').ilike('phone', '%' + tail).limit(1)
        clientId = found?.[0]?.id || null
      }
      await sb.from('wa_chats').upsert({
        id:              chatId,
        phone,
        name:            name || phone,
        last_message:    preview,
        last_message_at: sentAt,
        unread_count:    direction === 'in' ? 1 : 0,
        client_id:       clientId,
        status:          'new',
      }, { onConflict: 'id' })

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

    // ── Сохраняем сообщение ВСЕГДА (msgId теперь всегда есть; дубли — по id) ──
    {
      // Входящий файл — зеркалим в постоянное хранилище (ссылка Green временная).
      // На неудаче остаётся ссылка Green — сообщение в любом случае сохранится.
      let storedMedia = mediaUrl
      if (mediaUrl && direction === 'in') {
        const m = await mirrorIncomingMedia(sb, mediaUrl, chatId, msgId, mediaMime, mediaName)
        if (m) storedMedia = m
      }
      const { error: insertErr } = await sb.from('wa_messages').upsert({
        id:         msgId,
        chat_id:    chatId,
        direction,
        type,
        body:       text,
        media_url:  storedMedia,
        media_name: mediaName,
        media_mime: mediaMime,
        media_size: mediaSize,
        author:     direction === 'out' ? 'CRM' : name,
        status:     direction === 'out' ? 'sent' : 'delivered',
        sent_at:    sentAt,
      }, { onConflict: 'id', ignoreDuplicates: true })  // ignoreDuplicates=true — не перезаписываем уже сохранённые

      // ВРЕМЕННАЯ ДИАГНОСТИКА: результат сохранения сообщения
      console.log('[WA SAVE]', 'dir=' + direction, 'type=' + type, 'id=' + msgId, insertErr ? ('ERR: ' + insertErr.message) : 'OK')
      if (insertErr) console.error('Message upsert error:', insertErr.message)
    }

    // ── Round-robin: автораспределение нового лида по менеджерам ──
    // Включается в админке (calc_settings.wa_round_robin, миграция 011).
    // Назначаем менеджера с наименьшим числом активных чатов — и чату, и клиенту.
    // Любая ошибка (в т.ч. неприменённая миграция) не ломает вебхук.
    if (!existingChat && direction === 'in') {
      try {
        const { data: rrSet } = await sb
          .from('calc_settings')
          .select('wa_round_robin')
          .eq('id', 'main')
          .maybeSingle()
        if (rrSet?.wa_round_robin) {
          const { data: mgrs } = await sb.from('managers').select('id')
          if (mgrs?.length) {
            const { data: loads } = await sb
              .from('wa_chats')
              .select('assigned_to')
              .not('assigned_to', 'is', null)
              .neq('status', 'closed')
            const cnt = {}
            for (const r of (loads || [])) cnt[r.assigned_to] = (cnt[r.assigned_to] || 0) + 1
            let best = mgrs[0].id, bestN = Infinity
            for (const m of mgrs) {
              const n = cnt[m.id] || 0
              if (n < bestN) { bestN = n; best = m.id }
            }
            await sb.from('wa_chats').update({ assigned_to: best }).eq('id', chatId)
            // Клиента в базе может ещё не быть (создаётся при переводе) — тогда
            // update просто ничего не затронет, это не ошибка
            await sb.from('clients').update({ manager: best }).eq('phone', phone).is('manager', null)
          }
        }
      } catch (e) { console.error('[round-robin]', e.message) }
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

    // ── Автоответ в НЕРАБОЧЕЕ время (миграция 017, wa_config) ──────
    // На любое входящее вне рабочих часов, не чаще 1 раза в 6ч на чат — чтобы
    // клиент не чувствовал игнора ночью/в выходной, а менеджер спокойно отдыхал.
    if (direction === 'in') {
      try {
        const { data: cfgRow } = await sb
          .from('calc_settings').select('wa_config').eq('id', 'main').maybeSingle()
        const wc = cfgRow?.wa_config
        if (wc?.offhours_on && String(wc.offhours_text || '').trim() &&
            isOffHours(wc.work_from, wc.work_to)) {
          // троттлинг: уже отвечали автоответом нерабочего времени за последние 6ч?
          const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString()
          const { data: recent } = await sb.from('wa_messages')
            .select('id').eq('chat_id', chatId).eq('author', 'Автоответ (нерабочее время)')
            .gte('sent_at', since).limit(1)
          const GREEN_ID = process.env.GREEN_API_ID, GREEN_TOKEN = process.env.GREEN_API_TOKEN
          if (!recent?.length && GREEN_ID && GREEN_TOKEN) {
            const txt = wc.offhours_text.trim()
            try {
              const r = await fetch(
                `https://api.green-api.com/waInstance${GREEN_ID}/sendMessage/${GREEN_TOKEN}`,
                { method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ chatId, message: txt }) }
              )
              const d = await r.json()
              if (d.idMessage) {
                await sb.from('wa_messages').insert({
                  id: d.idMessage, chat_id: chatId, direction: 'out', type: 'text',
                  body: txt, author: 'Автоответ (нерабочее время)', status: 'sent',
                  sent_at: new Date().toISOString(),
                })
                await sb.from('wa_chats').update({
                  last_message: txt, last_message_at: new Date().toISOString(),
                }).eq('id', chatId)
              }
            } catch (e) { console.error('[offhours send]', e.message) }
          }
        }
      } catch (e) { console.error('[offhours check]', e.message) }
    }

    return res.status(200).json({ ok: true, chatId, msgId, type, direction })

  } catch (err) {
    console.error('WA webhook error:', err)
    // Возвращаем 200 Green API чтобы не получить повторные попытки
    console.error('[webhook]', err.message)
    return res.status(200).json({ ok: false, error: 'Ошибка обработки webhook' })
  }
}
