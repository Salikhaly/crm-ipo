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
