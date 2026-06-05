// pages/api/auth/login.js
// POST /api/auth/login  →  { login, pwd }  →  { token, user }

import { getSupabase } from '../../../lib/supabase'
import { signToken }   from '../../../lib/auth'
import bcrypt          from 'bcryptjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не разрешён' })
  }

  const { login, pwd } = req.body

  if (!login || !pwd) {
    return res.status(400).json({ error: 'Логин и пароль обязательны' })
  }

  // Базовая защита от брутфорса: искусственная задержка (constant-time)
  // В production замените на Redis rate limiter (upstash/ioredis)
  const startTime = Date.now()

  const sb = getSupabase()

  // SEC-001 FIX: ищем пользователя только по логину, пароль сравниваем через bcrypt
  const { data: user, error } = await sb
    .from('users')
    .select('*')
    .eq('login', login.trim().toLowerCase())
    .single()

  // Constant-time: даже если пользователь не найден — делаем compare чтобы время было одинаковым
  const dummyHash = '$2a$12$dummy.hash.to.prevent.timing.attacks.xxxxxxxxxxxxxxxxxxxx'
  const hashToCheck = user?.pwd_hash || dummyHash

  const passwordValid = await bcrypt.compare(pwd, hashToCheck)

  // Минимальная задержка 200ms против timing attacks
  const elapsed = Date.now() - startTime
  if (elapsed < 200) await new Promise(r => setTimeout(r, 200 - elapsed))

  if (error || !user || !passwordValid) {
    return res.status(401).json({ error: 'Неверный логин или пароль' })
  }

  const token = signToken({
    id:    user.id,
    name:  user.name,
    role:  user.role,
    mid:   user.manager_id,
    login: user.login,
  })

  return res.status(200).json({
    token,
    user: {
      id:    user.id,
      name:  user.name,
      role:  user.role,
      mid:   user.manager_id,
      login: user.login,
    },
  })
}
