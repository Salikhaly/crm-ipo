// __tests__/lib/mergeClients.test.js
const { mergeClients } = require('../../lib/mergeClients')

const P = {
  id:'p1', fio:'Иванов Иван', phone:'+7 707 111 22 33', iin:'',
  officialIncome:'', monthlyLoad:'50000', isWhatsApp:false,
  tags:['vip'], tasks:[{id:'t1',text:'A',done:false}],
  comments:[{id:'c1',text:'первый'}], payments:[], savedCalcs:[],
  custom:{ rate:'7%' }, accompStages:{}, contractAmount:900000,
}
const S = {
  id:'s1', fio:'Иванов И.', phone:'', iin:'123456789012',
  officialIncome:'450000', monthlyLoad:'', isWhatsApp:true,
  tags:['vip','пкб'], tasks:[{id:'t2',text:'B',done:true},{id:'t1',text:'A',done:false}],
  comments:[{id:'c2',text:'второй'}], payments:[{id:'pay1',amount:100}],
  savedCalcs:[{id:'sc1'}], credits:[{creditor:'Kaspi',status:'active'}],
  custom:{ rate:'9%', bank:'БЦК' }, accompStages:{0:{done:['x']}}, contractAmount:0,
}

describe('mergeClients', () => {
  const m = mergeClients(P, S, { userName:'Тест' })

  test('скаляры: главный приоритетен, пустые заполняются из дубля', () => {
    expect(m.fio).toBe('Иванов Иван')            // у главного есть — остаётся
    expect(m.iin).toBe('123456789012')            // у главного пусто — из дубля
    expect(m.officialIncome).toBe('450000')
    expect(m.monthlyLoad).toBe('50000')           // у главного есть
    expect(m.phone).toBe('+7 707 111 22 33')
    expect(m.contractAmount).toBe(900000)
  })
  test('булевы: истина побеждает', () => expect(m.isWhatsApp).toBe(true))
  test('задачи объединяются без дублей по id', () => {
    expect(m.tasks.map(t=>t.id).sort()).toEqual(['t1','t2'])
  })
  test('теги уникальны', () => expect(m.tags.sort()).toEqual(['vip','пкб'].sort()))
  test('кредиты и расчёты переносятся', () => {
    expect(m.credits.length).toBe(1)
    expect(m.savedCalcs.length).toBe(1)
    expect(m.payments.length).toBe(1)
  })
  test('custom: приоритет главного', () => {
    expect(m.custom.rate).toBe('7%')
    expect(m.custom.bank).toBe('БЦК')
  })
  test('accompStages главного пуст → берём дубля', () => {
    expect(m.accompStages[0].done).toEqual(['x'])
  })
  test('в ленте запись об объединении + комментарии обоих', () => {
    const texts = m.comments.map(c=>c.text).join(' | ')
    expect(texts).toContain('первый')
    expect(texts).toContain('второй')
    expect(texts).toContain('Объединён с дублем')
  })
  test('id главного сохраняется', () => expect(m.id).toBe('p1'))
})
