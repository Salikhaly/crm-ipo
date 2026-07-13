// pages/api/wa/sendMedia.js
// POST /api/wa/sendMedia  (multipart/form-data)
// Отправляет медиафайл через Green API sendFileByUpload

import { getSupabase } from '../../../lib/supabase'
import { apiError } from '../../../lib/apiError'
import { withAuth }    from '../../../lib/auth'
import formidable      from 'formidable'
import fs              from 'fs'

export const config = { api: { bodyParser: false } }

export default withAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' })

  const GREEN_ID    = process.env.GREEN_API_ID
  const GREEN_TOKEN = process.env.GREEN_API_TOKEN
  if (!GREEN_ID || !GREEN_TOKEN)
    return res.status(500).json({ error: 'GREEN_API_ID и GREEN_API_TOKEN не настроены' })

  try {
    const form = formidable({ maxFileSize: 32 * 1024 * 1024 })
    const [fields, files] = await form.parse(req)

    const chatId  = fields.chatId?.[0] || ''
    const phone   = fields.phone?.[0]  || ''
    const caption = fields.caption?.[0] || ''
    const author  = fields.author?.[0]  || req.user?.name || 'CRM'
    const file    = files.file?.[0]

    if (!phone || !file) return res.status(400).json({ error: 'phone и file обязательны' })

    // Форматируем chatId
    const rawPhone = phone.replace(/\D/g, '')
    const waPhone  = rawPhone.startsWith('7') ? rawPhone : '7' + rawPhone
    const waId     = chatId || (waPhone + '@c.us')

    // Base64
    const fileData   = fs.readFileSync(file.filepath)
    fs.unlink(file.filepath, () => {})   // удаляем временный файл сразу после прочтения
    const base64File = fileData.toString('base64')
    const fileName   = file.originalFilename || 'file'
    const mimeType   = file.mimetype || 'application/octet-stream'

    // Тип сообщения
    let msgType = 'document'
    if (mimeType.startsWith('image/'))      msgType = 'image'
    else if (mimeType.startsWith('video/')) msgType = 'video'
    else if (mimeType.startsWith('audio/')) msgType = 'audio'

    // Green API — токен передаётся в URL-пути, как требует Green API REST API
    const greenRes = await fetch(
      `https://api.green-api.com/waInstance${GREEN_ID}/sendFileByUpload/${GREEN_TOKEN}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ chatId: waId, fileName, caption, file: base64File }),
      }
    )
    const greenData = await greenRes.json()
    if (!greenRes.ok || !greenData.idMessage) {
      console.error('Green API sendMedia error:', greenData)
      return res.status(502).json({ error: 'Green API: ' + JSON.stringify(greenData) })
    }

    const sb  = getSupabase()
    const now = new Date().toISOString()

    // Зеркалим отправленный файл в Supabase Storage — иначе Green API не отдаёт URL
    // и менеджер вечно видит заглушку вместо своего фото/документа. Публичный
    // bucket → постоянная ссылка прямо в <img src>. Любая ошибка не ломает отправку.
    let storedUrl = ''
    try {
      const BUCKET = 'wa-media'
      try { await sb.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 32 * 1024 * 1024 }) } catch (e) { /* уже есть */ }
      const safe = String(fileName).replace(/[^\w.\-]/g, '_').slice(0, 80)
      const path = `${waId.replace('@c.us','')}/${greenData.idMessage}_${safe}`
      const { error: upErr } = await sb.storage.from(BUCKET).upload(path, fileData, { contentType: mimeType, upsert: true })
      if (!upErr) storedUrl = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    } catch (e) { console.error('[wa media store]', e.message) }

    // Сохраняем сообщение
    await sb.from('wa_messages').upsert({
      id:         greenData.idMessage,
      chat_id:    waId,
      direction:  'out',
      type:       msgType,
      body:       caption,
      media_url:  storedUrl,
      media_name: fileName,
      media_mime: mimeType,
      media_size: file.size || 0,
      author,
      status:     'sent',
      sent_at:    now,
    }, { onConflict: 'id', ignoreDuplicates: true })

    // Обновляем чат: используем update() для существующих (сохраняет unread_count и другие поля)
    // или insert() для новых — upsert с ignoreDuplicates:false обнуляет unread_count по умолчанию
    const { data: existingChat } = await sb
      .from('wa_chats')
      .select('id, status')
      .eq('id', waId)
      .maybeSingle()

    if (existingChat) {
      const upd = { last_message: caption || `[${msgType}]`, last_message_at: now }
      if (existingChat.status === 'new') upd.status = 'in_work'
      await sb.from('wa_chats').update(upd).eq('id', waId)
    } else {
      await sb.from('wa_chats').insert({
        id:              waId,
        phone:           '+' + waPhone,
        name:            '+' + waPhone,
        last_message:    caption || `[${msgType}]`,
        last_message_at: now,
        unread_count:    0,
        status:          'in_work',
      })
    }

    return res.status(200).json({ ok: true, messageId: greenData.idMessage })
  } catch (err) {
    console.error('sendMedia error:', err)
    return apiError(res, err)
  }
})
