// lib/waConstants.js
// Единый источник истины для статусов WhatsApp — импортируйте отсюда,
// не дублируйте в отдельных файлах.

export const VALID_CHAT_STATUSES    = Object.freeze(['new', 'in_work', 'done'])
export const VALID_MESSAGE_STATUSES = Object.freeze(['sent', 'delivered', 'read', 'failed'])
