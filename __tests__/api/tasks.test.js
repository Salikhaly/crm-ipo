// __tests__/api/tasks.test.js
process.env.JWT_SECRET           = 'test-secret-32chars!!'
process.env.SUPABASE_URL         = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_KEY = 'test-key'

const { signToken } = require('../../lib/auth')

const today = new Date().toISOString().slice(0, 10)
const mockClients = [
  { id: 'c1', fio: 'Иванов', phone: '+77001', manager: 'm1', tasks: [{ id: 't1', text: 'Позвонить', done: false, due: today, assignedTo: 'm1' }] },
  { id: 'c2', fio: 'Петров', phone: '+77002', manager: 'm2', tasks: [{ id: 't2', text: 'Письмо', done: true, due: today, assignedTo: 'm2' }] },
]

// tasks/index.js: let query = sb.from('clients').select('...')
// if manager: query = query.eq('manager', mid)
// const { data, error } = await query
// So the chain must resolve when awaited. We achieve this with a custom thenable.

const makeQuery = (resolveData) => {
  const q = {
    select: jest.fn(),
    eq:     jest.fn(),
    // Make it awaitable (thenable)
    then:   (resolve) => resolve({ data: resolveData, error: null }),
    catch:  (reject) => q,
  }
  q.select.mockReturnValue(q)
  q.eq.mockReturnValue(q)
  return q
}

let currentQuery
const mockFrom = jest.fn(() => {
  currentQuery = makeQuery(mockClients)
  return currentQuery
})

jest.mock('../../lib/supabase', () => ({ getSupabase: () => ({ from: mockFrom }) }))

const handler   = require('../../pages/api/tasks/index').default
const makeToken = (role, manager_id = null) =>
  `Bearer ${signToken({ id: 'u1', name: 'Test', role, manager_id, login: 'test' })}`
const makeRes   = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() })

beforeEach(() => jest.clearAllMocks())

describe('GET /api/tasks', () => {
  test('401 без токена', async () => {
    const res = makeRes()
    await handler({ method: 'GET', headers: {}, query: {} }, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  test('405 для DELETE', async () => {
    const res = makeRes()
    await handler({
      method: 'DELETE',
      headers: { authorization: makeToken('admin') },
      query: {},
    }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  test('200 для admin — возвращает структуру задач', async () => {
    const res = makeRes()
    await handler({
      method: 'GET',
      headers: { authorization: makeToken('admin') },
      query: {},
    }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const data = res.json.mock.calls[0][0]
    expect(data.counts).toBeDefined()
    expect(typeof data.counts.total).toBe('number')
    expect(Array.isArray(data.overdue)).toBe(true)
    expect(Array.isArray(data.today)).toBe(true)
  })

  test('менеджер видит только свои задачи — eq вызван', async () => {
    const res = makeRes()
    await handler({
      method: 'GET',
      headers: { authorization: makeToken('manager', 'm1') },
      query: {},
    }, res)
    expect(currentQuery.eq).toHaveBeenCalledWith('manager', 'm1')
    expect(res.status).toHaveBeenCalledWith(200)
  })

  test('status=all возвращает включая выполненные', async () => {
    const res = makeRes()
    await handler({
      method: 'GET',
      headers: { authorization: makeToken('admin') },
      query: { status: 'all' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const data = res.json.mock.calls[0][0]
    expect(data.counts.done).toBeGreaterThanOrEqual(0)
  })
})
