// __tests__/lib/calcEngine.test.js
const {
  avgSalary, calcTax, buildBreakdown, getKd,
  calcMaxPayment, calcReqSalary, findNeededOpv, buildOpvPlan,
  calcMortgageByPrice, calcMortgageBySalary, calcBankApproval,
  calcOpvVar, calcOpvEq, calcBuh, calcScenario,
  DEFAULT_CFG,
} = require('../../lib/calcEngine')

describe('avgSalary', () => {
  test('1 ОПВ → прямой расчёт', () => {
    const result = avgSalary([30000])
    expect(result).toBeGreaterThan(0)
    expect(result).toBe(Math.round(30000 * 7.9 / 6))
  })

  test('< 3 записей — без отсечения', () => {
    expect(avgSalary([20000, 40000])).toBe(Math.round((20000+40000) * 7.9 / 6))
  })

  test('>= 3 записей — с отсечением min/max', () => {
    const list   = [10000, 20000, 30000, 40000, 50000]
    const result = avgSalary(list)
    expect(result).toBeGreaterThan(0)
    // Должен быть меньше без-отсечения варианта
    const naive = Math.round(list.reduce((a,b)=>a+b,0) * 7.9 / 6)
    expect(result).not.toBe(naive)
  })

  test('пустой список → 0', () => {
    expect(avgSalary([])).toBe(0)
  })

  test('фильтрует нули и отрицательные', () => {
    expect(avgSalary([0, -100, 30000])).toBe(Math.round(30000 * 7.9 / 6))
  })

  test('6 равных месяцев → ровно ОПВ × 7.9', () => {
    expect(avgSalary(Array(6).fill(30000))).toBe(Math.round(30000 * 7.9))
  })

  test('12 равных месяцев НЕ завышают ЗП (делитель = n при n > 6)', () => {
    // Раньше: (12P·7.9/6 + 7.9P)/2 = 11.85P — завышение в 1.5 раза
    expect(avgSalary(Array(12).fill(30000))).toBe(Math.round(30000 * 7.9))
  })
})

describe('calcTax — Трудовой', () => {
  test('ОПВ = 10%', () => {
    const t = calcTax(300000, 'Трудовой')
    expect(t.opv).toBe(30000)
  })

  test('ВОСМС ≤ 34000', () => {
    const t = calcTax(2000000, 'Трудовой')
    expect(t.vosms).toBe(34000)
  })

  test('СО ≤ 29750', () => {
    const t = calcTax(2000000, 'Трудовой')
    expect(t.so).toBe(29750)
  })

  test('work = 15000 всегда', () => {
    expect(calcTax(100000, 'Трудовой').work).toBe(15000)
    expect(calcTax(500000, 'ГПХ').work).toBe(15000)
  })

  test('ОПВР и ООСМС есть только у Трудового', () => {
    const t = calcTax(300000, 'Трудовой')
    const g = calcTax(300000, 'ГПХ')
    expect(t.opvr).toBeGreaterThan(0)
    expect(t.oosms).toBeGreaterThan(0)
    expect(g.opvr).toBe(0)
    expect(g.oosms).toBe(0)
  })

  test('ИПН = 0 при зарплате до 147444 (Трудовой)', () => {
    expect(calcTax(147444, 'Трудовой').ipn).toBe(0)
    expect(calcTax(147445, 'Трудовой').ipn).toBeGreaterThanOrEqual(0)
  })

  test('total = сумма всех компонентов', () => {
    const t = calcTax(300000, 'Трудовой')
    expect(t.total).toBe(t.opv + t.vosms + t.so + t.ipn + t.opvr + t.oosms + t.work)
  })
})

describe('getKd', () => {
  test('малый доход → KD = v1 (0.40)', () => {
    expect(getKd(100000, DEFAULT_CFG)).toBe(0.40)
  })

  test('большой доход → KD = v4 (0.70)', () => {
    expect(getKd(1000000, DEFAULT_CFG)).toBe(0.70)
  })

  test('КД растёт с доходом', () => {
    const k1 = getKd(100000, DEFAULT_CFG)
    const k2 = getKd(300000, DEFAULT_CFG)
    const k3 = getKd(500000, DEFAULT_CFG)
    expect(k1).toBeLessThanOrEqual(k2)
    expect(k2).toBeLessThanOrEqual(k3)
  })
})

describe('calcMaxPayment', () => {
  test('нулевой доход → не одобрен', () => {
    const r = calcMaxPayment([{income:0, oldCredit:0}], 1, 'nauryz20', DEFAULT_CFG)
    expect(r.approved).toBe(false)
  })

  test('высокий доход → одобрен', () => {
    const r = calcMaxPayment([{income:500000, oldCredit:0}], 1, 'nauryz20', DEFAULT_CFG)
    expect(r.approved).toBe(true)
    expect(r.maxPayment).toBeGreaterThan(0)
  })

  test('старый кредит уменьшает maxPayment', () => {
    const without = calcMaxPayment([{income:500000, oldCredit:0}],    1, 'nauryz20', DEFAULT_CFG)
    const with_   = calcMaxPayment([{income:500000, oldCredit:50000}], 1, 'nauryz20', DEFAULT_CFG)
    expect(with_.maxPayment).toBeLessThan(without.maxPayment)
  })

  test('несколько заёмщиков суммируют доходы', () => {
    const single = calcMaxPayment([{income:300000, oldCredit:0}],  1, 'nauryz20', DEFAULT_CFG)
    const double = calcMaxPayment([{income:300000, oldCredit:0},{income:200000, oldCredit:0}], 1, 'nauryz20', DEFAULT_CFG)
    expect(double.maxPayment).toBeGreaterThan(single.maxPayment)
  })

  test('maxPayment = min(method1, method2)', () => {
    const r = calcMaxPayment([{income:500000, oldCredit:0}], 1, 'nauryz20', DEFAULT_CFG)
    expect(r.maxPayment).toBe(Math.min(r.method1, r.method2))
  })
})

describe('findNeededOpv', () => {
  test('находит ОПВ для достижения целевой ЗП', () => {
    const result = findNeededOpv([], 300000, 3)
    expect(result).not.toBeNull()
    expect(result.opvPerMonth).toBeGreaterThan(0)
    expect(result.achievedSalary).toBeGreaterThanOrEqual(299000)
  })

  test('с существующей историей нужно меньше', () => {
    const withHistory    = findNeededOpv([28000, 29000, 30000], 300000, 3)
    const withoutHistory = findNeededOpv([], 300000, 3)
    expect(withHistory.opvPerMonth).toBeLessThan(withoutHistory.opvPerMonth)
  })

  test('нулевой target → null', () => {
    expect(findNeededOpv([], 0, 3)).toBeNull()
  })

  test('нулевые месяцы → null', () => {
    expect(findNeededOpv([], 300000, 0)).toBeNull()
  })
})

describe('calcMortgageByPrice', () => {
  test('несуществующая программа → ok:false', () => {
    const r = calcMortgageByPrice({ program:'nonexistent', price:20000000, orgs:[] })
    expect(r.ok).toBe(false)
  })

  test('возвращает variantsByPrice при указании цены', () => {
    const r = calcMortgageByPrice({
      program: 'nauryz20',
      price:   25000000,
      members: 1,
      orgs:    [{ income: 500000, oldCredit: 0 }],
    })
    expect(r.ok).toBe(true)
    expect(Array.isArray(r.variantsByPrice)).toBe(true)
    expect(r.variantsByPrice.length).toBeGreaterThan(0)
  })

  test('каждый вариант содержит ключевые поля', () => {
    const r = calcMortgageByPrice({
      program: 'nauryz20', price: 25000000, members: 1,
      orgs: [{ income: 500000, oldCredit: 0 }],
    })
    const v = r.variantsByPrice[0]
    expect(v.monthly).toBeGreaterThan(0)
    expect(v.downPayment).toBe(Math.round(25000000 * 0.20))
    expect(v.loanAmount).toBe(25000000 - v.downPayment)
    expect(typeof v.canAfford).toBe('boolean')
    expect(Array.isArray(v.opvPlan)).toBe(true)
  })

  test('comparison содержит все программы', () => {
    const r = calcMortgageByPrice({
      program: 'nauryz20', price: 25000000, members: 1,
      orgs: [{ income: 500000, oldCredit: 0 }],
    })
    expect(r.comparison.length).toBe(Object.keys(DEFAULT_CFG.programs).length)
  })

  test('comparison отсортирован по платежу', () => {
    const r = calcMortgageByPrice({
      program: 'nauryz20', price: 25000000, members: 1,
      orgs: [{ income: 500000, oldCredit: 0 }],
    })
    for (let i = 1; i < r.comparison.length; i++) {
      expect(r.comparison[i].monthly).toBeGreaterThanOrEqual(r.comparison[i-1].monthly)
    }
  })
})

describe('calcMortgageBySalary', () => {
  test('очень низкая ЗП → approved:false', () => {
    // При ЗП 40000: method2 = 40000 - 4000 - 43250 = -7250 → rejected
    const r = calcMortgageBySalary({ program:'nauryz20', salary:40000, members:1, oldCredit:0 })
    expect(r.ok).toBe(true)
    expect(r.approved).toBe(false)
  })

  test('высокая ЗП → approved:true с суммами', () => {
    const r = calcMortgageBySalary({ program:'nauryz20', salary:500000, members:1, oldCredit:0 })
    expect(r.approved).toBe(true)
    expect(r.maxPrice).toBeGreaterThan(0)
    expect(r.maxLoan).toBeGreaterThan(0)
    expect(r.down).toBeGreaterThan(0)
    expect(r.down).toBe(Math.round(r.maxPrice * 0.20))
  })
})

describe('calcBankApproval', () => {
  test('возвращает все программы при одобрении', () => {
    const r = calcBankApproval({ orgs:[{income:600000, oldCredit:0}], members:1 })
    expect(r.ok).toBe(true)
    expect(r.approved).toBe(true)
    expect(r.allPrograms.length).toBeGreaterThan(0)
  })

  test('allPrograms отсортированы по maxPrice убывающие', () => {
    const r = calcBankApproval({ orgs:[{income:600000, oldCredit:0}], members:1 })
    for (let i = 1; i < r.allPrograms.length; i++) {
      expect(r.allPrograms[i].maxPrice).toBeLessThanOrEqual(r.allPrograms[i-1].maxPrice)
    }
  })

  test('режим ОПВ: доход = avgSalary(ОПВ), без завышения в 10 раз', () => {
    const opv = [50000, 50000, 50000, 50000, 50000, 50000]
    const r = calcBankApproval({ orgs:[{ mode:'opv', opvMonths:opv, oldCredit:0 }], members:1 })
    // 50 000 ОПВ ≈ ЗП 500 000; avgSalary даёт 50000×7.9 = 395 000 (банковский дисконт).
    // Старый код делил ОПВ на 0.10 до avgSalary и получал 3 950 000.
    expect(r.totalIncome).toBe(avgSalary(opv))
    expect(r.totalIncome).toBe(Math.round(50000 * 7.9))
  })
})

describe('calcOpvVar', () => {
  test('считает среднюю ЗП из ОПВ', () => {
    const r = calcOpvVar({ opv12:[30000,31000,29000,28000,32000,30000] })
    expect(r.ok).toBe(true)
    expect(r.result.currentAvg).toBeGreaterThan(0)
  })

  test('строит план при указании target', () => {
    const r = calcOpvVar({ opv12:[20000,21000,22000], target:400000 })
    expect(Array.isArray(r.result.plan)).toBe(true)
    expect(r.result.plan.length).toBe(6)
  })

  test('нет плана если target <= текущей ЗП', () => {
    const r = calcOpvVar({ opv12:[40000,41000,42000,43000,44000,45000], target:100000 })
    expect(r.result.plan).toBeNull()
  })

  test('gap = target - currentAvg', () => {
    const r = calcOpvVar({ opv12:[20000,21000,22000], target:400000 })
    expect(r.result.gap).toBe(Math.max(0, 400000 - r.result.currentAvg))
  })

  test('buh заполняется только при salary+type', () => {
    const without = calcOpvVar({ opv12:[20000,21000,22000] })
    const withBuh = calcOpvVar({ opv12:[20000,21000,22000], salary:300000, type:'Трудовой' })
    expect(without.result.buh).toBeNull()
    expect(withBuh.result.buh.find(b=>b.isTotal).val).toBeGreaterThan(0)
  })
})

describe('calcOpvEq', () => {
  test('рассчитывает равномерные платежи', () => {
    const r = calcOpvEq({ income:300000, months:6 })
    expect(r.ok).toBe(true)
    expect(r.result.payments.length).toBe(6)
    expect(r.result.payments.every(p => p > 0)).toBe(true)
    expect(r.result.currentAvg).toBeGreaterThan(0)
  })

  test('все платежи равны между собой', () => {
    const r = calcOpvEq({ income:300000, months:6 })
    const uniq = new Set(r.result.payments)
    expect(uniq.size).toBe(1)
  })
})

describe('calcBuh', () => {
  test('ошибка без type', () => {
    expect(calcBuh({ salary:300000 }).ok).toBe(false)
  })

  test('ошибка без salary', () => {
    expect(calcBuh({ type:'Трудовой' }).ok).toBe(false)
  })

  test('breakdown содержит ИТОГО', () => {
    const r = calcBuh({ type:'Трудовой', salary:300000 })
    expect(r.ok).toBe(true)
    const total = r.breakdown.find(b => b.isTotal)
    expect(total).toBeDefined()
    expect(total.val).toBeGreaterThan(0)
  })

  test('ИТОГО = сумма всех ненулевых строк (кроме «на руки»)', () => {
    const r = calcBuh({ type:'Трудовой', salary:300000 })
    const total    = r.breakdown.find(b => b.isTotal)
    const sumLines = r.breakdown.filter(b => !b.isTotal && !b.isNet && b.val !== null).reduce((a,b) => a + b.val, 0)
    expect(total.val).toBe(sumLines)
  })

  test('«Останется на руки» = ЗП минус удержания работника', () => {
    const r = calcBuh({ type:'Трудовой', salary:300000 })
    const net = r.breakdown.find(b => b.isNet)
    const g = l => r.breakdown.find(b => b.label === l).val
    expect(net.val).toBe(300000 - g('ОПВ') - g('ВОСМС') - g('СО') - g('ИПН'))
    expect(net.val).toBeGreaterThan(0)
  })

  test('tax_config из админки переопределяет константы', () => {
    const { calcTax } = require('../../lib/calcEngine')
    const base = calcTax(2000000, 'Трудовой')
    const custom = calcTax(2000000, 'Трудовой', { vosmsCap: 17000, workFee: 20000 })
    expect(custom.vosms).toBe(17000)
    expect(custom.work).toBe(20000)
    expect(base.vosms).toBe(34000)
  })
})

describe('calcScenario', () => {
  test('строит план на 1-6 месяцев', () => {
    const r = calcScenario({ target:300000, existing:[20000,21000,22000] })
    expect(r.ok).toBe(true)
    expect(r.result.plan.length).toBe(6)
  })

  test('gap = target - currentAvg', () => {
    const r = calcScenario({ target:300000, existing:[20000,21000,22000] })
    expect(r.result.gap).toBe(Math.max(0, 300000 - r.result.currentAvg))
  })

  test('best = план с минимальной totalCost', () => {
    const r = calcScenario({ target:300000, existing:[20000,21000,22000] })
    const best = r.result.plan.reduce((b,p) => (!b || (p.totalCost && p.totalCost < b.totalCost)) ? p : b, null)
    expect(r.result.best.months).toBe(best.months)
  })
})
