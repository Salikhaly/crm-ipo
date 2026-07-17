// lib/apiError.js
// Централизованная обработка ошибок API.
// В production — клиент видит только безопасное сообщение.
// В development — полное сообщение для отладки.
// Это закрывает 33 утечки error.message из audit C2.

const IS_DEV = process.env.NODE_ENV === 'development'

/**
 * Достаёт читаемый текст из ошибки любого вида.
 * Ошибки Supabase (PostgrestError) — это ОБЫЧНЫЕ объекты { message, details,
 * hint, code }, а НЕ экземпляры Error. Прежний код делал `err instanceof Error
 * ? err.message : String(err)` → для Supabase получал "[object Object]" и терял
 * всю диагностику (самый частый класс ошибок в приложении). Здесь разбираем
 * объект по полям, чтобы в Vercel-логах был реальный текст SQL-ошибки.
 */
function extractError(err) {
  if (err == null) return 'Unknown error'
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  if (typeof err === 'object') {
    // PostgrestError и похожие: собираем message + code + details + hint
    const parts = [err.message, err.code && `[${err.code}]`, err.details, err.hint].filter(Boolean)
    if (parts.length) return parts.join(' ')
    try { return JSON.stringify(err) } catch { return String(err) }
  }
  return String(err)
}

/**
 * Отправляет унифицированный ответ об ошибке.
 * @param {object} res         — Next.js response
 * @param {Error|object|string} err — исходная ошибка (в т.ч. PostgrestError)
 * @param {number} statusCode  — HTTP статус (по умолчанию 500)
 * @param {string} publicMsg   — сообщение для клиента (если не задано — generic)
 */
export function apiError(res, err, statusCode = 500, publicMsg = null) {
  const message = extractError(err)

  // Всегда логируем полную ошибку на сервере (видно в Vercel Logs / Sentry).
  // JSON.stringify — чтобы объект-ошибка Supabase не превратился в [object Object].
  let raw = ''
  try { raw = err?.stack || JSON.stringify(err) } catch { raw = String(err) }
  console.error(`[API ${statusCode}]`, message, raw)

  return res.status(statusCode).json({
    error: IS_DEV
      ? message                                          // dev: полное сообщение
      : (publicMsg || 'Внутренняя ошибка сервера'),     // prod: безопасное сообщение
  })
}

/**
 * Хелперы для типовых ситуаций
 */
export const apiErrors = {
  notFound:      (res, entity = 'Ресурс') =>
    res.status(404).json({ error: `${entity} не найден` }),

  forbidden:     (res) =>
    res.status(403).json({ error: 'Нет доступа' }),

  badRequest:    (res, msg = 'Неверный запрос') =>
    res.status(400).json({ error: msg }),

  methodNotAllowed: (res) =>
    res.status(405).json({ error: 'Метод не разрешён' }),

  unauthorized:  (res) =>
    res.status(401).json({ error: 'Не авторизован' }),
}
