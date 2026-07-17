// __tests__/api/backup.test.js
// Бэкап — единственная защита от потери базы (на free-тарифе Supabase автобэкапов нет).
// Поэтому проверяем: пароли не утекают, доступ только у admin/head, выгрузка не
// обрывается на 1000 строк (лимит PostgREST) и молчит об отсутствующих таблицах.
process.env.JWT_SECRET           = 'test-secret-32chars!!'
process.env.SUPABASE_URL         = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_KEY = 'test-key'

const { signToken } = require('../../lib/auth')

// table → массив страниц (каждый .range() отдаёт следующую) либо { error }
let tableData = {}
const selectCalls = []

const makeChain = (table) => {
  const c = {}
  c.select = jest.fn((cols) => { selectCalls.push([table, cols]); return c })
  c.range  = jest.fn(() => {
    const t = tableData[table]
    if (t && t.error) return Promise.resolve({ data: null, error: { message: 'no table' } })
    const pages = t || [[]]
    const page  = pages.shift() || []
    return Promise.resolve({ data: page, error: null })
  })
  return c
}

jest.mock('../../lib/supabase', () => ({
  getSupabase: () => ({ from: (t) => makeChain(t) }),
}))
jest.mock('../../lib/auth', () => {
  const actual = jest.requireActual('../../lib/auth')
  return actual
})

const handler = require('../../pages/api/backup').default
const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() })
const token = (role) => 'Bearer ' + signToken({ id: 'u0', name: 'Техник', role, manager_id: null })

beforeEach(() => { jest.clearAllMocks(); selectCalls.length = 0; tableData = {} })

describe('GET /api/backup', () => {
  test('401 без токена', async () => {
    const res = makeRes()
    await handler({ method: 'GET', headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  test('403 для менеджера — база целиком не для всех', async () => {
    const res = makeRes()
    await handler({ method: 'GET', headers: { authorization: token('manager') } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
  })

  test('405 на POST', async () => {
    const res = makeRes()
    await handler({ method: 'POST', headers: { authorization: token('admin') } }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  test('НИКОГДА не запрашивает pwd_hash', async () => {
    const res = makeRes()
    await handler({ method: 'GET', headers: { authorization: token('admin') } }, res)
    const usersCols = selectCalls.filter(([t]) => t === 'users').map(([, c]) => c).join(' ')
    expect(usersCols).not.toMatch(/pwd_hash|\*/)
    expect(usersCols).toContain('login')
  })

  test('200 для admin: отдаёт таблицы и счётчики', async () => {
    tableData = { clients: [[{ id: 'c1', fio: 'Иванов' }]] }
    const res = makeRes()
    await handler({ method: 'GET', headers: { authorization: token('admin') } }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const body = res.json.mock.calls[0][0]
    expect(body.ok).toBe(true)
    expect(body.tables.clients).toEqual([{ id: 'c1', fio: 'Иванов' }])
    expect(body.counts.clients).toBe(1)
  })

  test('200 для head', async () => {
    const res = makeRes()
    await handler({ method: 'GET', headers: { authorization: token('head') } }, res)
    expect(res.status).toHaveBeenCalledWith(200)
  })

  test('забирает ВСЕ строки, а не первую страницу в 1000 (иначе бэкап врёт)', async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ id: 'm' + i }))
    const page2 = [{ id: 'm1000' }]
    tableData = { wa_messages: [page1, page2] }
    const res = makeRes()
    await handler({ method: 'GET', headers: { authorization: token('admin') } }, res)
    const body = res.json.mock.calls[0][0]
    expect(body.counts.wa_messages).toBe(1001)
  })

  test('нет таблицы (миграция не применена) → в skipped, а не падение всего бэкапа', async () => {
    tableData = { deleted_clients: { error: true }, clients: [[{ id: 'c1' }]] }
    const res = makeRes()
    await handler({ method: 'GET', headers: { authorization: token('admin') } }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const body = res.json.mock.calls[0][0]
    expect(body.skipped).toContain('deleted_clients')
    expect(body.tables.deleted_clients).toBeUndefined()
    expect(body.counts.clients).toBe(1)
  })
})
