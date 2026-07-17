// __tests__/api/calc-settings.test.js
// Этот эндпоинт держит 5 вкладок админки: Калькулятор (налоги), Договоры,
// Поля карточки, Маршруты, WhatsApp. Тестов на него не было — и обработчик
// знал только GET/POST, пока фронт слал PUT (сохранение) и DELETE (удаление).
// Каждая кнопка «Сохранить» молча ловила 405, в базе лежали null-ы.
// Эти тесты закрывают именно контракт «каким методом стучится фронт».
process.env.JWT_SECRET           = 'test-secret-32chars!!'
process.env.SUPABASE_URL         = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_KEY = 'test-key'

const { signToken } = require('../../lib/auth')

let tableRows   = {}
let tableErrors = {}
const calls = { upsert: [], delete: [] }

const makeChain = (table) => {
  const res = { data: tableRows[table] || [], error: tableErrors[table] || null }
  const c = {}
  c.select = jest.fn(() => c)
  c.eq     = jest.fn(() => c)
  c.order  = jest.fn(() => Promise.resolve(res))
  c.single = jest.fn(() => Promise.resolve({ data: (tableRows[table] || [])[0] || null, error: null }))
  c.upsert = jest.fn((row) => { calls.upsert.push([table, row]); return Promise.resolve({ error: tableErrors[table] || null }) })
  c.delete = jest.fn(() => { const d = {}; d.eq = jest.fn((col, val) => { calls.delete.push([table, col, val]); return Promise.resolve({ error: tableErrors[table] || null }) }); return d })
  c.then   = (f) => Promise.resolve(res).then(f)
  return c
}

jest.mock('../../lib/supabase', () => ({ getSupabase: () => ({ from: (t) => makeChain(t) }) }))

const handler = require('../../pages/api/calc-settings/index').default
const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() })
const auth = { authorization: 'Bearer ' + signToken({ id: 'u0', name: 'Техник', role: 'admin', manager_id: null }) }

beforeEach(() => { jest.clearAllMocks(); tableRows = {}; tableErrors = {}; calls.upsert = []; calls.delete = [] })

describe('GET /api/calc-settings', () => {
  test('отдаёт шаблоны WhatsApp (без них панель «Быстрые ответы» пустая)', async () => {
    tableRows.wa_quick_replies = [{ id: 'r1', trigger: '/привет', title: 'Приветствие', body: 'Здравствуйте!' }]
    const res = makeRes()
    await handler({ method: 'GET', headers: auth }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const body = res.json.mock.calls[0][0]
    expect(body.replies).toHaveLength(1)
    expect(body.replies[0].trigger).toBe('/привет')
  })

  test('нет таблицы шаблонов (миграция 005) → replies:[], настройки живы', async () => {
    tableErrors.wa_quick_replies = { message: 'relation does not exist' }
    const res = makeRes()
    await handler({ method: 'GET', headers: auth }, res)
    const body = res.json.mock.calls[0][0]
    expect(body.ok).toBe(true)
    expect(body.replies).toEqual([])
  })
})

describe('сохранение: фронт шлёт PUT', () => {
  test('PUT сохраняет настройки, а не отвечает 405', async () => {
    const res = makeRes()
    await handler({ method: 'PUT', headers: auth, body: { settings: { tax_config: { opv: 10 } } } }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const [table, row] = calls.upsert[0]
    expect(table).toBe('calc_settings')
    expect(row.tax_config).toEqual({ opv: 10 })
  })

  test('POST тоже работает (обратная совместимость)', async () => {
    const res = makeRes()
    await handler({ method: 'POST', headers: auth, body: { settings: { mrp: 4325 } } }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(calls.upsert[0][1].mrp).toBe(4325)
  })

  test('PUT сохраняет шаблоны WA в snake_case', async () => {
    const res = makeRes()
    await handler({ method: 'PUT', headers: auth, body: { replies: [
      { id: 'r1', trigger: '/привет', title: 'Привет', body: 'Текст', category: 'greeting', active: true, sortOrder: 3 },
    ] } }, res)
    expect(res.json.mock.calls[0][0].ok).toBe(true)
    const [table, row] = calls.upsert[0]
    expect(table).toBe('wa_quick_replies')
    expect(row).toMatchObject({ id: 'r1', trigger: '/привет', sort_order: 3, active: true })
  })

  test('шаблон без команды/названия — внятная ошибка, а не тихая потеря', async () => {
    const res = makeRes()
    await handler({ method: 'PUT', headers: auth, body: { replies: [{ id: 'r1', trigger: '', title: '', body: 'x' }] } }, res)
    const body = res.json.mock.calls[0][0]
    expect(body.ok).toBe(false)
    expect(body.errors[0].error).toMatch(/команда и название/i)
  })

  test('занятая команда «/» → понятный текст, а не DB error', async () => {
    tableErrors.wa_quick_replies = { message: 'duplicate key value', code: '23505' }
    const res = makeRes()
    await handler({ method: 'PUT', headers: auth, body: { replies: [{ id: 'r2', trigger: '/привет', title: 'Дубль', body: 'x' }] } }, res)
    const body = res.json.mock.calls[0][0]
    expect(body.ok).toBe(false)
    expect(body.errors[0].error).toMatch(/уже занята/i)
  })
})

describe('DELETE — фронт шлёт DELETE', () => {
  test('удаляет шаблон по replyId, а не отвечает 405', async () => {
    const res = makeRes()
    await handler({ method: 'DELETE', headers: auth, body: { replyId: 'r1' } }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(calls.delete[0]).toEqual(['wa_quick_replies', 'id', 'r1'])
  })

  test('удаляет программу по programKey', async () => {
    const res = makeRes()
    await handler({ method: 'DELETE', headers: auth, body: { programKey: 'nauryz20' } }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(calls.delete[0]).toEqual(['calc_programs', 'key', 'nauryz20'])
  })

  test('DELETE без параметров → 400', async () => {
    const res = makeRes()
    await handler({ method: 'DELETE', headers: auth, body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })
})

describe('доступ', () => {
  test('401 без токена', async () => {
    const res = makeRes()
    await handler({ method: 'GET', headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  test('403 менеджеру — настройки системы не для него', async () => {
    const res = makeRes()
    const mgr = { authorization: 'Bearer ' + signToken({ id: 'u1', name: 'Ерлан', role: 'manager', manager_id: 'm1' }) }
    await handler({ method: 'PUT', headers: mgr, body: { settings: {} } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
  })
})
