// __tests__/lib/waPhone.test.js
// КРИТ-регрессия: казахстанский домашний формат 8XXXXXXXXXX превращался в
// 7 + 8XXX = 787XXX — сообщение уходило ЧУЖОМУ номеру. Здесь фиксируем корректную
// нормализацию для всех форматов ввода.
const { normalizeWaPhone, toWaChatId } = require('../../lib/waConstants')

describe('normalizeWaPhone — казахстанские форматы', () => {
  test('8XXXXXXXXXX (домашний) → 7XXXXXXXXXX, а НЕ 787XXX', () => {
    expect(normalizeWaPhone('87711285135')).toBe('77711285135')
    expect(normalizeWaPhone('8 (701) 234-56-78')).toBe('77012345678')
  })
  test('7XXXXXXXXXX (международный) — без изменений', () => {
    expect(normalizeWaPhone('77711285135')).toBe('77711285135')
    expect(normalizeWaPhone('+7 771 128 51 35')).toBe('77711285135')
  })
  test('10 цифр без кода страны → 7XXXXXXXXXX', () => {
    expect(normalizeWaPhone('7012345678')).toBe('77012345678')
  })
  test('мусор/пусто — не падает', () => {
    expect(normalizeWaPhone('')).toBe('')
    expect(normalizeWaPhone(null)).toBe('')
  })
})

describe('toWaChatId — формат Green API', () => {
  test('домашний 8XXX даёт правильный @c.us (не чужой номер!)', () => {
    expect(toWaChatId('87711285135')).toBe('77711285135@c.us')
  })
  test('пустой ввод → пустая строка (не "@c.us")', () => {
    expect(toWaChatId('')).toBe('')
  })
})
