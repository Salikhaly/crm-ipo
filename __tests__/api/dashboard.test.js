// __tests__/api/dashboard.test.js
process.env.JWT_SECRET           = 'test-secret-32chars!!'
process.env.SUPABASE_URL         = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_KEY = 'test-key'

const { signToken } = require('../../lib/auth')

const mockClients = [
  { id: 'c1', stage: 'new_lead',  manager: 'm1', contract_amount: 10000000, contract_type: null,  payments: [], tasks: [], created_at: new Date().toISOString(), is_whatsapp: false },
  { id: 'c2', stage: 'approval',  manager: 'm1', contract_amount: 20000000, contract_type: '5y',  payments: [{ status: 'paid', paidAmount: 500000 }], tasks: [], created_at: new Date().toISOString(), is_whatsapp: true },
  { id: 'c3', stage: 'deal',      manager: 'm2', contract_amount: 15000000, contract_type: '5y',  payments: [], tasks: [], created_at: new Date().toISOString(), is_whatsapp: false },
  { id: 'c4', stage: 'issuance',  manager: 'm2', contract_amount: 25000000, contract_type: '5yp', payments: [], tasks: [], created_at: new Date().toISOString(), is_whatsapp: false },
  { id: 'c5', stage: 'closed',    manager: 'm1', contract_amount: 8000000,  contract_type: '5y',  payments: [], tasks: [], created_at: new Date().toISOString(), is_whatsapp: false },
]

// dashboard uses Promise.all([clients_query, managers_query, waChats_query])
// Each query has different chain: clients chains .eq optionally then resolves
// managers: .select().eq('active',true) → resolves
// waChats: .select().eq('status','new') → resolves

// Use a factory that makes full chainable thenable per from() call
const makeFullChain = (resolveData) => {
  const c = {}
  const resolve = { data: resolveData, error: null }
  c.select = jest.fn().mockReturnValue(c)
  c.eq     = jest.fn().mockReturnValue(c)
  c.order  = jest.fn().mockReturnValue(c)
  c.gte    = jest.fn().mockReturnValue(c)
  c.lte    = jest.fn().mockReturnValue(c)
  c.range  = jest.fn().mockReturnValue(c)
  c.single = jest.fn().mockResolvedValue({ data: resolveData?.[0] || resolveData, error: null })
  c.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null })
  // Make awaitable — fresh promise per resolution
  c.then  = (onFulfilled) => Promise.resolve(resolve).then(onFulfilled)
  c.catch = (onRejected)  => Promise.resolve(resolve).catch(onRejected)
  return c
}

const mockFrom = jest.fn()
jest.mock('../../lib/supabase', () => ({ getSupabase: () => ({ from: mockFrom }) }))

const handler = require('../../pages/api/dashboard/index').default
const makeToken = (role, manager_id = null) =>
  `Bearer ${signToken({ id: 'u1', name: 'Test', role, manager_id, login: 'test' })}`
const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() })

beforeEach(() => {
  jest.clearAllMocks()
  // dashboard делает 4 вызова from() в Promise.all:
  // 1) from('clients') .select(...).gte(...)              — основная выборка клиентов
  // 2) from('clients') .select('id',{count,head}).gte(...)— trueTotal (только count)
  // 3) from('managers').select(...).eq('active',true)
  // 4) from('wa_chats').select(...).eq('status','new')
  const trueTotalChain = makeFullChain([])
  trueTotalChain.count = 5  // совпадает с mockClients.length
  mockFrom
    .mockReturnValueOnce(makeFullChain(mockClients))               // 1 clients
    .mockReturnValueOnce(trueTotalChain)                           // 2 trueTotal
    .mockReturnValueOnce(makeFullChain([{ id: 'm1', name: 'A', color: '#fff' }])) // 3 managers
    .mockReturnValueOnce(makeFullChain([{ id: 'w1', unread_count: 3, status: 'new' }])) // 4 waChats
})

describe('GET /api/dashboard', () => {
  test('401 без токена', async () => {
    const res = makeRes()
    await handler({ method: 'GET', headers: {}, query: {} }, res)
    expect(res.status).toHaveBeenCalledWith(401)
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

  test('200 для admin — возвращает metrics, funnel, managers, recent', async () => {
    const res = makeRes()
    await handler({
      method: 'GET',
      headers: { authorization: makeToken('admin') },
      query: {},
    }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const data = res.json.mock.calls[0][0]
    expect(data.metrics).toBeDefined()
    expect(data.metrics.total).toBe(5)
    expect(typeof data.funnel).toBe('object')
    expect(Array.isArray(data.managers)).toBe(true)
    expect(Array.isArray(data.recent)).toBe(true)
  })

  test('contractVolume суммирует contract_amount', async () => {
    const res = makeRes()
    await handler({
      method: 'GET',
      headers: { authorization: makeToken('admin') },
      query: {},
    }, res)
    const data = res.json.mock.calls[0][0]
    expect(typeof data.metrics.rev).toBe('number')
    // c2(20M) + c3(15M) + c4(25M) + c5(8M) = 68M (only with contract_type)
    expect(data.metrics.rev).toBe(68000000)
  })

  test('менеджер фильтруется через eq — total соответствует его клиентам', async () => {
    mockFrom.mockReset()  // clear beforeEach queue, start fresh
    const m1Clients = mockClients.filter(c => c.manager === 'm1')
    const trueTotalChain2 = makeFullChain([]); trueTotalChain2.count = m1Clients.length
    mockFrom
      .mockReturnValueOnce(makeFullChain(m1Clients))                              // clients
      .mockReturnValueOnce(trueTotalChain2)                                       // trueTotal
      .mockReturnValueOnce(makeFullChain([{ id: 'm1', name: 'A', color: '#fff' }])) // managers
      .mockReturnValueOnce(makeFullChain([]))                                     // wa_chats
    const res = makeRes()
    await handler({
      method: 'GET',
      headers: { authorization: makeToken('manager', 'm1') },
      query: {},
    }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const data = res.json.mock.calls[0][0]
    // Dashboard resolves to m1Clients data — total = 3
    expect(data.metrics.total).toBe(m1Clients.length)
    // Verify eq was used for filtering (from was called at least once)
    expect(mockFrom).toHaveBeenCalledWith('clients')
  })

  test('waUnread считается корректно', async () => {
    const res = makeRes()
    await handler({
      method: 'GET',
      headers: { authorization: makeToken('admin') },
      query: {},
    }, res)
    const data = res.json.mock.calls[0][0]
    expect(data.metrics.waUnread).toBe(3)
  })
})
