// __tests__/api/wa-webhook.test.js
// Тестируем критическую логику webhook без реального Supabase

process.env.JWT_SECRET      = 'test-secret-32chars!!'
process.env.SUPABASE_URL    = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_KEY = 'test-key'
process.env.WEBHOOK_SECRET  = 'test-webhook-secret'

// Mock supabase
const mockUpsert = jest.fn().mockResolvedValue({ data: {}, error: null })
const mockUpdate = jest.fn().mockReturnThis()
const mockEq     = jest.fn().mockResolvedValue({ data: null, error: null })
const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null })
const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null })
const mockSelect = jest.fn().mockReturnThis()
const mockFrom   = jest.fn(() => ({
  select: mockSelect, update: mockUpdate, upsert: mockUpsert,
  eq: mockEq, maybeSingle: mockMaybeSingle, single: mockSingle,
}))

jest.mock('../../lib/supabase', () => ({
  getSupabase: () => ({ from: mockFrom }),
}))

const handler = require('../../pages/api/wa/webhook').default

const makeReq = (body, query = {}) => ({
  method: 'GET',   // будет переопределён в тестах
  headers: {},
  query,
  body,
})
const makeRes = () => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
  return res
}

describe('Webhook security', () => {
  test('отклоняет запрос без секрета', async () => {
    const req = { ...makeReq({}, {}), method: 'POST' }
    const res = makeRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  test('отклоняет неверный секрет', async () => {
    const req = { ...makeReq({}, { secret: 'wrong' }), method: 'POST' }
    const res = makeRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  test('отклоняет GET метод', async () => {
    const req = makeReq({}, { secret: 'test-webhook-secret' })
    const res = makeRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })
})

describe('Webhook message handling', () => {
  const validReq = (body) => ({
    method: 'POST',
    headers: {},
    query: { secret: 'test-webhook-secret' },
    body,
  })

  test('пропускает не-message типы вебхуков', async () => {
    const res = makeRes()
    await handler(validReq({ typeWebhook: 'deviceInfo' }), res)
    expect(res.status).toHaveBeenCalledWith(200)
    const jsonArg = res.json.mock.calls[0][0]
    expect(jsonArg.skipped).toBeDefined()
  })

  test('пропускает групповые чаты (@g.us)', async () => {
    const res = makeRes()
    await handler(validReq({
      typeWebhook: 'incomingMessageReceived',
      senderData:  { chatId: '123456789@g.us', senderName: 'Test' },
      messageData: { typeMessage: 'textMessage', idMessage: 'msg1',
                     textMessageData: { textMessage: 'hello' } },
    }), res)
    const jsonArg = res.json.mock.calls[0][0]
    expect(jsonArg.skipped).toBe('group')
  })

  test('отклоняет пустой chatId', async () => {
    const res = makeRes()
    await handler(validReq({
      typeWebhook: 'incomingMessageReceived',
      senderData:  { chatId: '', senderName: '' },
      messageData: { typeMessage: 'textMessage', idMessage: 'msg2',
                     textMessageData: { textMessage: 'test' } },
    }), res)
    const jsonArg = res.json.mock.calls[0][0]
    expect(jsonArg.skipped).toBe('empty_chatId')
  })

  test('обновляет статус outgoingMessageStatus', async () => {
    mockEq.mockResolvedValueOnce({ data: {}, error: null })
    const res = makeRes()
    await handler(validReq({
      typeWebhook: 'outgoingMessageStatus',
      idMessage:   'msg-out-1',
      status:      'read',
    }), res)
    expect(res.status).toHaveBeenCalledWith(200)
    const jsonArg = res.json.mock.calls[0][0]
    expect(jsonArg.handled).toBe('status')
  })
})

describe('Auth middleware edge cases', () => {
  test('withAuth блокирует если Authorization отсутствует', async () => {
    // Тестируем через clients endpoint
    process.env.SUPABASE_URL = 'https://test.supabase.co'
    const clientsHandler = require('../../pages/api/clients/index').default
    const req = { method: 'GET', headers: {}, query: {}, user: null }
    const res = makeRes()
    await clientsHandler(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })
})
