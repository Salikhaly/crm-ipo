// __tests__/lib/importAnketa.test.js
const {
  parseMoney, parseIin, parsePhone, cleanStr,
  clientFromAnketa, clientsFromList,
} = require('../../lib/importAnketa')

describe('parseMoney', () => {
  test('число как есть', () => expect(parseMoney(300000)).toBe(300000))
  test('строка с пробелами', () => expect(parseMoney('1 234 567')).toBe(1234567))
  test('СРЗП с деталями', () => expect(parseMoney('300 000  (Org: 111)')).toBe(300000))
  test('пусто', () => { expect(parseMoney('')).toBe(''); expect(parseMoney(null)).toBe('') })
  test('нечисло', () => expect(parseMoney('нет данных')).toBe(''))
})

describe('parseIin', () => {
  test('валидный', () => expect(parseIin('123456789012')).toBe('123456789012'))
  test('с мусором но 12 цифр', () => expect(parseIin(' 1234 5678 9012 ')).toBe('123456789012'))
  test('короткий → пусто', () => expect(parseIin('12345')).toBe(''))
})

describe('parsePhone', () => {
  test('нормальный', () => expect(parsePhone('+7 707 123 45 67')).toBe('+7 707 123 45 67'))
  test('мало цифр но есть → оставляем', () => expect(parsePhone('123')).toBe('123'))
  test('пусто', () => expect(parsePhone('')).toBe(''))
})

describe('clientFromAnketa — формат анкеты ПКБ', () => {
  const cells = {
    'Анкета!B5': 'Иванов Иван Иванович',
    'Анкета!B6': '123456789012',
    'Анкета!F6': '+7 707 111 22 33',
    'Анкета!H10': 'ипотека',
    'Анкета!H13': '2 000 000',
    'Анкета!E18': '5 000 000',
    'Анкета!H18': '1 000 000',
    'Анкета!J18': '250 000',
    'Анкета!B43': '450 000  (АО Банк: 450 000)',
    'Кредиты!A1': 'ПКО:  Действ 2   Завершённый 1   ПКР 178',
    'Кредиты!E6': '50 000',
    'Кредиты!E7': '30 000',
  }
  const getCell = (s, r) => cells[`${s}!${r}`] ?? ''
  const c = clientFromAnketa(getCell)

  test('ФИО/ИИН/телефон', () => {
    expect(c.fio).toBe('Иванов Иван Иванович')
    expect(c.iin).toBe('123456789012')
    expect(c.phone).toBe('+7 707 111 22 33')
  })
  test('доход из СРЗП', () => expect(c.officialIncome).toBe('450000'))
  test('нагрузка = сумма E6:E23', () => expect(c.monthlyLoad).toBe('80000'))
  test('первый взнос = наличные на руках', () => expect(c.downPayment).toBe('2000000'))
  test('депозит', () => expect(c.depositAmount).toBe('5000000'))
  test('заметка содержит цель, ПКР, БВ, ГП', () => {
    expect(c.__note).toContain('Цель: ипотека')
    expect(c.__note).toContain('ПКР: 178')
    expect(c.__note).toContain('Баспана Вай')
    expect(c.__note).toContain('Госпремия')
  })
  test('тег импорт + этап новый лид', () => {
    expect(c.tags).toContain('импорт')
    expect(c.stage).toBe('new_lead')
  })
})

describe('clientsFromList — формат база_анкет.xlsx', () => {
  const rows = [
    ['Телефон','Дата','Менеджер','ФИО','ИИН','ПКР','Нагрузка/мес','СРЗП','Цель','Нал. на руках','Депозит Н'],
    ['+7 701 000 11 22','01.01.2026','Ерлан','Петров Пётр','210987654321','200','40 000','350 000','авто','500 000','0'],
    ['','', '', '', '', '', '', '', '', '', ''],  // пустая — пропустить
    ['+7 700 555 44 33','02.01.2026','Асель','Сидорова Анна','','150','','600 000','ремонт','',''],
  ]
  const list = clientsFromList(rows)

  test('пропускает пустые строки', () => expect(list.length).toBe(2))
  test('первый клиент смаплен', () => {
    const a = list[0]
    expect(a.fio).toBe('Петров Пётр')
    expect(a.phone).toBe('+7 701 000 11 22')
    expect(a.iin).toBe('210987654321')
    expect(a.officialIncome).toBe('350000')
    expect(a.monthlyLoad).toBe('40000')
    expect(a.downPayment).toBe('500000')
    expect(a.__note).toContain('Цель: авто')
    expect(a.__note).toContain('ПКР: 200')
  })
  test('второй клиент без ИИН — всё равно импортируется', () => {
    const b = list[1]
    expect(b.fio).toBe('Сидорова Анна')
    expect(b.iin).toBe('')
    expect(b.officialIncome).toBe('600000')
  })

  test('пустой/битый ввод → []', () => {
    expect(clientsFromList([])).toEqual([])
    expect(clientsFromList([['a','b'],['1','2']])).toEqual([])  // нет распознанных заголовков
  })
})

describe('creditsFromAnketa — кредитная история из листа «Кредиты»', () => {
  const cells = {
    'Кредиты!B6': 'Займ', 'Кредиты!C6': 'АО Банк ЦентрКредит', 'Кредиты!D6': '5 000 000',
    'Кредиты!E6': '120 000', 'Кредиты!F6': '3 200 000', 'Кредиты!G6': '', 'Кредиты!H6': '',
    'Кредиты!B7': 'Кредитная карта', 'Кредиты!C7': 'Kaspi Bank', 'Кредиты!E7': '25 000',
    'Кредиты!G7': '15', 'Кредиты!H7': '40 000',
    'Кредиты!B30': 'ТОО МФО Деньги', 'Кредиты!D30': 'ТОО Коллектор', 'Кредиты!F30': '01.03.2024',
    'Кредиты!G30': '90', 'Кредиты!H30': '150 000',
    'Кредиты!B46': 'АО Народный банк', 'Кредиты!F46': '10.05.2018',
  }
  const getCell = (s, r) => cells[`${s}!${r}`] ?? ''
  const { creditsFromAnketa } = require('../../lib/importAnketa')
  const list = creditsFromAnketa(getCell)

  test('активные, завершённые и старые распознаны', () => {
    expect(list.filter(k => k.status === 'active').length).toBe(2)
    expect(list.filter(k => k.status === 'closed').length).toBe(1)
    expect(list.filter(k => k.status === 'old').length).toBe(1)
  })
  test('поля активного кредита', () => {
    const a = list[0]
    expect(a.creditor).toBe('АО Банк ЦентрКредит')
    expect(a.amount).toBe(5000000)
    expect(a.payment).toBe(120000)
    expect(a.outstanding).toBe(3200000)
  })
  test('просрочка и цессионарий у завершённого', () => {
    const c1 = list.find(k => k.status === 'closed')
    expect(c1.cessionary).toBe('ТОО Коллектор')
    expect(c1.overdueDays).toBe(90)
    expect(c1.endDate).toBe('01.03.2024')
  })
  test('симметрия: anketaCells(credits) → creditsFromAnketa возвращает те же кредиты', () => {
    const { anketaCells } = require('../../lib/exportAnketa')
    const client = { fio:'X', credits: list }
    const map = {}
    for (const { sheet, ref, value } of anketaCells(client, {})) map[`${sheet}!${ref}`] = value
    const back = creditsFromAnketa((s, r) => map[`${s}!${r}`] ?? '')
    expect(back.filter(k => k.status === 'active').length).toBe(2)
    expect(back[0].creditor).toBe('АО Банк ЦентрКредит')
    expect(back[0].payment).toBe(120000)
    const closed = back.find(k => k.status === 'closed')
    expect(closed.cessionary).toBe('ТОО Коллектор')
  })
})


describe('clientsFromList — колонки «Этап» и «Сопровождение»', () => {
  const { clientsFromList } = require('../../lib/importAnketa')
  const rows = [
    ['ФИО', 'Телефон', 'Этап', 'Сопровождение'],
    ['Иванов Иван', '+7 707 111 22 33', 'Взят в работу', '3/7 · Стратегия аудирования'],
    ['Петров Пётр', '+7 707 222 33 44', 'approval', ''],
    ['Сидоров',     '+7 707 333 44 55', 'Неизвестный этап', 'мусор'],
  ]
  const list = clientsFromList(rows)
  test('этап по названию', () => { expect(list[0].stage).toBe('in_work') })
  test('этап по id', () => { expect(list[1].stage).toBe('approval') })
  test('неизвестный этап → new_lead', () => { expect(list[2].stage).toBe('new_lead') })
  test('сопровождение «3/7» → индекс 2', () => { expect(list[0].accompStageIndex).toBe(2) })
  test('пустое/мусорное сопровождение — поле не задаётся', () => {
    expect(list[1].accompStageIndex).toBeUndefined()
    expect(list[2].accompStageIndex).toBeUndefined()
  })
})
