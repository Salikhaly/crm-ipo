// __tests__/lib/exportAnketa.test.js
// Проверяем маппер экспорта и СИММЕТРИЮ: экспорт → импорт возвращает те же данные.
const { anketaCells, anketaFileName, baseRows, BASE_HEADERS } = require('../../lib/exportAnketa')
const { clientFromAnketa, clientsFromList } = require('../../lib/importAnketa')

const CLIENT = {
  fio: 'Иванов Иван Иванович',
  iin: '123456789012',
  phone: '+7 707 111 22 33',
  officialIncome: '450000',
  monthlyLoad: '80000',
  downPayment: '2000000',
  depositAmount: '5000000',
  dateIn: '2026-07-10',
  manager: 'm1', stage: 'analysis',
  tags: ['импорт', 'vip'],
  comments: [{ id:'1', text:'📥 Импорт · Цель: ипотека · ПКР: 178', author:'X', date:'', sys:true }],
}

describe('anketaCells — клиент → ячейки анкеты', () => {
  const cells = anketaCells(CLIENT, { contractLabel: 'Сопровождение' })
  const get = (sheet, ref) => cells.find(x => x.sheet === sheet && x.ref === ref)?.value ?? ''

  test('основные поля в свои ячейки', () => {
    expect(get('Анкета','B5')).toBe(CLIENT.fio)
    expect(get('Анкета','B6')).toBe(CLIENT.iin)
    expect(get('Анкета','F6')).toBe(CLIENT.phone)
  })
  test('цель из заметки импорта приоритетнее типа договора', () => {
    expect(get('Анкета','H10')).toBe('ипотека')
  })
  test('деньги: взнос, депозит, СРЗП, нагрузка', () => {
    expect(get('Анкета','H13')).toBe('2000000')
    expect(get('Анкета','E18')).toBe('5000000')
    expect(get('Анкета','B43')).toBe('450000')
    expect(get('Кредиты','E6')).toBe('80000')
  })
  test('пустые значения не пишутся', () => {
    const empty = anketaCells({ fio:'X' })
    expect(empty.find(x => x.ref === 'H13')).toBeUndefined()
    expect(empty.find(x => x.ref === 'B43')).toBeUndefined()
  })
})

describe('симметрия: экспорт анкеты → импорт анкеты', () => {
  test('clientFromAnketa восстанавливает данные', () => {
    const cells = anketaCells(CLIENT, {})
    const map = {}
    for (const { sheet, ref, value } of cells) map[`${sheet}!${ref}`] = value
    const back = clientFromAnketa((s, r) => map[`${s}!${r}`] ?? '')
    expect(back.fio).toBe(CLIENT.fio)
    expect(back.iin).toBe(CLIENT.iin)
    expect(back.phone).toBe(CLIENT.phone)
    expect(back.officialIncome).toBe('450000')
    expect(back.monthlyLoad).toBe('80000')
    expect(back.downPayment).toBe('2000000')
    expect(back.depositAmount).toBe('5000000')
  })
})

describe('baseRows — список в формате база_анкет', () => {
  const rows = baseRows([CLIENT], {
    mgrName: id => id === 'm1' ? 'Ерлан' : '',
    stageLabel: id => id === 'analysis' ? 'Анализ' : id,
  })

  test('заголовки + строка', () => {
    expect(rows[0]).toEqual(BASE_HEADERS)
    expect(rows.length).toBe(2)
  })
  test('данные в колонках', () => {
    const r = rows[1]
    expect(r[0]).toBe(CLIENT.phone)
    expect(r[2]).toBe('Ерлан')
    expect(r[3]).toBe(CLIENT.fio)
    expect(r[4]).toBe(CLIENT.iin)
    expect(r[5]).toBe('178')          // ПКР из заметки
    expect(r[6]).toBe(80000)          // нагрузка
    expect(r[7]).toBe(450000)         // СРЗП
    expect(r[8]).toBe('ипотека')      // цель из заметки
    expect(r[11]).toBe('Анализ')
  })

  test('симметрия: baseRows → clientsFromList восстанавливает клиентов', () => {
    const back = clientsFromList(rows)
    expect(back.length).toBe(1)
    expect(back[0].fio).toBe(CLIENT.fio)
    expect(back[0].iin).toBe(CLIENT.iin)
    expect(back[0].phone).toBe(CLIENT.phone)
    expect(back[0].officialIncome).toBe('450000')
    expect(back[0].monthlyLoad).toBe('80000')
    expect(back[0].downPayment).toBe('2000000')
  })
})

describe('anketaFileName', () => {
  test('безопасное имя', () => {
    expect(anketaFileName(CLIENT)).toBe('Анкета_Иванов_Иван_Иванович.xlsx')
    expect(anketaFileName({})).toBe('Анкета_клиент.xlsx')
  })
})


describe('baseRows — колонка «Сопровождение»', () => {
  const { baseRows, BASE_HEADERS } = require('../../lib/exportAnketa')
  test('заголовок присутствует перед «Тег»', () => {
    expect(BASE_HEADERS[BASE_HEADERS.length - 2]).toBe('Сопровождение')
  })
  test('значение из ctx.accompLabel попадает в строку', () => {
    const rows = baseRows(
      [{ fio: 'Тест', phone: '+77070000000', stage: 'in_work', contractType: 'extra', accompStageIndex: 2 }],
      { stageLabel: () => 'Взят в работу', accompLabel: () => '3/7 · Стратегия аудирования' },
    )
    const i = rows[0].indexOf('Сопровождение')
    expect(rows[1][i]).toBe('3/7 · Стратегия аудирования')
  })
})
