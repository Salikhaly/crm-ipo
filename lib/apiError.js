// lib/apiError.js
// Централизованная обработка ошибок API.
// В production — клиент видит только безопасное сообщение.
// В development — полное сообщение для отладки.
// Это закрывает 33 утечки error.message из audit C2.

const IS_DEV = process.env.NODE_ENV === 'development'

/**
 * Отправляет унифицированный ответ об ошибке.
 * @param {object} res         — Next.js response
 * @param {Error|string} err   — исходная ошибка
 * @param {number} statusCode  — HTTP статус (по умолчанию 500)
 * @param {string} publicMsg   — сообщение для клиента (если не задано — generic)
 */
export function apiError(res, err, statusCode = 500, publicMsg = null) {
  const message = err instanceof Error ? err.message : String(err)

  // Всегда логируем полную ошибку на сервере (видно в Vercel Logs / Sentry)
  console.error(`[API ${statusCode}]`, message, err?.stack || '')

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
