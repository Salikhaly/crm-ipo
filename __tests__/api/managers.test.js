// __tests__/api/managers.test.js
process.env.JWT_SECRET           = 'test-secret-32chars!!'
process.env.SUPABASE_URL         = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_KEY = 'test-key'

const { signToken } = require('../../lib/auth')

const mockSingle = jest.fn().mockResolvedValue({ data: { id: 'm1', name: 'Тест', role: 'manager', color: '#3b82f6', active: true }, error: null })
const mockSelect = jest.fn().mockReturnThis()
const mockInsert = jest.fn().mockReturnThis()
const mockUpdate = jest.fn().mockReturnThis()
const mockDelete = jest.fn().mockReturnThis()
const mockEq     = jest.fn().mockReturnThis()
const mockOrder  = jest.fn().mockResolvedValue({ data: [], error: null })

const mockFrom = jest.fn(() => ({
  select: mockSelect, insert: mockInsert,
  update: mockUpdate, delete: mockDelete,
  eq: mockEq, order: mockOrder, single: mockSingle,
}))

jest.mock('../../lib/supabase', () => ({ getSupabase: () => ({ from: mockFrom }) }))

const indexHandler = require('../../pages/api/managers/index').default
const idHandler    = require('../../pages/api/managers/[id]').default

const makeToken = (role = 'admin') =>
  `Bearer ${signToken({ id: 'u1', name: 'Test', role, manager_id: null, login: 'test' })}`
const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() })

beforeEach(() => jest.clearAllMocks())

describe('GET /api/managers', () => {
  test('401 без токена', async () => {
    const res = makeRes()
    await indexHandler({ method: 'GET', headers: {}, query: {} }, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  test('200 для любой роли', async () => {
    mockOrder.mockResolvedValueOnce({ data: [{ id: 'm1', name: 'Айгерим', role: 'manager', active: true }], error: null })
    const res = makeRes()
    await indexHandler({
      method: 'GET',
      headers: { authorization: makeToken('manager') },
      query: {},
    }, res)
    expect(res.status).toHaveBeenCalledWith(200)
  })
})

describe('POST /api/managers', () => {
  test('403 для manager', async () => {
    const res = makeRes()
    await indexHandler({
      method: 'POST',
      headers: { authorization: makeToken('manager') },
      body: { name: 'Новый', role: 'manager' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(403)
  })

  test('400 если name не передан', async () => {
    const res = makeRes()
    await indexHandler({
      method: 'POST',
      headers: { authorization: makeToken('admin') },
      body: { role: 'manager' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  test('201 при создании менеджера', async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: 'm-new', name: 'Новый', role: 'manager' }, error: null })
    const res = makeRes()
    await indexHandler({
      method: 'POST',
      headers: { authorization: makeToken('admin') },
      body: { name: 'Новый Менеджер', role: 'manager', phone: '+77001234567', color: '#10b981' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(201)
  })
})

describe('PUT /api/managers/:id', () => {
  test('403 для manager', async () => {
    const res = makeRes()
    await idHandler({
      method: 'PUT',
      headers: { authorization: makeToken('manager') },
      query: { id: 'm1' },
      body: { name: 'Изменённый' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(403)
  })

  test('200 при обновлении', async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: 'm1', name: 'Обновлён' }, error: null })
    const res = makeRes()
    await idHandler({
      method: 'PUT',
      headers: { authorization: makeToken('admin') },
      query: { id: 'm1' },
      body: { name: 'Обновлён', role: 'manager', color: '#ef4444', active: true },
    }, res)
    expect(res.status).toHaveBeenCalledWith(200)
  })
})

describe('DELETE /api/managers/:id', () => {
  test('403 для head (только admin)', async () => {
    const res = makeRes()
    await idHandler({
      method: 'DELETE',
      headers: { authorization: makeToken('head') },
      query: { id: 'm1' },
      body: {},
    }, res)
    expect(res.status).toHaveBeenCalledWith(403)
  })
})
