// lib/mergeClients.js
// Слияние двух карточек-дублей в одну (чистая функция — тестируется юнитами).
// Правила: скалярные поля — у главного приоритет, пустые заполняются из дубля;
// списки (задачи, комментарии, теги, платежи, расчёты, кредиты) — объединяются;
// custom — объединение с приоритетом главного. В ленту — системная запись.

const EMPTY = v =>
  v === undefined || v === null || v === '' || v === 0 ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)

// Скаляры, которые заполняем из дубля, если у главного пусто
const FILL_KEYS = [
  'fio','iin','phone','city','manager','dateIn','source','contactStatus',
  'maritalStatus','children','officialIncome','extraIncome','pensionContributions',
  'workExperience','downPayment','depositBank','depositAmount','depositTerm',
  'otbasyReward','otbasyQueue','otbasyQueueYear','otbasyQueueCity',
  'creditsCount','monthlyLoad','reassignmentComplex','reassignmentDeveloper',
  'reassignmentAmount','mortgageBalance','reassignmentBank',
  'contractType','contractAmount','responsibleManager','mortgageSpecialist',
  'miroLink','roadmapLink','driveLink','driveFolderName','program','waMsgPreview',
]

const dedupById = arr => {
  const seen = new Set()
  return arr.filter(x => {
    const id = x && x.id
    if (!id) return true
    if (seen.has(id)) return false
    seen.add(id); return true
  })
}

export function mergeClients(primary, secondary, opts = {}) {
  const p = { ...primary }
  const s = secondary || {}

  for (const k of FILL_KEYS) {
    if (EMPTY(p[k]) && !EMPTY(s[k])) p[k] = s[k]
  }
  // Булевы флаги: истина побеждает
  for (const k of ['isWhatsApp','extraIncomeConfirmed','otbasyDeposit','hasOverdue',
    'hadBankRefusal','hasRefinancing','problematicCredits','courtRestrictions',
    'isReassignment','hasDebt','urgentSale']) {
    if (s[k]) p[k] = true
  }

  // Списки — объединение (дубль после главного), без повторов по id
  p.tasks      = dedupById([...(primary.tasks||[]),      ...(s.tasks||[])])
  p.comments   = dedupById([...(primary.comments||[]),   ...(s.comments||[])])
  p.payments   = dedupById([...(primary.payments||[]),   ...(s.payments||[])])
  p.savedCalcs = dedupById([...(primary.savedCalcs||[]), ...(s.savedCalcs||[])])
  p.credits    = [...(primary.credits||[]), ...(s.credits||[])]
  p.tags       = [...new Set([...(primary.tags||[]), ...(s.tags||[])])]

  // Объекты: приоритет главного
  p.custom       = { ...(s.custom||{}),       ...(primary.custom||{}) }
  p.reassStatus  = { ...(s.reassStatus||{}),  ...(primary.reassStatus||{}) }
  p.accompStages = EMPTY(primary.accompStages||{}) ? (s.accompStages||{}) : primary.accompStages

  // Системная запись в ленту
  p.comments = [...p.comments, {
    id: 'merge_' + Date.now(),
    text: `🔗 Объединён с дублем: ${s.fio || s.phone || s.id || ''}`.trim(),
    author: opts.userName || '',
    date: opts.date || new Date().toLocaleString('ru', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }),
    sys: true,
  }]

  return p
}
