// pages/api/auth/login.js
// POST /api/auth/login  →  { login, pwd }  →  { token, user }

import { getSupabase } from '../../../lib/supabase'
import { signToken }   from '../../../lib/auth'
import bcrypt          from 'bcryptjs'
import { apiError, apiErrors } from '../../../lib/apiError'

// ─── In-memory rate limiter ───────────────────────────────────────────────────
// В serverless каждый инстанс независим — это защищает от наивного перебора,
// но не от атак с десятков IP. Для production-grade защиты: Upstash Redis.
const attempts = new Map()
const MAX_ATTEMPTS = 10
const WINDOW_MS    = 10 * 60 * 1000  // 10 минут

function checkRateLimit(ip) {
  const now = Date.now()
  const rec = attempts.get(ip)
  if (rec && now < rec.resetAt) {
    if (rec.count >= MAX_ATTEMPTS) return false
    rec.count++
  } else {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
  }
  // Чистка старых записей
  if (attempts.size > 1000) {
    for (const [k, v] of attempts) {
      if (now >= v.resetAt) attempts.delete(k)
    }
  }
  return true
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return apiErrors.methodNotAllowed(res)

  // Rate limiting — закрывает аудит M1
  const ip = req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown'
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Слишком много попыток. Подождите 10 минут.' })
  }

  const { login, pwd } = req.body
  if (!login || !pwd) return apiErrors.badRequest(res, 'Логин и пароль обязательны')

  const startTime = Date.now()
  const sb = getSupabase()

  const { data: user, error } = await sb
    .from('users')
    .select('*')
    .eq('login', login.trim().toLowerCase())
    .maybeSingle()

  const dummyHash = '$2a$12$dummy.hash.to.prevent.timing.attacks.xxxxxxxxxxxxxxxxxxxx'
  const hashToCheck = user?.pwd_hash || dummyHash
  const passwordValid = await bcrypt.compare(pwd, hashToCheck)

  const elapsed = Date.now() - startTime
  if (elapsed < 200) await new Promise(r => setTimeout(r, 200 - elapsed))

  if (error) return apiError(res, error, 500, 'Ошибка авторизации')
  if (!user || !passwordValid) return res.status(401).json({ error: 'Неверный логин или пароль' })

  const token = signToken({
    id: user.id, name: user.name, role: user.role,
    manager_id: user.manager_id, login: user.login,
  })

  return res.status(200).json({
    token,
    user: { id: user.id, name: user.name, role: user.role, manager_id: user.manager_id, login: user.login },
  })
}
