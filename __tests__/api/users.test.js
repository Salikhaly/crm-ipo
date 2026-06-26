// __tests__/api/users.test.js
process.env.JWT_SECRET           = 'test-secret-32chars!!'
process.env.SUPABASE_URL         = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_KEY = 'test-key'

const { signToken } = require('../../lib/auth')
const bcrypt        = require('bcryptjs')

const mockMaybe  = jest.fn().mockResolvedValue({ data: null, error: null })
const mockSingle = jest.fn().mockResolvedValue({ data: { id: 'u1', name: 'Test', role: 'admin', login: 'test' }, error: null })
const mockSelect = jest.fn().mockReturnThis()
const mockInsert = jest.fn().mockReturnThis()
const mockUpdate = jest.fn().mockReturnThis()
const mockDelete = jest.fn().mockReturnThis()
const mockEq     = jest.fn().mockReturnThis()
const mockOrder  = jest.fn().mockResolvedValue({ data: [], error: null })

const mockFrom = jest.fn(() => ({
  select: mockSelect, insert: mockInsert, update: mockUpdate,
  delete: mockDelete, eq: mockEq, order: mockOrder,
  single: mockSingle, maybeSingle: mockMaybe,
}))

jest.mock('../../lib/supabase', () => ({ getSupabase: () => ({ from: mockFrom }) }))

const indexHandler = require('../../pages/api/users/index').default
const idHandler    = require('../../pages/api/users/[id]').default

const makeToken = (role = 'admin') =>
  `Bearer ${signToken({ id: 'u0', name: 'Admin', role, manager_id: null, login: 'admin' })}`
const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() })

beforeEach(() => jest.clearAllMocks())

describe('GET /api/users', () => {
  test('401 без токена', async () => {
    const res = makeRes()
    await indexHandler({ method: 'GET', headers: {}, query: {} }, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  test('403 для manager', async () => {
    const res = makeRes()
    await indexHandler({
      method: 'GET',
      headers: { authorization: makeToken('manager') },
      query: {},
    }, res)
    expect(res.status).toHaveBeenCalledWith(403)
  })

  test('200 для admin', async () => {
    mockOrder.mockResolvedValueOnce({ data: [{ id: 'u1', login: 'test', role: 'admin' }], error: null })
    const res = makeRes()
    await indexHandler({
      method: 'GET',
      headers: { authorization: makeToken('admin') },
      query: {},
    }, res)
    expect(res.status).toHaveBeenCalledWith(200)
  })
})

describe('POST /api/users', () => {
  test('400 если login занят', async () => {
    mockMaybe.mockResolvedValueOnce({ data: { id: 'existing' }, error: null })
    const res = makeRes()
    await indexHandler({
      method: 'POST',
      headers: { authorization: makeToken('admin') },
      body: { login: 'admin', pwd: 'test123', name: 'Дубль', role: 'manager' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0].error).toMatch(/занят/i)
  })

  test('пароль хешируется bcrypt при создании', async () => {
    mockMaybe.mockResolvedValueOnce({ data: null, error: null })
    mockSingle.mockResolvedValueOnce({ data: { id: 'new', login: 'newuser', role: 'manager' }, error: null })

    const res = makeRes()
    await indexHandler({
      method: 'POST',
      headers: { authorization: makeToken('admin') },
      body: { login: 'newuser', pwd: 'mypassword', name: 'Новый', role: 'manager' },
    }, res)

    // Verify insert was called with pwd_hash not pwd
    const insertArg = mockInsert.mock.calls[0][0]
    expect(insertArg.pwd_hash).toBeDefined()
    expect(insertArg.pwd).toBeUndefined()
    // Verify it's a valid bcrypt hash
    const valid = await bcrypt.compare('mypassword', insertArg.pwd_hash)
    expect(valid).toBe(true)
  })

  test('plaintext пароль не сохраняется', async () => {
    mockMaybe.mockResolvedValueOnce({ data: null, error: null })
    mockSingle.mockResolvedValueOnce({ data: { id: 'u2' }, error: null })

    const res = makeRes()
    await indexHandler({
      method: 'POST',
      headers: { authorization: makeToken('admin') },
      body: { login: 'test2', pwd: 'secret', name: 'User', role: 'manager' },
    }, res)

    const insertArg = mockInsert.mock.calls[0][0]
    expect(insertArg.pwd).toBeUndefined()
    expect(insertArg.pwd_hash).toBeDefined()
    expect(insertArg.pwd_hash).not.toBe('secret')
  })
})

describe('PUT /api/users/:id', () => {
  test('400 если login не передан', async () => {
    const res = makeRes()
    await idHandler({
      method: 'PUT',
      headers: { authorization: makeToken('admin') },
      query: { id: 'u1' },
      body: { name: 'Test', role: 'manager' },  // no login
    }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  test('пароль обновляется только если передан', async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: 'u1', login: 'test', role: 'manager', pwd_hash: 'x' }, error: null })
    const res = makeRes()
    await idHandler({
      method: 'PUT',
      headers: { authorization: makeToken('admin') },
      query: { id: 'u1' },
      body: { login: 'test', name: 'Test', role: 'manager' },  // no pwd
    }, res)
    const updateArg = mockUpdate.mock.calls[0][0]
    expect(updateArg.pwd_hash).toBeUndefined()
  })

  test('пароль хешируется если передан', async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: 'u1' }, error: null })
    const res = makeRes()
    await idHandler({
      method: 'PUT',
      headers: { authorization: makeToken('admin') },
      query: { id: 'u1' },
      body: { login: 'test', name: 'Test', role: 'manager', pwd: 'newpass' },
    }, res)
    const updateArg = mockUpdate.mock.calls[0][0]
    expect(updateArg.pwd_hash).toBeDefined()
    expect(updateArg.pwd_hash).not.toBe('newpass')
    const valid = await bcrypt.compare('newpass', updateArg.pwd_hash)
    expect(valid).toBe(true)
  })

  test('pwd_hash не попадает в ответ', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'u1', name: 'Test', role: 'manager', login: 'test', pwd_hash: 'secret_hash' },
      error: null
    })
    const res = makeRes()
    await idHandler({
      method: 'PUT',
      headers: { authorization: makeToken('admin') },
      query: { id: 'u1' },
      body: { login: 'test', name: 'Test', role: 'manager' },
    }, res)
    const jsonArg = res.json.mock.calls[0][0]
    expect(jsonArg.user?.pwd_hash).toBeUndefined()
  })

  test('DELETE 403 для manager', async () => {
    const res = makeRes()
    await idHandler({
      method: 'DELETE',
      headers: { authorization: makeToken('manager') },
      query: { id: 'u1' },
      body: {},
    }, res)
    expect(res.status).toHaveBeenCalledWith(403)
  })
})
