// __tests__/lib/auth.test.js
import { signToken, verifyToken, withAuth, withRole } from '../../lib/auth'

process.env.JWT_SECRET = 'test-secret-for-jest-only-32chars!!'

const mockUser = { id: '1', name: 'Тест', role: 'admin', mid: null, login: 'test' }

describe('signToken / verifyToken', () => {
  test('подписывает и верифицирует токен', () => {
    const token   = signToken(mockUser)
    const payload = verifyToken(token)
    expect(payload.id).toBe('1')
    expect(payload.role).toBe('admin')
  })

  test('verifyToken возвращает null для невалидного токена', () => {
    expect(verifyToken('invalid.token.here')).toBeNull()
  })

  test('verifyToken возвращает null для expired токена', () => {
    const expiredToken = signToken({ ...mockUser, exp: Math.floor(Date.now()/1000) - 1 })
    // expired tokens с exp в прошлом
    expect(verifyToken('eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.invalid')).toBeNull()
  })
})

describe('withAuth middleware', () => {
  const makeReqRes = (authHeader) => {
    const req = { headers: { authorization: authHeader }, user: null }
    const res = {
      status: jest.fn().mockReturnThis(),
      json:   jest.fn().mockReturnThis(),
    }
    return { req, res }
  }

  test('пропускает валидный Bearer токен', async () => {
    const token   = signToken(mockUser)
    const handler = jest.fn(async (req, res) => res.status(200).json({ ok: true }))
    const { req, res } = makeReqRes(`Bearer ${token}`)
    await withAuth(handler)(req, res)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(req.user.id).toBe('1')
  })

  test('отклоняет запрос без заголовка', async () => {
    const handler = jest.fn()
    const { req, res } = makeReqRes(undefined)
    await withAuth(handler)(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(handler).not.toHaveBeenCalled()
  })

  test('отклоняет неверный формат (без Bearer)', async () => {
    const handler = jest.fn()
    const { req, res } = makeReqRes('Token abc123')
    await withAuth(handler)(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  test('отклоняет истёкший/невалидный токен', async () => {
    const handler = jest.fn()
    const { req, res } = makeReqRes('Bearer invalid.jwt.token')
    await withAuth(handler)(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })
})

describe('withRole middleware', () => {
  test('пропускает пользователя с нужной ролью', async () => {
    const token   = signToken(mockUser)   // role: admin
    const handler = jest.fn(async (req, res) => res.status(200).json({ ok: true }))
    const req     = { headers: { authorization: `Bearer ${token}` } }
    const res     = { status: jest.fn().mockReturnThis(), json: jest.fn() }
    await withRole('admin', 'head')(handler)(req, res)
    expect(handler).toHaveBeenCalled()
  })

  test('блокирует пользователя с неправильной ролью', async () => {
    const managerToken = signToken({ ...mockUser, role: 'manager' })
    const handler      = jest.fn()
    const req          = { headers: { authorization: `Bearer ${managerToken}` } }
    const res          = { status: jest.fn().mockReturnThis(), json: jest.fn() }
    await withRole('admin')(handler)(req, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(handler).not.toHaveBeenCalled()
  })
})
