// lib/exportAnketa.js
// Экспорт клиентов CRM в форматы приложения ПКБ — зеркало lib/importAnketa.js.
//  1) Анкета ПКБ: карта «ячейка → значение» для заполнения public/pkb-template.xlsx
//     (те же ячейки, что читает импорт и пишет PKB app).
//  2) Список база_анкет.xlsx: строки с теми же заголовками, что понимает
//     clientsFromList() — файл ходит по кругу CRM ⇄ ПКБ без потерь.
// Модуль чистый (без ExcelJS/SheetJS) — тестируется юнитами.

const n = v => {
  const x = parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10)
  return isFinite(x) && x !== 0 ? x : null
}

// Достаёт «Цель: …», «ПКР: …» и т.п. из заметки импорта в ленте (если была)
function fromImportNote(c, label) {
  for (const cm of (c.comments || [])) {
    const t = String(cm.text || '')
    if (!t.includes('📥 Импорт')) continue
    const m = t.match(new RegExp(label + ':\\s*([^·]+)'))
    if (m) return m[1].trim()
  }
  return ''
}

// ─── 1. Анкета ПКБ: клиент → [{sheet, ref, value}] ──────────────────────────
// ctObj — CT[c.contractType] (передаётся снаружи, чтобы не тянуть constants)
export function anketaCells(c, { contractLabel = '', managerName = '' } = {}) {
  const cells = []
  const put = (sheet, ref, value) => { if (value !== null && value !== '' && value !== undefined) cells.push({ sheet, ref, value }) }

  put('Анкета', 'B5', c.fio || '')
  put('Анкета', 'B6', c.iin || '')
  put('Анкета', 'F6', c.phone || '')
  // Цель: из заметки импорта → тип договора → «ипотека»
  put('Анкета', 'H10', fromImportNote(c, 'Цель') || contractLabel || 'ипотека')
  const onhand = n(c.downPayment)
  if (onhand) { put('Анкета', 'G13', 'Нал. на руках:'); put('Анкета', 'H13', String(onhand)) }
  put('Анкета', 'E18', n(c.depositAmount) ? String(n(c.depositAmount)) : null)
  put('Анкета', 'B43', n(c.officialIncome) ? String(n(c.officialIncome)) : null)
  put('Анкета', 'A43', n(c.officialIncome) ? 'СРЗП' : null)

  // Кредитная история: если есть полный список (c.credits) — построчно,
  // как пишет PKB app; иначе нагрузка одной строкой-итогом
  const credits = Array.isArray(c.credits) ? c.credits : []
  const active  = credits.filter(k => k.status === 'active').slice(0, 18)
  const closed  = credits.filter(k => k.status === 'closed').slice(0, 10)
  if (active.length || closed.length) {
    active.forEach((k, i) => {
      const r = 6 + i
      put('Кредиты', 'B' + r, k.type || '')
      put('Кредиты', 'C' + r, k.creditor || '')
      put('Кредиты', 'D' + r, k.amount        ? String(k.amount)        : null)
      put('Кредиты', 'E' + r, k.payment       ? String(k.payment)       : null)
      put('Кредиты', 'F' + r, k.outstanding   ? String(k.outstanding)   : null)
      put('Кредиты', 'G' + r, k.overdueDays   ? String(k.overdueDays)   : null)
      put('Кредиты', 'H' + r, k.overdueAmount ? String(k.overdueAmount) : null)
    })
    closed.forEach((k, i) => {
      const r = 30 + i
      put('Кредиты', 'B' + r, k.creditor || '')
      put('Кредиты', 'D' + r, k.cessionary || null)
      put('Кредиты', 'F' + r, k.endDate || null)
      put('Кредиты', 'G' + r, k.overdueDays   ? String(k.overdueDays)   : null)
      put('Кредиты', 'H' + r, k.overdueAmount ? String(k.overdueAmount) : null)
    })
  } else {
    const load = n(c.monthlyLoad)
    if (load) {
      put('Кредиты', 'C6', 'По данным CRM (итого)')
      put('Кредиты', 'E6', String(load))
    }
  }
  return cells
}

// Имя файла анкеты: Анкета_Иванов_Иван.xlsx
export function anketaFileName(c) {
  const safe = String(c.fio || c.phone || 'клиент').replace(/[^\wА-Яа-яЁё\s-]/g, '').trim().replace(/\s+/g, '_')
  return `Анкета_${safe || 'клиент'}.xlsx`
}

// ─── 2. Список база_анкет.xlsx ───────────────────────────────────────────────
// Заголовки — как в PKB app (DB_HDR), их же распознаёт импорт clientsFromList.
export const BASE_HEADERS = ['Телефон','Дата','Менеджер','ФИО','ИИН','ПКР',
  'Нагрузка/мес','СРЗП','Цель','Нал. на руках','Депозит Н','Этап','Сопровождение','Тег']

// list — клиенты CRM; ctx: { mgrName(id), stageLabel(id), accompLabel(client) }
export function baseRows(list, ctx = {}) {
  const mgrName     = ctx.mgrName     || (() => '')
  const stageLabel  = ctx.stageLabel  || (id => id || '')
  const accompLabel = ctx.accompLabel || (() => '')
  const rows = [BASE_HEADERS]
  for (const c of list) {
    rows.push([
      c.phone || '', c.dateIn || '', mgrName(c.manager) || '',
      c.fio || '', c.iin || '', fromImportNote(c, 'ПКР'),
      n(c.monthlyLoad)    ?? '', n(c.officialIncome) ?? '',
      fromImportNote(c, 'Цель'),
      n(c.downPayment)    ?? '', n(c.depositAmount)  ?? '',
      stageLabel(c.stage), accompLabel(c) || '', (c.tags || []).join(', '),
    ])
  }
  return rows
}

// ─── 3. Лист «История» ───────────────────────────────────────────────────────
// «Что по чём сделано» по каждому клиенту: договор+сумма, оплаты (оплачено/
// осталось), сохранённые расчёты, закрытие, лента общения. Одно событие = строка,
// клиенты разделены. Этот лист НЕ читается импортом — только для чтения человеком.
export const HISTORY_HEADERS = ['Клиент', 'Телефон', 'Дата', 'Тип', 'Что сделано', 'Сумма ₸']

const money = v => {
  const x = Number(String(v ?? '').replace(/[^\d.-]/g, ''))
  return isFinite(x) && x !== 0 ? x : ''
}
// Дата из ISO/строки в дд.мм.гггг; если пусто — как есть
const dmy = v => {
  if (!v) return ''
  const d = new Date(v)
  if (isNaN(d)) return String(v)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ctx: { mgrName(id), stageLabel(id), contractLabel(id) }
export function historyRows(list, ctx = {}) {
  const stageLabel    = ctx.stageLabel    || (id => id || '')
  const contractLabel = ctx.contractLabel || (id => id || '')
  const rows = [HISTORY_HEADERS]
  const PAY_ST = { paid: 'оплачено', partial: 'частично', pending: 'ожидает' }

  for (const c of list) {
    const who   = c.fio || c.phone || '—'
    const phone = c.phone || ''
    const start = rows.length
    const line = (date, type, what, sum) => rows.push([who, phone, dmy(date), type, what, sum === '' || sum == null ? '' : sum])

    // Договор — что оформили и на сколько
    if (c.contractType || c.contractAmount) {
      line(c.dateIn, 'Договор', contractLabel(c.contractType) || c.contractType || '—', money(c.contractAmount))
    }
    // Оплаты — что по чём внесено / осталось
    for (const p of (c.payments || [])) {
      const st  = PAY_ST[p.status] || p.status || ''
      const amt = p.status === 'paid' || p.status === 'partial' ? money(p.paidAmount) : money(p.amount)
      line(p.paidDate || '', 'Оплата', `${p.name || 'платёж'} — ${st}`, amt)
    }
    // Сохранённые расчёты — какие суммы считали
    for (const s of (c.savedCalcs || [])) {
      const detail = [s.program, s.price ? `цена ${money(s.price)}` : '', s.loan ? `кредит ${money(s.loan)}` : '', s.monthly ? `платёж ${money(s.monthly)}/мес` : '']
        .filter(Boolean).join(', ')
      line(s.date, 'Расчёт', detail || 'расчёт', money(s.price || s.maxPrice || s.loan))
    }
    // Закрытие
    if (c.closeReason) line(c.closedAt || '', 'Закрытие', c.closeReason, '')
    // Лента общения (комментарии) — только видимые записи менеджера
    for (const cm of (c.comments || [])) {
      const t = String(cm.text || '').replace(/\s+/g, ' ').trim()
      if (!t) continue
      line(cm.date || cm.createdAt, cm.sys ? 'Система' : 'Комментарий', t.slice(0, 300), '')
    }

    // Если у клиента вообще ничего нет — одна строка со статусом, чтобы он не потерялся
    if (rows.length === start) line(c.dateIn, 'Статус', 'этап: ' + stageLabel(c.stage), '')
    // Пустая строка-разделитель между клиентами
    rows.push(['', '', '', '', '', ''])
  }
  return rows
}
