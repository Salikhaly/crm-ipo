// __tests__/api/wa-chats.test.js
process.env.JWT_SECRET           = 'test-secret-32chars!!'
process.env.SUPABASE_URL         = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_KEY = 'test-key'

const { signToken } = require('../../lib/auth')

const mockMaybe = jest.fn().mockResolvedValue({ data: null, error: null })

// chats GET list: .select().order().limit()  — BUT chats.js uses order() then awaits (no limit for chat list)
// chats GET messages: .select().eq().order().limit()
// chats PATCH: .update().eq().select().maybeSingle()
// Need a universal chain

const chain = {
  select:      jest.fn(),
  update:      jest.fn(),
  eq:          jest.fn(),
  order:       jest.fn(),
  gt:          jest.fn(),
  limit:       jest.fn(),
  maybeSingle: mockMaybe,
}
// All return chain for chaining
chain.select.mockReturnValue(chain)
chain.update.mockReturnValue(chain)
chain.eq.mockReturnValue(chain)
chain.order.mockReturnValue(chain)
chain.gt.mockReturnValue(chain)
// limit resolves (end of chain for messages)
chain.limit.mockResolvedValue({ data: [], error: null })
// order also resolves for chat list (no limit call)
// We need order() to BOTH return chain AND resolve
// Solution: make order return a thenable chain
const makeOrderResult = (data) => {
  const r = { ...chain }
  r.then = (resolve) => resolve({ data, error: null })
  r.catch = () => r
  return r
}

const mockFrom = jest.fn(() => chain)

jest.mock('../../lib/supabase', () => ({ getSupabase: () => ({ from: mockFrom }) }))

const handler   = require('../../pages/api/wa/chats').default
const makeToken = (role = 'admin') =>
  `Bearer ${signToken({ id: 'u1', name: 'Test', role, manager_id: null, login: 'test' })}`
const makeRes   = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() })

beforeEach(() => {
  jest.clearAllMocks()
  chain.select.mockReturnValue(chain)
  chain.update.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  chain.gt.mockReturnValue(chain)
  chain.limit.mockResolvedValue({ data: [], error: null })
  mockMaybe.mockResolvedValue({ data: null, error: null })
})

describe('GET /api/wa/chats — список', () => {
  test('401 без токена', async () => {
    const res = makeRes()
    await handler({ method: 'GET', headers: {}, query: {} }, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  test('200 возвращает chats массив', async () => {
    const chatData = [{ id: 'chat1@c.us', phone: '+77001', unread_count: 2, status: 'new' }]
    chain.order.mockResolvedValueOnce({ data: chatData, error: null })
    const res = makeRes()
    await handler({ method: 'GET', headers: { authorization: makeToken() }, query: {} }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const data = res.json.mock.calls[0][0]
    expect(Array.isArray(data.chats)).toBe(true)
  })
})

describe('GET /api/wa/chats — сообщения (?id=)', () => {
  test('200 возвращает messages массив', async () => {
    const msgData = [{ id: 'msg1', chat_id: 'chat1@c.us', direction: 'in', body: 'Привет' }]
    chain.limit.mockResolvedValueOnce({ data: msgData, error: null })
    const res = makeRes()
    await handler({
      method: 'GET',
      headers: { authorization: makeToken() },
      query: { id: 'chat1@c.us' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const data = res.json.mock.calls[0][0]
    expect(Array.isArray(data.messages)).toBe(true)
  })
})

describe('PATCH /api/wa/chats', () => {
  test('400 без chatId', async () => {
    const res = makeRes()
    await handler({
      method: 'PATCH',
      headers: { authorization: makeToken() },
      body: { status: 'in_work' },
      query: {},
    }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  test('400 для невалидного статуса', async () => {
    const res = makeRes()
    await handler({
      method: 'PATCH',
      headers: { authorization: makeToken() },
      body: { chatId: 'chat1@c.us', status: 'bad_status' },
      query: {},
    }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0].error).toMatch(/недопустимый статус/i)
  })

  test('400 если ни status ни managerId не переданы', async () => {
    const res = makeRes()
    await handler({
      method: 'PATCH',
      headers: { authorization: makeToken() },
      body: { chatId: 'chat1@c.us' },
      query: {},
    }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  test('принимает all valid statuses', async () => {
    for (const status of ['new', 'in_work', 'done']) {
      jest.clearAllMocks()
      chain.select.mockReturnValue(chain)
      chain.update.mockReturnValue(chain)
      chain.eq.mockReturnValue(chain)
      mockMaybe.mockResolvedValueOnce({ data: { id: 'chat1', status }, error: null })
      const res = makeRes()
      await handler({
        method: 'PATCH',
        headers: { authorization: makeToken() },
        body: { chatId: 'chat1@c.us', status },
        query: {},
      }, res)
      expect(res.status).toHaveBeenCalledWith(200)
    }
  })

  test('404 если chat не найден', async () => {
    mockMaybe.mockResolvedValueOnce({ data: null, error: null })
    const res = makeRes()
    await handler({
      method: 'PATCH',
      headers: { authorization: makeToken() },
      body: { chatId: 'nonexist@c.us', status: 'done' },
      query: {},
    }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })
})
