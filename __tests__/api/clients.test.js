// __tests__/api/clients.test.js
process.env.JWT_SECRET           = 'test-secret-32chars!!'
process.env.SUPABASE_URL         = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_KEY = 'test-key'

const { signToken } = require('../../lib/auth')

// clients/index.js builds:
//   let query = sb.from('clients').select('*').order('created_at', { ascending: false })
//   if manager: query = query.eq('manager', mid)
//   if stage:   query = query.eq('stage', stage)
//   if search:  query = query.or(...)
//   const { data, error } = await query  ← awaits the chain directly
//
// So every chain method must return an AWAITABLE object with .eq/.or still on it.

const makeFullChain = (resolveData) => {
  const resolve = { data: resolveData, error: null }
  const c = {}
  c.select = jest.fn().mockReturnValue(c)
  c.insert = jest.fn().mockReturnValue(c)
  c.update = jest.fn().mockReturnValue(c)
  c.delete = jest.fn().mockReturnValue(c)
  c.eq     = jest.fn().mockReturnValue(c)
  c.or     = jest.fn().mockReturnValue(c)
  c.order  = jest.fn().mockReturnValue(c)
  c.range  = jest.fn().mockReturnValue(c)
  c.gte    = jest.fn().mockReturnValue(c)
  c.lte    = jest.fn().mockReturnValue(c)
  c.single = jest.fn().mockResolvedValue(resolve.data ? { data: resolve.data[0] || resolve.data, error: null } : resolve)
  c.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null })
  // Make the chain itself awaitable
  c.then  = (onFulfilled) => Promise.resolve(resolve).then(onFulfilled)
  c.catch = (onRejected)  => Promise.resolve(resolve).catch(onRejected)
  return c
}

let currentChain
const mockFrom = jest.fn((table) => {
  if (table === 'users') return makeUserAuthChain()
  currentChain = makeFullChain([])
  return currentChain
})

jest.mock('../../lib/supabase', () => ({
  getSupabase: () => ({ from: mockFrom }),
  dbToClient:  (r) => r,
  clientToDb:  (c) => c,
  addSavedCalcs: (row) => row,
  addCloseReason: (row) => row,
  addTags: (row) => row,
  addCustom: (row) => row,
  addPkbFields: (row) => row,
  findMissingOptionalColumn: () => null,
}))

jest.mock('../../lib/actionLog', () => ({ logAction: jest.fn() }))

// Динамический мок withAuth: возвращает role/manager_id текущего теста
let _authRow = { role: 'admin', manager_id: null }
const makeUserAuthChain = () => {
  const c = {}
  c.select      = jest.fn().mockReturnValue(c)
  c.eq          = jest.fn().mockReturnValue(c)
  c.maybeSingle = jest.fn().mockImplementation(() =>
    Promise.resolve({ data: { role: _authRow.role, manager_id: _authRow.manager_id }, error: null })
  )
  return c
}


const indexHandler = require('../../pages/api/clients/index').default
const idHandler    = require('../../pages/api/clients/[id]').default

const makeToken = (role, manager_id = null) => {
  _authRow = { role, manager_id: manager_id || null }
  return `Bearer ${signToken({ id: 'u1', name: 'Test', role, manager_id, login: 'test' })}`
}
const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() })

beforeEach(() => jest.clearAllMocks())

describe('GET /api/clients', () => {
  test('401 без токена', async () => {
    const res = makeRes()
    await indexHandler({ method: 'GET', headers: {}, query: {} }, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  test('405 для DELETE', async () => {
    const res = makeRes()
    await indexHandler({
      method: 'DELETE',
      headers: { authorization: makeToken('admin') },
      query: {},
    }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  test('200 для admin — возвращает всех клиентов', async () => {
    const clientData = [{ id: 'c1', stage: 'new_lead', fio: 'Тест' }]
    mockFrom.mockReturnValueOnce(makeFullChain(clientData))
    const res = makeRes()
    await indexHandler({
      method: 'GET',
      headers: { authorization: makeToken('admin') },
      query: {},
    }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const data = res.json.mock.calls[0][0]
    expect(Array.isArray(data.clients)).toBe(true)
  })

  test('менеджер видит всех клиентов команды (решение бизнеса, июль 2026)', async () => {
    const chain = makeFullChain([])
    mockFrom.mockReturnValueOnce(chain)
    const res = makeRes()
    await indexHandler({
      method: 'GET',
      headers: { authorization: makeToken('manager', 'm1') },
      query: {},
    }, res)
    expect(chain.eq).not.toHaveBeenCalledWith('manager', 'm1')
    expect(res.status).toHaveBeenCalledWith(200)
  })

  test('admin НЕ вызывает eq("manager") без фильтра', async () => {
    const chain = makeFullChain([])
    mockFrom.mockReturnValueOnce(chain)
    const res = makeRes()
    await indexHandler({
      method: 'GET',
      headers: { authorization: makeToken('admin') },
      query: {},
    }, res)
    const managerEqCall = chain.eq.mock.calls.find(args => args[0] === 'manager')
    expect(managerEqCall).toBeUndefined()
  })

  test('фильтр по stage передаётся в eq', async () => {
    const chain = makeFullChain([])
    mockFrom.mockReturnValueOnce(chain)
    const res = makeRes()
    await indexHandler({
      method: 'GET',
      headers: { authorization: makeToken('admin') },
      query: { stage: 'approval' },
    }, res)
    expect(chain.eq).toHaveBeenCalledWith('stage', 'approval')
  })
})

describe('POST /api/clients', () => {
  // Раньше сервер отвечал 400 «id обязателен». Фронт слал клиента без id
  // (emptyClient его не создавал) → «+ Новый клиент» и «В CRM базу» из WhatsApp
  // не работали вообще. Теперь сервер подставляет свой id.
  test('без id сервер подставляет свой, а не роняет создание', async () => {
    const saved = { id: 'gen-id', fio: 'Тест' }
    const chain = makeFullChain([saved])
    chain.single = jest.fn().mockResolvedValue({ data: saved, error: null })
    mockFrom.mockReturnValueOnce(chain)
    const res = makeRes()
    await indexHandler({
      method: 'POST',
      headers: { authorization: makeToken('admin') },
      query: {},
      body: { fio: 'Тест' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(chain.insert.mock.calls[0][0].id).toEqual(expect.any(String))
    expect(chain.insert.mock.calls[0][0].id).not.toBe('')
  })

  test('201 при создании клиента', async () => {
    const newClient = { id: 'new-c', fio: 'Новый', stage: 'new_lead' }
    const chain = makeFullChain([newClient])
    chain.single = jest.fn().mockResolvedValue({ data: newClient, error: null })
    mockFrom.mockReturnValueOnce(chain)
    const res = makeRes()
    await indexHandler({
      method: 'POST',
      headers: { authorization: makeToken('admin') },
      query: {},
      body: { id: 'new-c', fio: 'Новый', stage: 'new_lead' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(201)
  })

  test('менеджер создаёт клиента только себе', async () => {
    const chain = makeFullChain([])
    chain.single = jest.fn().mockResolvedValue({ data: { id: 'c1', manager: 'm1' }, error: null })
    mockFrom.mockReturnValueOnce(chain)
    const res = makeRes()
    await indexHandler({
      method: 'POST',
      headers: { authorization: makeToken('manager', 'm1') },
      query: {},
      body: { id: 'c-new', fio: 'Тест', manager: 'other-mgr', stage: 'new_lead' },
    }, res)
    // manager field overwritten to their own manager_id
    const insertArg = chain.insert.mock.calls[0]?.[0]
    if (insertArg) {
      expect(insertArg.manager).toBe('m1')
    }
  })
})

describe('GET /api/clients/:id', () => {
  test('404 если клиент не найден', async () => {
    const chain = makeFullChain(null)
    chain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValueOnce(chain)
    const res = makeRes()
    await idHandler({
      method: 'GET',
      headers: { authorization: makeToken('admin') },
      query: { id: 'nonexistent' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('менеджер видит чужого клиента (командный доступ)', async () => {
    const chain = makeFullChain(null)
    chain.maybeSingle = jest.fn().mockResolvedValue({
      data: { id: 'c1', manager: 'other-mgr', stage: 'new_lead' },
      error: null,
    })
    mockFrom.mockReturnValueOnce(chain)
    const res = makeRes()
    await idHandler({
      method: 'GET',
      headers: { authorization: makeToken('manager', 'my-mgr') },
      query: { id: 'c1' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(200)
  })

  test('403 для DELETE от manager', async () => {
    const res = makeRes()
    await idHandler({
      method: 'DELETE',
      headers: { authorization: makeToken('manager', 'm1') },
      query: { id: 'c1' },
      body: {},
    }, res)
    expect(res.status).toHaveBeenCalledWith(403)
  })
})

// ── Фиксы аудита 18.07: дедуп на PUT, серверная валидация этапов, атомарная гонка ──
// Скриптуемая цепочка: каждый вызов терминального метода забирает следующий
// результат из очереди — позволяет прописать сценарий из нескольких запросов.
function makeScriptedChain(queue) {
  const c = {}
  const next = () => Promise.resolve(queue.shift() || { data: null, error: null })
  for (const m of ['select','insert','update','delete','eq','neq','or','order','ilike','gte','lte']) {
    c[m] = jest.fn().mockReturnValue(c)
  }
  c.limit       = jest.fn(() => next())
  c.maybeSingle = jest.fn(() => next())
  c.single      = jest.fn(() => next())
  c.then  = (f) => next().then(f)
  return c
}

describe('PUT /api/clients/:id — фиксы аудита 18.07', () => {
  const EXISTING = {
    id: 'c1', fio: 'Иванов', phone: '+77001112233', iin: '111111111111',
    stage: 'new_lead', manager: 'm1', updated_at: '2026-07-18T10:00:00+00:00',
    responsible_manager: null, mortgage_specialist: '', comments: [],
  }

  test('смена этапа на «Договор» без типа/суммы → 400 (серверная canMoveToStage)', async () => {
    const chain = makeScriptedChain([{ data: EXISTING, error: null }])
    mockFrom.mockReturnValue(chain)
    const res = makeRes()
    await idHandler({
      method: 'PUT',
      headers: { authorization: makeToken('admin') },
      query: { id: 'c1' },
      body: { id: 'c1', fio: 'Иванов', stage: 'contract', updatedAt: EXISTING.updated_at },
    }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0].error).toMatch(/тип и сумму договора/i)
  })

  test('смена телефона на занятый другим клиентом → 409', async () => {
    const chain = makeScriptedChain([
      { data: EXISTING, error: null },                                  // load existing
      { data: [{ id: 'c2', fio: 'Петров', phone: '+77009998877' }], error: null }, // dup check
    ])
    mockFrom.mockReturnValue(chain)
    const res = makeRes()
    await idHandler({
      method: 'PUT',
      headers: { authorization: makeToken('admin') },
      query: { id: 'c1' },
      body: { id: 'c1', fio: 'Иванов', phone: '+77009998877', stage: 'new_lead', updatedAt: EXISTING.updated_at },
    }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json.mock.calls[0][0].error).toMatch(/телефон уже есть/i)
  })

  test('смена ИИН на занятый → 409', async () => {
    const chain = makeScriptedChain([
      { data: EXISTING, error: null },
      { data: [{ id: 'c2', fio: 'Петров' }], error: null },  // dup ИИН
    ])
    mockFrom.mockReturnValue(chain)
    const res = makeRes()
    await idHandler({
      method: 'PUT',
      headers: { authorization: makeToken('admin') },
      query: { id: 'c1' },
      body: { id: 'c1', fio: 'Иванов', phone: '+77001112233', iin: '222222222222', stage: 'new_lead', updatedAt: EXISTING.updated_at },
    }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json.mock.calls[0][0].error).toMatch(/иин уже есть/i)
  })

  test('гонка: UPDATE-по-версии вернул 0 строк → 409 со свежей версией (не тихий 200)', async () => {
    const freshRow = { ...EXISTING, fio: 'Победивший', updated_at: '2026-07-18T10:00:01+00:00' }
    const chain = makeScriptedChain([
      { data: EXISTING, error: null },   // load existing (версия совпадает — ранняя проверка пройдена)
      { data: null, error: null },       // атомарный UPDATE: 0 строк — гонку выиграл другой
      { data: freshRow, error: null },   // re-fetch свежей версии
    ])
    mockFrom.mockReturnValue(chain)
    const res = makeRes()
    await idHandler({
      method: 'PUT',
      headers: { authorization: makeToken('admin') },
      query: { id: 'c1' },
      body: { id: 'c1', fio: 'Проигравший', phone: '+77001112233', stage: 'new_lead', updatedAt: EXISTING.updated_at },
    }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    const body = res.json.mock.calls[0][0]
    expect(body.stale).toBe(true)
    expect(body.client.fio).toBe('Победивший')
  })

  test('успешный PUT: атомарный UPDATE фильтрует и по id, и по updated_at', async () => {
    const updated = { ...EXISTING, fio: 'Обновлённый' }
    const chain = makeScriptedChain([
      { data: EXISTING, error: null },
      { data: updated, error: null },    // UPDATE прошёл (версия совпала)
    ])
    mockFrom.mockReturnValue(chain)
    const res = makeRes()
    await idHandler({
      method: 'PUT',
      headers: { authorization: makeToken('admin') },
      query: { id: 'c1' },
      body: { id: 'c1', fio: 'Обновлённый', phone: '+77001112233', stage: 'new_lead', updatedAt: EXISTING.updated_at },
    }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    // .eq вызван и с id, и с updated_at (атомарный WHERE)
    const eqArgs = chain.eq.mock.calls.map(a => a[0])
    expect(eqArgs).toContain('id')
    expect(eqArgs).toContain('updated_at')
  })
})
