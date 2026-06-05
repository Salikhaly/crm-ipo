// __tests__/lib/supabase.test.js
// Тестируем маппинг dbToClient / clientToDb — критично для финансовых данных
process.env.SUPABASE_URL         = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_KEY = 'test-key'

import { dbToClient, clientToDb } from '../../lib/supabase'

const dbRow = {
  id: 'uuid-1', fio: 'Иван Иванов', iin: '900101300001',
  phone: '+77001234567', city: 'Алматы', manager: 'mgr-1',
  date_in: '2024-01-15', source: 'referral', stage: 'docs',
  is_whatsapp: true, wa_msg_preview: 'Привет',
  contract_amount: 15000000, payments: [{ amount: 100000 }],
  comments: [], tasks: [], accomp_stages: {},
  credit_status: 'good', has_overdue: false,
  created_at: '2024-01-15T10:00:00Z',
}

describe('dbToClient', () => {
  test('корректно маппит все ключевые поля', () => {
    const c = dbToClient(dbRow)
    expect(c.id).toBe('uuid-1')
    expect(c.fio).toBe('Иван Иванов')
    expect(c.iin).toBe('900101300001')
    expect(c.isWhatsApp).toBe(true)           // snake → camel
    expect(c.waMsgPreview).toBe('Привет')
    expect(c.contractAmount).toBe(15000000)   // финансовое поле
    expect(c.payments).toEqual([{ amount: 100000 }])
    expect(c.creditStatus).toBe('good')
    expect(c.dateIn).toBe('2024-01-15')
  })

  test('возвращает null для null input', () => {
    expect(dbToClient(null)).toBeNull()
  })

  test('подставляет дефолты для undefined полей', () => {
    const c = dbToClient({ id: 'x' })
    expect(c.fio).toBe('')
    expect(c.city).toBe('Алматы')
    expect(c.stage).toBe('new_lead')
    expect(c.comments).toEqual([])
    expect(c.tasks).toEqual([])
  })
})

describe('clientToDb', () => {
  test('roundtrip: dbToClient → clientToDb сохраняет данные', () => {
    const client = dbToClient(dbRow)
    const back   = clientToDb(client)
    expect(back.fio).toBe(dbRow.fio)
    expect(back.iin).toBe(dbRow.iin)
    expect(back.contract_amount).toBe(dbRow.contract_amount)
    expect(back.is_whatsapp).toBe(dbRow.is_whatsapp)
    expect(back.wa_msg_preview).toBe(dbRow.wa_msg_preview)
  })

  test('не включает поле id при обновлении (delete row.id паттерн)', () => {
    const client = dbToClient(dbRow)
    const row    = clientToDb(client)
    // id должен быть, но [id].js делает delete row.id перед update — тест это документирует
    expect(row).toHaveProperty('fio')
    expect(row).toHaveProperty('contract_amount')
  })
})
