// __tests__/lib/docTemplates.test.js
const { sumWordsKzt, fillDocTemplate, DOC_TEMPLATES_FALLBACK, DOC_PLACEHOLDERS } = require('../../lib/docTemplates')

describe('sumWordsKzt — сумма прописью', () => {
  test('ноль', () => {
    expect(sumWordsKzt(0)).toBe('ноль тенге')
  })

  test('единицы и десятки', () => {
    expect(sumWordsKzt(21)).toBe('двадцать один тенге')
    expect(sumWordsKzt(17)).toBe('семнадцать тенге')
    expect(sumWordsKzt(90)).toBe('девяносто тенге')
  })

  test('сотни', () => {
    expect(sumWordsKzt(600)).toBe('шестьсот тенге')
    expect(sumWordsKzt(999)).toBe('девятьсот девяносто девять тенге')
  })

  test('тысячи — женский род', () => {
    expect(sumWordsKzt(1000)).toBe('одна тысяча тенге')
    expect(sumWordsKzt(2000)).toBe('две тысячи тенге')
    expect(sumWordsKzt(5000)).toBe('пять тысяч тенге')
    expect(sumWordsKzt(12012)).toBe('двенадцать тысяч двенадцать тенге')
    expect(sumWordsKzt(600000)).toBe('шестьсот тысяч тенге')
  })

  test('склонение 11-14 тысяч', () => {
    expect(sumWordsKzt(11000)).toBe('одиннадцать тысяч тенге')
    expect(sumWordsKzt(12000)).toBe('двенадцать тысяч тенге')
  })

  test('миллионы', () => {
    expect(sumWordsKzt(1100000)).toBe('один миллион сто тысяч тенге')
    expect(sumWordsKzt(2000000)).toBe('два миллиона тенге')
    expect(sumWordsKzt(5000000)).toBe('пять миллионов тенге')
    expect(sumWordsKzt(1234567)).toBe('один миллион двести тридцать четыре тысячи пятьсот шестьдесят семь тенге')
  })

  test('миллиарды', () => {
    expect(sumWordsKzt(1000000000)).toBe('один миллиард тенге')
  })

  test('типовые суммы договоров', () => {
    expect(sumWordsKzt(300000)).toBe('триста тысяч тенге')
    expect(sumWordsKzt(900000)).toBe('девятьсот тысяч тенге')
    expect(sumWordsKzt(1100000)).toBe('один миллион сто тысяч тенге')
  })

  test('нечисловой ввод → ноль', () => {
    expect(sumWordsKzt(null)).toBe('ноль тенге')
    expect(sumWordsKzt('abc')).toBe('ноль тенге')
  })
})

describe('fillDocTemplate — подстановка', () => {
  const c = { fio:'Иванов Иван', iin:'123456789012', phone:'+77071234567', city:'Алматы', contractAmount:600000 }

  test('подставляет все данные клиента', () => {
    const out = fillDocTemplate('{{ФИО}} · {{ИИН}} · {{ТЕЛЕФОН}} · {{ГОРОД}}', c)
    expect(out).toBe('Иванов Иван · 123456789012 · +77071234567 · Алматы')
  })

  test('сумма цифрами и прописью', () => {
    const out = fillDocTemplate('{{СУММА}} ({{СУММА_ПРОПИСЬЮ}})', c)
    expect(out).toContain('600')
    expect(out).toContain('шестьсот тысяч тенге')
  })

  test('менеджер и тип договора из opts', () => {
    const out = fillDocTemplate('{{МЕНЕДЖЕР}} / {{ТИП_ДОГОВОРА}}', c, { manager:'Асель', contractLabel:'Сопровождение' })
    expect(out).toBe('Асель / Сопровождение')
  })

  test('пустые поля → прочерк', () => {
    const out = fillDocTemplate('{{ФИО}} {{СУММА}}', {})
    expect(out).toBe('____________ ____________')
  })

  test('неизвестный плейсхолдер остаётся как есть', () => {
    expect(fillDocTemplate('{{НЕИЗВЕСТНО}}', c)).toBe('{{НЕИЗВЕСТНО}}')
  })

  test('дефолтные шаблоны заполняются без остатка известных плейсхолдеров', () => {
    for (const tpl of DOC_TEMPLATES_FALLBACK) {
      const out = fillDocTemplate(tpl.body, c, { manager:'Асель', contractLabel:'Сопровождение', date:'01.01.2026' })
      for (const ph of DOC_PLACEHOLDERS) expect(out).not.toContain(ph)
    }
  })
})
