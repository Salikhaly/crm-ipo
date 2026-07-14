// __tests__/api/portal.test.js
// Гарантирует, что публичный портал НЕ отдаёт чувствительные данные (ИИН, доход)
// и корректно считает прогресс по этапу.
process.env.JWT_SECRET           = 'test-secret-32chars!!'
process.env.SUPABASE_URL         = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_KEY = 'test-key'

const clientRow = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  fio: 'Иванов Иван', stage: 'approval', manager: 'm1', contract_type: 'full',
  // ниже — то, что НЕ должно утечь
  iin: '123456789012', official_income: 900000, comments: [{ text: 'секрет' }],
}
const managerRow = { name: 'Пётр', phone: '+77010000000' }

const mockMaybe = jest.fn()
const chain = {
  select: jest.fn().mockReturnThis(),
  eq:     jest.fn().mockReturnThis(),
  maybeSingle: mockMaybe,
}
jest.mock('../../lib/supabase', () => ({
  getSupabase: () => ({ from: () => chain }),
}))

const handler = require('../../pages/api/portal/[id]').default
const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() })

beforeEach(() => { jest.clearAllMocks() })

describe('GET /api/portal/:id', () => {
  test('404 на невалидный id (защита от перебора)', async () => {
    const res = makeRes()
    await handler({ method: 'GET', query: { id: 'junk' } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('отдаёт статус, но НЕ отдаёт ИИН/доход/комментарии', async () => {
    mockMaybe
      .mockResolvedValueOnce({ data: clientRow })    // клиент
      .mockResolvedValueOnce({ data: managerRow })   // менеджер
    const res = makeRes()
    await handler({ method: 'GET', query: { id: clientRow.id } }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const body = res.json.mock.calls[0][0]
    expect(body.firstName).toBe('Иванов')
    expect(body.stage).toBe('Одобрение')
    expect(body.progress).toBeGreaterThan(0)
    expect(body.manager).toEqual({ name: 'Пётр', phone: '+77010000000' })
    // критично: чувствительное не утекает
    const json = JSON.stringify(body)
    expect(json).not.toContain('123456789012') // ИИН
    expect(json).not.toContain('900000')        // доход
    expect(json).not.toContain('секрет')        // комментарии
  })

  test('404 если клиент не найден', async () => {
    mockMaybe.mockResolvedValueOnce({ data: null })
    const res = makeRes()
    await handler({ method: 'GET', query: { id: 'ffffffff-1111-2222-3333-444444444444' } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })
})
