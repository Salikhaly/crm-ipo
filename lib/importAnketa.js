// lib/importAnketa.js
// Разбор Excel-файлов в объекты клиента CRM. Два формата:
//  1) Анкета ПКБ (template.xlsx) — данные в фиксированных ячейках листов «Анкета»/«Кредиты».
//  2) Список «база_анкет.xlsx» — строки с заголовками (Телефон, ФИО, ИИН, СРЗП…).
//
// Модуль ЧИСТЫЙ: не зависит от SheetJS. Браузер строит из книги два аксессора
// и передаёт их сюда — это делает маппинг юнит-тестируемым.
//   getCell(sheetName, 'B5') -> сырое значение ячейки (или '')
import { PIPELINE_DEFAULT } from './constants'
//   Формат ячеек анкеты выведен из PKB_App: app.py _write_extra / main.py fill_anketa_from_pension.

// «1 234 567», 123456, "300000  (ORG: 1)" → 300000 (int) | '' если нет числа
export function parseMoney(v) {
  if (v == null) return ''
  if (typeof v === 'number') return isFinite(v) ? Math.round(v) : ''
  const m = String(v).replace(/ /g, ' ').match(/-?\d[\d\s.,]*/)
  if (!m) return ''
  const digits = m[0].replace(/[\s.,](?=\d{3}\b)/g, '').replace(/[^\d]/g, '')
  return digits ? parseInt(digits, 10) : ''
}

export function cleanStr(v) {
  if (v == null) return ''
  return String(v).replace(/ /g, ' ').trim()
}

// ИИН — ровно 12 цифр, иначе ''
export function parseIin(v) {
  const d = cleanStr(v).replace(/\D/g, '')
  return /^\d{12}$/.test(d) ? d : ''
}

// Телефон → как ввёл пользователь, но чистим мусор; пустой если цифр < 10
export function parsePhone(v) {
  const s = cleanStr(v)
  const d = s.replace(/\D/g, '')
  return d.length >= 10 ? s : (d.length ? s : '')
}

// Кредитная история с листа «Кредиты» (раскладка write_output_legacy_excel):
// активные — строки 6..23 (B тип, C кредитор, D сумма, E платёж, F остаток,
// G дни просрочки, H сумма просрочки); завершённые — 30..39; старые — 46..55.
export function creditsFromAnketa(getCell) {
  const out = []
  const g = r => ({
    type:     cleanStr(getCell('Кредиты', 'B' + r)),
    creditor: cleanStr(getCell('Кредиты', 'C' + r)),
  })
  for (let r = 6; r <= 23; r++) {
    const { type, creditor } = g(r)
    const payment = parseMoney(getCell('Кредиты', 'E' + r))
    if (!type && !creditor && !payment) continue
    out.push({
      status: 'active', type, creditor,
      amount:        parseMoney(getCell('Кредиты', 'D' + r)) || '',
      payment:       payment || '',
      outstanding:   parseMoney(getCell('Кредиты', 'F' + r)) || '',
      overdueDays:   parseMoney(getCell('Кредиты', 'G' + r)) || '',
      overdueAmount: parseMoney(getCell('Кредиты', 'H' + r)) || '',
    })
  }
  for (const [from, to, status] of [[30, 39, 'closed'], [46, 55, 'old']]) {
    for (let r = from; r <= to; r++) {
      const creditor = cleanStr(getCell('Кредиты', 'B' + r))
      if (!creditor) continue
      out.push({
        status, type: '', creditor,
        cessionary:    cleanStr(getCell('Кредиты', 'D' + r)),
        endDate:       cleanStr(getCell('Кредиты', 'F' + r)),
        overdueDays:   parseMoney(getCell('Кредиты', 'G' + r)) || '',
        overdueAmount: parseMoney(getCell('Кредиты', 'H' + r)) || '',
      })
    }
  }
  return out
}

// ─── Формат 1: одна анкета ПКБ ───────────────────────────────────────────────
// getCell(sheet, ref). Возвращает объект клиента (частичный, под emptyClient).
export function clientFromAnketa(getCell) {
  const g = (s, r) => cleanStr(getCell(s, r))
  const fio   = g('Анкета', 'B5')
  const iin   = parseIin(getCell('Анкета', 'B6'))
  const phone = parsePhone(getCell('Анкета', 'F6'))
  const goal   = g('Анкета', 'H10')
  const onhand = parseMoney(getCell('Анкета', 'H13'))   // наличные на руках
  const cashN  = parseMoney(getCell('Анкета', 'E18'))   // депозит Н
  const bv     = parseMoney(getCell('Анкета', 'H18'))   // Баспана Вай
  const gp     = parseMoney(getCell('Анкета', 'J18'))   // Госпремия
  const srzp   = parseMoney(getCell('Анкета', 'B43'))   // средняя зарплата

  // ПКР из сводки листа «Кредиты» A1: "...  ПКР 123"
  const summary = g('Кредиты', 'A1')
  const pkrM = summary.match(/ПКР\s*(\d+)/i)
  const pkr  = pkrM ? pkrM[1] : ''

  // Нагрузка/мес — сумма периодических платежей активных договоров (Кредиты E6:E23)
  let load = 0
  for (let r = 6; r <= 23; r++) {
    const n = parseMoney(getCell('Кредиты', 'E' + r))
    if (n) load += n
  }

  const noteParts = []
  if (goal) noteParts.push('Цель: ' + goal)
  if (pkr)  noteParts.push('ПКР: ' + pkr)
  if (onhand) noteParts.push('Наличные на руках: ' + onhand.toLocaleString('ru'))
  if (bv)   noteParts.push('Баспана Вай: ' + bv.toLocaleString('ru'))
  if (gp)   noteParts.push('Госпремия: ' + gp.toLocaleString('ru'))

  const client = buildClient({
    fio, iin, phone,
    officialIncome: srzp,
    monthlyLoad:    load || '',
    downPayment:    onhand,
    depositAmount:  cashN,
    note: noteParts.join(' · '),
  })
  // Полная кредитная история — таблица во вкладке «Финансы» (миграция 015)
  const credits = creditsFromAnketa(getCell)
  if (credits.length) client.credits = credits
  return client
}

// ─── Формат 2: список с заголовками (база_анкет.xlsx) ────────────────────────
// Синонимы заголовков → ключ. Сопоставление регистронезависимое, по вхождению.
const HEADER_MAP = [
  [['фио', 'клиент', 'имя'],               'fio'],
  [['телефон', 'тел', 'phone', 'номер'],   'phone'],
  [['иин', 'iin'],                          'iin'],
  [['город', 'city'],                       'city'],
  [['менеджер', 'manager'],                 'manager'],
  [['срзп', 'доход', 'зарплата', 'зп'],     'income'],
  [['нагрузк', 'платеж', 'кредит/мес'],     'load'],
  [['цель'],                                'goal'],
  [['пкр'],                                 'pkr'],
  [['нал', 'на руках'],                     'onhand'],
  [['депозит', 'вклад'],                    'deposit'],
  [['бв', 'баспана'],                       'bv'],
  [['гп', 'госпрем'],                       'gp'],
  [['дата'],                                'date'],
  [['этап', 'stage'],                       'stage'],
  [['сопровожд'],                           'accomp'],
]

function headerKey(h) {
  const s = cleanStr(h).toLowerCase()
  if (!s) return null
  for (const [aliases, key] of HEADER_MAP) {
    if (aliases.some(a => s.includes(a))) return key
  }
  return null
}

// rows — массив массивов (первая строка — заголовки). Возвращает clients[].
// pipeline — актуальная воронка (для колонки «Этап»); без неё — дефолтная.
export function clientsFromList(rows, pipeline) {
  if (!Array.isArray(rows) || rows.length < 2) return []
  const pl = Array.isArray(pipeline) && pipeline.length ? pipeline : PIPELINE_DEFAULT
  const header = rows[0].map(headerKey)
  const idx = {}
  header.forEach((k, i) => { if (k && idx[k] == null) idx[k] = i })
  if (idx.fio == null && idx.phone == null && idx.iin == null) return []

  const out = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || !row.length) continue
    const val = k => (idx[k] != null ? row[idx[k]] : '')
    const fio   = cleanStr(val('fio'))
    const phone = parsePhone(val('phone'))
    const iin   = parseIin(val('iin'))
    if (!fio && !phone && !iin) continue   // пустая строка

    const goal = cleanStr(val('goal'))
    const pkr  = cleanStr(val('pkr'))
    const note = [goal && 'Цель: ' + goal, pkr && 'ПКР: ' + pkr].filter(Boolean).join(' · ')
    // «Этап» — название или id этапа воронки; «Сопровождение» — «3/7 · Название» → индекс
    const stageRaw = cleanStr(val('stage')).toLowerCase()
    const stageId  = stageRaw
      ? (pl.find(p => p.id.toLowerCase() === stageRaw || String(p.l).toLowerCase() === stageRaw)?.id || '')
      : ''
    const accompM  = cleanStr(val('accomp')).match(/^(\d+)/)
    out.push(buildClient({
      fio, phone, iin,
      city:           cleanStr(val('city')) || undefined,
      officialIncome: parseMoney(val('income')),
      monthlyLoad:    parseMoney(val('load')),
      downPayment:    parseMoney(val('onhand')),
      depositAmount:  parseMoney(val('deposit')),
      note,
      stage:            stageId || undefined,
      accompStageIndex: accompM ? Math.max(0, parseInt(accompM[1], 10) - 1) : undefined,
    }))
  }
  return out
}

// ─── Общий сборщик клиента (частичный объект, накладывается на emptyClient) ──
function buildClient({ fio, iin, phone, city, officialIncome, monthlyLoad, downPayment, depositAmount, note, stage, accompStageIndex }) {
  const c = {
    fio: fio || '', iin: iin || '', phone: phone || '',
    source: 'other', stage: stage || 'new_lead',
    tags: ['импорт'],
  }
  if (accompStageIndex != null) c.accompStageIndex = accompStageIndex
  if (city)                     c.city = city
  if (officialIncome !== '' && officialIncome != null) c.officialIncome = String(officialIncome)
  if (monthlyLoad    !== '' && monthlyLoad    != null) c.monthlyLoad    = String(monthlyLoad)
  if (downPayment    !== '' && downPayment    != null) c.downPayment    = String(downPayment)
  if (depositAmount  !== '' && depositAmount  != null) c.depositAmount  = String(depositAmount)
  if (note) c.__note = note   // временное поле — импортёр превратит в комментарий
  return c
}
