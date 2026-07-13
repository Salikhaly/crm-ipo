// __tests__/api/wa-send.test.js
process.env.JWT_SECRET           = 'test-secret-32chars!!'
process.env.SUPABASE_URL         = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_KEY = 'test-key'
process.env.GREEN_API_ID         = 'test-instance'
process.env.GREEN_API_TOKEN      = 'test-token'

const { signToken } = require('../../lib/auth')

// Mock fetch globally
global.fetch = jest.fn()

const mockMaybe  = jest.fn().mockResolvedValue({ data: null, error: null })
const mockInsert = jest.fn().mockResolvedValue({ data: {}, error: null })
const mockUpdate = jest.fn()

// send.js does:
// sb.from('wa_chats').select('id').eq('id', waId).maybeSingle()  — chain
// sb.from('wa_messages').insert(...)                              — direct
// sb.from('wa_chats').update(...).eq(...)                        — chain

const chatChain = {}
chatChain.select      = jest.fn().mockReturnValue(chatChain)
chatChain.eq          = jest.fn().mockReturnValue(chatChain)
chatChain.update      = jest.fn().mockReturnValue(chatChain)
chatChain.insert      = jest.fn().mockResolvedValue({ data: {}, error: null })
chatChain.upsert      = jest.fn().mockResolvedValue({ data: {}, error: null })
chatChain.maybeSingle = mockMaybe

const msgChain = { insert: mockInsert }

let fromCallIdx = 0
const mockFrom = jest.fn(() => {
  fromCallIdx++
  // First call: wa_messages insert OR wa_chats select/update
  return chatChain
})

jest.mock('../../lib/supabase', () => ({ getSupabase: () => ({ from: mockFrom }) }))

const handler = require('../../pages/api/wa/send').default
const makeToken = (role = 'admin') =>
  `Bearer ${signToken({ id: 'u1', name: 'Test', role, manager_id: null, login: 'test' })}`
const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() })

beforeEach(() => { jest.clearAllMocks(); fromCallIdx = 0 })

describe('POST /api/wa/send', () => {
  test('503 если GREEN_API_ID = placeholder', async () => {
    const origId = process.env.GREEN_API_ID
    process.env.GREEN_API_ID = 'placeholder'
    const res = makeRes()
    await handler({
      method: 'POST',
      headers: { authorization: makeToken() },
      body: { phone: '77001234567', text: 'Тест', author: 'x' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(503)
    process.env.GREEN_API_ID = origId
  })

  test('503 если GREEN_API_TOKEN = placeholder', async () => {
    const origToken = process.env.GREEN_API_TOKEN
    process.env.GREEN_API_TOKEN = 'placeholder'
    const res = makeRes()
    await handler({
      method: 'POST',
      headers: { authorization: makeToken() },
      body: { phone: '77001234567', text: 'Тест', author: 'x' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(503)
    process.env.GREEN_API_TOKEN = origToken
  })

  test('405 для GET', async () => {
    const res = makeRes()
    await handler({ method: 'GET', headers: { authorization: makeToken() }, query: {}, body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  test('401 без токена', async () => {
    const res = makeRes()
    await handler({ method: 'POST', headers: {}, body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  test('400 если phone не передан', async () => {
    const res = makeRes()
    await handler({
      method: 'POST',
      headers: { authorization: makeToken() },
      body: { text: 'привет' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  test('400 если text не передан', async () => {
    const res = makeRes()
    await handler({
      method: 'POST',
      headers: { authorization: makeToken() },
      body: { phone: '77001234567' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  test('Green API вызывается с токеном в URL (не в заголовке)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ idMessage: 'msg-001' }),
    })
    mockMaybe.mockResolvedValueOnce({ data: { id: 'chat1' }, error: null })

    const res = makeRes()
    await handler({
      method: 'POST',
      headers: { authorization: makeToken() },
      body: { phone: '77001234567', text: 'Тест', author: 'Admin' },
    }, res)

    // Verify Green API URL contains token in path
    const fetchCall = global.fetch.mock.calls[0]
    const url = fetchCall[0]
    expect(url).toContain('test-token')
    expect(url).toContain('test-instance')
    expect(url).toContain('sendMessage')

    // Verify NO Authorization header sent to Green API
    const options = fetchCall[1]
    expect(options.headers?.Authorization).toBeUndefined()
  })

  test('200 + сообщение сохраняется в БД при успехе', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ idMessage: 'msg-999' }),
    })
    mockMaybe.mockResolvedValueOnce({ data: { id: 'chat1' }, error: null })

    const res = makeRes()
    await handler({
      method: 'POST',
      headers: { authorization: makeToken() },
      body: { phone: '77001234567', text: 'Привет', author: 'Менеджер' },
    }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(chatChain.upsert).toHaveBeenCalled()
    const insertArg = chatChain.upsert.mock.calls[0][0]
    expect(insertArg.id).toBe('msg-999')
    expect(insertArg.direction).toBe('out')
    expect(insertArg.status).toBe('sent')
  })

  test('502 если Green API вернул ошибку', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ message: 'forbidden' }),
    })

    const res = makeRes()
    await handler({
      method: 'POST',
      headers: { authorization: makeToken() },
      body: { phone: '77001234567', text: 'Тест', author: 'x' },
    }, res)

    expect(res.status).toHaveBeenCalledWith(502)
  })

  test('chat создаётся если не существует', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ idMessage: 'msg-new' }),
    })
    // maybeSingle returns null — chat doesn't exist
    mockMaybe.mockResolvedValueOnce({ data: null, error: null })

    const res = makeRes()
    await handler({
      method: 'POST',
      headers: { authorization: makeToken() },
      body: { phone: '77009999999', text: 'Первое сообщение', author: 'Admin' },
    }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    // сообщение сохраняется через upsert, сам чат — insert
    expect(chatChain.upsert).toHaveBeenCalled()
    expect(chatChain.insert).toHaveBeenCalled()
  })
})
