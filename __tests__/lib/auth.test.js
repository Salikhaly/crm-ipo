// __tests__/lib/auth.test.js
process.env.JWT_SECRET           = 'test-secret-for-jest-only-32chars!!'
process.env.SUPABASE_URL         = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_KEY = 'test-key'
// JEST_SKIP_AUTH_DB=1 уже задан в jest.setup.js — DB не трогается совсем

// Мок supabase нужен только чтобы lib/supabase.js не упал при импорте
jest.mock('../../lib/supabase', () => ({
  getSupabase: () => ({
    from: () => ({
      select: function () { return this },
      eq:     function () { return this },
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}))

const { signToken, verifyToken, withAuth, withRole } = require('../../lib/auth')

const mockUser = { id: 'u1', name: 'Тест', role: 'admin', manager_id: null, login: 'test' }

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() })

describe('signToken / verifyToken', () => {
  test('подписывает и верифицирует токен', () => {
    const token = signToken(mockUser)
    const payload = verifyToken(token)
    expect(payload.id).toBe('u1')
    expect(payload.role).toBe('admin')
  })

  test('verifyToken → null для невалидного токена', () => {
    expect(verifyToken('bad.token.here')).toBeNull()
  })

  test('verifyToken → null для пустой строки', () => {
    expect(verifyToken('')).toBeNull()
  })

  test('verifyToken → null для null', () => {
    expect(verifyToken(null)).toBeNull()
  })

  test('токен содержит manager_id а не mid', () => {
    const token = signToken({ ...mockUser, manager_id: 'm1' })
    const payload = verifyToken(token)
    expect(payload.manager_id).toBe('m1')
    expect(payload.mid).toBeUndefined()
  })

  test('токен живёт 7 дней', () => {
    const token = signToken(mockUser)
    const payload = verifyToken(token)
    const sevenDays = 7 * 24 * 3600
    expect(payload.exp - payload.iat).toBe(sevenDays)
  })
})

describe('withAuth middleware', () => {
  const makeReq = (authHeader) => ({ headers: { authorization: authHeader } })

  test('пропускает валидный Bearer токен', async () => {
    const token = signToken(mockUser)
    const handler = jest.fn(async (req, res) => res.status(200).json({ ok: true }))
    const req = makeReq(`Bearer ${token}`)
    const res = makeRes()
    await withAuth(handler)(req, res)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(req.user.id).toBe('u1')
  })

  test('401 без заголовка', async () => {
    const handler = jest.fn()
    await withAuth(handler)(makeReq(undefined), makeRes())
    expect(handler).not.toHaveBeenCalled()
  })

  test('401 без Bearer prefix', async () => {
    const handler = jest.fn()
    const res = makeRes()
    await withAuth(handler)({ headers: { authorization: 'Token abc' } }, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  test('401 невалидный JWT', async () => {
    const handler = jest.fn()
    const res = makeRes()
    await withAuth(handler)(makeReq('Bearer invalid.jwt.token'), res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(handler).not.toHaveBeenCalled()
  })

  test('устанавливает req.user из payload', async () => {
    const token = signToken({ id: 'u99', name: 'Менеджер', role: 'manager', manager_id: 'm5' })
    const handler = jest.fn(async () => {})
    const req = makeReq(`Bearer ${token}`)
    await withAuth(handler)(req, makeRes())
    expect(req.user.id).toBe('u99')
    expect(req.user.role).toBe('manager')
    expect(req.user.manager_id).toBe('m5')
  })
})

describe('withRole middleware', () => {
  test('пропускает admin к admin-ресурсу', async () => {
    const token = signToken(mockUser)
    const handler = jest.fn(async (req, res) => res.status(200).json({}))
    const req = { headers: { authorization: `Bearer ${token}` } }
    const res = makeRes()
    await withRole('admin', 'head')(handler)(req, res)
    expect(handler).toHaveBeenCalled()
  })

  test('403 для manager на admin-ресурсе', async () => {
    const token = signToken({ ...mockUser, role: 'manager' })
    const handler = jest.fn()
    const req = { headers: { authorization: `Bearer ${token}` } }
    const res = makeRes()
    await withRole('admin')(handler)(req, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(handler).not.toHaveBeenCalled()
  })

  test('пропускает head к admin+head ресурсу', async () => {
    const token = signToken({ ...mockUser, role: 'head' })
    const handler = jest.fn(async (req, res) => res.status(200).json({}))
    const req = { headers: { authorization: `Bearer ${token}` } }
    await withRole('admin', 'head')(handler)(req, makeRes())
    expect(handler).toHaveBeenCalled()
  })
})
