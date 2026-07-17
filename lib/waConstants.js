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
