// __tests__/api/wa-stats.test.js
process.env.JWT_SECRET           = 'test-secret-32chars!!'
process.env.SUPABASE_URL         = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_KEY = 'test-key'

const { signToken } = require('../../lib/auth')

const CHATS = [
  { id: 'a@c.us', assigned_to: 'm1', status: 'new',     category: 'question',  unread_count: 2, client_id: null,  last_message_at: '2026-07-18T10:00:00Z' },
  { id: 'b@c.us', assigned_to: 'm1', status: 'in_work', category: 'accompany', unread_count: 0, client_id: 'c1',  last_message_at: '2026-07-18T09:00:00Z' },
  { id: 'c@c.us', assigned_to: 'm2', status: 'done',    category: '',          unread_count: 0, client_id: 'c2',  last_message_at: '2026-07-17T09:00:00Z' },
]
const MSGS = [
  { chat_id: 'a@c.us', direction: 'in',  author: '',      sent_at: '2026-07-18T10:00:00Z' }, // last=in → ждёт ответа
  { chat_id: 'b@c.us', direction: 'in',  author: '',      sent_at: '2026-07-18T08:00:00Z' },
  { chat_id: 'b@c.us', direction: 'out', author: 'Ерлан', sent_at: '2026-07-18T09:00:00Z' }, // last=out
  { chat_id: 'c@c.us', direction: 'out', author: 'Сауле', sent_at: '2026-07-17T09:00:00Z' },
]

const mockFrom = jest.fn((table) => {
  if (table === 'wa_chats')   return { select: () => Promise.resolve({ data: CHATS, error: null }) }
  if (table === 'managers')   return { select: () => Promise.resolve({ data: [{ id: 'm1', name: 'Ерлан' }, { id: 'm2', name: 'Сауле' }], error: null }) }
  if (table === 'wa_messages') {
    return { select: () => ({ range: (from) => Promise.resolve({ data: from === 0 ? MSGS : [], error: null }) }) }
  }
  if (table === 'users') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { role: _role, manager_id: null }, error: null }) }) }) }
  return { select: () => Promise.resolve({ data: [], error: null }) }
})
let _role = 'admin'

jest.mock('../../lib/supabase', () => ({ getSupabase: () => ({ from: mockFrom }) }))

const handler = require('../../pages/api/wa/stats').default
const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() })
const token = (role) => { _role = role; return 'Bearer ' + signToken({ id: 'u0', name: 'T', role, manager_id: null }) }

beforeEach(() => jest.clearAllMocks())

describe('GET /api/wa/stats', () => {
  test('401 без токена', async () => {
    const res = makeRes()
    await handler({ method: 'GET', headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  test('403 для специалиста', async () => {
    const res = makeRes()
    await handler({ method: 'GET', headers: { authorization: token('specialist') } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
  })

  test('405 на POST', async () => {
    const res = makeRes()
    await handler({ method: 'POST', headers: { authorization: token('admin') } }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  test('агрегирует чаты, статусы, категории, ждущих ответа', async () => {
    const res = makeRes()
    await handler({ method: 'GET', headers: { authorization: token('admin') } }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const b = res.json.mock.calls[0][0]
    expect(b.totals.chats).toBe(3)
    expect(b.totals.notInBase).toBe(1)
    expect(b.totals.unread).toBe(2)
    expect(b.totals.waitingReply).toBe(1)          // только чат a (last=in)
    expect(b.byStatus).toEqual({ new: 1, in_work: 1, done: 1 })
    expect(b.byCategory.question).toBe(1)
    expect(b.byCategory.accompany).toBe(1)
    expect(b.totals.totalIn).toBe(2)
    expect(b.totals.totalOut).toBe(2)
  })

  test('перМенеджер: m1 два чата, один ждёт ответа', async () => {
    const res = makeRes()
    await handler({ method: 'GET', headers: { authorization: token('admin') } }, res)
    const b = res.json.mock.calls[0][0]
    const m1 = b.perManager.find(m => m.id === 'm1')
    expect(m1.chats).toBe(2)
    expect(m1.unanswered).toBe(1)
    expect(m1.name).toBe('Ерлан')
  })
})
