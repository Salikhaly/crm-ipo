// lib/format.js
// Централизованные форматтеры — DRY вместо 4 дублей fmtMoney.
// Закрывает audit M3.

/**
 * Форматирует число в тенге: 1234567 → '1 234 567 ₸'
 * @param {number|null} n
 * @param {string} fallback — что вернуть если n = null/undefined/NaN
 */
export const fmtMoney = (n, fallback = '—') =>
  n != null && isFinite(n)
    ? Math.round(n).toLocaleString('ru-RU') + ' ₸'
    : fallback

/**
 * Форматирует КД в проценты: 0.45 → '45%'
 */
export const fmtKd = (v, fallback = '—') =>
  v != null && isFinite(v)
    ? (v * 100).toFixed(0) + '%'
    : fallback

/**
 * Форматирует дату: '2024-01-15' → '15.01.2024'
 */
export const fmtDate = (d, fallback = '—') => {
  if (!d) return fallback
  try {
    return new Date(d).toLocaleDateString('ru-RU')
  } catch {
    return fallback
  }
}

/**
 * Форматирует число с разделителями без знака валюты
 */
export const fmtNum = (n, fallback = '—') =>
  n != null && isFinite(n)
    ? Math.round(n).toLocaleString('ru-RU')
    : fallback
