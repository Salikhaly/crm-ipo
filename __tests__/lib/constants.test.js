// __tests__/lib/constants.test.js
// Маршруты сопровождения по типу договора + amoCRM-механики
const {
  ACCOMP, ACCOMP_TEMPLATES, ACCOMP_GROUP_BY_CONTRACT, ALL_ACCOMP_STAGES,
  getAccompTemplate, STAGE_GUIDE, DEFAULT_CHECKLISTS, getChecklist,
  CLOSE_REASONS, STAGE_AUTO_TASK, canMoveToStage, CONTRACTS, TASK_T,
  emptyClient, uid,
} = require('../../lib/constants')

// POST /api/clients требует id. Без него «+ Новый клиент» и «В CRM базу» из
// WhatsApp падали с 400 — клиента нельзя было завести вообще.
describe('emptyClient — id для создания клиента', () => {
  test('всегда возвращает непустой id', () => {
    const c = emptyClient()
    expect(typeof c.id).toBe('string')
    expect(c.id.length).toBeGreaterThan(0)
  })

  test('id уникален у каждого нового клиента', () => {
    expect(emptyClient().id).not.toBe(emptyClient().id)
  })

  test('менеджер проставляется из аргумента', () => {
    expect(emptyClient('m3').manager).toBe('m3')
    expect(emptyClient().manager).toBe('')
  })

  test('uid не падает и даёт разные значения', () => {
    expect(uid()).not.toBe(uid())
  })
})

describe('ACCOMP_TEMPLATES — маршруты по программам', () => {
  test('7 групп маршрутов', () => {
    expect(Object.keys(ACCOMP_TEMPLATES)).toEqual(
      ['full','online','income','otbasy','gov','search','commercial']
    )
  })

  test('маршрут full идентичен старому ACCOMP (обратная совместимость индексов)', () => {
    expect(ACCOMP_TEMPLATES.full.stages).toEqual(ACCOMP)
  })

  test('каждый тип договора из CONTRACTS имеет маршрут', () => {
    for (const ct of CONTRACTS) {
      expect(ACCOMP_GROUP_BY_CONTRACT[ct.id]).toBeDefined()
      expect(ACCOMP_TEMPLATES[ACCOMP_GROUP_BY_CONTRACT[ct.id]]).toBeDefined()
    }
  })

  test('getAccompTemplate: без договора / неизвестный тип → full', () => {
    expect(getAccompTemplate('').key).toBe('full')
    expect(getAccompTemplate(undefined).key).toBe('full')
    expect(getAccompTemplate('unknown_type').key).toBe('full')
  })

  test('getAccompTemplate: маппинг групп', () => {
    expect(getAccompTemplate('full_all').key).toBe('full')
    expect(getAccompTemplate('online').key).toBe('online')
    expect(getAccompTemplate('extra').key).toBe('income')
    expect(getAccompTemplate('no_income').key).toBe('income')
    expect(getAccompTemplate('otbasy').key).toBe('otbasy')
    expect(getAccompTemplate('nauryz').key).toBe('gov')
    expect(getAccompTemplate('50_50').key).toBe('gov')
    expect(getAccompTemplate('30_70').key).toBe('gov')
    expect(getAccompTemplate('rental').key).toBe('gov')
    expect(getAccompTemplate('search').key).toBe('search')
    expect(getAccompTemplate('commercial').key).toBe('commercial')
  })

  test('каждый маршрут заканчивается «Закрытие»', () => {
    for (const t of Object.values(ACCOMP_TEMPLATES)) {
      expect(t.stages[t.stages.length - 1]).toBe('Закрытие')
    }
  })

  test('у каждого этапа каждого маршрута есть гайд (что делать + что говорить)', () => {
    for (const t of Object.values(ACCOMP_TEMPLATES)) {
      for (const s of t.stages) {
        expect(STAGE_GUIDE[s]).toBeDefined()
        expect(STAGE_GUIDE[s].do.length).toBeGreaterThan(10)
        expect(STAGE_GUIDE[s].say.length).toBeGreaterThan(10)
      }
    }
  })

  test('у каждого нового этапа (не из старого ACCOMP) есть дефолтный чек-лист', () => {
    const newStages = ALL_ACCOMP_STAGES.filter(s => !ACCOMP.includes(s))
    expect(newStages.length).toBeGreaterThan(0)
    for (const s of newStages) {
      expect(Array.isArray(DEFAULT_CHECKLISTS[s])).toBe(true)
      expect(DEFAULT_CHECKLISTS[s].length).toBeGreaterThan(0)
      // у пунктов стабильные id и текст
      for (const item of DEFAULT_CHECKLISTS[s]) {
        expect(item.id).toBeTruthy()
        expect(item.t).toBeTruthy()
      }
    }
  })

  test('id пунктов дефолтных чек-листов уникальны глобально', () => {
    const ids = Object.values(DEFAULT_CHECKLISTS).flat().map(i => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('getChecklist — приоритет БД над дефолтом', () => {
  test('непустой чек-лист из БД выигрывает', () => {
    const db = { 'Задаток': [{ id:'x1', t:'Свой пункт' }] }
    expect(getChecklist(db, 'Задаток')).toEqual([{ id:'x1', t:'Свой пункт' }])
  })

  test('пустая БД → дефолтный чек-лист', () => {
    expect(getChecklist({}, 'Задаток')).toEqual(DEFAULT_CHECKLISTS['Задаток'])
    expect(getChecklist(null, 'Задаток')).toEqual(DEFAULT_CHECKLISTS['Задаток'])
  })

  test('нет ни БД, ни дефолта → пустой массив', () => {
    expect(getChecklist({}, 'Несуществующий этап')).toEqual([])
  })
})

describe('canMoveToStage — обязательные поля этапов', () => {
  test('в «Договор» нельзя без типа и суммы договора', () => {
    expect(canMoveToStage({ contractType:'', contractAmount:0 }, 'contract').ok).toBe(false)
    expect(canMoveToStage({ contractType:'full', contractAmount:0 }, 'contract').ok).toBe(false)
    expect(canMoveToStage({ contractType:'full', contractAmount:600000 }, 'contract').ok).toBe(true)
  })

  test('в «Сопровождение» нельзя без телефона', () => {
    expect(canMoveToStage({ phone:'' }, 'accompaniment').ok).toBe(false)
    expect(canMoveToStage({ phone:'+77071234567' }, 'accompaniment').ok).toBe(true)
  })

  test('остальные этапы — без ограничений', () => {
    expect(canMoveToStage({}, 'in_work').ok).toBe(true)
    expect(canMoveToStage({}, 'closed').ok).toBe(true)
  })
})

describe('amoCRM-механики', () => {
  test('CLOSE_REASONS непустой и содержит ключевые причины', () => {
    expect(CLOSE_REASONS.length).toBeGreaterThanOrEqual(5)
    expect(CLOSE_REASONS).toContain('Отказ банка')
    expect(CLOSE_REASONS).toContain('Не выходит на связь')
  })

  test('типы авто-задач существуют в TASK_T', () => {
    for (const at of Object.values(STAGE_AUTO_TASK)) {
      expect(TASK_T).toContain(at.type)
      expect(at.text.length).toBeGreaterThan(5)
    }
  })
})


describe('getAccompTemplate — override из админки', () => {
  const { getAccompTemplate } = require('../../lib/constants')
  test('свои этапы главнее хардкода', () => {
    const t = getAccompTemplate('full', { full: { l:'Мой маршрут', stages:[{name:'Шаг 1'},{name:'Шаг 2'}] } })
    expect(t.stages).toEqual(['Шаг 1','Шаг 2'])
    expect(t.l).toBe('Мой маршрут')
  })
  test('пустое имя этапа не роняет карточку (всегда строка)', () => {
    const t = getAccompTemplate('full', { full: { stages:[{name:''},{name:'  '},{name:'Ок'}] } })
    for (const s of t.stages) expect(typeof s).toBe('string')
    expect(t.stages[2]).toBe('Ок')
  })
  test('без override — хардкод', () => {
    const t = getAccompTemplate('online', null)
    expect(Array.isArray(t.stages)).toBe(true)
    expect(t.stages.length).toBeGreaterThan(3)
  })
})
