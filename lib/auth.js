// lib/auth.js
// JWT авторизация для API routes

import jwt from 'jsonwebtoken'

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

    req.user = payload
    return handler(req, res)
  }
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
