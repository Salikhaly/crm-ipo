// lib/constants.js
// Общие константы и утилиты — вынесены из pages/index.js для переиспользования
// в features/. Чистые данные и функции без React.

// ─── Лимиты и интервалы ───────────────────────────────────────────────────────
export const WA_CHATS_POLL_MS    = 10_000
export const WA_MESSAGES_POLL_MS = 5_000
export const MIN_SEARCH_LENGTH   = 2
export const MAX_FILE_SIZE_BYTES = 32 * 1024 * 1024

// ─── Воронка ──────────────────────────────────────────────────────────────────
export const PIPELINE_DEFAULT = [
  { id: 'new_lead',      l: 'Новый лид',        c: '#6366f1' },
  { id: 'in_work',       l: 'Взят в работу',    c: '#0ea5e9' },
  { id: 'analysis',      l: 'Анализ',           c: '#f59e0b' },
  { id: 'consultation',  l: 'Консультация',      c: '#a855f7' },
  { id: 'contract',      l: 'Договор',           c: '#ec4899' },
  { id: 'accompaniment', l: 'Сопровождение',     c: '#14b8a6' },
  { id: 'approval',      l: 'Одобрение',         c: '#10b981' },
  { id: 'deal',          l: 'Сделка',            c: '#f97316' },
  { id: 'issuance',      l: 'Выдача ипотеки',    c: '#22c55e' },
  { id: 'closed',        l: 'Закрыто',           c: '#64748b' },
]

export const ACCOMP = [
  'Сбор документов','Проверка БКИ','Подготовка доходов','Выбор программы',
  'Подача заявки','Одобрение','Поиск квартиры','Оценка','Сделка','Выдача ипотеки','Закрытие'
]

export const CONTRACTS = [
  { id: 'full',        l: 'Сопровождение',               a: 600000  },
  { id: 'extra',       l: 'Доп. доход',                  a: 300000  },
  { id: 'search',      l: 'Поиск дома',                  a: 200000  },
  { id: 'full_extra',  l: 'Сопровождение + Доп. доход',  a: 900000  },
  { id: 'full_search', l: 'Сопровождение + Поиск',       a: 800000  },
  { id: 'full_all',    l: 'Полный пакет',                a: 1100000 },
  { id: 'online',      l: 'Онлайн сопровождение',        a: 400000  },
  { id: 'nauryz',      l: 'Наурыз',                      a: 0       },
  { id: '50_50',       l: '50/50',                       a: 0       },
  { id: '30_70',       l: '30/70',                       a: 0       },
  { id: 'rental',      l: 'Арендное жильё',              a: 0       },
  { id: 'otbasy',      l: 'Отбасы банк',                 a: 0       },
  { id: 'commercial',  l: 'Коммерческая ипотека',        a: 0       },
  { id: 'no_income',   l: 'Без подтвержд. дохода',       a: 0       },
]
export const CT = Object.fromEntries(CONTRACTS.map(c => [c.id, c]))

export const SRCS = [
  { id: 'instagram',      l: 'Instagram',    c: '#e1306c' },
  { id: 'tiktok',         l: 'TikTok',       c: '#010101' },
  { id: 'whatsapp',       l: 'WhatsApp',     c: '#25d366' },
  { id: 'recommendation', l: 'Рекомендация', c: '#f59e0b' },
  { id: 'site',           l: 'Сайт',         c: '#3b82f6' },
  { id: 'kaspi',          l: 'Kaspi',        c: '#ef4444' },
  { id: 'telegram',       l: 'Telegram',     c: '#0088cc' },
  { id: 'other',          l: 'Другое',       c: '#64748b' },
]
export const SRC = Object.fromEntries(SRCS.map(s => [s.id, s]))

export const CR_ST = [
  { id: 'good',      l: 'Хорошая',      c: '#10b981' },
  { id: 'medium',    l: 'Средняя',      c: '#f59e0b' },
  { id: 'bad',       l: 'Плохая',       c: '#ef4444' },
  { id: 'overdue',   l: 'Просрочки',    c: '#dc2626' },
  { id: 'current',   l: 'Тек.кредиты', c: '#f97316' },
  { id: 'microloans',l: 'Микрозаймы',  c: '#f97316' },
  { id: 'arrests',   l: 'Аресты',      c: '#991b1b' },
  { id: 'none',      l: 'Нет КИ',      c: '#64748b' },
]
export const CR = Object.fromEntries(CR_ST.map(c => [c.id, c]))

export const ROLES = [
  { id: 'admin',     l: 'Техник',         c: '#ef4444' },
  { id: 'head',      l: 'Руководитель',   c: '#8b5cf6' },
  { id: 'manager',   l: 'Менеджер',       c: '#3b82f6' },
  { id: 'specialist',l: 'Специалист',     c: '#14b8a6' },
]
export const ROLE = Object.fromEntries(ROLES.map(r => [r.id, r]))

export const CONTACT_ST = ['Дозвонился','Не отвечает','Перезвонить','Отказ','Думает','Назначена встреча']
export const CITIES     = ['Алматы','Астана','Шымкент','Актобе','Другой']
export const MARITAL    = ['Женат/Замужем','Холост/Не замужем','Разведён(а)','Вдовец/Вдова']
export const WORK_T     = [{ id:'official',l:'Официальная'},{ id:'ip',l:'ИП'},{ id:'self',l:'Самозанятый'},{ id:'none',l:'Без офиц.работы'}]
export const DOWN_T     = [{ id:'cash',l:'Наличка'},{ id:'deposit',l:'Депозит'},{ id:'mixed',l:'Смешанный'}]
export const TASK_T     = ['📞 Позвонить','📄 Запросить документы','📧 Отправить договор','🤝 Назначить встречу','🏦 Проверить депозит','📊 Проверить БКИ','✅ Другое']
export const COLORS     = ['#6366f1','#10b981','#f59e0b','#ec4899','#0ea5e9','#14b8a6','#ef4444','#8b5cf6','#f97316','#64748b']
export const TI         = { check:'ti-checkbox', ecp:'ti-writing-sign', doc:'ti-file-text' }
export const TC         = { check:'#64748b', ecp:'#8b5cf6', doc:'#0ea5e9' }
export const TB         = { check:'#f1f5f9', ecp:'#f5f3ff', doc:'#eff6ff' }
export const TL         = { check:'Пункт', ecp:'ЭЦП', doc:'Документ' }
export const PAY_ST     = {
  pending: { l:'Ожидает',   c:'#f59e0b', bg:'#fffbeb' },
  partial: { l:'Частично',  c:'#0ea5e9', bg:'#eff6ff' },
  paid:    { l:'Оплачено',  c:'#10b981', bg:'#f0fdf4' },
}

// ─── Утилиты ──────────────────────────────────────────────────────────────────
export const uid    = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
export const fmt    = n  => n ? new Intl.NumberFormat('ru').format(Math.round(n)) : '—'
// fmtN — как fmt, но с хвостовым пробелом (перед ₸ в шаблонах): "1 000 " / "— "
export const fmtN   = n  => n ? new Intl.NumberFormat('ru').format(Math.round(n)) + ' ' : '— '
export const today  = () => new Date().toISOString().split('T')[0]
export const nowStr = () => new Date().toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})

export function emptyClient(mid = '') {
  return {
    fio:'', phone:'', iin:'', city:'', birthDate:'',
    manager: mid, dateIn: today(), source:'instagram', stage:'new_lead',
    isWhatsApp: false, waMsgPreview:'', contactStatus:'',
    maritalStatus:'', children:'', officialIncome:'', extraIncome:'',
    extraIncomeConfirmed: false, pensionContributions:'', workExperience:'',
    workType:'official', downPayment:'', downPaymentType:'cash',
    depositBank:'', depositAmount:'', depositTerm:'',
    otbasyDeposit: false, otbasyReward:'', otbasyQueue:'',
    otbasyQueueYear:'', otbasyQueueCity:'',
    creditStatus:'good', hasOverdue: false, creditsCount:'', monthlyLoad:'',
    hadBankRefusal: false, hasRefinancing: false, problematicCredits: false,
    courtRestrictions: false, isReassignment: false, reassignmentComplex:'',
    reassignmentDeveloper:'', reassignmentAmount:'', mortgageBalance:'',
    reassignmentBank:'', hasDebt: false, urgentSale: false,
    contractType:'', contractAmount: 0, payments:[],
    responsibleManager:'', mortgageSpecialist:'', accompStageIndex: 0,
    accompStages:{}, miroLink:'', roadmapLink:'', driveLink:'',
    dealStepsDone: [], dealStepsNotes: {},
    driveFolderName:'', comments:[], tasks:[], savedCalcs:[],
    contracts5y:{}, contracts5yPlus:{},
    createdAt: new Date().toISOString(),
  }
}
