// lib/waConstants.js
// Единый источник истины для статусов WhatsApp — импортируйте отсюда,
// не дублируйте в отдельных файлах.

export const VALID_CHAT_STATUSES    = Object.freeze(['new', 'in_work', 'done'])
export const VALID_MESSAGE_STATUSES = Object.freeze(['sent', 'delivered', 'read', 'failed'])

// Категории чата (метка типа обращения). Менеджер ставит вручную — на следующий
// день с ходу видно, кто на сопровождении, кто по жилзайму, у кого вопрос.
// Решение владельца (17.07): «300» оставить как есть.
export const WA_CHAT_CATS = Object.freeze([
  { id: 'accompany', l: 'Сопровождение', color: '#10b981' },
  { id: 'zhilzaim',  l: 'Жилзайм',       color: '#3b82f6' },
  { id: 'question',  l: 'Вопрос',        color: '#f59e0b' },
  { id: 'cat300',    l: '300',           color: '#8b5cf6' },
])
export const VALID_CHAT_CATS = Object.freeze(WA_CHAT_CATS.map(c => c.id))

// Международный номер (11 цифр, 7XXXXXXXXXX) из любого казахстанского формата.
// КРИТ: прежняя логика send/sendMedia была `raw.startsWith('7') ? raw : '7'+raw`
// и ломала номера с ведущей 8 (домашний формат РК): 87711285135 → 787711285135,
// т.е. сообщение уходило ЧУЖОМУ человеку. Здесь 8XXXXXXXXXX → 7XXXXXXXXXX,
// 10 цифр без кода → 7XXXXXXXXXX.
export function normalizeWaPhone(phone) {
  const d = String(phone || '').replace(/\D/g, '')
  if (/^8\d{10}$/.test(d)) return '7' + d.slice(1)   // 8 701… → 7 701…
  if (/^7\d{10}$/.test(d)) return d                   // уже международный
  if (/^\d{10}$/.test(d))  return '7' + d             // 701… без кода страны
  return d                                            // прочее — как есть
}

// Телефон → Green API chatId (77XXXXXXXXX@c.us)
export function toWaChatId(phone) {
  const n = normalizeWaPhone(phone)
  return n ? n + '@c.us' : ''
}
