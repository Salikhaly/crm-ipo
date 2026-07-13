// features/calc/index.jsx
// Калькулятор — вынесен из pages/index.js.
// Экспортирует CalcPage (страница калькулятора со всеми вкладками).
// Внутренние компоненты (CalcProgTab, CalcMortgageTab, CalcOpvTab и т.д.)
// используются только внутри этого модуля.

import React, { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import {
  PROGRAMS_FALLBACK, API_PROGRAMS_FALLBACK, getPrograms,
  annuity, buildSch, fmtMoney, fmtK, fmtM,
  kdColor, kdText, avgSalary,
  D50_FALLBACK, getD50,
} from '../../lib/calcData'

const PROGS_DATA = PROGRAMS_FALLBACK
const PROGRAMS   = PROGRAMS_FALLBACK
const D50        = D50_FALLBACK

// Этапы сделки (fallback для CalcStepsTab когда calcCfg.deal_steps пуст)
const DEAL_STEPS = [
  {n:'Предварительное одобрение', sub:'Подача заявки, проверка кредитной истории', cost:''},
  {n:'Поиск квартиры', sub:'После одобрения — ищем подходящий объект', cost:''},
  {n:'Задаток', sub:'Подписание договора задатка с продавцом', cost:'от 50 000–200 000 ₸ (возвращается)'},
  {n:'Оценка недвижимости (1-2 дня)', sub:'Документы продавца: У/Л, ТП, УГР, ДКП, Форма 2, Свид. о браке', cost:'21 600 ₸'},
  {n:'Проверка на задолженность', sub:'У/Л и У/Л супруги — покупателя и продавца', cost:''},
  {n:'Логин/пароль Отбасы банка', sub:'Открыть личный кабинет', cost:''},
  {n:'Открыть текущий счёт', sub:'В Отбасы банке для проведения сделки', cost:''},
  {n:'Кред. заявка (документы)', sub:'Покупатель: У/Л, свид. о браке, У/Л супруги · Продавец: У/Л, свид. о браке, У/Л супруги, КЗ счёт 20-знач., Форма 2, ТП, УГР, ДКП', cost:''},
  {n:'Уведомление об одобрении', sub:'Банк выдаёт одобрение на конкретную квартиру', cost:''},
  {n:'ДКП у нотариуса', sub:'Покупатель: У/Л, свид. о браке, У/Л супруги · Продавец: + Форма 2, ТП, УГР, ДКП, КЗ счёт', cost:'51 900 + 2 292 + 6 488 = 60 680 ₸'},
  {n:'Регистрация ДКП', sub:'Ускоренно 2ч — 7 085 ₸ · Обычная 1.5 дня — 1 555 ₸', cost:'1 555–7 085 ₸'},
  {n:'Получить Форму 2', sub:'Согласие супруги строго по образцу Отбасы банка', cost:''},
  {n:'Сдача документов в банк для ДЗНИ', sub:'а) ДКП  б) ТП  в) УГР  г) Форма 2  д) Согласие', cost:''},
  {n:'Подписание договоров ДЗНИ, ДБЗ, ДЗЖСС', sub:'Форма 2 · документы до 13:00', cost:''},
  {n:'Вынесение текущего счёта, комиссия банка', sub:'', cost:''},
  {n:'Регистрация ДЗНИ у нотариуса', sub:'Регистрация 23 788 + Заявление 2 292 + Согласие 6 488', cost:'32 568 ₸ (+ ускоренно 7 085 ₸)'},
  {n:'Выдача — перевод денег продавцу', sub:'Страховка · Календарь и график · После одобрения — базар', cost:'Страховка ~0.3%/год от цены'},
]

const CONTRACT_TYPES = ['Трудовой', 'ГПХ']


export function CalcPage({ user, clients, toast$ }) {
  const TABS = [
    { id:'prog',     l:'Программы',    icon:'ti-home' },
    { id:'exp',      l:'Расходы',      icon:'ti-receipt' },
    { id:'t50',      l:'50/50',        icon:'ti-table' },
    { id:'pay',      l:'Платёж',       icon:'ti-calculator' },
    { id:'cmp',      l:'Сравнить',     icon:'ti-arrows-shuffle' },
    { id:'early',    l:'Досрочно',     icon:'ti-bolt' },
    { id:'inc',      l:'По доходу',    icon:'ti-user' },
    { id:'rent',     l:'Аренда vs',    icon:'ti-building' },
    { id:'steps',    l:'Этапы',        icon:'ti-list-check' },
    { id:'mortgage', l:'🏦 Ипотека',   icon:'ti-home-2' },
    { id:'bank',     l:'🏦 Одобрение', icon:'ti-building-bank' },
    { id:'opv',      l:'📊 ОПВ',       icon:'ti-chart-bar' },
    { id:'tax',      l:'🧾 Бухгалтер', icon:'ti-calculator' },
  ]
  const [tab, setTab]       = useState('prog')
  const [busy, setBusy]     = useState(false)
  // Настройки из БД — загружаем один раз при открытии калькулятора
  const [calcCfg, setCalcCfg] = useState(null)

  useEffect(() => {
    api.getCalcSettings().then(d => {
      if (d?.settings) setCalcCfg(d.settings)
    }).catch(() => {})
  }, [])

  async function doCalc(action, payload) {
    setBusy(true)
    try {
      return await api.calc(action, payload)
    } catch(e) {
      toast$('❌ ' + e.message, 'err')
      return null
    } finally {
      setBusy(false)
    }
  }

  // Группировка вкладок
  const newTabs = TABS.slice(0, 9)
  const oldTabs = TABS.slice(9)

  return (
    <div style={{maxWidth:900,margin:'0 auto'}}>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:20,fontWeight:700,color:'#0f172a',marginBottom:2}}>🧮 Калькулятор</div>
        <div style={{fontSize:12,color:'#64748b'}}>Все расчёты по ипотечным программам Казахстана 2026</div>
        {/* №7: словарик терминов для новичков */}
        <details style={{marginTop:8}}>
          <summary style={{fontSize:11.5,color:'#3b82f6',cursor:'pointer',fontWeight:600,userSelect:'none'}}>
            ❓ Что значат термины (для новичков)
          </summary>
          <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:10,padding:'10px 13px',marginTop:6,fontSize:11.5,color:'#475569',lineHeight:1.7}}>
            <b>ПВ (первоначальный взнос)</b> — сколько клиент платит сразу из своих. 20% = пятая часть цены квартиры.<br/>
            <b>КД (коэффициент долговой нагрузки)</b> — какая доля дохода уйдёт на все кредиты. Больше 50% — банк почти наверняка откажет.<br/>
            <b>ПМ (прожиточный минимум)</b> — сумма, которая должна остаться на жизнь после платежа. У Наурыз-программ ПМ ниже — одобряют с меньшим доходом.<br/>
            <b>Аннуитет</b> — платёж одинаковый каждый месяц весь срок.<br/>
            <b>ОПВ</b> — пенсионные отчисления 10% от зарплаты. По ним банк проверяет реальный доход.<br/>
            <b>ГЭСВ</b> — реальная ставка со всеми комиссиями (чуть выше рекламной).
          </div>
        </details>
      </div>

      {/* Новый калькулятор — вкладки */}
      <div style={{fontSize:10,fontWeight:600,color:'#94a3b8',marginBottom:4,letterSpacing:'.06em'}}>РАСЧЁТЫ ДЛЯ КЛИЕНТА</div>
      <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:6,background:'#f8fafc',padding:4,borderRadius:12,border:'1px solid #e2e8f0'}}>
        {newTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{flex:'1',minWidth:72,padding:'9px 4px',minHeight:38,border:'none',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:600,
              background: tab===t.id ? '#fff' : 'transparent',
              color: tab===t.id ? '#0f172a' : '#64748b',
              boxShadow: tab===t.id ? '0 1px 3px rgba(0,0,0,.06)' : 'none',
              transition:'all .15s', whiteSpace:'nowrap'}}>
            <i className={`ti ${t.icon}`} style={{fontSize:12,marginRight:2}}/>{t.l}
          </button>
        ))}
      </div>

      {/* Старый калькулятор — вкладки */}
      <div style={{fontSize:10,fontWeight:600,color:'#94a3b8',marginBottom:4,letterSpacing:'.06em'}}>СЛУЖЕБНЫЕ (БАНК, ОПВ, НАЛОГИ)</div>
      <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:16,background:'#f8fafc',padding:4,borderRadius:12,border:'1px solid #e2e8f0'}}>
        {oldTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{flex:'1',minWidth:88,padding:'9px 4px',minHeight:38,border:'none',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:600,
              background: tab===t.id ? '#fff' : 'transparent',
              color: tab===t.id ? '#0f172a' : '#64748b',
              boxShadow: tab===t.id ? '0 1px 3px rgba(0,0,0,.06)' : 'none',
              transition:'all .15s'}}>
            {t.l}
          </button>
        ))}
        {busy && <span style={{fontSize:11,color:'#3b82f6',display:'flex',alignItems:'center',gap:4,paddingLeft:4}}>
          <i className="ti ti-loader-2 spin" style={{fontSize:14}}/>Считаю...
        </span>}
      </div>

      {/* Новые вкладки */}
      {tab==='prog'     && <CalcProgTab  toast$={toast$} clients={clients} calcCfg={calcCfg}/>}
      {tab==='exp'      && <CalcExpTab   toast$={toast$} calcCfg={calcCfg}/>}
      {tab==='t50'      && <Calc50Tab calcCfg={calcCfg}/>}
      {tab==='pay'      && <CalcPayTab calcCfg={calcCfg}/>}
      {tab==='cmp'      && <CalcCmpTab calcCfg={calcCfg}/>}
      {tab==='early'    && <CalcEarlyTab/>}
      {tab==='inc'      && <CalcIncTab calcCfg={calcCfg}/>}
      {tab==='rent'     && <CalcRentTab/>}
      {tab==='steps'    && <CalcStepsTab toast$={toast$} calcCfg={calcCfg}/>}

      {/* Старые вкладки — через API */}
      <div style={['mortgage','bank','opv','tax'].includes(tab) ? {} : {display:'none'}}>
        <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:14,padding:20}}>
          {tab==='mortgage' && <CalcMortgageTab doCalc={doCalc} clients={clients}/>}
          {tab==='bank'     && <CalcBankTab     doCalc={doCalc}/>}
          {tab==='opv'      && <CalcOpvTab      doCalc={doCalc}/>}
          {tab==='tax'      && <CalcTaxTab      doCalc={doCalc}/>}
        </div>
      </div>
    </div>
  )
}
CalcPage = React.memo(CalcPage)

// ─── SHARED CARD STYLE ────────────────────────────────────────────
const C = {
  card:  { background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:16, marginBottom:12 },
  sec:   { fontSize:11, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8, paddingBottom:6, borderBottom:'1px solid #f1f5f9' },
  row:   { display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'5px 0', borderBottom:'1px solid #f8fafc', gap:8 },
  rk:    { color:'#64748b', fontSize:11, flex:1, lineHeight:1.4 },
  rv:    { fontWeight:500, fontSize:12, textAlign:'right', whiteSpace:'nowrap' },
  sr:    { display:'flex', alignItems:'center', gap:8, marginBottom:8 },
  sv:    { fontSize:12, fontWeight:500, minWidth:100, textAlign:'right', color:'#0f172a' },
  met:   { background:'#f8fafc', borderRadius:8, padding:'10px 12px' },
  ml:    { fontSize:10, color:'#64748b', marginBottom:2 },
  mv:    { fontSize:15, fontWeight:500, color:'#0f172a' },
  sep:   { height:1, background:'#f1f5f9', margin:'8px 0' },
  badge: (bg, col) => ({ display:'inline-block', fontSize:9, padding:'2px 5px', borderRadius:4, fontWeight:500, background:bg, color:col, marginLeft:4, verticalAlign:'middle' }),
  note:  (bg, border, col) => ({ borderRadius:10, padding:'8px 12px', fontSize:11, lineHeight:1.5, marginBottom:10, background:bg, border:`1px solid ${border}`, color:col }),
  tot:   (bg, col) => ({ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', borderRadius:8, marginTop:8, fontWeight:500, background:bg, color:col }),
}
const Srow = ({ label, val, id, min, max, step, onInput }) => (
  <div style={C.sr}>
    <span style={C.rk}>{label}</span>
    <input type="range" id={id} min={min} max={max} step={step} defaultValue={val} onInput={onInput} style={{flex:1}} />
    <span style={C.sv} id={id+'v'}>—</span>
  </div>
)

// ─── TAB: ПРОГРАММЫ ───────────────────────────────────────────────
function CalcProgTab({ toast$, clients, calcCfg }) {
  // Берём программы из БД если загружены, иначе хардкод
  const progsData = (calcCfg?.progs_data?.length ? calcCfg.progs_data : PROGS_DATA)
  const [selP, setSelP]   = useState(null)
  const [price, setPrice] = useState(30000000)
  const [term, setTerm]   = useState(17)
  const [inc, setInc]     = useState(500000)
  const [res, setRes]     = useState(null)

  // Выбираем первую программу при первом рендере или когда данные загрузились
  useEffect(() => {
    if (!selP && progsData.length) setSelP(progsData[0].id)
  }, [progsData])

  const p = progsData.find(x => x.id === selP)

  useEffect(() => { if (p) recalc() }, [selP, price, term, inc])

  function recalc() {
    const safeT = Math.min(term, p.t)
    if (term > p.t) setTerm(p.t)
    const down = Math.round(price * p.d)
    const credit = price - down
    const mo = safeT * 12
    const pm = annuity(credit, p.r, mo)
    const tot = pm * mo, ov = tot - credit
    const kd = inc > 0 ? pm / inc : 0
    // Таблица 50/50 индексирована по договорной сумме (= цене квартиры),
    // поэтому ищем по price и показываем только для программ со взносом 50%.
    // Раньше искали по credit — платёж для 50/50 занижался вдвое.
    const tbl = p.d === 0.5 ? D50.find(d => Math.abs(d[0] - price) < 1000001) : null
    const sch = buildSch(credit, p.r, mo)
    setRes({ down, credit, pm, tot, ov, kd, tbl, sch, safeT, ov1yr: sch.slice(0,12).reduce((s,r)=>s+r.in_,0), bo1yr: sch.slice(0,12).reduce((s,r)=>s+r.bo,0) })
  }

  function waShare() {
    if (!res) return
    const txt = `🏠 Расчёт ипотеки — ${p.n}\n\n💰 Цена: ${fmtM(price)}\n📥 Взнос: ${fmtM(res.down)}\n🏦 Кредит: ${fmtM(res.credit)}\n📊 ${p.r}% · ${res.safeT} лет\n💳 Платёж/мес: ${fmtM(res.pm)}\n📈 Переплата: ${fmtM(res.ov)}\n✅ Итого: ${fmtM(res.tot)}`
    window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank')
  }

  return (
    <div>
      {/* Program grid */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:10}}>
        {progsData.filter(x=>x.grp==='g').map(pg => (
          <button key={pg.id} onClick={() => setSelP(pg.id)}
            style={{padding:'8px 7px',border:`1px solid ${selP===pg.id?'#3b82f6':'#e2e8f0'}`,borderRadius:10,cursor:'pointer',
              background:selP===pg.id?'#eff6ff':'#fff',textAlign:'left',transition:'all .15s'}}>
            <div style={{fontSize:11,fontWeight:500,color:'#0f172a'}}>{pg.n}</div>
            <div style={{fontSize:10,color:'#64748b',marginTop:1}}>{pg.r}% · до {pg.t} лет</div>
            <div style={{fontSize:10,color:'#1d4ed8',marginTop:1}}>ПВ {Math.round(pg.d*100)}%</div>
          </button>
        ))}
      </div>
      <div style={{fontSize:10,fontWeight:600,color:'#64748b',marginBottom:4,marginTop:4}}>КОММЕРЧЕСКИЕ БАНКИ</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:12}}>
        {progsData.filter(x=>x.grp==='c').map(pg => (
          <button key={pg.id} onClick={() => setSelP(pg.id)}
            style={{padding:'8px 7px',border:`1px solid ${selP===pg.id?'#f97316':'#e2e8f0'}`,borderRadius:10,cursor:'pointer',
              background:selP===pg.id?'#fff7ed':'#fff',textAlign:'left',transition:'all .15s'}}>
            <div style={{fontSize:11,fontWeight:500,color:'#0f172a'}}>{pg.n}</div>
            <div style={{fontSize:10,color:'#64748b',marginTop:1}}>{pg.r}% · до {pg.t} лет</div>
            <div style={{fontSize:10,color:'#854F0B',marginTop:1}}>ПВ {Math.round(pg.d*100)}%</div>
          </button>
        ))}
      </div>

      {p && <div style={{...C.note('#E6F1FB','#85B7EB','#0C447C')}}><b>{p.n}</b> — {p.note}</div>}

      <div style={C.card}>
        <div style={C.sec}>Параметры</div>
        <div style={C.sr}>
          <span style={C.rk}>Стоимость квартиры</span>
          <input type="range" min={3000000} max={120000000} step={500000} value={price} onChange={e=>setPrice(+e.target.value)} style={{flex:1}}/>
          <span style={C.sv}>{fmtM(price)}</span>
        </div>
        <div style={C.sep}/>
        <div style={C.sr}>
          <span style={C.rk}>Срок {p && term > p.t ? `(макс ${p.t}л)` : ''}</span>
          <input type="range" min={1} max={p ? p.t : 25} step={1} value={Math.min(term, p ? p.t : 25)} onChange={e=>setTerm(+e.target.value)} style={{flex:1}}/>
          <span style={C.sv}>{Math.min(term, p ? p.t : 25)} лет</span>
        </div>
        <div style={C.sep}/>
        <div style={C.sr}>
          <span style={C.rk}>Ежемесячный доход</span>
          <input type="range" min={100000} max={3000000} step={10000} value={inc} onChange={e=>setInc(+e.target.value)} style={{flex:1}}/>
          <span style={C.sv}>{fmtM(inc)}</span>
        </div>
      </div>

      {res && (
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:12}}>
            {[['Платёж/мес',fmtM(res.pm),'#1d4ed8'],['Кредит',fmtM(res.credit),'#0f172a'],['Взнос',fmtM(res.down),'#0f172a'],['Итого',fmtM(res.tot),'#0f172a']].map(([l,v,col])=>(
              <div key={l} style={C.met}><div style={C.ml}>{l}</div><div style={{...C.mv,color:col}}>{v}</div></div>
            ))}
          </div>

          {res.tbl && (
            <div style={{...C.note('#eff6ff','#93c5fd','#1e40af')}}>
              <b>По таблице 50/50</b> (~{fmtK(res.tbl[0])} ₸): Промзаём 8.5% = <b>{fmtM(res.tbl[2])}/мес</b> · Жилзаём 5% = <b>{fmtM(res.tbl[4])}/мес</b> · ОПВ (ОП=5): {fmtM(res.tbl[1])}
            </div>
          )}

          <div style={C.card}>
            <div style={C.sec}>Полная сводка</div>
            {[
              ['Ставка', p.r + '% годовых'],
              ['Срок', res.safeT + ' лет (' + res.safeT*12 + ' мес.)'],
              ['Цена квартиры', fmtM(price)],
              ['Первоначальный взнос', fmtM(res.down) + ' (' + Math.round(p.d*100) + '%)'],
              ['Сумма кредита', fmtM(res.credit)],
              ['Ежемесячный платёж', fmtM(res.pm)],
              ['Переплата (проценты)', fmtM(res.ov)],
              ['% переплаты к кредиту', Math.round(res.ov/res.credit*100) + '%'],
              ['Итого за ' + res.safeT + ' лет', fmtM(res.tot)],
              ['Тело долга за 1-й год', fmtM(res.bo1yr)],
              ['Проценты за 1-й год', fmtM(res.ov1yr)],
            ].map(([k,v]) => (
              <div key={k} style={{...C.row,borderBottom:'1px solid #f8fafc'}}><span style={C.rk}>{k}</span><span style={C.rv}>{v}</span></div>
            ))}
            {inc > 0 && (
              <>
                <div style={C.sep}/>
                <div style={{...C.row,borderBottom:'none'}}>
                  <span style={C.rk}>КД (коэф. долговой нагрузки)</span>
                  <span style={{...C.rv, color:kdColor(res.kd)}}>{(res.kd*100).toFixed(1)}%</span>
                </div>
                <div style={{height:6,background:'#f1f5f9',borderRadius:3,overflow:'hidden',margin:'4px 0'}}>
                  <div style={{width:Math.min(100,res.kd*100).toFixed(1)+'%',height:'100%',background:kdColor(res.kd),borderRadius:3}}/>
                </div>
                <div style={{fontSize:10,color:'#64748b'}}>{kdText(res.kd)} · Мин. доход: {fmtM(Math.ceil(res.pm/0.5))}</div>
              </>
            )}
          </div>

          <button onClick={waShare}
            style={{width:'100%',padding:10,border:'none',borderRadius:10,background:'#25D366',color:'#fff',fontSize:13,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:12}}>
            <i className="ti ti-brand-whatsapp"/> Отправить расчёт в WhatsApp
          </button>
        </>
      )}
    </div>
  )
}

// ─── TAB: РАСХОДЫ ─────────────────────────────────────────────────
function CalcExpTab({ toast$, calcCfg }) {
  const [price, setPrice]  = useState(30000000)
  const [dnPct, setDnPct]  = useState(20)
  const [bank, setBank]    = useState('otbasy')
  const [reg, setReg]      = useState('fast')
  const [marr, setMarr]    = useState(true)
  const [sq, setSq]        = useState(60)

  const down = Math.round(price * dnPct / 100)
  const insurancePct = calcCfg?.insurance_pct || 0.003

  // Расходы из БД или хардкод
  const buildRows = (items) => (items || []).map(r => {
    if (r.marr !== undefined && r.marr !== marr) return null
    if (r.regType && r.regType !== reg) return null
    return { k: r.k, v: r.k.toLowerCase().includes('страховка') ? Math.round(price * insurancePct) : r.v, req: r.req }
  }).filter(Boolean)

  const rowsOtbasyCfg = calcCfg?.expense_otbasy?.length ? buildRows(calcCfg.expense_otbasy) : null
  const rowsOtbasy = rowsOtbasyCfg || [
    { k:'Оценка недвижимости (1-2 дня)',  v:21600,  req:true },
    { k:'ДКП нотариус',                   v:51900,  req:true },
    { k:'Заявление',                      v:2292,   req:true },
    { k:'Согласие супруги',               v:marr?6488:0, req:marr, note:marr?'':'не требуется' },
    { k:'Регистрация ДКП ' + (reg==='fast'?'ускоренно (2ч)':'обычная (1.5 дня)'), v:reg==='fast'?7085:1555, req:true },
    { k:'Регистрация ДЗНИ',               v:23788,  req:true },
    { k:'Заявление ДЗНИ',                 v:2292,   req:true },
    { k:'Согласие ДЗНИ',                  v:marr?6488:0, req:marr, note:marr?'':'не требуется' },
    { k:`Страховка 1-й год (~${(insurancePct*100).toFixed(1)}%/год)`, v:Math.round(price*insurancePct), req:true, note:'ежегодно' },
  ]

  const rowsOtherCfg = calcCfg?.expense_other?.length ? buildRows(calcCfg.expense_other) : null
  const rowsOther = rowsOtherCfg || [
    { k:'Оценка недвижимости (1-2 дня)',  v:21600,  req:true },
    { k:'Ипотечный договор',              v:15728,  req:true },
    { k:'Согласие супруги',               v:marr?5898:0,  req:marr,  note:marr?'':'не требуется' },
    { k:'Заявление о не браке',           v:marr?0:2084,  req:!marr, note:marr?'не требуется':'' },
    { k:'ДКП нотариус',                   v:47184,  req:true },
    { k:'Регистрация ДКП ' + (reg==='fast'?'ускоренный (2ч)':'обычный'), v:reg==='fast'?6222:1555, req:true },
    { k:'Регистрация залога',             v:7864,   req:true },
    { k:`Страховка 1-й год (~${(insurancePct*100).toFixed(1)}%/год)`, v:Math.round(price*insurancePct), req:true, note:'ежегодно' },
  ]

  const mrpRef = calcCfg?.mrp_ref?.length ? calcCfg.mrp_ref : [
    {k:'МРП 2026', v:'4 325 ₸'},{k:'МЗП 2026', v:'85 000 ₸'},
    {k:'ВМП (прожит. мин.) 2026', v:'46 228 ₸'},{k:'Жилищные выплаты 2026', v:'74 000 ₸'},
    {k:'Мин. пенсия 2026', v:'62 771 ₸'},{k:'ДКП нотариус — Отбасы', v:'51 900 ₸'},
    {k:'ДКП нотариус — другие банки', v:'47 184 ₸'},
    {k:'Регистрация залога (др. банк)', v:'7 864 ₸'},{k:'Ипотека договор (др. банк)', v:'15 728 ₸'},
  ]

  const rows   = bank==='otbasy' ? rowsOtbasy : rowsOther
  const oblig  = rows.filter(r=>r.req&&r.v>0).reduce((s,r)=>s+r.v,0)
  const need   = down + oblig

  function waShareExp() {
    const txt = `💸 Расходы на оформление ипотеки\n\n🏠 Цена: ${fmtM(price)}\n📥 Взнос (${dnPct}%): ${fmtM(down)}\n📋 Расходы: ${fmtM(oblig)}\n✅ ИТОГО на руках: ${fmtM(need)}`
    window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank')
  }

  return (
    <div>
      <div style={C.card}>
        <div style={C.sec}>Параметры сделки</div>
        <div style={{...C.row,borderBottom:'1px solid #f8fafc'}}>
          <span style={C.rk}>Стоимость квартиры (₸)</span>
          <input type="text" inputMode="numeric" value={price} onChange={e=>setPrice(+String(e.target.value).replace(/\D/g,'')||0)}
            style={{width:140,padding:'4px 8px',border:'1px solid #e2e8f0',borderRadius:8,textAlign:'right',fontSize:12,background:'#fff',color:'#0f172a'}}/>
        </div>
        <div style={{...C.row,borderBottom:'1px solid #f8fafc',paddingTop:8}}>
          <span style={C.rk}>Первоначальный взнос</span>
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            {[0,10,20,30,50].map(p=>(
              <button key={p} onClick={()=>setDnPct(p)}
                style={{padding:'3px 8px',border:`1px solid ${dnPct===p?'#3b82f6':'#e2e8f0'}`,borderRadius:6,cursor:'pointer',
                  background:dnPct===p?'#eff6ff':'#fff',fontSize:10,fontWeight:500,color:dnPct===p?'#1d4ed8':'#64748b'}}>
                {p}%
              </button>
            ))}
          </div>
        </div>
        <div style={{...C.row,borderBottom:'1px solid #f8fafc'}}><span style={C.rk}>Сумма взноса</span><span style={{...C.rv,color:'#1d4ed8'}}>{fmtM(down)}</span></div>
        <div style={{...C.row,borderBottom:'1px solid #f8fafc',paddingTop:6}}>
          <span style={C.rk}>Банк</span>
          <select value={bank} onChange={e=>setBank(e.target.value)}
            style={{padding:'4px 8px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:12,background:'#fff',color:'#0f172a'}}>
            <option value="otbasy">Отбасы банк</option>
            <option value="other">Другой банк (Халык и др.)</option>
          </select>
        </div>
        <div style={{...C.row,borderBottom:'1px solid #f8fafc',paddingTop:6}}>
          <span style={C.rk}>Регистрация ДКП</span>
          <select value={reg} onChange={e=>setReg(e.target.value)}
            style={{padding:'4px 8px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:12,background:'#fff',color:'#0f172a'}}>
            <option value="fast">Ускоренная 2ч — {bank==='otbasy'?'7 085':'6 222'} ₸</option>
            <option value="slow">Обычная 1.5 дня — 1 555 ₸</option>
          </select>
        </div>
        <div style={{...C.row,borderBottom:'1px solid #f8fafc',paddingTop:6}}>
          <span style={C.rk}>Статус</span>
          <select value={marr?'y':'n'} onChange={e=>setMarr(e.target.value==='y')}
            style={{padding:'4px 8px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:12,background:'#fff',color:'#0f172a'}}>
            <option value="y">В браке</option>
            <option value="n">Не в браке</option>
          </select>
        </div>
      </div>

      <div style={C.card}>
        <div style={C.sec}>Расходы — {bank==='otbasy'?'Отбасы банк':'Другой банк'}</div>
        {rows.map((r,i) => (
          <div key={i} style={{...C.row,borderBottom:'1px solid #f8fafc'}}>
            <span style={C.rk}>{r.k}{r.note&&<span style={{color:'#94a3b8',fontSize:10}}> · {r.note}</span>}</span>
            <span style={{...C.rv,color:r.v>0&&r.req?'#993C1D':'#94a3b8'}}>{r.v>0?fmtM(r.v):'—'}</span>
          </div>
        ))}
        <div style={C.tot('#FEF2F2','#993C1D')}><span>Итого расходы</span><span>{fmtM(oblig)}</span></div>
      </div>

      <div style={C.card}>
        <div style={C.sec}>Итого нужно иметь на руках</div>
        <div style={{...C.row,borderBottom:'1px solid #f8fafc'}}><span style={C.rk}>Первоначальный взнос ({dnPct}%)</span><span style={{...C.rv,color:'#1d4ed8'}}>{fmtM(down)}</span></div>
        <div style={{...C.row,borderBottom:'none'}}><span style={C.rk}>Расходы на оформление</span><span style={{...C.rv,color:'#993C1D'}}>{fmtM(oblig)}</span></div>
        <div style={C.tot('#eff6ff','#1d4ed8')}><span style={{fontSize:13}}>ИТОГО</span><span style={{fontSize:18}}>{fmtM(need)}</span></div>
        <div style={{fontSize:10,color:'#64748b',marginTop:6}}>+ Задаток (возвращается) · Ремонт ~{fmtM(sq*25000)} · Оценка уже включена</div>
      </div>

      <div style={C.card}>
        <div style={C.sec}>Справочник МРП / МЗП / ВПМ</div>
        {mrpRef.map(({k,v})=>(
          <div key={k} style={{...C.row,borderBottom:'1px solid #f8fafc'}}><span style={C.rk}>{k}</span><span style={C.rv}>{v}</span></div>
        ))}
      </div>

      <button onClick={waShareExp}
        style={{width:'100%',padding:10,border:'none',borderRadius:10,background:'#25D366',color:'#fff',fontSize:13,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:12}}>
        <i className="ti ti-brand-whatsapp"/> Отправить расходы в WhatsApp
      </button>
    </div>
  )
}

// ─── TAB: 50/50 TABLE ─────────────────────────────────────────────
function Calc50Tab({ calcCfg }) {
  const [search, setSearch] = useState('')
  const q = +search
  const d50 = getD50(calcCfg)
  const data = q ? d50.filter(r => Math.abs(r[0] - q) < 3000001) : d50
  return (
    <div>
      <div style={{...C.note('#E6F1FB','#85B7EB','#0C447C')}}>
        Промзаём ~8 лет (ОП=5 мес.) · Жилзаём ~9 лет (ОП=16 мес.) — точные данные из вашей таблицы
      </div>
      <div style={C.card}>
        <div style={C.sec}>Поиск по сумме</div>
        <input type="text" inputMode="numeric" placeholder="Введите договорную сумму, напр. 24000000"
          value={search} onChange={e=>setSearch(e.target.value.replace(/[^\d]/g,''))}
          style={{width:'100%',padding:'8px 12px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:13,background:'#fff',color:'#0f172a'}}/>
      </div>
      <div style={{border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden'}}>
        <div style={{maxHeight:420,overflowY:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
            <thead>
              <tr style={{position:'sticky',top:0,background:'#fff'}}>
                <th style={{padding:'7px 8px',textAlign:'left',fontSize:10,fontWeight:600,color:'#64748b',borderBottom:'1px solid #e2e8f0'}}>Дог. сумма</th>
                <th style={{padding:'7px 8px',textAlign:'right',fontSize:10,fontWeight:600,color:'#854F0B',borderBottom:'1px solid #e2e8f0'}}>ОПВ (ОП=5)</th>
                <th style={{padding:'7px 8px',textAlign:'right',fontSize:10,fontWeight:600,color:'#1d4ed8',borderBottom:'1px solid #e2e8f0'}}>Платёж 8.5%</th>
                <th style={{padding:'7px 8px',textAlign:'right',fontSize:10,fontWeight:600,color:'#854F0B',borderBottom:'1px solid #e2e8f0'}}>ОПВ (ОП=16)</th>
                <th style={{padding:'7px 8px',textAlign:'right',fontSize:10,fontWeight:600,color:'#1d4ed8',borderBottom:'1px solid #e2e8f0'}}>Платёж 5%</th>
              </tr>
            </thead>
            <tbody>
              {data.map(([s,o5,p85,o16,p5]) => {
                const hi = q && Math.abs(s-q) < 1000001
                return (
                  <tr key={s} style={{background:hi?'#eff6ff':'transparent'}}>
                    <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc',fontWeight:hi?500:400,color:'#0f172a'}}>{fmtK(s)}{hi&&' ←'}</td>
                    <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc',textAlign:'right',color:'#854F0B'}}>{fmtK(o5)}</td>
                    <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc',textAlign:'right',color:'#1d4ed8',fontWeight:500}}>{fmtK(p85)}</td>
                    <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc',textAlign:'right',color:'#854F0B'}}>{fmtK(o16)}</td>
                    <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc',textAlign:'right',color:'#1d4ed8',fontWeight:500}}>{fmtK(p5)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── TAB: ПЛАТЁЖ ──────────────────────────────────────────────────
function CalcPayTab({ calcCfg }) {
  const [cr, setCr]     = useState(24000000)
  const [rate, setRate] = useState(8.5)
  const [term, setTerm] = useState(8)
  const [yrFlt, setYrFlt] = useState(null)

  const d50 = getD50(calcCfg)
  const mo = term * 12
  const pm = annuity(cr, rate, mo)
  const tot = pm * mo, ov = tot - cr
  const r = rate / 12 / 100
  const sch = buildSch(cr, rate, mo)
  const filtSch = yrFlt ? sch.filter(row => Math.ceil(row.n/12) === yrFlt) : sch
  // Таблица 50/50 индексирована по договорной сумме (цене квартиры).
  // Кредит по 50/50 = половина цены, поэтому для введённого кредита ищем строку ~2×кредит.
  const tbl = d50.find(d => Math.abs(d[0] - cr*2) < 1000001)
  const years = [...new Set([1,3,5,Math.ceil(term/2),term].filter(y=>y<=term&&y>=1))]

  return (
    <div>
      <div style={C.card}>
        <div style={C.sec}>Сумма кредита</div>
        <div style={C.sr}>
          <input type="range" min={3000000} max={80000000} step={500000} value={cr} onChange={e=>setCr(+e.target.value)} style={{flex:1}}/>
          <span style={C.sv}>{fmtM(cr)}</span>
        </div>
        <div style={C.sep}/>
        <div style={C.sec}>Ставка</div>
        <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>
          {(calcCfg?.rate_presets?.length
            ? calcCfg.rate_presets.map(p => [p.r ?? p.rate, p.l ?? p.label])
            : [[5,'Жилзаём'],[7,'Наурыз'],[8.5,'Промзаём'],[9,'Отау'],[20,'Коммерч.']]
          ).map(([rv,l])=>(
            <button key={rv} onClick={()=>setRate(rv)}
              style={{padding:'4px 8px',border:`1px solid ${rate===rv?'#3b82f6':'#e2e8f0'}`,borderRadius:6,cursor:'pointer',
                background:rate===rv?'#eff6ff':'#fff',fontSize:10,fontWeight:500,color:rate===rv?'#1d4ed8':'#64748b'}}>
              {rv}% {l}
            </button>
          ))}
        </div>
        <div style={C.sr}>
          <input type="range" min={1} max={25} step={0.5} value={rate} onChange={e=>setRate(+e.target.value)} style={{flex:1}}/>
          <span style={C.sv}>{rate.toFixed(1)}%</span>
        </div>
        <div style={C.sep}/>
        <div style={C.sec}>Срок</div>
        <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>
          {[8,9,17,19,25].map(tv=>(
            <button key={tv} onClick={()=>setTerm(tv)}
              style={{padding:'4px 8px',border:`1px solid ${term===tv?'#3b82f6':'#e2e8f0'}`,borderRadius:6,cursor:'pointer',
                background:term===tv?'#eff6ff':'#fff',fontSize:10,fontWeight:500,color:term===tv?'#1d4ed8':'#64748b'}}>
              {tv} лет
            </button>
          ))}
        </div>
        <div style={C.sr}>
          <input type="range" min={1} max={25} step={1} value={term} onChange={e=>setTerm(+e.target.value)} style={{flex:1}}/>
          <span style={C.sv}>{term} лет</span>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:12}}>
        {[['Платёж/мес',fmtM(pm),'#1d4ed8'],['Кредит',fmtM(cr),'#0f172a'],['Переплата',fmtM(ov),'#854F0B'],['Итого',fmtM(tot),'#0f172a']].map(([l,v,col])=>(
          <div key={l} style={C.met}><div style={C.ml}>{l}</div><div style={{...C.mv,color:col}}>{v}</div></div>
        ))}
      </div>

      {tbl && (
        <div style={{...C.note('#eff6ff','#93c5fd','#1e40af')}}>
          <b>По таблице 50/50</b> (дог. сумма ~{fmtK(tbl[0])} ₸ при кредите {fmtK(cr)} ₸): Промзаём 8.5% = <b>{fmtM(tbl[2])}/мес</b> · Жилзаём 5% = <b>{fmtM(tbl[4])}/мес</b>
        </div>
      )}

      <div style={C.card}>
        <div style={C.sec}>Разбивка первого платежа</div>
        {[['Проценты (1-й мес.)',fmtM(cr*r),'#854F0B'],['Тело долга (1-й мес.)',fmtM(pm-cr*r),'#1d4ed8'],
          ['Тело за 1-й год',fmtM(sch.slice(0,12).reduce((s,x)=>s+x.bo,0)),'#1d4ed8'],
          ['Проценты за 1-й год',fmtM(sch.slice(0,12).reduce((s,x)=>s+x.in_,0)),'#854F0B']
        ].map(([k,v,col])=>(
          <div key={k} style={{...C.row,borderBottom:'1px solid #f8fafc'}}><span style={C.rk}>{k}</span><span style={{...C.rv,color:col}}>{v}</span></div>
        ))}
      </div>

      <div style={C.card}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
          <div style={C.sec} style={{margin:0,border:'none',padding:0,fontSize:11,fontWeight:600,color:'#64748b'}}>Таблица платежей</div>
          <div style={{display:'flex',gap:4}}>
            {years.map(y=>(
              <button key={y} onClick={()=>setYrFlt(yrFlt===y?null:y)}
                style={{padding:'3px 7px',border:`1px solid ${yrFlt===y?'#3b82f6':'#e2e8f0'}`,borderRadius:6,cursor:'pointer',
                  background:yrFlt===y?'#eff6ff':'#fff',fontSize:10,color:yrFlt===y?'#1d4ed8':'#64748b'}}>
                {y}г
              </button>
            ))}
          </div>
        </div>
        <div style={{border:'1px solid #e2e8f0',borderRadius:8,overflow:'hidden'}}>
          <div style={{maxHeight:280,overflowY:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
              <thead>
                <tr style={{position:'sticky',top:0,background:'#fff'}}>
                  {['Мес.','Платёж','Долг','%','Остаток'].map(h=>(
                    <th key={h} style={{padding:'6px 7px',textAlign:'left',fontSize:10,fontWeight:500,color:'#64748b',borderBottom:'1px solid #e2e8f0'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtSch.map(row=>(
                  <tr key={row.n}>
                    <td style={{padding:'4px 7px',borderBottom:'1px solid #f8fafc'}}>{row.n}</td>
                    <td style={{padding:'4px 7px',borderBottom:'1px solid #f8fafc'}}>{fmtK(row.pm)}</td>
                    <td style={{padding:'4px 7px',borderBottom:'1px solid #f8fafc',color:'#1d4ed8'}}>{fmtK(row.bo)}</td>
                    <td style={{padding:'4px 7px',borderBottom:'1px solid #f8fafc',color:'#854F0B'}}>{fmtK(row.in_)}</td>
                    <td style={{padding:'4px 7px',borderBottom:'1px solid #f8fafc'}}>{fmtK(row.b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── TAB: СРАВНИТЬ ────────────────────────────────────────────────
function CalcCmpTab({ calcCfg }) {
  const [price, setPrice] = useState(30000000)
  const [term, setTerm]   = useState(17)
  const progs = getPrograms(calcCfg)
  const gov = progs.filter(p=>p.grp==='g')
  const com = progs.filter(p=>p.grp==='c')

  function TblRows({ progs }) {
    return progs.map(p => {
      const t = Math.min(term, p.t), d = Math.round(price*p.d), cr = price-d
      if (cr <= 0) return null
      const pm = annuity(cr, p.r, t*12), tot = pm*t*12, ov = tot-cr
      return (
        <tr key={p.id}>
          <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc',fontWeight:500}}>{p.n}</td>
          <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc'}}>{p.r}%</td>
          <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc'}}>{t}л</td>
          <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc'}}>{fmtK(d)} ₸</td>
          <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc',color:'#1d4ed8',fontWeight:500}}>{fmtK(pm)} ₸</td>
          <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc',color:'#854F0B'}}>{fmtK(ov)} ₸</td>
        </tr>
      )
    })
  }
  const TblHead = () => (
    <thead>
      <tr style={{position:'sticky',top:0,background:'#fff'}}>
        {['Программа','Ставка','Срок','ПВ','Платёж/мес','Переплата'].map(h=>(
          <th key={h} style={{padding:'6px 8px',textAlign:'left',fontSize:10,fontWeight:500,color:'#64748b',borderBottom:'1px solid #e2e8f0',whiteSpace:'nowrap'}}>{h}</th>
        ))}
      </tr>
    </thead>
  )

  return (
    <div>
      <div className="hint">
        <span className="hint-icon">📊</span>
        <div>Сравнить программы: вводите цену квартиры и срок — таблица покажет платёж по каждой программе сразу. Удобно показать клиенту, где выгоднее.</div>
      </div>
      <div style={C.card}>
        <div style={C.sec}>Одна цена — все программы</div>
        <div style={C.sr}>
          <span style={C.rk}>Цена квартиры</span>
          <input type="range" min={5000000} max={100000000} step={500000} value={price} onChange={e=>setPrice(+e.target.value)} style={{flex:1}}/>
          <span style={C.sv}>{fmtM(price)}</span>
        </div>
        <div style={C.sep}/>
        <div style={C.sr}>
          <span style={C.rk}>Срок</span>
          <input type="range" min={1} max={25} step={1} value={term} onChange={e=>setTerm(+e.target.value)} style={{flex:1}}/>
          <span style={C.sv}>{term} лет</span>
        </div>
      </div>
      <div style={{fontSize:10,fontWeight:600,color:'#64748b',marginBottom:4}}>ГОСУДАРСТВЕННЫЕ ПРОГРАММЫ</div>
      <div style={{border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden',marginBottom:12}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><TblHead/><tbody><TblRows progs={gov}/></tbody></table>
        </div>
      </div>
      <div style={{fontSize:10,fontWeight:600,color:'#64748b',marginBottom:4}}>КОММЕРЧЕСКИЕ БАНКИ</div>
      <div style={{border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><TblHead/><tbody><TblRows progs={com}/></tbody></table>
        </div>
      </div>
    </div>
  )
}

// ─── TAB: ДОСРОЧНО ────────────────────────────────────────────────
function CalcEarlyTab() {
  const [cr, setCr]       = useState(24000000)
  const [rate, setRate]   = useState(8.5)
  const [term, setTerm]   = useState(8)
  const [extra, setExtra] = useState(50000)

  const mo = term * 12, pm = annuity(cr, rate, mo)
  const totN = pm * mo, ovN = totN - cr
  const r = rate / 12 / 100
  let b = cr, totE = 0, moE = 0
  while (b > 0.5 && moE < mo * 2) {
    const i_ = b * r, pay = Math.min(pm + extra, b + i_)
    b = Math.max(0, b - (pay - i_)); totE += pay; moE++
  }
  const ovE = totE - cr, saved = totN - totE, savedMo = mo - moE
  const closeDate = new Date(Date.now() + moE * 30.5 * 86400000).toLocaleDateString('ru-RU', { year:'numeric', month:'long' })

  return (
    <div>
      <div className="hint">
        <span className="hint-icon">⚡</span>
        <div>Досрочное погашение: покажите клиенту, сколько он сэкономит и на сколько сократится срок, если платить сверху каждый месяц. Сильный аргумент «за».</div>
      </div>
      <div style={{...C.note('#E6F1FB','#85B7EB','#0C447C')}}>Введите параметры кредита и доп. платёж — покажу сколько сэкономишь и на сколько сократится срок.</div>
      <div style={C.card}>
        <div style={C.sec}>Параметры кредита</div>
        <div style={C.sr}>
          <span style={C.rk}>Сумма кредита</span>
          <input type="range" min={3000000} max={80000000} step={500000} value={cr} onChange={e=>setCr(+e.target.value)} style={{flex:1}}/>
          <span style={C.sv}>{fmtM(cr)}</span>
        </div>
        <div style={C.sep}/>
        <div style={C.sr}>
          <span style={C.rk}>Ставка</span>
          <input type="range" min={1} max={25} step={0.5} value={rate} onChange={e=>setRate(+e.target.value)} style={{flex:1}}/>
          <span style={C.sv}>{rate.toFixed(1)}%</span>
        </div>
        <div style={C.sep}/>
        <div style={C.sr}>
          <span style={C.rk}>Срок</span>
          <input type="range" min={1} max={25} step={1} value={term} onChange={e=>setTerm(+e.target.value)} style={{flex:1}}/>
          <span style={C.sv}>{term} лет</span>
        </div>
        <div style={C.sep}/>
        <div style={C.sr}>
          <span style={C.rk}>Доп. платёж каждый месяц</span>
          <input type="range" min={0} max={500000} step={5000} value={extra} onChange={e=>setExtra(+e.target.value)} style={{flex:1}}/>
          <span style={C.sv}>{fmtM(extra)}</span>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
        <div style={C.met}>
          <div style={C.ml}>Без досрочных ({term} лет)</div>
          <div style={{...C.mv}}>{fmtM(pm)}/мес</div>
          <div style={{fontSize:10,color:'#64748b',marginTop:4}}>Переплата: {fmtM(ovN)}<br/>Итого: {fmtM(totN)}</div>
        </div>
        <div style={C.met}>
          <div style={C.ml}>+{fmtM(extra)}/мес доп.</div>
          <div style={{...C.mv,color:'#1d4ed8'}}>{fmtM(pm+extra)}/мес</div>
          <div style={{fontSize:10,color:'#64748b',marginTop:4}}>Переплата: {fmtM(ovE)}<br/>Итого: {fmtM(totE)}</div>
        </div>
      </div>
      <div style={{...C.card,background:'#eff6ff',border:'1px solid #93c5fd'}}>
        <div style={{...C.sec,color:'#1e40af',borderColor:'#bfdbfe'}}>Выгода от досрочного погашения</div>
        {[
          ['Экономия на процентах', fmtM(saved), '#1d4ed8'],
          ['Срок сокращается на', savedMo + ' мес. (' + (savedMo/12).toFixed(1) + ' лет)', '#1d4ed8'],
          ['Новый срок', moE + ' мес. (' + (moE/12).toFixed(1) + ' лет)', '#0f172a'],
          ['Закроете ипотеку в', closeDate, '#0f172a'],
        ].map(([k,v,col]) => (
          <div key={k} style={{...C.row,borderBottom:'1px solid #bfdbfe'}}><span style={C.rk}>{k}</span><span style={{...C.rv,color:col}}>{v}</span></div>
        ))}
      </div>
    </div>
  )
}

// ─── TAB: ПО ДОХОДУ ───────────────────────────────────────────────
function CalcIncTab({ calcCfg }) {
  const [inc, setInc]   = useState(500000)
  const [oc, setOc]     = useState(0)
  const [kdL, setKdL]   = useState(50)
  const maxPmt = inc * kdL / 100 - oc
  const progs = getPrograms(calcCfg)
  const gov = progs.filter(p => p.grp === 'g')
  const com = progs.filter(p => p.grp === 'c')

  function TblRows({ progs }) {
    return progs.map(p => {
      const maxCr = Math.round(maxPmt / annuity(1, p.r, p.t * 12))
      const maxP = Math.round(maxCr / (1 - p.d))
      return maxCr > 0 ? (
        <tr key={p.id}>
          <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc',fontWeight:500}}>{p.n}</td>
          <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc'}}>{p.r}%</td>
          <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc'}}>{fmtM(maxPmt)}</td>
          <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc',color:'#1d4ed8',fontWeight:500}}>{fmtM(maxCr)}</td>
          <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc'}}>{fmtM(maxP)}</td>
        </tr>
      ) : null
    })
  }
  const TblHead = () => (
    <thead>
      <tr style={{position:'sticky',top:0,background:'#fff'}}>
        {['Программа','Ставка','Мах платёж','Макс. кредит','Макс. цена'].map(h => (
          <th key={h} style={{padding:'6px 8px',textAlign:'left',fontSize:10,fontWeight:500,color:'#64748b',borderBottom:'1px solid #e2e8f0',whiteSpace:'nowrap'}}>{h}</th>
        ))}
      </tr>
    </thead>
  )

  return (
    <div>
      <div className="hint">
        <span className="hint-icon">💰</span>
        <div>Подбор по доходу: вводите доход клиента — увидите, какую квартиру он потянет по каждой программе. Быстрый ответ на вопрос «на что мне хватит?».</div>
      </div>
      <div style={{...C.note('#eff6ff','#93c5fd','#1e40af')}}>Введите доход — покажу максимальную цену квартиры по каждой программе.</div>
      <div style={C.card}>
        <div style={C.sr}>
          <span style={C.rk}>Ежемесячный доход</span>
          <input type="range" min={100000} max={3000000} step={10000} value={inc} onChange={e=>setInc(+e.target.value)} style={{flex:1}}/>
          <span style={C.sv}>{fmtM(inc)}</span>
        </div>
        <div style={C.sep}/>
        <div style={C.sr}>
          <span style={C.rk}>Действующие кредиты/мес</span>
          <input type="range" min={0} max={500000} step={5000} value={oc} onChange={e=>setOc(+e.target.value)} style={{flex:1}}/>
          <span style={C.sv}>{fmtM(oc)}</span>
        </div>
        <div style={C.sep}/>
        <div style={{...C.row,borderBottom:'none'}}>
          <span style={C.rk}>Лимит КД</span>
          <div style={{display:'flex',gap:5}}>
            {[40,50,60].map(kv=>(
              <button key={kv} onClick={()=>setKdL(kv)}
                style={{padding:'4px 10px',border:`1px solid ${kdL===kv?'#3b82f6':'#e2e8f0'}`,borderRadius:6,cursor:'pointer',
                  background:kdL===kv?'#eff6ff':'#fff',fontSize:11,fontWeight:500,color:kdL===kv?'#1d4ed8':'#64748b'}}>
                {kv}%
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{...C.met,marginBottom:12}}>
        <div style={C.ml}>Макс. платёж при КД {kdL}%</div>
        <div style={{...C.mv,color:'#1d4ed8'}}>{fmtM(Math.max(0,maxPmt))}/мес</div>
      </div>
      <div style={{fontSize:10,fontWeight:600,color:'#64748b',marginBottom:4}}>ГОСУДАРСТВЕННЫЕ</div>
      <div style={{border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden',marginBottom:12}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><TblHead/><tbody><TblRows progs={gov}/></tbody></table>
        </div>
      </div>
      <div style={{fontSize:10,fontWeight:600,color:'#64748b',marginBottom:4}}>КОММЕРЧЕСКИЕ</div>
      <div style={{border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><TblHead/><tbody><TblRows progs={com}/></tbody></table>
        </div>
      </div>
    </div>
  )
}

// ─── TAB: АРЕНДА vs ───────────────────────────────────────────────
function CalcRentTab() {
  const [price, setPrice] = useState(30000000)
  const [rate, setRate]   = useState(7)
  const [dnP, setDnP]     = useState(20)
  const [term, setTerm]   = useState(17)
  const [rent, setRent]   = useState(150000)
  const [sav, setSav]     = useState(13)
  const [grow, setGrow]   = useState(8)

  const down = Math.round(price * dnP / 100), cr = price - down, mo = term * 12
  const pm = annuity(cr, rate, mo), tot = pm * mo, ov = tot - cr
  const finalP = Math.round(price * Math.pow(1 + grow / 100, term))
  const netI = finalP - tot
  const diff = pm - rent
  // Депозит с учётом 10% ИПН на проценты (в РК проценты по вкладам физлиц облагаются).
  // Эффективная ставка = номинальная × (1 - 0.10)
  const effRate = sav * 0.9
  let savAcc = down
  for (let m = 0; m < mo; m++) savAcc = savAcc * (1 + effRate / 12 / 100) + (diff > 0 ? diff : 0)
  savAcc = Math.round(savAcc)
  const winner = netI > savAcc

  const Sl = ({ label, min, max, step, val, onChange, fmt }) => (
    <div style={C.sr}>
      <span style={C.rk}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={val} onChange={e=>onChange(+e.target.value)} style={{flex:1}}/>
      <span style={C.sv}>{fmt ? fmt(val) : val}</span>
    </div>
  )

  return (
    <div>
      <div className="hint">
        <span className="hint-icon">🏠</span>
        <div>Аренда или покупка: сравнивает — снимать квартиру и копить на депозите ИЛИ купить в ипотеку. Депозит считается с вычетом 10% налога на проценты. Помогает клиенту решиться.</div>
      </div>
      <div style={{...C.note('#FAEEDA','#FAC775','#633806')}}>Сравниваем: платить ипотеку и стать владельцем, или снимать и откладывать разницу на депозит.</div>
      <div style={C.card}>
        <Sl label="Цена квартиры" min={5000000} max={100000000} step={500000} val={price} onChange={setPrice} fmt={fmtM}/>
        <div style={C.sep}/>
        <Sl label="Ставка ипотеки" min={5} max={25} step={0.5} val={rate} onChange={setRate} fmt={v=>v.toFixed(1)+'%'}/>
        <div style={C.sep}/>
        <Sl label="Взнос %" min={0} max={50} step={5} val={dnP} onChange={setDnP} fmt={v=>v+'%'}/>
        <div style={C.sep}/>
        <Sl label="Срок ипотеки" min={1} max={25} step={1} val={term} onChange={setTerm} fmt={v=>v+' лет'}/>
        <div style={C.sep}/>
        <Sl label="Аренда в месяц" min={50000} max={500000} step={5000} val={rent} onChange={setRent} fmt={fmtM}/>
        <div style={C.sep}/>
        <Sl label="Депозит % год. (−10% налог)" min={3} max={20} step={0.5} val={sav} onChange={setSav} fmt={v=>v.toFixed(1)+'%'}/>
        <div style={C.sep}/>
        <Sl label="Рост цен недвиж. % год." min={0} max={20} step={1} val={grow} onChange={setGrow} fmt={v=>v+'%'}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
        <div style={C.met}>
          <div style={C.ml}>🏠 Ипотека / мес</div>
          <div style={C.mv}>{fmtM(pm)}</div>
          <div style={{fontSize:10,color:'#64748b',marginTop:4}}>Выплат: {fmtM(tot)}<br/>Переплата: {fmtM(ov)}<br/>Цена через {term}л: {fmtM(finalP)}<br/><b style={{color:'#1d4ed8'}}>Актив: {fmtM(netI)}</b></div>
        </div>
        <div style={C.met}>
          <div style={C.ml}>🏘️ Аренда / мес</div>
          <div style={C.mv}>{fmtM(rent)}</div>
          <div style={{fontSize:10,color:'#64748b',marginTop:4}}>Аренда за {term}л: {fmtM(rent*mo)}<br/>Разница: {fmtM(Math.abs(diff))}<br/><br/><b style={{color:'#1d4ed8'}}>Накопления: {fmtM(savAcc)}</b></div>
        </div>
      </div>
      <div style={{...C.note(winner?'#eff6ff':'#FAEEDA', winner?'#93c5fd':'#FAC775', winner?'#1e40af':'#633806')}}>
        <b>{winner ? '🏠 Ипотека выгоднее — разница ' + fmtM(Math.abs(netI-savAcc)) : '🏘️ Аренда + депозит выгоднее — разница ' + fmtM(Math.abs(netI-savAcc))}</b><br/>
        При ипотеке — вы владелец актива. При аренде — гибкость и ликвидность.
      </div>
    </div>
  )
}

// ─── TAB: ЭТАПЫ СДЕЛКИ ────────────────────────────────────────────
function CalcStepsTab({ toast$, calcCfg }) {
  const steps = calcCfg?.deal_steps?.length ? calcCfg.deal_steps : DEAL_STEPS
  const [done, setDone] = useState(new Set())

  function toggle(i) {
    setDone(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function copyAll() {
    const txt = steps.map((s,i) => `${i+1}. ${s.n}${s.cost?' ['+s.cost+']':''}`).join('\n')
    navigator.clipboard?.writeText(txt).then(() => toast$('✅ Скопировано'))
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <div style={{fontSize:12,color:'#64748b'}}>Отмечено: {done.size} / {steps.length}</div>
        <div style={{display:'flex',gap:6}}>
          <button onClick={()=>setDone(new Set())}
            style={{padding:'5px 10px',border:'1px solid #e2e8f0',borderRadius:8,cursor:'pointer',fontSize:11,background:'#fff',color:'#64748b'}}>
            Сбросить
          </button>
          <button onClick={copyAll}
            style={{padding:'5px 10px',border:'1px solid #e2e8f0',borderRadius:8,cursor:'pointer',fontSize:11,background:'#fff',color:'#64748b'}}>
            <i className="ti ti-copy" style={{fontSize:12,marginRight:3}}/>Копировать
          </button>
        </div>
      </div>

      <div style={{height:4,background:'#f1f5f9',borderRadius:2,overflow:'hidden',marginBottom:12}}>
        <div style={{width:(done.size/steps.length*100).toFixed(1)+'%',height:'100%',background:'#3b82f6',borderRadius:2,transition:'width .3s'}}/>
      </div>

      <div style={C.card}>
        {steps.map((s,i) => (
          <div key={i} style={{display:'flex',gap:10,padding:'8px 0',borderBottom:i<steps.length-1?'1px solid #f8fafc':'none'}}>
            <div onClick={()=>toggle(i)}
              style={{width:22,height:22,borderRadius:'50%',flexShrink:0,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:500,transition:'all .15s',
                background:done.has(i)?'#3b82f6':'#eff6ff',color:done.has(i)?'#fff':'#1d4ed8',border:'1px solid '+(done.has(i)?'#3b82f6':'#93c5fd')}}>
              {done.has(i) ? <i className="ti ti-check" style={{fontSize:11}}/> : i+1}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:500,color:done.has(i)?'#94a3b8':'#0f172a',textDecoration:done.has(i)?'line-through':'none'}}>{s.n}</div>
              {s.sub && <div style={{fontSize:10,color:'#94a3b8',marginTop:2,lineHeight:1.4}}>{s.sub}</div>}
              {s.cost && <div style={{fontSize:10,fontWeight:500,color:'#993C1D',marginTop:2}}>{s.cost}</div>}
            </div>
          </div>
        ))}
      </div>

      <div style={C.card}>
        <div style={C.sec}>Документы — справочник</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:'#64748b',marginBottom:6}}>Покупатель (всегда)</div>
            {['У/Л','Свид. о браке','У/Л супруги'].map(d=><div key={d} style={{fontSize:11,color:'#0f172a',padding:'2px 0'}}>· {d}</div>)}
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:'#64748b',marginBottom:6}}>Продавец (всегда)</div>
            {['У/Л','Свид. о браке','У/Л супруги','КЗ счёт 20-значный','Форма 2','ТП','УГР','ДКП'].map(d=><div key={d} style={{fontSize:11,color:'#0f172a',padding:'2px 0'}}>· {d}</div>)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//  СТАРЫЕ ВКЛАДКИ КАЛЬКУЛЯТОРА (через API calcEngine)
//  Сохранены для полного расчёта с учётом КД, ПМ, ОПВ
// ════════════════════════════════════════════════════════════════

// OLD_PROGRAMS убран — программы грузятся из БД через api.calc('programs').
// Fallback пока загружается — API_PROGRAMS_FALLBACK (ключи движка: nauryz20 и т.д.).

function CalcMortgageTab({ doCalc, clients }) {
  const [mode,    setMode]    = useState('price')
  // Список программ из БД (fallback — PROGRAMS_FALLBACK)
  const [progList, setProgList] = useState(API_PROGRAMS_FALLBACK)
  const [program, setProgram] = useState('nauryz20')
  const [price,   setPrice]   = useState('')
  const [salary,  setSalary]  = useState('')
  const [members, setMembers] = useState('1')
  const [oldCred, setOldCred] = useState('')
  const [result,  setResult]  = useState(null)
  const [busy,    setBusy]    = useState(false)
  const prog = progList.find(p => p.key === program)

  // Грузим программы из БД (фикс AK-2 — новые программы из админки доступны)
  useEffect(() => {
    doCalc('programs', {}).then(res => {
      if (res?.ok && Array.isArray(res.programs) && res.programs.length) {
        setProgList(res.programs)
        // если текущая выбранная программа исчезла — берём первую
        if (!res.programs.find(p => p.key === program)) {
          setProgram(res.programs[0].key)
        }
      }
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function calc() {
    setBusy(true); setResult(null)
    try {
      let res
      if (mode === 'price') {
        res = await doCalc('mortgage_by_price', {
          program, price: +price, members: Math.max(1, +members || 1),
          orgs: [{ income: +salary, oldCredit: +oldCred }],
        })
      } else {
        res = await doCalc('mortgage_by_salary', {
          program, salary: +salary, members: Math.max(1, +members || 1), oldCredit: +oldCred,
        })
      }
      if (res?.ok) setResult(res)
    } finally { setBusy(false) }
  }

  const inp = (placeholder, value, onChange) => (
    <input className="inp" type="text" inputMode="numeric" placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value.replace(/[^\d]/g,''))}
      style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:10,padding:'10px 12px',color:'#0f172a',fontSize:14,width:'100%',marginBottom:8}}/>
  )

  return (
    <div>
      <div className="hint">
        <span className="hint-icon">💡</span>
        <div><b>Как считать:</b> «По цене квартиры» — узнать платёж и нужный доход под конкретную квартиру. «По зарплате» — узнать какую квартиру потянет клиент с его доходом. Выберите программу (Наурыз для льготного платежа) и заполните поля.</div>
      </div>
      {/* Режим */}
      <div className="r2" style={{marginBottom:12}}>
        {[['price','По цене квартиры'],['salary','По зарплате']].map(([m,l])=>(
          <button key={m} onClick={()=>{setMode(m);setResult(null)}}
            style={{flex:1,padding:'8px',border:`1.5px solid ${mode===m?'#3b82f6':'#e2e8f0'}`,borderRadius:10,cursor:'pointer',
              background:mode===m?'#eff6ff':'#fff',color:mode===m?'#1d4ed8':'#64748b',fontSize:12,fontWeight:mode===m?600:400}}>
            {l}
          </button>
        ))}
      </div>

      {/* Программы */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:12}}>
        {progList.map(p=>(
          <button key={p.key} onClick={()=>setProgram(p.key)}
            style={{padding:'8px 6px',border:`1.5px solid ${program===p.key?'#3b82f6':'#e2e8f0'}`,borderRadius:10,cursor:'pointer',
              background:program===p.key?'#eff6ff':'#fff',textAlign:'left'}}>
            <div style={{fontSize:12,fontWeight:500}}>{p.icon} {p.name}</div>
            <div style={{fontSize:10,color:'#64748b',marginTop:2}}>ПВ {Math.round((p.downRatio ?? p.d ?? 0)*100)}%</div>
          </button>
        ))}
      </div>

      <div style={{background:'#f8fafc',borderRadius:12,padding:16,marginBottom:12}}>
        {mode==='price'
          ? <>{inp('Цена квартиры (₸)',price,setPrice)}{inp('Зарплата (₸)',salary,setSalary)}</>
          : <>{inp('Зарплата (₸)',salary,setSalary)}</>}
        <div className="r2">
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:'#64748b',marginBottom:4}}>Кол-во заёмщиков</div>
            <input type="number" min="1" max="20" value={members} onChange={e=>setMembers(e.target.value)} placeholder="1"
              style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:10,padding:'9px 12px',fontSize:14,width:'100%'}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:'#64748b',marginBottom:4}}>Кредиты/мес (₸)</div>
            <input type="text" inputMode="numeric" value={oldCred} onChange={e=>setOldCred(e.target.value.replace(/[^\d]/g,''))} placeholder="0"
              style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:10,padding:'9px 12px',fontSize:14,width:'100%'}}/>
          </div>
        </div>
      </div>

      <button onClick={calc} disabled={busy}
        style={{width:'100%',padding:12,border:'none',borderRadius:12,background:busy?'#93c5fd':'#3b82f6',color:'#fff',fontSize:14,fontWeight:600,cursor:busy?'default':'pointer',marginBottom:12,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
        {busy ? <><i className="ti ti-loader-2 spin" style={{fontSize:16}}/>Считаю...</> : <><i className="ti ti-calculator" style={{fontSize:16}}/>Рассчитать</>}
      </button>

      {result && <CalcMortgageResult result={result} mode={mode} prog={prog}/>}
    </div>
  )
}

function CalcMortgageResult({ result, mode, prog }) {
  const fmtMoney = n => n!=null ? Math.round(n).toLocaleString('ru-RU') + ' ₸' : '—'
  const fmtKd    = v => v!=null ? (v*100).toFixed(0) + '%' : '—'

  if (!result?.ok) return null

  // ── mode=salary ──────────────────────────────────────────────────────────
  if (mode === 'salary' && result.approved) {
    return (
      <div style={{marginTop:4}}>
        <div style={{background:'#f0fdf4',border:'1.5px solid #86efac',borderRadius:12,padding:14,marginBottom:10}}>
          <div style={{fontSize:13,color:'#16a34a',fontWeight:700,marginBottom:8}}>✅ Одобрение возможно — {result.prog?.name || prog?.name}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {[
              ['Максимальная цена', fmtMoney(result.maxPrice)],
              ['Первый взнос',      fmtMoney(result.down)],
              ['Сумма займа',       fmtMoney(result.maxLoan)],
              ['Платёж/мес',        fmtMoney(result.payment)],
              ['КД',                fmtKd(result.kd)],
              ['Ставка',            result.rate],
            ].map(([l,v])=>(
              <div key={l} style={{background:'#fff',borderRadius:8,padding:10}}>
                <div style={{fontSize:10,color:'#64748b',marginBottom:2}}>{l}</div>
                <div style={{fontSize:14,fontWeight:600,color:'#0f172a'}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:10,fontSize:11,color:'#64748b',background:'rgba(0,0,0,.03)',borderRadius:8,padding:'7px 10px'}}>
            Метод 1 (КД): {fmtMoney(result.method1)} · Метод 2 (ПМ): {fmtMoney(result.method2)}
          </div>
          {result.variantsBySalary?.length > 1 && (
            <div style={{marginTop:10}}>
              <div style={{fontSize:12,fontWeight:600,color:'#64748b',marginBottom:6}}>📊 Варианты по ставке:</div>
              {result.variantsBySalary.map((v,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 10px',borderRadius:8,
                  border:'1.5px solid #e2e8f0',background:i===0?'#eff6ff':'#f8fafc',marginBottom:5}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:600}}>{v.label}</div>
                    <div style={{fontSize:10,color:'#64748b'}}>Взнос {fmtMoney(v.downPayment)}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:14,fontWeight:700,color:'#3b82f6'}}>{fmtMoney(v.maxPrice)}</div>
                    <div style={{fontSize:10,color:'#94a3b8'}}>макс. цена</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (mode === 'salary' && !result.approved) {
    // Минимальный доход чтобы хотя бы method2 стал положительным:
    // method2 = income - income*0.10 - pm - oldCredit > 0
    // income*0.9 > pm + oldCredit  →  income > (pm + oldCredit)/0.9
    const pm        = result.pm || 0
    const oldCredit = result.totalOldCredit || result.oldCredit || 0
    const minIncome = pm > 0 ? Math.ceil((pm + oldCredit) / 0.9) : 0
    const gap       = minIncome > 0 && result.totalIncome != null
                        ? Math.max(0, minIncome - result.totalIncome) : 0
    return (
      <div style={{background:'#fef2f2',border:'1.5px solid #fecaca',borderRadius:12,padding:14}}>
        <div style={{fontSize:13,color:'#dc2626',fontWeight:700}}>❌ Доход недостаточен для программы {result.prog?.name || prog?.name}</div>
        <div style={{fontSize:12,color:'#64748b',marginTop:6}}>Метод 1 (КД): {Math.round(result.method1||0).toLocaleString('ru-RU')} ₸ · Метод 2 (ПМ): {Math.round(result.method2||0).toLocaleString('ru-RU')} ₸</div>
        {minIncome > 0 && (
          <div style={{marginTop:10,padding:'9px 12px',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:9}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:gap>0?4:0}}>
              <span style={{fontSize:12,color:'#854d0e'}}>💡 Минимальный доход для одобрения:</span>
              <span style={{fontSize:13,fontWeight:700,color:'#854d0e'}}>{minIncome.toLocaleString('ru-RU')} ₸</span>
            </div>
            {gap > 0 && (
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span style={{fontSize:12,color:'#dc2626'}}>Не хватает:</span>
                <span style={{fontSize:13,fontWeight:700,color:'#dc2626'}}>{gap.toLocaleString('ru-RU')} ₸</span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── mode=price ───────────────────────────────────────────────────────────
  // Примечание: result.calc содержит данные по доходу (approved, method1, method2, kd)
  // variantsByPrice[i].monthly — платёж/мес, .canAfford — доступность по доходу
  if (mode === 'price') {
    const vars      = result.variantsByPrice || []
    const calc      = result.calc || {}
    const approved  = calc.approved   // true если доход позволяет хотя бы один вариант
    const noSalary  = !calc.totalIncome || calc.totalIncome === 0

    return (
      <div>
        {/* Статусный баннер */}
        {noSalary
          ? <div style={{background:'#fffbeb',border:'1.5px solid #fde68a',borderRadius:12,padding:12,marginBottom:10}}>
              <div style={{fontSize:13,color:'#92400e',fontWeight:700}}>💡 Введите зарплату для проверки доступности</div>
              <div style={{fontSize:11,color:'#78350f',marginTop:4}}>Платежи по всем вариантам показаны ниже — введите доход чтобы узнать, одобрят ли банк</div>
            </div>
          : approved
            ? <div style={{background:'#f0fdf4',border:'1.5px solid #86efac',borderRadius:12,padding:12,marginBottom:10}}>
                <div style={{fontSize:13,color:'#16a34a',fontWeight:700}}>✅ {result.prog?.name} — платёж по доходу доступен</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginTop:8}}>
                  {[['Сумма займа',fmtMoney(vars[0]?.loanAmount)],['Взнос',fmtMoney(vars[0]?.downPayment)],
                    ['Метод 1 (КД)',fmtMoney(calc.method1)],['Метод 2 (ПМ)',fmtMoney(calc.method2)]
                  ].map(([l,v])=>(
                    <div key={l} style={{background:'#fff',borderRadius:8,padding:8}}>
                      <div style={{fontSize:10,color:'#64748b',marginBottom:1}}>{l}</div>
                      <div style={{fontSize:13,fontWeight:600}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            : <div style={{background:'#fef2f2',border:'1.5px solid #fecaca',borderRadius:12,padding:12,marginBottom:10}}>
                <div style={{fontSize:13,color:'#dc2626',fontWeight:700}}>❌ Платёж превышает доступный по доходу</div>
                <div style={{fontSize:11,color:'#64748b',marginTop:4}}>
                  Макс. платёж по доходу: {fmtMoney(calc.maxPayment > 0 ? calc.maxPayment : 0)} ·
                  КД: {fmtKd(calc.kd)}
                </div>
              </div>
        }

        {/* Все варианты ставок */}
        {vars.length > 0 && (
          <div>
            <div style={{fontSize:12,fontWeight:600,color:'#64748b',marginBottom:6}}>Все варианты ставок:</div>
            {vars.map((v,i)=>{
              const canAfford = !noSalary && v.canAfford
              const isUnknown = noSalary
              return (
                <div key={i} style={{padding:'10px 12px',
                  border:`1.5px solid ${isUnknown?'#e2e8f0':canAfford?'#86efac':'#fecaca'}`,borderRadius:10,marginBottom:6,
                  background:isUnknown?'#f8fafc':canAfford?'#f0fdf4':'#fef2f2'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:600}}>{v.label}</div>
                      <div style={{fontSize:10,color:'#64748b',marginTop:2}}>КД {fmtKd(v.kd)}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:15,fontWeight:700,color:isUnknown?'#0f172a':canAfford?'#16a34a':'#dc2626'}}>
                        {fmtMoney(v.monthly)}/мес
                      </div>
                      <div style={{fontSize:10,color:'#94a3b8',marginTop:1}}>
                        {isUnknown ? '—' : canAfford ? '✅ одобрят' : '❌ откажут'}
                      </div>
                    </div>
                  </div>
                  {/* Нужная ЗП — показываем если нет дохода или не хватает */}
                  {(isUnknown || !canAfford) && v.requiredSalary > 0 && (
                    <div style={{marginTop:7,padding:'6px 10px',background:'#fef9c3',borderRadius:7,
                      border:'1px solid #fde68a',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontSize:11,color:'#854d0e',fontWeight:500}}>💡 Нужна средняя ЗП:</span>
                      <span style={{fontSize:13,fontWeight:700,color:'#854d0e'}}>
                        {fmtMoney(v.requiredSalary)}/мес
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Кнопка копировать */}
        {vars.length > 0 && (
          <button onClick={()=>{
            const lines = [`🏠 Расчёт ипотеки — ${result.prog?.name || ''}`,'']
            if (vars[0]) {
              lines.push(`💵 Первоначальный взнос: ${fmtMoney(vars[0].downPayment)}`)
              lines.push(`🏦 Сумма займа: ${fmtMoney(vars[0].loanAmount)}`)
            }
            lines.push('')
            lines.push('📊 Варианты ставок:')
            vars.forEach(v => {
              const needStr = (!noSalary && !v.canAfford && v.requiredSalary) ? ` | нужна ЗП: ${fmtMoney(v.requiredSalary)}` : ''
              const status = noSalary ? '' : (v.canAfford ? ' ✅' : ' ❌')
              lines.push(`• ${v.label}: ${fmtMoney(v.monthly)}/мес${status}${needStr}`)
            })
            navigator.clipboard?.writeText(lines.join('\n')).catch(()=>{})
              .then ? void 0 : void 0
            const text = lines.join('\n')
            try { navigator.clipboard.writeText(text) } catch(e) {}
            window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank')
          }}
            style={{width:'100%',marginTop:8,padding:'9px',border:'none',borderRadius:9,
              background:'#25D366',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',gap:7}}>
            <i className="ti ti-brand-whatsapp"/>Отправить клиенту в WhatsApp
          </button>
        )}
      </div>
    )
  }
  return null
}

function CalcBankTab({ doCalc }) {
  const [members, setMembers] = useState('1')
  const [orgs,    setOrgs]    = useState([{ income:'', oldCredit:'', mode:'income' }])
  const [result,  setResult]  = useState(null)
  const [busy,    setBusy]    = useState(false)

  function setOrg(i, key, val) {
    setOrgs(os => os.map((o,idx) => idx===i ? {...o,[key]:val} : o))
    setResult(null)
  }

  async function calc() {
    setBusy(true); setResult(null)
    try {
      const res = await doCalc('bank_approval', {
        orgs: orgs.map(o => ({ income: +o.income||0, oldCredit: +o.oldCredit||0 })),
        members: Math.max(1, +members || 1),
      })
      if (res?.ok) setResult(res)
    } finally { setBusy(false) }
  }

  const fmtM = n => Math.round(n||0).toLocaleString('ru-RU') + ' ₸'
  const fmtKd = v => v!=null ? (v*100).toFixed(0) + '%' : '—'

  return (
    <div>
      <div style={{background:'#f8fafc',borderRadius:12,padding:14,marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:600,color:'#64748b',marginBottom:8}}>Заёмщики</div>
        {orgs.map((o,i)=>(
          <div key={i} style={{marginBottom:10,padding:10,background:'#fff',borderRadius:10,border:'1px solid #e2e8f0'}}>
            <div style={{fontSize:11,color:'#94a3b8',marginBottom:6}}>Заёмщик {i+1}</div>
            <div className="r2">
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:'#64748b',marginBottom:3}}>Доход (₸)</div>
                <input type="text" inputMode="numeric" value={o.income} onChange={e=>setOrg(i,'income',e.target.value.replace(/[^\d]/g,''))} placeholder="300 000"
                  style={{width:'100%',padding:'8px 10px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,background:'#fff',color:'#0f172a'}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:'#64748b',marginBottom:3}}>Кредиты/мес (₸)</div>
                <input type="text" inputMode="numeric" value={o.oldCredit} onChange={e=>setOrg(i,'oldCredit',e.target.value.replace(/[^\d]/g,''))} placeholder="0"
                  style={{width:'100%',padding:'8px 10px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,background:'#fff',color:'#0f172a'}}/>
              </div>
            </div>
            {orgs.length > 1 &&
              <button onClick={()=>setOrgs(os=>os.filter((_,idx)=>idx!==i))}
                style={{marginTop:6,fontSize:10,color:'#ef4444',background:'none',border:'none',cursor:'pointer'}}>✕ Удалить</button>}
          </div>
        ))}
        {orgs.length < 10 && (
          <button onClick={()=>setOrgs(os=>[...os,{income:'',oldCredit:'',mode:'income'}])}
            style={{width:'100%',padding:'8px',border:'1.5px dashed #cbd5e1',borderRadius:10,cursor:'pointer',
              background:'transparent',color:'#64748b',fontSize:12}}>
            + Добавить созаёмщика
          </button>
        )}
        <div style={{marginTop:10}}>
          <div style={{fontSize:11,color:'#64748b',marginBottom:4}}>Кол-во членов семьи</div>
          <input type="number" min="1" max="20" value={members} onChange={e=>setMembers(e.target.value)} placeholder="1"
            style={{width:'100%',padding:'8px 10px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,background:'#fff',color:'#0f172a'}}/>
        </div>
      </div>

      <button onClick={calc} disabled={busy}
        style={{width:'100%',padding:12,border:'none',borderRadius:12,background:busy?'#93c5fd':'#3b82f6',color:'#fff',fontSize:14,fontWeight:600,cursor:busy?'default':'pointer',marginBottom:12,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
        {busy ? <><i className="ti ti-loader-2 spin" style={{fontSize:16}}/>Считаю...</> : <><i className="ti ti-building-bank" style={{fontSize:16}}/>Рассчитать одобрение</>}
      </button>

      {result?.ok && (
        <div>
          <div style={{background:result.approved?'#f0fdf4':'#fef2f2',border:`1.5px solid ${result.approved?'#86efac':'#fecaca'}`,borderRadius:12,padding:14,marginBottom:10}}>
            <div style={{fontSize:13,fontWeight:700,color:result.approved?'#16a34a':'#dc2626',marginBottom:8}}>
              {result.approved ? '✅ Одобрение вероятно' : '❌ Доход недостаточен'}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
              {[['Макс. платёж',fmtM(result.maxPayment)],['КД',fmtKd(result.kd)],
                ['Метод 1 (КД)',fmtM(result.method1)],['Метод 2 (ПМ)',fmtM(result.method2)],
                ['Общий доход',fmtM(result.totalIncome)],['Прожит. мин.',fmtM(result.pm)]
              ].map(([l,v])=>(
                <div key={l} style={{background:'#fff',borderRadius:8,padding:8}}>
                  <div style={{fontSize:10,color:'#64748b',marginBottom:1}}>{l}</div>
                  <div style={{fontSize:13,fontWeight:600}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          {result.allPrograms?.length > 0 && (
            <div>
              <div style={{fontSize:12,fontWeight:600,color:'#64748b',marginBottom:6}}>По всем программам:</div>
              {result.allPrograms.map((p,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'8px 10px',border:'1px solid #e2e8f0',borderRadius:10,marginBottom:5,background:'#f8fafc'}}>
                  <div style={{fontSize:12,fontWeight:500}}>{p.icon} {p.name}</div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:13,fontWeight:600,color:'#0f172a'}}>{fmtM(p.maxPrice)}</div>
                    <div style={{fontSize:10,color:'#64748b'}}>макс. цена · ПВ {fmtM(p.downPayment)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CalcOpvTab({ doCalc }) {
  const [mode,      setMode]      = useState('var')
  const [opvStr,    setOpvStr]    = useState('')
  const [target,    setTarget]    = useState('')
  const [income,    setIncome]    = useState('')
  const [months,    setMonths]    = useState('6')
  const [salaryBuh, setSalaryBuh] = useState('')
  const [typeBuh,   setTypeBuh]   = useState('Трудовой')
  const [result,    setResult]    = useState(null)
  const [busy,      setBusy]      = useState(false)

  // Форматирование с пробелами — 2000000 → «2 000 000»
  const fmt  = n => n > 0 ? Math.round(n).toLocaleString('ru-RU') + ' ₸' : '—'
  const fmtP = n => n > 0 ? Math.round(n * 10) / 10 + '%' : '—'

  // При вводе ОПВ форматируем с пробелами в подсказке
  function parseOpv(str) {
    return str.split(/[,;\n\s]+/).map(Number).filter(v => v > 0)
  }

  async function calc() {
    setBusy(true); setResult(null)
    try {
      let res
      if (mode === 'var') {
        const opv12 = parseOpv(opvStr)
        if (!opv12.length) { setBusy(false); return }
        res = await doCalc('opv_var', { opv12, target: +target.replace(/\s/g,''), salary: +salaryBuh.replace(/\s/g,''), type: typeBuh })
      } else {
        if (!income) { setBusy(false); return }
        res = await doCalc('opv_eq', { income: +income.replace(/\s/g,''), months: +months, salary: +salaryBuh.replace(/\s/g,''), type: typeBuh })
      }
      if (res?.ok) setResult(res)
    } finally { setBusy(false) }
  }

  const opvList = parseOpv(opvStr)
  const opvTotal = opvList.reduce((s,v)=>s+v, 0)
  const opvAvg   = opvList.length ? opvTotal / opvList.length : 0
  // Та же формула, что в lib/calcEngine.js avgSalary() — ОПВ*7.9/6 с отсечением
  // min/max при n>=3. Раньше тут было упрощённое opvAvg/0.10, которое давало
  // другое число, чем итоговый расчёт после нажатия «Рассчитать ОПВ»
  const salaryFromOpv = avgSalary(opvList)

  return (
    <div>
      {/* Режим */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:14}}>
        {[['var','📊 По истории ОПВ'],['eq','📐 Равномерный']].map(([m,l])=>(
          <button key={m} onClick={()=>{setMode(m);setResult(null)}}
            style={{padding:'10px',border:`2px solid ${mode===m?'#3b82f6':'#e2e8f0'}`,borderRadius:10,cursor:'pointer',
              background:mode===m?'#eff6ff':'#fff',color:mode===m?'#1d4ed8':'#64748b',
              fontSize:13,fontWeight:mode===m?700:400,transition:'all .15s'}}>
            {l}
          </button>
        ))}
      </div>

      {mode === 'var' ? (
        <div>
          {/* Пояснение */}
          <div style={{background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:10,padding:'10px 13px',marginBottom:12,fontSize:12,color:'#1e40af',lineHeight:1.5}}>
            <b>Как заполнить:</b> Введите суммы ОПВ из истории ОПВ — каждый месяц с новой строки или через запятую.<br/>
            ОПВ — это 10% от вашей официальной зарплаты (например, ОПВ 30 000 ₸ → ЗП 300 000 ₸)
          </div>

          {/* Поле ОПВ */}
          <div style={{marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <label style={{fontSize:12,fontWeight:600,color:'#374151'}}>Суммы ОПВ за каждый месяц (₸)</label>
              {opvList.length > 0 && (
                <span style={{fontSize:11,color:'#64748b',background:'#f1f5f9',padding:'2px 8px',borderRadius:6}}>
                  {opvList.length} мес. введено
                </span>
              )}
            </div>
            <textarea
              value={opvStr}
              onChange={e=>setOpvStr(e.target.value)}
              placeholder={"Пример:\n30000\n32500\n29000\n31000\n30500\n28000\n\n(каждая строка — один месяц)"}
              rows={5}
              style={{width:'100%',padding:'10px 12px',border:`1.5px solid ${opvStr&&!opvList.length?'#fca5a5':'#e2e8f0'}`,
                borderRadius:10,fontSize:14,background:'#fff',color:'#0f172a',
                resize:'vertical',fontFamily:'monospace',lineHeight:1.7}}
            />
            {/* Живой предпросмотр */}
            {opvList.length > 0 && (
              <div style={{marginTop:8,padding:'10px 13px',background:'#f8fafc',borderRadius:10,border:'1px solid #e2e8f0'}}>
                <div style={{fontSize:11,color:'#64748b',marginBottom:6,fontWeight:600}}>Распознанные данные:</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:8}}>
                  {opvList.map((v,i) => (
                    <span key={i} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:6,
                      padding:'3px 8px',fontSize:11,fontFamily:'monospace',color:'#0f172a'}}>
                      {i+1}. {v.toLocaleString('ru-RU')} ₸
                    </span>
                  ))}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                  {[
                    ['Месяцев', opvList.length + ' мес.', '#374151'],
                    ['Ср. ОПВ/мес', opvAvg.toLocaleString('ru-RU',{maximumFractionDigits:0}) + ' ₸', '#1d4ed8'],
                    ['Ср. ЗП (расчёт банка)', salaryFromOpv.toLocaleString('ru-RU',{maximumFractionDigits:0}) + ' ₸', '#0f766e'],
                  ].map(([l,v,c])=>(
                    <div key={l} style={{background:'#fff',borderRadius:8,padding:'8px 10px',border:'1px solid #e2e8f0'}}>
                      <div style={{fontSize:10,color:'#94a3b8',marginBottom:2}}>{l}</div>
                      <div style={{fontSize:13,fontWeight:700,color:c}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Целевая ЗП */}
          <div style={{marginBottom:12}}>
            <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>
              Целевая средняя ЗП (необязательно)
            </label>
            <div style={{position:'relative'}}>
              <input value={target} onChange={e=>setTarget(e.target.value.replace(/[^\d]/g,''))} type="text" inputMode="numeric"
                placeholder="300 000"
                style={{width:'100%',padding:'10px 50px 10px 12px',border:'1.5px solid #e2e8f0',
                  borderRadius:10,fontSize:14,background:'#fff',color:'#0f172a'}}/>
              <span style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',
                fontSize:13,color:'#94a3b8',pointerEvents:'none'}}>₸</span>
            </div>
            {target > 0 && (
              <div style={{fontSize:11,color:'#64748b',marginTop:4}}>
                = {(+target/10).toLocaleString('ru-RU',{maximumFractionDigits:0})} ₸ ОПВ/мес (10%)
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div style={{background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:10,padding:'10px 13px',marginBottom:12,fontSize:12,color:'#1e40af'}}>
            Рассчитывает какой должен быть доход каждый месяц, если ОПВ поступают равномерно.
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            <div>
              <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>Нужный доход (₸)</label>
              <div style={{position:'relative'}}>
                <input value={income} onChange={e=>setIncome(e.target.value.replace(/[^\d]/g,''))} type="text" inputMode="numeric" placeholder="300 000"
                  style={{width:'100%',padding:'10px 50px 10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontSize:14,background:'#fff',color:'#0f172a'}}/>
                <span style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',fontSize:13,color:'#94a3b8',pointerEvents:'none'}}>₸</span>
              </div>
              {income > 0 && <div style={{fontSize:11,color:'#64748b',marginTop:4}}>ОПВ = {(+income * 0.10).toLocaleString('ru-RU',{maximumFractionDigits:0})} ₸/мес</div>}
            </div>
            <div>
              <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>Срок накопления</label>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4}}>
                {[3,4,5,6].map(n=>(
                  <button key={n} onClick={()=>setMonths(String(n))}
                    style={{padding:'10px 0',border:`1.5px solid ${months==n?'#3b82f6':'#e2e8f0'}`,borderRadius:8,
                      background:months==n?'#eff6ff':'#fff',color:months==n?'#1d4ed8':'#64748b',
                      fontSize:12,fontWeight:months==n?700:400,cursor:'pointer'}}>
                    {n} мес
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Тип договора и ЗП для бухгалтера */}
      <div style={{background:'#fafafa',borderRadius:10,border:'1px solid #e2e8f0',padding:12,marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:600,color:'#64748b',marginBottom:8}}>Для расчёта отчислений (необязательно)</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div>
            <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:4}}>Тип договора</label>
            <select value={typeBuh} onChange={e=>setTypeBuh(e.target.value)}
              style={{width:'100%',padding:'8px 10px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,background:'#fff',color:'#0f172a'}}>
              <option value="Трудовой">Трудовой</option>
              <option value="ГПХ">ГПХ</option>
            </select>
          </div>
          <div>
            <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:4}}>Зарплата (₸)</label>
            <div style={{position:'relative'}}>
              <input value={salaryBuh} onChange={e=>setSalaryBuh(e.target.value.replace(/[^\d]/g,''))} type="text" inputMode="numeric" placeholder="300 000"
                style={{width:'100%',padding:'8px 40px 8px 10px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,background:'#fff',color:'#0f172a'}}/>
              <span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',fontSize:12,color:'#94a3b8',pointerEvents:'none'}}>₸</span>
            </div>
          </div>
        </div>
      </div>

      <button onClick={calc} disabled={busy}
        style={{width:'100%',padding:13,border:'none',borderRadius:12,
          background:busy?'#93c5fd':'#3b82f6',color:'#fff',fontSize:14,fontWeight:700,
          cursor:busy?'default':'pointer',marginBottom:14,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
        {busy
          ? <><i className="ti ti-loader-2 spin" style={{fontSize:16}}/>Считаю...</>
          : <><i className="ti ti-chart-bar" style={{fontSize:16}}/>Рассчитать ОПВ</>}
      </button>

      {/* Результат */}
      {result?.ok && result.result && (() => {
        const r = result.result
        return (
          <div>
            {/* Основные метрики */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
              {(mode === 'var' ? [
                {l:'Средняя ЗП', v: fmt(r.currentAvg), sub:'по данным ОПВ', c:'#0f766e', bg:'#f0fdfa'},
                {l:'Цель', v: r.target ? fmt(r.target) : '—', sub:'целевая зарплата', c:'#1d4ed8', bg:'#eff6ff'},
                {l:'Разница', v: r.target > 0 ? (r.gap > 0 ? fmt(r.gap) : '✅ Достигнута') : '—', sub:r.gap>0?'нужно добрать':'цель достигнута', c:r.gap>0?'#854F0B':'#0f766e', bg:r.gap>0?'#fefce8':'#f0fdfa'},
              ] : [
                {l:'ОПВ / месяц', v: r.payments?.length ? fmt(r.payments[0]) : '—', sub:'платить каждый месяц', c:'#854F0B', bg:'#fefce8'},
                {l:'Срок', v: r.payments?.length ? r.payments.length + ' мес.' : '—', sub:'на протяжении', c:'#1d4ed8', bg:'#eff6ff'},
                {l:'Средняя ЗП', v: fmt(r.currentAvg), sub:'получится у банка', c:'#0f766e', bg:'#f0fdfa'},
              ]).map(({l,v,sub,c,bg})=>(
                <div key={l} style={{background:bg,borderRadius:12,padding:'12px 14px',border:`1.5px solid ${c}33`}}>
                  <div style={{fontSize:10,color:'#64748b',marginBottom:4,fontWeight:600,textTransform:'uppercase',letterSpacing:'.04em'}}>{l}</div>
                  <div style={{fontSize:16,fontWeight:800,color:c,marginBottom:2}}>{v}</div>
                  <div style={{fontSize:10,color:'#94a3b8'}}>{sub}</div>
                </div>
              ))}
            </div>

            {/* Разбивка по месяцам (бухгалтерия) — показывается в режиме var при наличии данных */}
            {r.buh && (
              <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:12,overflow:'hidden',marginBottom:14}}>
                <div style={{padding:'10px 14px',background:'#f8fafc',borderBottom:'1px solid #e2e8f0',fontSize:12,fontWeight:600,color:'#374151'}}>
                  📅 Разбивка по месяцам
                </div>
                {(r.buh||[]).map((row,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                    padding:'9px 14px',borderBottom:i<(r.buh||[]).length-1?'1px solid #f8fafc':'none',
                    background:row.isTotal?'#f0fdf4':row.isAvg?'#eff6ff':'transparent'}}>
                    <span style={{fontSize:12,fontWeight:row.isTotal||row.isAvg?600:400,
                      color:row.isTotal?'#0f766e':row.isAvg?'#1d4ed8':'#374151'}}>{row.label}</span>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:row.isTotal||row.isAvg?14:12,fontWeight:row.isTotal||row.isAvg?700:400,
                        color:row.isTotal?'#0f766e':row.isAvg?'#1d4ed8':'#0f172a'}}>
                        {typeof row.val === 'number' ? row.val.toLocaleString('ru-RU',{maximumFractionDigits:0})+' ₸' : row.val}
                      </div>
                      {row.opv != null && (
                        <div style={{fontSize:10,color:'#94a3b8'}}>ОПВ: {Math.round(row.opv).toLocaleString('ru-RU')} ₸</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* План набора ОПВ */}
            {r.plan?.length > 0 && r.plan.some(p=>p.opvPerMonth) && (
              <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:12,overflow:'hidden',marginBottom:14}}>
                <div style={{padding:'10px 14px',background:'#fefce8',borderBottom:'1px solid #fde68a',fontSize:12,fontWeight:600,color:'#854F0B'}}>
                  🎯 План набора нужной суммы ОПВ
                </div>
                {r.plan.filter(p=>p.opvPerMonth).map((p,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                    padding:'10px 14px',borderBottom:i<r.plan.filter(x=>x.opvPerMonth).length-1?'1px solid #f8fafc':'none'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:28,height:28,borderRadius:'50%',background:'#fef3c7',
                        color:'#92400e',display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:11,fontWeight:700}}>{p.months}</div>
                      <div>
                        <div style={{fontSize:12,fontWeight:600,color:'#0f172a'}}>{p.months} месяц{p.months>1?p.months<5?'а':'ев':''}</div>
                        <div style={{fontSize:10,color:'#94a3b8'}}>платить ОПВ в мес.</div>
                      </div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:13,fontWeight:700,color:'#854F0B'}}>{fmt(p.opvPerMonth)}</div>
                      <div style={{fontSize:10,color:'#94a3b8'}}>→ ЗП {fmt(p.achieved)}</div>
                    </div>
                    {p.totalCost && (
                      <div style={{textAlign:'right',marginLeft:12}}>
                        <div style={{fontSize:11,color:'#64748b'}}>Итого</div>
                        <div style={{fontSize:12,fontWeight:600,color:'#374151'}}>{fmt(p.totalCost)}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Отчисления бухгалтера */}
            {r.buh?.length > 0 && (
              <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:12,overflow:'hidden'}}>
                <div style={{padding:'10px 14px',background:'#f8fafc',borderBottom:'1px solid #e2e8f0',fontSize:12,fontWeight:600,color:'#374151'}}>
                  🧾 Отчисления ({typeBuh})
                </div>
                {r.buh.map((row,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                    padding:'8px 14px',borderBottom:i<r.buh.length-1?'1px solid #f8fafc':'none',
                    background:row.isTotal?'#f0fdf4':'transparent'}}>
                    <span style={{fontSize:12,fontWeight:row.isTotal?600:400,color:row.isTotal?'#0f766e':'#374151'}}>{row.label}</span>
                    <span style={{fontSize:row.isTotal?13:12,fontWeight:row.isTotal?700:400,
                      color:row.isTotal?'#0f766e':'#0f172a'}}>
                      {typeof row.val === 'number' ? row.val.toLocaleString('ru-RU',{maximumFractionDigits:0})+' ₸' : row.val}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

function CalcTaxTab({ doCalc }) {
  const [type,    setType]    = useState('Трудовой')
  const [salary,  setSalary]  = useState('')
  const [buhFee,  setBuhFee]  = useState('')   // комиссия бухгалтеру
  const [result,  setResult]  = useState(null)
  const [busy,    setBusy]    = useState(false)
  const [err,     setErr]     = useState('')

  const fmt = n => Math.round(n||0).toLocaleString('ru-RU') + ' ₸'

  async function calc() {
    setErr('')
    const s = +String(salary).replace(/\s/g,'')
    if (!s || s <= 0) { setErr('Укажите зарплату больше нуля'); return }
    setBusy(true); setResult(null)
    try {
      const res = await doCalc('buh', { type, salary: s })
      if (res?.ok) setResult(res)
      else setErr(res?.message || 'Не удалось рассчитать')
    } finally { setBusy(false) }
  }

  const netVal = result?.breakdown?.find(r=>r.isTotal||r.isNet)?.val || 0
  const feeVal = +String(buhFee).replace(/\s/g,'') || 0
  const toCard = Math.max(0, netVal - feeVal)

  function sendWA() {
    if (!result) return
    const gross = result.breakdown?.find(r=>r.isGross)?.val || +salary
    const lines = [
      `🧾 Расчёт зарплаты (${type})`,
      '',
      `📥 Начислено: *${fmt(gross)}*`,
    ]
    result.breakdown?.filter(r => !r.isGross && !r.isTotal && !r.isNet && r.val !== 0)
      .forEach(r => lines.push(`  ${r.label}: -${fmt(Math.abs(r.val))}`))
    lines.push(`💳 На руки: *${fmt(netVal)}*`)
    if (feeVal > 0) {
      lines.push(`  └ Бухгалтеру: -${fmt(feeVal)}`)
      lines.push(`  └ На карту: *${fmt(toCard)}*`)
    }
    lines.push('', `💡 ОПВ ${fmt(Math.round(+salary*0.10))} = 10% — банк использует для расчёта ср. ЗП`)
    window.open('https://wa.me/?text='+encodeURIComponent(lines.join('\n')),'_blank')
  }

  return (
    <div>
      <div style={{background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:10,padding:'10px 13px',marginBottom:14,fontSize:12,color:'#1e40af',lineHeight:1.5}}>
        Введите начисленную зарплату — увидите все налоги, что уходит бухгалтеру и что реально приходит на карту.
      </div>

      <div style={{marginBottom:12}}>
        <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>Тип договора</label>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
          {['Трудовой','ГПХ'].map(t=>(
            <button key={t} onClick={()=>{setType(t);setResult(null);setErr('')}}
              style={{padding:'10px',border:`2px solid ${type===t?'#3b82f6':'#e2e8f0'}`,borderRadius:10,cursor:'pointer',
                background:type===t?'#eff6ff':'#fff',color:type===t?'#1d4ed8':'#64748b',
                fontSize:13,fontWeight:type===t?700:400}}>
              {t==='Трудовой'?'📋 Трудовой договор':'📄 ГПХ'}
            </button>
          ))}
        </div>
      </div>

      <div style={{marginBottom:12}}>
        <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>
          Начисленная зарплата (до вычетов)
        </label>
        <div style={{position:'relative'}}>
          <input type="text" inputMode="numeric" value={salary}
            onChange={e=>{setSalary(e.target.value.replace(/[^\d]/g,''));setResult(null);setErr('')}}
            onKeyDown={e=>e.key==='Enter'&&calc()}
            placeholder="300 000"
            style={{width:'100%',padding:'12px 50px 12px 14px',border:`1.5px solid ${err?'#fca5a5':'#e2e8f0'}`,
              borderRadius:12,fontSize:16,background:'#fff',color:'#0f172a',fontWeight:500,boxSizing:'border-box'}}/>
          <span style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',
            fontSize:14,color:'#94a3b8',pointerEvents:'none',fontWeight:500}}>₸</span>
        </div>
        {err && <div style={{fontSize:12,color:'#dc2626',marginTop:5}}>⚠️ {err}</div>}
      </div>

      {/* Комиссия бухгалтеру */}
      <div style={{marginBottom:14}}>
        <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>
          Комиссия бухгалтеру (₸) <span style={{fontWeight:400,color:'#94a3b8'}}>— необязательно</span>
        </label>
        <div style={{position:'relative'}}>
          <input type="text" inputMode="numeric" value={buhFee}
            onChange={e=>setBuhFee(e.target.value.replace(/[^\d]/g,''))}
            placeholder="0 — если нет комиссии"
            style={{width:'100%',padding:'10px 50px 10px 14px',border:'1.5px solid #e2e8f0',
              borderRadius:10,fontSize:14,background:'#fff',color:'#0f172a',boxSizing:'border-box'}}/>
          <span style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',
            fontSize:13,color:'#94a3b8',pointerEvents:'none'}}>₸</span>
        </div>
        {feeVal > 0 && netVal > 0 && (
          <div style={{fontSize:11,color:'#64748b',marginTop:4}}>
            На карту = {fmt(netVal)} − {fmt(feeVal)} = <b style={{color:'#0f766e'}}>{fmt(toCard)}</b>
          </div>
        )}
      </div>

      <button onClick={calc} disabled={busy}
        style={{width:'100%',padding:13,border:'none',borderRadius:12,
          background:busy?'#93c5fd':'#3b82f6',color:'#fff',fontSize:14,fontWeight:700,
          cursor:busy?'default':'pointer',marginBottom:14,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
        {busy
          ? <><i className="ti ti-loader-2 spin" style={{fontSize:16}}/>Считаю...</>
          : <><i className="ti ti-receipt" style={{fontSize:16}}/>Рассчитать налоги</>}
      </button>

      {result?.ok && result.breakdown?.length > 0 && (
        <div>
          {/* Главные цифры */}
          <div style={{display:'grid',gridTemplateColumns:feeVal>0?'1fr 1fr 1fr':'1fr 1fr',gap:8,marginBottom:12}}>
            {(() => {
              const gross = result.breakdown.find(r=>r.isGross)
              const cards = [
                {l:'Начислено',   v:gross?fmt(gross.val):fmt(salary), bg:'#f8fafc', c:'#0f172a'},
                {l:'На руки',     v:fmt(netVal),                       bg:'#f0fdf4', c:'#0f766e'},
              ]
              if (feeVal > 0) cards.push({l:'На карту', v:fmt(toCard), bg:'#eff6ff', c:'#1d4ed8'})
              return cards.map(({l,v,bg,c})=>(
                <div key={l} style={{background:bg,borderRadius:12,padding:'12px',
                  border:`1.5px solid ${c}22`,textAlign:'center'}}>
                  <div style={{fontSize:11,color:'#64748b',marginBottom:4,fontWeight:600}}>{l}</div>
                  <div style={{fontSize:16,fontWeight:900,color:c}}>{v}</div>
                </div>
              ))
            })()}
          </div>

          {/* Если есть комиссия — показываем разбивку */}
          {feeVal > 0 && (
            <div style={{background:'#fef9c3',border:'1.5px solid #fde68a',borderRadius:10,
              padding:'10px 14px',marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                <span style={{fontSize:12,color:'#854d0e'}}>На руки (до вычета бухгалтера)</span>
                <span style={{fontSize:13,fontWeight:700,color:'#854d0e'}}>{fmt(netVal)}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                <span style={{fontSize:12,color:'#854d0e'}}>− Комиссия бухгалтеру</span>
                <span style={{fontSize:13,fontWeight:700,color:'#dc2626'}}>−{fmt(feeVal)}</span>
              </div>
              <div style={{borderTop:'1px solid #fde68a',paddingTop:6,display:'flex',justifyContent:'space-between'}}>
                <span style={{fontSize:13,fontWeight:700,color:'#0f172a'}}>= На карту</span>
                <span style={{fontSize:16,fontWeight:900,color:'#0f766e'}}>{fmt(toCard)}</span>
              </div>
            </div>
          )}

          {/* Детализация */}
          <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:12,overflow:'hidden',marginBottom:10}}>
            <div style={{padding:'10px 14px',background:'#f8fafc',borderBottom:'1px solid #e2e8f0',
              fontSize:12,fontWeight:600,color:'#374151'}}>Детализация ({type})</div>
            {result.breakdown.map((row,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                padding:'10px 14px',borderBottom:i<result.breakdown.length-1?'1px solid #f8fafc':'none',
                background:row.isTotal||row.isNet?'#f0fdf4':row.isGross?'#f8fafc':'transparent'}}>
                <span style={{fontSize:12,fontWeight:(row.isTotal||row.isNet||row.isGross)?600:400,
                  color:(row.isTotal||row.isNet)?'#0f766e':row.isGross?'#374151':'#64748b'}}>
                  {row.label}
                </span>
                <span style={{fontSize:(row.isTotal||row.isNet)?14:12,
                  fontWeight:(row.isTotal||row.isNet||row.isGross)?700:400,
                  color:(row.isTotal||row.isNet)?'#0f766e':row.isGross?'#0f172a':'#374151',
                  fontFamily:'monospace'}}>
                  {typeof row.val === 'number'
                    ? (row.val < 0 ? '-' : '') + Math.abs(Math.round(row.val)).toLocaleString('ru-RU') + ' ₸'
                    : row.val}
                </span>
              </div>
            ))}
          </div>

          <div style={{fontSize:11,color:'#94a3b8',marginBottom:10,padding:'0 4px'}}>
            <i className="ti ti-info-circle" style={{marginRight:4}}/>
            ОПВ ({fmt(Math.round(+salary*0.10))}) = 10% от начисленной. Банк использует для расчёта средней ЗП.
          </div>

          <button onClick={sendWA}
            style={{width:'100%',padding:10,border:'none',borderRadius:10,background:'#25D366',color:'#fff',
              fontSize:13,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:7}}>
            <i className="ti ti-brand-whatsapp"/>Отправить расчёт клиенту в WhatsApp
          </button>
        </div>
      )}
    </div>
  )
}
