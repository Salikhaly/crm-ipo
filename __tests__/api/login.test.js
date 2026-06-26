// __tests__/api/login.test.js
process.env.JWT_SECRET           = 'test-secret-32chars!!'
process.env.SUPABASE_URL         = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_KEY = 'test-key'

const bcrypt = require('bcryptjs')

// Build hash synchronously for test
const TEST_HASH = bcrypt.hashSync('correct123', 4) // rounds=4 for speed in tests

const mockMaybeSingle = jest.fn()
const mockEq          = jest.fn().mockReturnThis()
const mockSelect      = jest.fn().mockReturnThis()
const mockFrom        = jest.fn(() => ({ select: mockSelect, eq: mockEq, maybeSingle: mockMaybeSingle }))

jest.mock('../../lib/supabase', () => ({ getSupabase: () => ({ from: mockFrom }) }))

const handler = require('../../pages/api/auth/login').default
const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() })

beforeEach(() => { jest.clearAllMocks() })

describe('POST /api/auth/login', () => {
  test('405 для GET запроса', async () => {
    const res = makeRes()
    await handler({ method: 'GET', body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  test('400 если login не передан', async () => {
    const res = makeRes()
    await handler({ method: 'POST', body: { pwd: '123' } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  test('400 если pwd не передан', async () => {
    const res = makeRes()
    await handler({ method: 'POST', body: { login: 'admin' } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  test('400 если оба поля пустые', async () => {
    const res = makeRes()
    await handler({ method: 'POST', body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  test('401 если пользователь не найден (maybeSingle→null)', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const res = makeRes()
    await handler({ method: 'POST', body: { login: 'noone', pwd: 'x' } }, res)
    expect(res.status).toHaveBeenCalledWith(401)
    const jsonArg = res.json.mock.calls[0][0]
    expect(jsonArg.error).toMatch(/неверный/i)
  })

  test('401 при неверном пароле', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'u1', name: 'Admin', role: 'admin', manager_id: null, login: 'admin', pwd_hash: TEST_HASH },
      error: null
    })
    const res = makeRes()
    await handler({ method: 'POST', body: { login: 'admin', pwd: 'wrongpass' } }, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  test('200 + token при верных данных', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'u1', name: 'Admin', role: 'admin', manager_id: null, login: 'admin', pwd_hash: TEST_HASH },
      error: null
    })
    const res = makeRes()
    await handler({ method: 'POST', body: { login: 'admin', pwd: 'correct123' } }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const jsonArg = res.json.mock.calls[0][0]
    expect(jsonArg.token).toBeDefined()
    expect(jsonArg.user.id).toBe('u1')
    expect(jsonArg.user.role).toBe('admin')
    expect(jsonArg.user.manager_id).toBeDefined()
    // Пароль не должен утекать в ответ
    expect(jsonArg.user.pwd_hash).toBeUndefined()
    expect(jsonArg.user.pwd).toBeUndefined()
  })

  test('login нечувствителен к регистру', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'u1', name: 'Admin', role: 'admin', manager_id: null, login: 'admin', pwd_hash: TEST_HASH },
      error: null
    })
    const res = makeRes()
    await handler({ method: 'POST', body: { login: 'ADMIN', pwd: 'correct123' } }, res)
    // eq() должен быть вызван с lowercase
    expect(mockEq).toHaveBeenCalledWith('login', 'admin')
    expect(res.status).toHaveBeenCalledWith(200)
  })

  test('ответ содержит manager_id а не mid', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'u2', name: 'Менеджер', role: 'manager', manager_id: 'm1', login: 'mgr', pwd_hash: TEST_HASH },
      error: null
    })
    const res = makeRes()
    await handler({ method: 'POST', body: { login: 'mgr', pwd: 'correct123' } }, res)
    const user = res.json.mock.calls[0][0].user
    expect(user.manager_id).toBe('m1')
    expect(user.mid).toBeUndefined()
  })
})
