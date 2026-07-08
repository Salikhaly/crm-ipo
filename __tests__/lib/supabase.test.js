// __tests__/lib/supabase.test.js
process.env.SUPABASE_URL         = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_KEY = 'test-key'
process.env.JWT_SECRET           = 'test-secret-32chars!!'

const { dbToClient, clientToDb } = require('../../lib/supabase')

const fullDbRow = {
  id: 'uuid-1', fio: 'Иван Иванов', iin: '900101300001',
  phone: '+77001234567', city: 'Алматы', manager: 'mgr-1',
  date_in: '2024-01-15', source: 'referral', stage: 'approval',
  is_whatsapp: true, wa_msg_preview: 'Привет',
  contact_status: 'reached', marital_status: 'married', children: '2',
  official_income: '500000', extra_income: '100000', extra_income_confirmed: true,
  pension_contributions: '50000', work_experience: '5', work_type: 'official',
  down_payment: '3000000', down_payment_type: 'cash',
  deposit_bank: 'Отбасы', deposit_amount: '1000000', deposit_term: '36',
  otbasy_deposit: true, otbasy_reward: '200000', otbasy_queue: '1234',
  otbasy_queue_year: '2025', otbasy_queue_city: 'Алматы',
  credit_status: 'good', has_overdue: false, credits_count: '2',
  monthly_load: '150000', had_bank_refusal: false, has_refinancing: false,
  problematic_credits: false, court_restrictions: false,
  is_reassignment: false, reassignment_complex: '', reassignment_developer: '',
  reassignment_amount: '', mortgage_balance: '', reassignment_bank: '',
  has_debt: false, urgent_sale: false,
  contract_type: '5y', contract_amount: 25000000,
  payments: [{ id: 'p1', amount: 500000, paidAmount: 500000, status: 'paid' }],
  responsible_manager: 'mgr-2', mortgage_specialist: 'Нурлан',
  accomp_stage_index: 2, accomp_stages: { '0': { done: true } },
  miro_link: 'https://miro.com/x', roadmap_link: '', drive_link: 'https://drive.google.com/x',
  drive_folder_name: 'Иванов', comments: [{ id: 'c1', text: 'ok' }],
  tasks: [{ id: 't1', text: 'Позвонить', done: false }],
  contracts5y: { bank: 'Халык' }, contracts5y_plus: {},
  created_at: '2024-01-15T10:00:00Z',
}

describe('dbToClient', () => {
  test('маппит все ключевые поля snake_case → camelCase', () => {
    const c = dbToClient(fullDbRow)
    expect(c.id).toBe('uuid-1')
    expect(c.fio).toBe('Иван Иванов')
    expect(c.iin).toBe('900101300001')
    expect(c.isWhatsApp).toBe(true)
    expect(c.waMsgPreview).toBe('Привет')
    expect(c.contractAmount).toBe(25000000)
    expect(c.creditStatus).toBe('good')
    expect(c.dateIn).toBe('2024-01-15')
    expect(c.accompStageIndex).toBe(2)
    expect(c.driveLink).toBe('https://drive.google.com/x')
    expect(c.driveFolderName).toBe('Иванов')
    expect(c.contracts5y).toEqual({ bank: 'Халык' })
    expect(c.contracts5yPlus).toEqual({})
  })

  test('маппит boolean поля корректно', () => {
    const c = dbToClient(fullDbRow)
    expect(c.otbasyDeposit).toBe(true)
    expect(c.extraIncomeConfirmed).toBe(true)
    expect(c.hasOverdue).toBe(false)
    expect(c.hadBankRefusal).toBe(false)
    expect(c.isReassignment).toBe(false)
  })

  test('маппит JSONB поля как массивы/объекты', () => {
    const c = dbToClient(fullDbRow)
    expect(Array.isArray(c.payments)).toBe(true)
    expect(c.payments[0].paidAmount).toBe(500000)
    expect(Array.isArray(c.comments)).toBe(true)
    expect(Array.isArray(c.tasks)).toBe(true)
    expect(typeof c.accompStages).toBe('object')
  })

  test('возвращает null для null input', () => {
    expect(dbToClient(null)).toBeNull()
    expect(dbToClient(undefined)).toBeNull()
  })

  test('дефолты для пустой строки БД', () => {
    const c = dbToClient({ id: 'x' })
    expect(c.fio).toBe('')
    expect(c.city).toBe('Алматы')
    expect(c.stage).toBe('new_lead')
    expect(c.source).toBe('other')
    expect(c.contractAmount).toBe(0)
    expect(c.payments).toEqual([])
    expect(c.comments).toEqual([])
    expect(c.tasks).toEqual([])
    expect(c.accompStages).toEqual({})
    expect(c.contracts5y).toEqual({})
    expect(c.contracts5yPlus).toEqual({})
    expect(c.driveLink).toBe('')
    expect(c.driveFolderName).toBe('')
  })

  test('boolean false не перезаписывается дефолтом true', () => {
    const c = dbToClient({ id: 'x', has_overdue: false, otbasy_deposit: false })
    expect(c.hasOverdue).toBe(false)
    expect(c.otbasyDeposit).toBe(false)
  })
})

describe('clientToDb', () => {
  test('roundtrip dbToClient → clientToDb сохраняет данные', () => {
    const client = dbToClient(fullDbRow)
    const back   = clientToDb(client)
    expect(back.fio).toBe('Иван Иванов')
    expect(back.iin).toBe('900101300001')
    expect(back.contract_amount).toBe(25000000)
    expect(back.is_whatsapp).toBe(true)
    expect(back.wa_msg_preview).toBe('Привет')
    expect(back.drive_link).toBe('https://drive.google.com/x')
    expect(back.drive_folder_name).toBe('Иванов')
    expect(back.accomp_stage_index).toBe(2)
  })

  test('маппит camelCase → snake_case корректно', () => {
    const client = dbToClient(fullDbRow)
    const back   = clientToDb(client)
    expect(back.date_in).toBe('2024-01-15')
    expect(back.credit_status).toBe('good')
    expect(back.down_payment_type).toBe('cash')
    expect(back.extra_income_confirmed).toBe(true)
    expect(back.otbasy_deposit).toBe(true)
    expect(back.contracts5y_plus).toEqual({})
  })

  test('финансовые суммы сохраняются как числа', () => {
    const client = dbToClient(fullDbRow)
    const back   = clientToDb(client)
    expect(typeof back.contract_amount).toBe('number')
    expect(back.contract_amount).toBe(25000000)
  })
})

// ─── Необязательные колонки (миграции 008 / 010) ────────────────────────────
const { addCloseReason, findMissingOptionalColumn } = require('../../lib/supabase')

describe('addCloseReason', () => {
  test('добавляет close_reason только если поле есть у клиента', () => {
    const row = {}
    addCloseReason(row, { closeReason: 'Отказ банка' })
    expect(row.close_reason).toBe('Отказ банка')
  })

  test('не трогает row без поля closeReason', () => {
    const row = {}
    addCloseReason(row, {})
    expect('close_reason' in row).toBe(false)
  })

  test('пустая причина → пустая строка', () => {
    const row = {}
    addCloseReason(row, { closeReason: '' })
    expect(row.close_reason).toBe('')
  })
})

describe('findMissingOptionalColumn', () => {
  test('находит отсутствующую колонку по тексту ошибки', () => {
    const row = { fio: 'x', close_reason: '' }
    const err = { message: `column "close_reason" of relation "clients" does not exist` }
    expect(findMissingOptionalColumn(err, row)).toBe('close_reason')
  })

  test('не срабатывает если колонки нет в row', () => {
    const err = { message: `column "close_reason" does not exist` }
    expect(findMissingOptionalColumn(err, { fio: 'x' })).toBeNull()
  })

  test('null при отсутствии ошибки или другой ошибке', () => {
    expect(findMissingOptionalColumn(null, { close_reason: '' })).toBeNull()
    expect(findMissingOptionalColumn({ message: 'timeout' }, { close_reason: '' })).toBeNull()
  })

  test('saved_calcs тоже распознаётся', () => {
    const row = { saved_calcs: [] }
    const err = { message: `column "saved_calcs" does not exist` }
    expect(findMissingOptionalColumn(err, row)).toBe('saved_calcs')
  })
})
