// pages/api/clients/check-phone.js
// №4: Проверка дубля телефона при создании клиента.
// GET /api/clients/check-phone?phone=+77071234567
// Ищет по ВСЕМ клиентам (не только своим) — чтобы менеджеры не дублировали
// друг друга. Возвращает только имя и менеджера (без деталей чужого клиента).

import { getSupabase } from '../../../lib/supabase'
import { withAuth } from '../../../lib/auth'

export default withAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })

  const raw = String(req.query.phone || '')
  const digits = raw.replace(/\D/g, '').replace(/^8/, '7')
  if (digits.length < 10) return res.status(200).json({ found: null })

  const sb = getSupabase()
  // Ищем по последним 10 цифрам (без кода страны) — ловит любые форматы записи
  const tail = digits.slice(-10)
  const { data } = await sb
    .from('clients')
    .select('id, fio, manager, phone')
    .ilike('phone', `%${tail}%`)
    .limit(1)

  if (!data?.length) return res.status(200).json({ found: null })

  const c = data[0]
  const { data: mgr } = await sb.from('managers').select('name').eq('id', c.manager).maybeSingle()

  return res.status(200).json({
    found: {
      fio:     c.fio || 'Без имени',
      manager: mgr?.name || '—',
    },
  })
})
