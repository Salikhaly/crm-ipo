// __tests__/api/search.test.js
process.env.JWT_SECRET           = 'test-secret-32chars!!'
process.env.SUPABASE_URL         = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_KEY = 'test-key'

const { signToken } = require('../../lib/auth')

const mockClients = [
  { id: 'c1', fio: 'Иванов Иван', iin: '900101300001', phone: '+77001234567', stage: 'new_lead', manager: 'm1' },
  { id: 'c2', fio: 'Петрова Анна', iin: '850202350002', phone: '+77007654321', stage: 'approval', manager: 'm2' },
]

const mockEq = jest.fn()
const chain  = {}
chain.select = jest.fn().mockReturnValue(chain)
chain.order  = jest.fn().mockReturnValue(chain)
chain.eq     = jest.fn().mockReturnValue(chain)
chain.or     = jest.fn().mockReturnValue(chain)
chain.limit  = jest.fn().mockResolvedValue({ data: mockClients, error: null })
const mockFrom = jest.fn(() => chain)

jest.mock('../../lib/supabase', () => ({
  getSupabase: () => ({ from: mockFrom }),
  dbToClient: (r) => r,
}))

const handler = require('../../pages/api/search/index').default
const makeToken = (role, manager_id = null) =>
  `Bearer ${signToken({ id: 'u1', name: 'Test', role, manager_id, login: 'test' })}`
const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() })

beforeEach(() => jest.clearAllMocks())

describe('GET /api/search', () => {
  test('401 без токена', async () => {
    const res = makeRes()
    await handler({ method: 'GET', headers: {}, query: {} }, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  test('200 с пустым результатом если q не передан', async () => {
    chain.limit.mockResolvedValueOnce({ data: [], error: null })
    const res = makeRes()
    await handler({
      method: 'GET',
      headers: { authorization: makeToken('admin') },
      query: {},
    }, res)
    // search returns all clients when q is empty (no 400)
    expect(res.status).toHaveBeenCalledWith(200)
  })

  test('200 с результатами при q >= 2 символа', async () => {
    chain.limit.mockResolvedValueOnce({ data: mockClients, error: null })
    const res = makeRes()
    await handler({
      method: 'GET',
      headers: { authorization: makeToken('admin') },
      query: { q: 'Ив' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(200)
  })

  test('200 с результатами поиска', async () => {
    chain.limit.mockResolvedValueOnce({ data: mockClients, error: null })
    const res = makeRes()
    await handler({
      method: 'GET',
      headers: { authorization: makeToken('admin') },
      query: { q: 'Иванов' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const data = res.json.mock.calls[0][0]
    expect(Array.isArray(data.results)).toBe(true)
  })

  test('менеджер ищет только среди своих клиентов', async () => {
    chain.limit.mockResolvedValueOnce({ data: [mockClients[0]], error: null })
    const res = makeRes()
    await handler({
      method: 'GET',
      headers: { authorization: makeToken('manager', 'm1') },
      query: { q: 'Иван' },
    }, res)
    expect(chain.eq).toHaveBeenCalledWith('manager', 'm1')
  })

  test('405 для POST', async () => {
    const res = makeRes()
    await handler({
      method: 'POST',
      headers: { authorization: makeToken('admin') },
      body: {},
    }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })
})
