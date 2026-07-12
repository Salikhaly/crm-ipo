// pages/api/search/index.js
// GET /api/search?q=xxx&stage=xxx&manager=xxx
// Поиск клиентов по ИИН, имени, телефону, городу

import { getSupabase, dbToClient } from '../../../lib/supabase'
import { apiError } from '../../../lib/apiError'
import { withAuth } from '../../../lib/auth'

// Экранирует спецсимволы PostgreSQL ILIKE: %, _, \
function escapeLike(s) {
  // %_\ — спецсимволы ILIKE; запятые и скобки — синтаксис фильтра .or() PostgREST
  return s.replace(/[%_\\]/g, '\\$&').replace(/[,()]/g, ' ')
}

export default withAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Только GET' })

  const sb = getSupabase()
  const { role, manager_id: mid } = req.user
  const { q = '', stage, manager } = req.query

  // Без критериев поиска — возвращаем пустой результат (не дампим всю БД)
  if (!q && !stage && !manager) {
    return res.status(200).json({ results: [], count: 0 })
  }

  let query = sb.from('clients').select('*').order('created_at', { ascending: false })

  // Роль определяет видимость (зеркалим логику clients/index.js)
  // Менеджеры ищут по всем клиентам команды (решение бизнеса, июль 2026)
  if (role === 'specialist' && mid) query = query.eq('responsible_manager', mid)

  // Фильтры (менеджер и специалист не могут обойти свои ограничения через query string)
  if (stage)   query = query.eq('stage', stage)
  if (manager && role !== 'specialist') query = query.eq('manager', manager)

  // Поиск (минимум 2 символа)
  if (q.length >= 2) {
    // №5: если запрос похож на телефон — ищем по нормализованным цифрам.
    // «8707 123-45-67» и «+7 707 1234567» находят одного клиента
    // (телефоны в БД нормализованы к +7XXXXXXXXXX миграцией 009).
    const digits = q.replace(/\D/g, '')
    if (digits.length >= 5) {
      const tail = digits.replace(/^8/, '7').slice(-10)
      query = query.or(
        `fio.ilike.%${escapeLike(q)}%,iin.ilike.%${escapeLike(q)}%,phone.ilike.%${escapeLike(tail)}%,city.ilike.%${escapeLike(q)}%`
      )
    } else {
      query = query.or(
        `fio.ilike.%${escapeLike(q)}%,iin.ilike.%${escapeLike(q)}%,phone.ilike.%${escapeLike(q)}%,city.ilike.%${escapeLike(q)}%`
      )
    }
  }

  const { data, error } = await query.limit(50)
  if (error) return apiError(res, error)

  return res.status(200).json({
    results: (data || []).map(dbToClient),
    count:   (data || []).length,
  })
})
