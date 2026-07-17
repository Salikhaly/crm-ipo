// lib/calcEngine.js
// Полный движок калькулятора — порт из Google Apps Script
// Все алгоритмы идентичны оригиналу

// ─── ИПОТЕЧНЫЕ ПРОГРАММЫ (дефолт, если нет в БД) ─────────────────────────────
// downRatio — взнос как доля от ЦЕНЫ КВАРТИРЫ
// coeff     — коэффициент аннуитета считается ОТ ЦЕНЫ (не от кредита!)
//             payment / coeff = maxPrice (цена квартиры — потолок)
//             credit = maxPrice * (1 - downRatio)
//             down   = maxPrice * downRatio
export const DEFAULT_PROGRAMS = {
  '5050':     { key:'5050',     name:'Ипотека 50/50',      icon:'🏛️', downRatio:0.50, desc:'Взнос 50%',  variants:[{label:'8.5% — 8 лет',coeff:0.0080522},{label:'5% — 6 лет',coeff:0.0080525}] },
  '3070':     { key:'3070',     name:'Программа 30/70',    icon:'🏠', downRatio:0.30, desc:'Взнос 30%',  variants:[{label:'~10-12 лет',  coeff:0.00886788}] },
  'nauryz20': { key:'nauryz20', name:'Наурыз (взнос 20%)', icon:'🌸', downRatio:0.20, desc:'Взнос 20%',  variants:[{label:'7% — 19 лет', coeff:0.00843335},{label:'9% — 19 лет',coeff:0.0101}] },
  'nauryz10': { key:'nauryz10', name:'Наурыз (взнос 10%)', icon:'🌷', downRatio:0.10, desc:'Взнос 10%',  variants:[{label:'7% — 19 лет', coeff:0.00943335},{label:'9% — 19 лет',coeff:0.0111}] },
  'jasyl':    { key:'jasyl',    name:'Жасыл Ипотека',      icon:'🌿', downRatio:0.20, desc:'Взнос 20%',  variants:[{label:'7% очередники',coeff:0.00783333},{label:'11% военные',coeff:0.01116667},{label:'15% все',coeff:0.01241667}] },
  'askeri':   { key:'askeri',   name:'Наурыз Аскери',      icon:'🎖️', downRatio:0.00, desc:'Взнос 0%',   variants:[{label:'1-8 лет',     coeff:0.0127},{label:'9-19 лет',coeff:0.00376}] },
}

// ─── Хелпер: из maxPrice (цены квартиры) вычислить взнос и сумму кредита ────
// coeff в программах считается ОТ ЦЕНЫ квартиры, поэтому:
//   payment / coeff = maxPrice  (цена квартиры — потолок)
//   down            = maxPrice * downRatio   (взнос)
//   credit          = maxPrice * (1-downRatio) (реальный кредит банка)
export function calcDownAndCredit(maxPrice, prog) {
  const down   = Math.round(maxPrice * prog.downRatio)
  const credit = maxPrice - down
  return { down, credit }
}

// ─── НАСТРОЙКИ ПО УМОЛЧАНИЮ ───────────────────────────────────────────────────
export const DEFAULT_CFG = {
  mrp:      4325,
  pmNauryz: 10,
  pmOther:  13,
  kd: { p1:40, p2:65, p3:90, v1:0.40, v2:0.50, v3:0.60, v4:0.70 },
  programs: DEFAULT_PROGRAMS,
  nauryzKeys: ['nauryz10','nauryz20'],
}

// ─── КД из настроек (итерационно) ────────────────────────────────────────────
export function getKd(income, cfg) {
  const r = income / cfg.mrp
  if (r <= cfg.kd.p1) return cfg.kd.v1
  if (r <= cfg.kd.p2) return cfg.kd.v2
  if (r <= cfg.kd.p3) return cfg.kd.v3
  return cfg.kd.v4
}

// ─── Прожиточный минимум для программы ───────────────────────────────────────
export function getPm(programKey, cfg, members = 1) {
  const safeMembers = Math.max(1, Math.round(+members) || 1)
  const isNauryz = cfg.nauryzKeys.includes(programKey)
  return cfg.mrp * (isNauryz ? cfg.pmNauryz : cfg.pmOther) * safeMembers
}

// ─── Средняя ЗП из истории ОПВ ───────────────────────────────────────────────
// Алгоритм: ОПВ * 7.9/6 с отсечением min/max при n >= 3
// Формула рассчитана на окно банка в 6 месяцев: при n < 6 недостающие месяцы
// фактически считаются нулями (делитель 6). При n > 6 делим на n — иначе
// ввод 12 месяцев ОПВ завышал среднюю ЗП в ~1.5 раза.
export function avgSalary(opvList) {
  const list = opvList.map(Number).filter(v => isFinite(v) && v > 0)
  if (!list.length) return 0
  const n   = list.length
  const sum = list.reduce((a, b) => a + b, 0)
  const s1  = sum * 7.9 / Math.max(6, n)
  // При n < 3 отсечение min/max невозможно — результат менее надёжен
  // (банки обычно требуют минимум 3 месяца для корректного расчёта)
  if (n < 3) return Math.round(s1)
  const mx = Math.max(...list)
  const mn = Math.min(...list)
  return Math.round((s1 + (sum - mx - mn) * 7.9 / (n - 2)) / 2)
}

// Возвращает true если истории ОПВ недостаточно для надёжного расчёта
export function isOpvInsufficient(opvList) {
  const list = opvList.map(Number).filter(v => isFinite(v) && v > 0)
  return list.length < 3
}

// ─── Налоговые константы (дефолт; правятся в админке → calc_settings.tax_config) ─
export const DEFAULT_TAX = {
  vosmsCap:     34000,    // потолок ВОСМС (2%)
  soRate:       0.045,    // СО от зарплаты
  soCap:        29750,    // потолок СО
  ipnDeduction: 129750,   // вычет ИПН (30 МРП)
  ipnThreshold: 147444,   // порог: до этой ЗП ИПН = 0 (Трудовой)
  workFee:      15000,    // работа / услуга бухгалтера
}

// ─── Расчёт всех налогов и взносов ───────────────────────────────────────────
// taxCfg — переопределения из админки (частичные), поверх DEFAULT_TAX
export function calcTax(salary, type, taxCfg) {
  const T = { ...DEFAULT_TAX, ...(taxCfg || {}) }
  const opv   = Math.round(salary * 0.10)
  const vosms = Math.min(Math.round(salary * 0.02), +T.vosmsCap)
  const so    = Math.min(Math.round(salary * +T.soRate), +T.soCap)
  const work  = +T.workFee
  let ipn, opvr, oosms

  if (type === 'Трудовой') {
    ipn   = salary <= +T.ipnThreshold ? 0 : Math.max(0, Math.round((salary * 0.9 - salary * 0.02 - +T.ipnDeduction) * 0.10))
    opvr  = Math.round(salary * 0.035)
    oosms = Math.round(salary * 0.03)
  } else {
    ipn   = Math.max(0, Math.round((salary * 0.9 - vosms - so) * 0.10))
    opvr  = 0
    oosms = 0
  }

  return {
    opv, vosms, so, ipn, opvr, oosms, work,
    // «Сколько останется на руки»: зарплата минус удержания РАБОТНИКА
    // (ОПВ, ВОСМС, СО, ИПН). ОПВР/ООСМС платит работодатель, работа — расход фирмы.
    net:   Math.max(0, salary - opv - vosms - so - ipn),
    total: opv + vosms + so + ipn + opvr + oosms + work,
  }
}

// ─── Разбивка для бухгалтера ─────────────────────────────────────────────────
export function buildBreakdown(salary, type, taxCfg) {
  const t   = calcTax(salary, type, taxCfg)
  const isT = type === 'Трудовой'
  const held      = t.opv + t.vosms + t.so + t.ipn      // удержания с зарплаты работника
  const extra     = (isT ? t.opvr + t.oosms : 0) + t.work // сверх зарплаты (работодатель + бухгалтер)
  const fullCost  = salary + extra                       // полная стоимость оформления
  return [
    // Группа 1 — балансирует: Начислено = Удержано + На руки
    { label: 'Начислено (зарплата)',            val: salary, isGross: true },
    { label: '— ОПВ (10%)',                     val: t.opv,  isDed: true },
    { label: '— ВОСМС (2%)',                    val: t.vosms, isDed: true },
    { label: '— СО',                            val: t.so,   isDed: true },
    { label: '— ИПН',                           val: t.ipn,  isDed: true },
    { label: 'Удержано с зарплаты',             val: held,   isSub: true },
    { label: '💵 На руки (Начислено − Удержано)', val: t.net, isNet: true },
    // Группа 2 — расходы СВЕРХ зарплаты (не уменьшают «на руки»)
    ...(isT ? [
      { label: 'ОПВР (сверху, работодатель)',   val: t.opvr,  isExtra: true },
      { label: 'ООСМС (сверху, работодатель)',  val: t.oosms, isExtra: true },
    ] : []),
    { label: 'Услуги бухгалтера (фикс.)',       val: t.work,  isExtra: true },
    { label: 'Полная стоимость оформления',     val: fullCost, isTotal: true },
  ]
}

// ─── Максимальный платёж по доходам ──────────────────────────────────────────
export function calcMaxPayment(orgs, members, programKey, cfg) {
  const totalIncome    = orgs.reduce((a, o) => a + (Number(o.income)    || 0), 0)
  const totalOldCredit = orgs.reduce((a, o) => a + (Number(o.oldCredit) || 0), 0)
  const pm = getPm(programKey, cfg, members)

  // КД определяется только по доходу — итерация не нужна
  const kd = getKd(totalIncome, cfg)

  const method1    = Math.round(totalIncome * kd - totalOldCredit)
  const method2    = Math.round(totalIncome - totalIncome * 0.10 - pm - totalOldCredit)
  const maxPayment = Math.min(method1, method2)

  return { totalIncome, totalOldCredit, kd, pm, method1, method2, maxPayment, approved: maxPayment > 0 }
}

// ─── Нужная ЗП для заданного платежа ─────────────────────────────────────────
export function calcReqSalary(monthly, oldCredit, pm, cfg) {
  const reqCSD = Math.round((monthly + pm + oldCredit) / 0.9)

  // КД зависит только от дохода — итерируем по reqOD до сходимости
  let kd    = 0.70
  let reqOD = Math.round((monthly + oldCredit) / kd)
  for (let iter = 0; iter < 20; iter++) {
    const newKd   = getKd(reqOD, cfg)
    const newReqOD = Math.round((monthly + oldCredit) / newKd)
    if (Math.abs(newReqOD - reqOD) < 1) { kd = newKd; reqOD = newReqOD; break }
    kd    = newKd
    reqOD = newReqOD
  }

  return {
    reqCSD,
    reqOD,
    reqSalary: Math.max(reqCSD, reqOD),
    kd,
  }
}

// ─── Бинарный поиск нужного ОПВ за N месяцев ─────────────────────────────────
export function findNeededOpv(existing, target, addMonths) {
  if (target <= 0 || addMonths <= 0) return null
  let lo = 0
  let hi = target * 0.25

  for (let i = 0; i < 80; i++) {
    const mid  = (lo + hi) / 2
    const list = [...existing]
    for (let j = 0; j < addMonths; j++) list.push(mid)
    if (avgSalary(list) < target) lo = mid
    else hi = mid
    if (Math.abs(hi - lo) < 0.5) break
  }

  const opvPerMonth = Math.round((lo + hi) / 2)
  const check = [...existing]
  for (let k = 0; k < addMonths; k++) check.push(opvPerMonth)

  return {
    opvPerMonth,
    achievedSalary: avgSalary(check),
  }
}

// ─── OPV план на 1-6 месяцев ─────────────────────────────────────────────────
export function buildOpvPlan(existing, targetSalary) {
  return Array.from({ length: 6 }, (_, i) => {
    const n    = i + 1
    const plan = findNeededOpv(existing, targetSalary, n)
    return {
      months:      n,
      opvPerMonth: plan ? plan.opvPerMonth : null,
      achieved:    plan ? plan.achievedSalary : null,
      totalCost:   plan ? plan.opvPerMonth * n : null,
    }
  })
}

// ─── ГЛАВНЫЙ РАСЧЁТ: по цене квартиры ────────────────────────────────────────
export function calcMortgageByPrice(payload, cfg = DEFAULT_CFG) {
  const { program: progKey, price, members = 1, orgs = [], existingOpv = [] } = payload
  const prog = cfg.programs[progKey]
  if (!prog) return { ok: false, message: 'Программа не найдена' }

  const calc = calcMaxPayment(orgs, members, progKey, cfg)

  // Варианты по цене
  const variantsByPrice = price > 0 ? prog.variants.map(v => {
    const monthly  = Math.round(price * v.coeff)
    const down     = Math.round(price * prog.downRatio)
    const pm       = getPm(progKey, cfg, members)
    const req      = calcReqSalary(monthly, calc.totalOldCredit, pm, cfg)
    const opvPlan  = buildOpvPlan(existingOpv.map(Number).filter(v => isFinite(v) && v > 0), req.reqSalary)

    return {
      label:          v.label,
      monthly,
      downPayment:    down,
      loanAmount:     price - down,
      requiredSalary: req.reqSalary,
      reqByOD:        req.reqOD,
      reqByCSD:       req.reqCSD,
      kd:             req.kd,
      canAfford:      calc.approved && monthly <= calc.maxPayment,
      opvPlan,
    }
  }) : null

  // Варианты по зарплате
  const variantsBySalary = calc.approved && calc.maxPayment > 0 ? prog.variants.map(v => {
    const maxPrice           = Math.round(calc.maxPayment / v.coeff)  // coeff от ЦЕНЫ
    const { down, credit }   = calcDownAndCredit(maxPrice, prog)
    return {
      label:       v.label,
      maxMonthly:  calc.maxPayment,
      maxPrice,                   // цена квартиры
      maxLoan:     credit,        // реальный кредит
      downPayment: down,
      method1:     calc.method1,
      method2:     calc.method2,
      kd:          calc.kd,
      pm:          calc.pm,
    }
  }) : null

  // Сравнение всех программ
  const comparison = price > 0 ? Object.values(cfg.programs).map(p => {
    const v0      = p.variants[0]
    const monthly = Math.round(price * v0.coeff)
    const pm      = getPm(p.key, cfg, members)
    const req     = calcReqSalary(monthly, calc.totalOldCredit, pm, cfg)
    return {
      key:            p.key,
      name:           p.name,
      icon:           p.icon,
      downPayment:    Math.round(price * p.downRatio),
      monthly,
      requiredSalary: req.reqSalary,
      reqByOD:        req.reqOD,
      reqByCSD:       req.reqCSD,
      canAfford:      calc.approved && monthly <= calc.maxPayment,
    }
  }).sort((a, b) => a.monthly - b.monthly) : null

  return {
    ok: true,
    calc,
    variantsByPrice,
    variantsBySalary,
    comparison,
    prog: { name: prog.name, icon: prog.icon, downRatio: prog.downRatio },
  }
}

// ─── РАСЧЁТ: по зарплате ─────────────────────────────────────────────────────
export function calcMortgageBySalary(payload, cfg = DEFAULT_CFG) {
  const { program: progKey, salary, members = 1, oldCredit = 0 } = payload
  const prog = cfg.programs[progKey]
  if (!prog) return { ok: false, message: 'Программа не найдена' }

  const orgs = [{ income: salary, oldCredit }]
  const calc = calcMaxPayment(orgs, members, progKey, cfg)

  if (!calc.approved || calc.maxPayment <= 0) {
    return { ok: true, approved: false, maxPayment: 0, maxLoan: 0, maxPrice: 0, down: 0, ...calc, prog }
  }

  const v0                  = prog.variants[0]
  const maxPrice            = Math.round(calc.maxPayment / v0.coeff)  // coeff от ЦЕНЫ
  const { down, credit }    = calcDownAndCredit(maxPrice, prog)

  return {
    ok:          true,
    approved:    true,
    program:     progKey,
    programName: prog.name,
    icon:        prog.icon,
    maxPayment:  calc.maxPayment,
    maxPrice,                    // цена квартиры (потолок)
    maxLoan:     credit,         // реальный кредит = цена - взнос
    down,                        // первый взнос
    payment:     calc.maxPayment,
    rate:        v0.label,
    members,
    oldCredit,
    pm:          calc.pm,
    kd:          calc.kd,
    totalIncome: calc.totalIncome,
    method1:     calc.method1,
    method2:     calc.method2,
    downRatio:   prog.downRatio,
  }
}

// ─── РАСЧЁТ: одобрение банка ─────────────────────────────────────────────────
export function calcBankApproval(payload, cfg = DEFAULT_CFG) {
  const { orgs: rawOrgs = [], members = 1, program = '' } = payload

  const orgs = rawOrgs.map(o => {
    if (o.mode === 'opv' && o.opvMonths?.length) {
      const list = o.opvMonths.map(Number).filter(v => isFinite(v) && v > 0)
      // avgSalary принимает суммы ОПВ напрямую (внутри уже заложен коэффициент 7.9).
      // Раньше ОПВ сначала делили на 0.10 (переводили в зарплату) и потом
      // прогоняли через avgSalary — доход завышался в 10 раз.
      return { income: list.length ? avgSalary(list) : 0, oldCredit: Number(o.oldCredit) || 0 }
    }
    return { income: Number(o.income) || 0, oldCredit: Number(o.oldCredit) || 0 }
  })

  const calc = calcMaxPayment(orgs, members, program, cfg)

  const allPrograms = calc.approved
    ? Object.values(cfg.programs).map(p => {
        const v0               = p.variants[0]
        const maxPrice         = Math.round(calc.maxPayment / v0.coeff)  // coeff от ЦЕНЫ
        const { down, credit } = calcDownAndCredit(maxPrice, p)
        return {
          key:         p.key,
          name:        p.name,
          icon:        p.icon,
          downRatio:   p.downRatio,
          maxPrice,               // цена квартиры
          maxLoan:     credit,    // реальный кредит
          downPayment: down,
        }
      }).sort((a, b) => b.maxPrice - a.maxPrice)
    : []

  return {
    ok:              true,
    totalIncome:     calc.totalIncome,
    totalOldCredit:  calc.totalOldCredit,
    kd:              calc.kd,
    pm:              calc.pm,
    mrp:             cfg.mrp,
    method1:         calc.method1,
    method2:         calc.method2,
    maxPayment:      calc.maxPayment,
    approved:        calc.approved,
    members,
    allPrograms,
  }
}

// ─── РАСЧЁТ ОПВ — вариативный ────────────────────────────────────────────────
// Алгоритм расчёта средней ЗП (avgSalary) и плана (buildOpvPlan) не менялся —
// меняется только форма возвращаемого объекта, на которую опирается фронтенд
// (CalcOpvTab читает result.result.currentAvg / .target / .gap / .plan / .buh)
export function calcOpvVar(payload, taxCfg) {
  const { type, salary = 0, target = 0, opv12 = [] } = payload
  const opvList = opv12.map(Number).filter(v => isFinite(v) && v > 0)
  const avgSal  = opvList.length ? avgSalary(opvList) : 0
  const buh     = salary > 0 && type ? buildBreakdown(salary, type, taxCfg) : null
  const plan    = target > 0 && target > avgSal ? buildOpvPlan(opvList, target) : null

  return {
    ok: true,
    result: {
      currentAvg: avgSal,
      target,
      gap: Math.max(0, target - avgSal),
      plan,
      buh,
    },
  }
}

// ─── РАСЧЁТ ОПВ — равномерный ────────────────────────────────────────────────
const EQ_COEFF = { 3: 0.1688, 4: 0.1519, 5: 0.1381, 6: 0.1266 }

export function calcOpvEq(payload, taxCfg) {
  const { type, income = 0, months = 0, salary = 0 } = payload
  let payments = [], avgSal = 0

  if (income > 0 && EQ_COEFF[months]) {
    const mo = Math.round(income * EQ_COEFF[months])
    payments  = Array(months).fill(mo)
    avgSal    = avgSalary(payments)
  }

  const buh = salary > 0 && type ? buildBreakdown(salary, type, taxCfg) : null

  return {
    ok: true,
    result: {
      payments,
      currentAvg: avgSal,
      target: 0,
      gap: 0,
      plan: null,
      buh,
    },
  }
}

// ─── РАСЧЁТ: бухгалтер ───────────────────────────────────────────────────────
export function calcBuh(payload, taxCfg) {
  const { type, salary = 0 } = payload
  if (!type || !salary) return { ok: false, message: 'Укажите тип и зарплату' }
  return { ok: true, breakdown: buildBreakdown(salary, type, taxCfg) }
}

// ─── СЦЕНАРИЙ ────────────────────────────────────────────────────────────────
export function calcScenario(payload, taxCfg) {
  const { type = 'Трудовой', existing = [], target = 300000 } = payload
  const existingList = existing.map(Number).filter(v => isFinite(v) && v > 0)
  const cur          = existingList.length ? avgSalary(existingList) : 0

  const plan = Array.from({ length: 6 }, (_, i) => {
    const n = i + 1
    const r = findNeededOpv(existingList, target, n)
    return {
      months:      n,
      opvPerMonth: r ? r.opvPerMonth : null,
      achieved:    r ? r.achievedSalary : null,
      totalCost:   r ? r.opvPerMonth * n : null,
    }
  })

  const bd   = buildBreakdown(target, type, taxCfg)
  const best = plan.reduce((b, p) => (!b || (p.totalCost && p.totalCost < b.totalCost)) ? p : b, null)

  return {
    ok: true,
    result: { target, currentAvg: cur, gap: Math.max(0, target - cur), plan, breakdown: bd, best },
  }
}
