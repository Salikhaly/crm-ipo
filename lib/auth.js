// lib/auth.js
// JWT авторизация для API routes

import jwt from 'jsonwebtoken'
import { getSupabase } from './supabase'

if (!process.env.JWT_SECRET) {
  throw new Error('[auth] JWT_SECRET env variable is required but not set')
}
const SECRET = process.env.JWT_SECRET

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' })
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET)
  } catch {
    return null
  }
}

// Короткоживущий кэш в памяти процесса: не бьём БД на каждый запрос,
// но и не доверяем JWT-данным дольше чем CACHE_TTL_MS.
// На серверless-платформах (Vercel) кэш живёт пока тёплый инстанс жив —
// в худшем случае проверка произойдёт чуть чаще, что безопасно (не опаснее).
const userCache = new Map()  // userId -> { role, manager_id, fetchedAt }
const CACHE_TTL_MS  = 60_000   // 60 секунд — баланс между нагрузкой на БД и скоростью реакции на смену роли
const MAX_CACHE_SIZE = 2_000   // защита от неограниченного роста на долгоживущих инстансах

function evictStale() {
  // Не сканируем всю карту на каждый запрос — только когда она разрослась
  if (userCache.size <= MAX_CACHE_SIZE) return
  const now = Date.now()
  for (const [key, val] of userCache) {
    if (now - val.fetchedAt >= CACHE_TTL_MS) userCache.delete(key)
  }
}

async function getFreshUserData(userId, jwtPayload = null) {
  const cached = userCache.get(userId)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached
  }

  // В тестах (JEST_SKIP_AUTH_DB=1) не трогаем БД —
  // возвращаем role/manager_id прямо из JWT-payload.
  // NODE_ENV guard гарантирует: в production (Vercel) этот код НИКОГДА не выполнится.
  // process.env.NODE_ENV на Vercel всегда = 'production', не 'test'.
  // Закрывает аудит C1 (auth bypass в production-коде).
  if (process.env.NODE_ENV === 'test' &&
      process.env.JEST_SKIP_AUTH_DB === '1' &&
      jwtPayload) {
    return { role: jwtPayload.role, manager_id: jwtPayload.manager_id ?? null, fetchedAt: Date.now() }
  }

  const sb = getSupabase()
  const { data, error } = await sb
    .from('users')
    .select('role, manager_id')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) {
    userCache.delete(userId)
    return null  // пользователь удалён или ошибка БД
  }

  const fresh = { role: data.role, manager_id: data.manager_id, fetchedAt: Date.now() }
  evictStale()
  userCache.set(userId, fresh)
  return fresh
}

// Middleware — проверяет JWT из заголовка Authorization
export function withAuth(handler) {
  return async (req, res) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Не авторизован' })
    }

    const token = authHeader.split(' ')[1]
    const payload = verifyToken(token)

    if (!payload) {
      return res.status(401).json({ error: 'Токен недействителен или истёк' })
    }

    // SEC: сверяем role/manager_id с текущими данными БД, а не только с JWT-payload.
    // Без этого уволенный сотрудник или понижение роли admin→manager не вступает
    // в силу до истечения токена (до 7 дней) — критичная дыра в правах доступа.
    const fresh = await getFreshUserData(payload.id, payload)
    if (!fresh) {
      return res.status(401).json({ error: 'Пользователь не найден или удалён' })
    }

    req.user = {
      ...payload,
      role:       fresh.role,        // актуальная роль из БД, не из старого токена
      manager_id: fresh.manager_id,  // актуальная привязка к менеджеру
    }
    return handler(req, res)
  }
}

// Принудительно сбрасывает кэш для пользователя — вызывать сразу после
// изменения роли/manager_id через PUT /api/users/[id], чтобы новые права
// подействовали мгновенно, а не через CACHE_TTL_MS.
export function invalidateUserCache(userId) {
  userCache.delete(userId)
}

// Проверка роли
export function withRole(...roles) {
  return (handler) => withAuth(async (req, res) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Нет доступа' })
    }
    return handler(req, res)
  })
}
