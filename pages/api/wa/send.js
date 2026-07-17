// pages/api/wa/send.js
// POST /api/wa/send
// Отправляет сообщение клиенту через Green API
// Body: { chatId, phone, text, author }

import { getSupabase } from '../../../lib/supabase'
import { apiError } from '../../../lib/apiError'
import { withAuth } from '../../../lib/auth'
import { normalizeWaPhone, toWaChatId } from '../../../lib/waConstants'

// ─── Защита от бана WhatsApp ──────────────────────────────────────────────────
// WhatsApp (Meta) банит номера за спам-паттерны: высокая скорость, массовая
// отправка. Держим паузу между сообщениями и дневной лимит.
const MIN_INTERVAL_MS = 4000        // не чаще 1 сообщения в 4 секунды
const DAILY_LIMIT     = 250         // мягкий дневной лимит на аккаунт
const DAILY_WARN_AT   = 200         // с какого числа предупреждать

let _lastSentAt = 0                  // время последней отправки (весь инстанс)
const _dailyCount = { date: '', count: 0 }  // счётчик за сутки
const _recentByPhone = new Map()     // phone → { text, at } защита от дубля

function checkThrottle(phone, text) {
  // В тестах троттлинг отключён (NODE_ENV=test) — иначе быстрые тесты упираются в паузу
  if (process.env.NODE_ENV === 'test' && process.env.WA_SKIP_THROTTLE !== '0') {
    return { ok: true, warn: null }
  }

  const now   = Date.now()
  const today = new Date().toISOString().slice(0, 10)

  // Сброс дневного счётчика в новый день
  if (_dailyCount.date !== today) {
    _dailyCount.date = today
    _dailyCount.count = 0
  }

  // Дневной лимит
  if (_dailyCount.count >= DAILY_LIMIT) {
    return { ok: false, code: 429, error: `Достигнут дневной лимит отправки (${DAILY_LIMIT}). Защита от блокировки WhatsApp. Продолжите завтра.` }
  }

  // Минимальный интервал между сообщениями
  const sinceLast = now - _lastSentAt
  if (sinceLast < MIN_INTERVAL_MS) {
    const wait = Math.ceil((MIN_INTERVAL_MS - sinceLast) / 1000)
    return { ok: false, code: 429, error: `Слишком быстро. Подождите ${wait} сек между сообщениями (защита от блокировки WhatsApp).` }
  }

  // Защита от дубля — тот же текст тому же номеру за последние 60 сек
  const recent = _recentByPhone.get(phone)
  if (recent && recent.text === text && now - recent.at < 60000) {
    return { ok: false, code: 409, error: 'Это же сообщение уже отправлено этому номеру минуту назад.' }
  }

  return { ok: true, warn: _dailyCount.count >= DAILY_WARN_AT ? `⚠️ Отправлено ${_dailyCount.count} из ${DAILY_LIMIT} за сегодня` : null }
}

function markSent(phone, text) {
  _lastSentAt = Date.now()
  _dailyCount.count++
  _recentByPhone.set(phone, { text, at: Date.now() })
  // чистка старых записей
  if (_recentByPhone.size > 500) {
    const cutoff = Date.now() - 60000
    for (const [k, v] of _recentByPhone) if (v.at < cutoff) _recentByPhone.delete(k)
  }
}

export default withAuth(async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Только POST' })
  }

  const { chatId, phone, text, author } = req.body

  if (!phone || !text) {
    return res.status(400).json({ error: 'phone и text обязательны' })
  }

  // Проверка троттлинга ДО обращения к Green API
  const rawPhoneForCheck = phone.replace(/\D/g, '')
  const throttle = checkThrottle(rawPhoneForCheck, text)
  if (!throttle.ok) {
    return res.status(throttle.code).json({ error: throttle.error })
  }

  const GREEN_ID    = process.env.GREEN_API_ID
  const GREEN_TOKEN = process.env.GREEN_API_TOKEN

  if (!GREEN_ID || !GREEN_TOKEN || GREEN_ID === 'placeholder' || GREEN_TOKEN === 'placeholder') {
    return res.status(503).json({
      error: 'WhatsApp не подключён. Обратитесь к администратору для настройки Green API.'
    })
  }

  try {
    // Форматируем номер в международный (учёт казахстанского 8XXX и 10-значного)
    const waPhone  = normalizeWaPhone(phone)
    const waId     = chatId || toWaChatId(phone)

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

    // Успешно отправлено — фиксируем для троттлинга
    markSent(rawPhoneForCheck, text)

    // Сохраняем исходящее сообщение в БД
    const sb = getSupabase()

    // upsert (не insert): повторный вебхук/ретрай с тем же idMessage не роняет 500
    await sb.from('wa_messages').upsert({
      id:        greenData.idMessage,
      chat_id:   waId,
      direction: 'out',
      type:      'text',
      body:      text,
      author:    author || req.user.name || 'CRM',
      status:    'sent',
      sent_at:   new Date().toISOString(),
    }, { onConflict: 'id', ignoreDuplicates: true })

    // Обновляем чат — upsert создаёт запись если её ещё нет
    const { data: existChat } = await sb.from('wa_chats').select('id, status').eq('id', waId).maybeSingle()
    if (existChat) {
      const upd = { last_message: text, last_message_at: new Date().toISOString() }
      // Ответил менеджер → чат больше не «Новый», уходит в «В работе»
      if (existChat.status === 'new') upd.status = 'in_work'
      await sb.from('wa_chats').update(upd).eq('id', waId)
    } else {
      await sb.from('wa_chats').insert({
        id:              waId,
        phone:           '+' + waPhone,
        name:            '+' + waPhone,
        last_message:    text,
        last_message_at: new Date().toISOString(),
        unread_count:    0,
        status:          'in_work',
      })
    }

    return res.status(200).json({
      ok:        true,
      messageId: greenData.idMessage,
      warn:      throttle.warn || undefined,
    })
  } catch (err) {
    console.error('send-wa error:', err)
    return apiError(res, err)
  }
})
