// features/clients/index.jsx
// Карточка клиента — вынесена из pages/index.js.
// Экспортирует ClientDetail (полная карточка со всеми вкладками).
// Внутренние: ProfileTab, AnalysisTab, CreditTab, OtbasyTab, ContractTab,
// PaymentsTab, ReassTab, DealStepsBlock, AccompTab, HistoryTab, TasksTabC,
// DriveTab, ClientCalcTab — используются только внутри карточки.

import React, { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { api } from '../../lib/api'
import {
  today, uid, nowStr, CT, CONTRACTS, ACCOMP, PIPELINE_DEFAULT,
  SRC, SRCS, CR, CR_ST, ROLE, MARITAL, CITIES, WORK_T, DOWN_T, CONTACT_ST,
  TASK_T, PAY_ST, TI, TC, TB, TL,
} from '../../lib/constants'
import {
  Btn, Inp, Sel, Fl, Tag, Tgl, Prog, StTag,
} from '../../components/ui'
import {
  annuity, fmtMoney, fmtM, PROGRAMS_FALLBACK,
} from '../../lib/calcData'

export function ClientDetail({ client, managers, pipeline, checklists, user, onSave, onDelete, onMove, onBack, toast$, setHasChanges, syncing }) {
  const [c,      setC]      = useState(JSON.parse(JSON.stringify(client)))
  const [tab,    setTab]    = useState('profile')
  const [accIdx, setAccIdx] = useState(c.accompStageIndex||0)
  const [autoBanner, setAutoBanner] = useState(null)
  const [isDirty,    setIsDirty]    = useState(false)
  const [showCalc,   setShowCalc]   = useState(false)
  const [showStageDrawer, setShowStageDrawer] = useState(false)
  const canEdit = user.role !== 'qa'  // техник (admin) и все остальные кроме qa могут редактировать
  const pl      = pipeline || PIPELINE_DEFAULT
  const cls     = checklists || {}

  function set(k, v) { setC(x=>({...x,[k]:v})); setIsDirty(true); setHasChanges(true) }
  function save() { onSave({...c}); setIsDirty(false) }

  const stageObj = pl.find(p => p.id === c.stage)
  const cr       = CR[c.creditStatus]
  const ctObj    = CT[c.contractType]
  const mgr      = managers.find(m => m.id === c.manager)

  const totalPaid    = (c.payments||[]).filter(p=>p.status==='paid').reduce((s,p)=>s+p.paidAmount,0)
  const totalPartial = (c.payments||[]).filter(p=>p.status==='partial').reduce((s,p)=>s+p.paidAmount,0)
  const payPct       = c.contractAmount > 0 ? Math.round((totalPaid+totalPartial)/c.contractAmount*100) : 0

  const aStages = c.accompStages || {}
  function getSD(i) { return aStages[i] || { done:[], comments:[], tasks:[], docs:[] } }
  function setSD(i, data) { set('accompStages', {...aStages,[i]:data}) }

  function toggleCheck(si, itemId) {
    const sd   = getSD(si)
    const done = sd.done || []
    const newDone = done.includes(itemId) ? done.filter(x=>x!==itemId) : [...done,itemId]
    const items   = cls[ACCOMP[si]] || []
    if (newDone.length===items.length && items.length>0 && si<ACCOMP.length-1) {
      setAutoBanner({ fromIdx:si, toIdx:si+1, fromName:ACCOMP[si], toName:ACCOMP[si+1] })
    } else { setAutoBanner(null) }
    setSD(si, {...sd, done:newDone})
  }

  const totalItems  = ACCOMP.reduce((s,st) => s+(cls[st]||[]).length, 0)
  const totalDone   = ACCOMP.reduce((s,st,i) => s+((aStages[i]?.done)||[]).length, 0)
  const overallPct  = totalItems > 0 ? Math.round(totalDone/totalItems*100) : 0

  const ALL_TABS = [
    {id:'profile',  l:'👤 Профиль'},
    {id:'analysis', l:'📊 Анализ'},
    {id:'credit',   l:'💳 КИ'},
    {id:'otbasy',   l:'🏦 Отбасы'},
    {id:'contract', l:'📄 Договор'},
    {id:'payments', l:`💰 Оплата (${(c.payments||[]).length})`},
    {id:'reassign', l:'🔄 Переуступка'},
    {id:'accomp',   l:'🗺 Сопровождение'},
    {id:'tasks',    l:`✅ Задачи (${(c.tasks||[]).filter(t=>!t.done).length})`},
    {id:'history',  l:`💬 История (${(c.comments||[]).length})`},
    {id:'drive',    l:'📁 Файлы'},
    {id:'calc',     l:'🧮 Калькулятор'},
  ]

  const stageColor = stageObj?.c || '#3b82f6'

  return (
    <>
      <Head>
        <title>{c.fio||'Клиент'} — Ипотека CRM</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css"/>
      </Head>
      <div className="client-detail" style={{display:'flex',minHeight:'100vh',fontFamily:"'Inter',system-ui,sans-serif"}}>
        {/* Затемнение под выезжающей панелью — мобильный */}
        {showStageDrawer && (
          <div onClick={()=>setShowStageDrawer(false)}
            style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:998}}/>
        )}
        {/* Sidebar */}
        <div className={"sidebar" + (showStageDrawer ? " mobile-open" : "")} style={{width:220,background:'#0f172a',display:'flex',flexDirection:'column',position:'sticky',top:0,height:'100vh',overflowY:'auto',flexShrink:0}}>
          {/* Кнопка закрытия — только мобильный */}
          <button aria-label="Закрыть меню" className="sidebar-close-mobile" onClick={()=>setShowStageDrawer(false)}
            style={{display:'none',position:'absolute',top:10,right:10,width:32,height:32,borderRadius:8,border:'none',background:'rgba(255,255,255,.08)',color:'#fff',fontSize:18,cursor:'pointer',alignItems:'center',justifyContent:'center',zIndex:10}}>
            ×
          </button>
          <div style={{padding:'16px 15px 13px',borderBottom:'1px solid rgba(255,255,255,.07)'}}>
            <div style={{fontSize:20,marginBottom:4}}>🏠</div>
            <div style={{fontSize:14,fontWeight:800,color:'#fff'}}>Ипотека CRM</div>
            <div style={{fontSize:10,color:'#475569',marginTop:2}}>Карточка клиента</div>
          </div>
          <div style={{padding:'9px 8px',flex:1,display:'flex',flexDirection:'column',gap:2}}>
            <button aria-label="Назад к списку клиентов" onClick={onBack} style={{display:'flex',alignItems:'center',gap:8,padding:'9px 11px',borderRadius:9,color:'#64748b',background:'transparent',fontSize:12.5,width:'100%',textAlign:'left',border:'none',cursor:'pointer',fontFamily:'inherit'}}>
              <i className="ti ti-arrow-left" style={{fontSize:16,width:17}}/>Назад к списку
            </button>
            <div style={{padding:'8px 10px 3px',fontSize:9,fontWeight:700,letterSpacing:'.09em',color:'#374151',textTransform:'uppercase',marginTop:6}}>Этап воронки</div>
            {pl.map(p => (
              <button key={p.id} onClick={()=>canEdit&&set('stage',p.id)}
                style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:7,padding:'8px 11px',borderRadius:9,color:c.stage===p.id?'#fff':'#64748b',background:c.stage===p.id?p.c:'transparent',fontSize:12,width:'100%',textAlign:'left',border:'none',cursor:canEdit?'pointer':'default',fontFamily:'inherit',transition:'all .14s'}}>
                <span style={{display:'flex',alignItems:'center',gap:7}}><span style={{width:7,height:7,borderRadius:'50%',background:p.c,display:'inline-block'}}/>{p.l}</span>
                {c.stage===p.id && <i className="ti ti-check" style={{fontSize:12}}/>}
              </button>
            ))}
            {(c.miroLink||c.driveLink) && <>
              <div style={{padding:'8px 10px 3px',fontSize:9,fontWeight:700,letterSpacing:'.09em',color:'#374151',textTransform:'uppercase',marginTop:6}}>Ссылки</div>
              {c.miroLink && <a href={c.miroLink} target="_blank" style={{display:'flex',alignItems:'center',gap:8,padding:'8px 11px',borderRadius:9,color:'#64748b',fontSize:12,textDecoration:'none'}}><i className="ti ti-brand-miro" style={{fontSize:16,color:'#f5c842'}}/>Miro</a>}
              {c.driveLink && <a href={c.driveLink} target="_blank" style={{display:'flex',alignItems:'center',gap:8,padding:'8px 11px',borderRadius:9,color:'#64748b',fontSize:12,textDecoration:'none'}}><i className="ti ti-brand-google-drive" style={{fontSize:16,color:'#0ea5e9'}}/>Google Drive</a>}
            </>}
          </div>
          <div style={{padding:11,borderTop:'1px solid rgba(255,255,255,.07)'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'9px 10px',background:'rgba(255,255,255,.06)',borderRadius:10}}>
              <div style={{width:28,height:28,borderRadius:'50%',background:ROLE[user.role]?.c||'#3b82f6',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:11,color:'#fff',flexShrink:0}}>{user.name?.[0]}</div>
              <div style={{fontSize:11,fontWeight:600,color:'#94a3b8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.name}</div>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="main-area">
          <div className="topbar">
            <Btn size="sm" onClick={onBack}><i className="ti ti-arrow-left"/><span className="btn-text-desktop">Назад</span></Btn>
            <button aria-label="Открыть этапы сделки" className="stage-drawer-toggle" onClick={()=>setShowStageDrawer(true)}
              style={{display:'none',width:36,height:36,borderRadius:9,border:'1.5px solid #e2e8f0',background:'#f8fafc',color:'#64748b',cursor:'pointer',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <i className="ti ti-list-details" style={{fontSize:17}}/>
            </button>
            <div className="topbar-title" style={{fontSize:15}}>
              {c.fio||'Клиент'}
              {isDirty && <span style={{fontSize:10,color:'#f59e0b',marginLeft:6,fontWeight:600}}>●</span>}
            </div>
            {canEdit && <Btn variant="danger" size="sm" onClick={()=>{if(window.confirm('Удалить клиента?'))onDelete(c.id)}} disabled={syncing}><i className="ti ti-trash"/></Btn>}
            {canEdit && <Btn variant="primary" size="sm" onClick={save} disabled={syncing}>
              {syncing ? <><i className="ti ti-loader spin"/></> : <><i className="ti ti-device-floppy"/><span className="btn-text-desktop">Сохранить</span></>}
            </Btn>}
          </div>

          <div className='main-content'>
            {/* Hero */}
            <div style={{background:`linear-gradient(135deg,${stageColor}cc,#0f172a)`,borderRadius:14,padding:18,marginBottom:13,color:'#fff'}}>
              <div style={{fontSize:20,fontWeight:800,letterSpacing:'-.4px',marginBottom:5}}>{c.fio||'—'}</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
                <StTag id={c.stage} pl={pl}/>
                {c.isWhatsApp && <span style={{background:'#25d36633',color:'#25d366',borderRadius:20,padding:'4px 9px',fontSize:11,fontWeight:700}}>WhatsApp</span>}
                {cr && <Tag c={cr.c} ch={cr.l}/>}
                {ctObj && <span style={{padding:'4px 9px',borderRadius:20,fontSize:11,fontWeight:700,background:'rgba(255,255,255,.15)',color:'#fff'}}>{ctObj.l}</span>}
              </div>
              <div className='hero-grid'>
                {[['Телефон',c.phone||'—'],['ИИН',c.iin||'—'],['Менеджер',mgr?.name||'—'],['Источник',SRC[c.source]?.l||'—'],['Договор',c.contractAmount>0?fmtN(c.contractAmount)+'₸':'—'],['Дата',c.dateIn]].map(([l,v])=>(
                  <div key={l} style={{background:'rgba(255,255,255,.1)',borderRadius:9,padding:9}}>
                    <div style={{fontSize:9,fontWeight:600,opacity:.6,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:2}}>{l}</div>
                    <div style={{fontSize:12,fontWeight:700}}>{v}</div>
                  </div>
                ))}
              </div>
              {c.contractAmount > 0 && (c.payments||[]).length > 0 && (
                <div style={{marginTop:11}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:4,opacity:.8}}><span>Получено денег</span><span>{payPct}%</span></div>
                  <Prog pct={payPct} c={payPct===100?'#10b981':payPct>0?'#22c55e':'rgba(255,255,255,.3)'} sz='sm'/>
                </div>
              )}
            </div>

            {/* Contact status */}
            <div style={{marginBottom:13}}>
              <div style={{fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:7}}>Статус связи</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {CONTACT_ST.map(s => (
                  <button key={s} onClick={()=>canEdit&&set('contactStatus',s)}
                    style={{padding:'8px 13px',borderRadius:20,border:`2px solid ${c.contactStatus===s?'#3b82f6':'#e2e8f0'}`,background:c.contactStatus===s?'#eff6ff':'#fff',fontSize:12,fontWeight:600,cursor:canEdit?'pointer':'default',color:c.contactStatus===s?'#3b82f6':'#64748b',fontFamily:'inherit',transition:'all .14s'}}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:14,overflow:'visible',boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
              <div className="tabs">
                {ALL_TABS.map(t => (
                  <div key={t.id} className={`tab-item${tab===t.id?' active':''}`} onClick={()=>setTab(t.id)}>
                    {t.l}
                  </div>
                ))}
              </div>
              <div style={{padding:'18px 19px'}}>
                {tab==='profile'  && <ProfileTab  c={c} set={set} managers={managers} canEdit={canEdit}/>}
                {tab==='analysis' && <AnalysisTab c={c} set={set} canEdit={canEdit}/>}
                {tab==='credit'   && <CreditTab   c={c} set={set} canEdit={canEdit}/>}
                {tab==='otbasy'   && <OtbasyTab   c={c} set={set}/>}
                {tab==='contract' && <ContractTab c={c} set={set} setC={v=>{setC(v);setIsDirty(true);setHasChanges(true)}} pipeline={pl}/>}
                {tab==='payments' && <PaymentsTab c={c} setC={v=>{setC(v);setIsDirty(true);setHasChanges(true)}} pipeline={pl} canEdit={canEdit}/>}
                {tab==='reassign' && <ReassTab    c={c} set={set} canEdit={canEdit}/>}
                {tab==='accomp'   && <AccompTab   c={c} setC={v=>{setC(v);setIsDirty(true);setHasChanges(true)}} managers={managers} canEdit={canEdit} checklists={cls} user={user} accIdx={accIdx} setAccIdx={setAccIdx} autoBanner={autoBanner} setAutoBanner={setAutoBanner} toggleCheck={toggleCheck} overallPct={overallPct} totalDone={totalDone} totalItems={totalItems} getSD={getSD} setSD={setSD} toast$={toast$}/>}
                {tab==='tasks'    && <TasksTabC   c={c} setC={v=>{setC(v);setIsDirty(true);setHasChanges(true)}} user={user} canEdit={canEdit}/>}
                {tab==='history'  && <HistoryTab  c={c} setC={v=>{setC(v);setIsDirty(true);setHasChanges(true)}} user={user}/>}
                {tab==='drive'    && <DriveTab     c={c} setC={v=>{setC(v);setIsDirty(true);setHasChanges(true)}} user={user}/>}
                {tab==='calc'     && <ClientCalcTab c={c} user={user} toast$={toast$}/>}
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin .8s linear infinite}
        @media(max-width:768px){
          .app-layout .sidebar{display:none}
          .main-content{padding:12px 12px 80px}
          .topbar{padding:9px 12px;flex-wrap:nowrap}
          .hero-grid{grid-template-columns:1fr 1fr}
          .r2,.r3{grid-template-columns:1fr}
        }
      `}</style>
    </>
  )
}

// ─── TAB COMPONENTS ──────────────────────────────────────────────
function ProfileTab({ c, set, managers, canEdit }) {
  return <>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
      <Fl l="ФИО *" req ch={<Inp value={c.fio} onChange={e=>set('fio',e.target.value)} placeholder="Фамилия Имя Отчество" disabled={!canEdit}/>}/>
      <Fl l="ИИН"      ch={<Inp value={c.iin} onChange={e=>set('iin',e.target.value)} placeholder="123456789012" maxLength={12} disabled={!canEdit}/>}/>
      <Fl l="Телефон *" req ch={<Inp value={c.phone} onChange={e=>set('phone',e.target.value)} placeholder="+7 701 000-00-00" disabled={!canEdit}/>}/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
      <Fl l="Город"   ch={<Sel value={c.city}    onChange={e=>set('city',e.target.value)}    disabled={!canEdit}>{CITIES.map(x=><option key={x}>{x}</option>)}</Sel>}/>
      <Fl l="Менеджер" ch={<Sel value={c.manager||''} onChange={e=>set('manager',e.target.value)} disabled={!canEdit}><option value="">—</option>{managers.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</Sel>}/>
      <Fl l="Источник" ch={<Sel value={c.source}  onChange={e=>set('source',e.target.value)}  disabled={!canEdit}>{SRCS.map(s=><option key={s.id} value={s.id}>{s.l}</option>)}</Sel>}/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
      <Fl l="Дата поступления" ch={<Inp type="date" value={c.dateIn} onChange={e=>set('dateIn',e.target.value)}/>}/>
      <Fl l="КИ" ch={<Sel value={c.creditStatus} onChange={e=>set('creditStatus',e.target.value)} disabled={!canEdit}>{CR_ST.map(x=><option key={x.id} value={x.id}>{x.l}</option>)}</Sel>}/>
    </div>
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 13px',background:'#f8fafc',borderRadius:11,border:'2px solid #e2e8f0',marginBottom:13}}>
      <i className="ti ti-brand-whatsapp" style={{fontSize:18,color:'#25d366'}}/>
      <span style={{fontWeight:600,flex:1}}>Лид из WhatsApp</span>
      <Tgl on={c.isWhatsApp} onClick={()=>canEdit&&set('isWhatsApp',!c.isWhatsApp)}/>
    </div>
    {c.isWhatsApp && <Fl l="Сообщение из WhatsApp" ch={<textarea value={c.waMsgPreview||''} onChange={e=>set('waMsgPreview',e.target.value)} placeholder="Вставьте текст из чата..." style={{background:'#f8fafc',border:'2px solid #cbd5e1',borderRadius:10,padding:'10px 12px',fontSize:14,width:'100%',resize:'none',minHeight:72,outline:'none',fontFamily:'inherit'}}/>}/>}
  </>
}

function AnalysisTab({ c, set, canEdit }) {
  return <>
    <div style={{fontWeight:700,fontSize:12,color:'#64748b',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10}}>Личные данные</div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
      <Fl l="Семейное положение" ch={<Sel value={c.maritalStatus} onChange={e=>set('maritalStatus',e.target.value)} disabled={!canEdit}><option value="">—</option>{MARITAL.map(s=><option key={s}>{s}</option>)}</Sel>}/>
      <Fl l="Кол-во детей" ch={<Inp type="number" min="0" value={c.children} onChange={e=>set('children',e.target.value)}/>}/>
    </div>
    <div style={{fontWeight:700,fontSize:12,color:'#64748b',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10,marginTop:4}}>Финансы</div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
      <Fl l="Офиц. доход (₸)"  ch={<Inp type="number" value={c.officialIncome}      onChange={e=>set('officialIncome',e.target.value)}/>}/>
      <Fl l="Доп. доход (₸)"   ch={<Inp type="number" value={c.extraIncome}          onChange={e=>set('extraIncome',e.target.value)}/>}/>
      <Fl l="Пенсионные (₸)"   ch={<Inp type="number" value={c.pensionContributions} onChange={e=>set('pensionContributions',e.target.value)}/>}/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
      <Fl l="Стаж (лет)"       ch={<Inp type="number" value={c.workExperience} onChange={e=>set('workExperience',e.target.value)}/>}/>
      <Fl l="Тип занятости"    ch={<Sel value={c.workType} onChange={e=>set('workType',e.target.value)} disabled={!canEdit}>{WORK_T.map(w=><option key={w.id} value={w.id}>{w.l}</option>)}</Sel>}/>
    </div>
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 13px',background:'#f8fafc',borderRadius:11,border:'2px solid #e2e8f0',marginBottom:13}}>
      <span style={{fontWeight:600,flex:1}}>Доп. доход подтверждается</span>
      <Tgl on={c.extraIncomeConfirmed} onClick={()=>canEdit&&set('extraIncomeConfirmed',!c.extraIncomeConfirmed)}/>
    </div>
    <div style={{fontWeight:700,fontSize:12,color:'#64748b',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10}}>Первоначальный взнос</div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
      <Fl l="Сумма ПВ (₸)"   ch={<Inp type="number" value={c.downPayment}  onChange={e=>set('downPayment',e.target.value)}/>}/>
      <Fl l="Тип ПВ"          ch={<Sel value={c.downPaymentType} onChange={e=>set('downPaymentType',e.target.value)} disabled={!canEdit}>{DOWN_T.map(d=><option key={d.id} value={d.id}>{d.l}</option>)}</Sel>}/>
      <Fl l="Банк депозита"   ch={<Inp value={c.depositBank} onChange={e=>set('depositBank',e.target.value)}/>}/>
    </div>
    {(c.downPaymentType==='deposit'||c.downPaymentType==='mixed') && (
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Fl l="Сумма депозита" ch={<Inp type="number" value={c.depositAmount} onChange={e=>set('depositAmount',e.target.value)}/>}/>
        <Fl l="Срок (мес)"    ch={<Inp value={c.depositTerm} onChange={e=>set('depositTerm',e.target.value)} placeholder="36"/>}/>
      </div>
    )}
  </>
}

function CreditTab({ c, set, canEdit }) {
  return <>
    <Fl l="Статус кредитной истории" ch={
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:7}}>
        {CR_ST.map(s => (
          <div key={s.id} onClick={()=>canEdit&&set('creditStatus',s.id)}
            style={{border:`2px solid ${c.creditStatus===s.id?s.c:'#e2e8f0'}`,borderRadius:10,padding:9,cursor:canEdit?'pointer':'default',textAlign:'center',background:c.creditStatus===s.id?s.c+'11':'#f8fafc',transition:'all .14s'}}>
            <span style={{width:8,height:8,borderRadius:'50%',background:s.c,display:'block',margin:'0 auto 4px'}}/>
            <div style={{fontSize:11,fontWeight:700,color:c.creditStatus===s.id?s.c:'#0f172a'}}>{s.l}</div>
          </div>
        ))}
      </div>
    }/>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
      <Fl l="Кол-во кредитов"    ch={<Inp type="number" value={c.creditsCount} onChange={e=>set('creditsCount',e.target.value)}/>}/>
      <Fl l="Ежемес. нагрузка (₸)" ch={<Inp type="number" value={c.monthlyLoad}  onChange={e=>set('monthlyLoad',e.target.value)}/>}/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
      {[['hasOverdue','⚠️ Есть просрочки','#ef4444'],['hadBankRefusal','🏦 Был отказ банка','#f97316'],['hasRefinancing','🔄 Рефинансирование','#8b5cf6'],['problematicCredits','❌ Проблемные кредиты','#dc2626'],['courtRestrictions','⚖️ Суд. ограничения','#991b1b']].map(([k,l,col]) => (
        <div key={k} onClick={()=>canEdit&&set(k,!c[k])}
          style={{display:'flex',alignItems:'center',gap:9,padding:'11px 12px',border:`2px solid ${c[k]?col:'#e2e8f0'}`,borderRadius:11,cursor:canEdit?'pointer':'default',background:c[k]?col+'11':'#f8fafc',transition:'all .14s'}}>
          <div style={{width:19,height:19,borderRadius:5,border:`2px solid ${c[k]?col:'#cbd5e1'}`,background:c[k]?col:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            {c[k] && <i className="ti ti-check" style={{fontSize:11,color:'#fff'}}/>}
          </div>
          <span style={{fontSize:12,fontWeight:600,color:c[k]?col:'#0f172a'}}>{l}</span>
        </div>
      ))}
    </div>
  </>
}

function OtbasyTab({ c, set }) {
  return <>
    <div style={{background:'linear-gradient(135deg,#f0fdfa,#ecfdf5)',border:'2px solid #6ee7b7',borderRadius:13,padding:14,marginBottom:14}}>
      <div style={{fontWeight:800,fontSize:15,color:'#065f46',marginBottom:4}}>🏦 Отбасы банк</div>
      <div style={{fontSize:13,color:'#047857'}}>Специальные поля для программы Отбасы</div>
    </div>
    <div style={{display:'flex',alignItems:'center',gap:11,padding:'12px 13px',background:'#f8fafc',borderRadius:11,border:'2px solid #e2e8f0',marginBottom:13}}>
      <span style={{fontWeight:700,flex:1}}>Депозит Отбасы</span>
      <Tgl on={c.otbasyDeposit} onClick={()=>set('otbasyDeposit',!c.otbasyDeposit)}/>
    </div>
    {c.otbasyDeposit && (
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Fl l="Вознаграждение (%)" ch={<Inp type="number" step="0.1" value={c.otbasyReward}    onChange={e=>set('otbasyReward',e.target.value)}/>}/>
        <Fl l="Категория очереди"  ch={<Inp value={c.otbasyQueue}    onChange={e=>set('otbasyQueue',e.target.value)} placeholder="Стандарт..."/>}/>
        <Fl l="Год постановки"     ch={<Inp type="number" value={c.otbasyQueueYear} onChange={e=>set('otbasyQueueYear',e.target.value)} placeholder="2020"/>}/>
        <Fl l="Город очереди"      ch={<Sel value={c.otbasyQueueCity} onChange={e=>set('otbasyQueueCity',e.target.value)}><option value="">—</option>{CITIES.map(x=><option key={x}>{x}</option>)}</Sel>}/>
      </div>
    )}
  </>
}

function ContractTab({ c, set, setC, pipeline }) {
  const pl = pipeline || PIPELINE_DEFAULT
  return <>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
      {CONTRACTS.map(ct => (
        <div key={ct.id} onClick={()=>setC(x=>{
          const n = {...x, contractType:ct.id, contractAmount:ct.a||x.contractAmount}
          if (ct.a > 0 && !(n.payments||[]).length) {
            n.payments = [
              { id:uid(), name:'Предоплата 30%',     amount:Math.round(ct.a*.3), type:'stage', stageTrigger:'contract', status:'pending', paidAmount:0, paidDate:'', note:'' },
              { id:uid(), name:'Основная часть 70%', amount:Math.round(ct.a*.7), type:'stage', stageTrigger:'approval', status:'pending', paidAmount:0, paidDate:'', note:'После одобрения' },
            ]
          }
          return n
        })}
          style={{padding:'11px 13px',borderRadius:11,border:`2px solid ${c.contractType===ct.id?'#3b82f6':'#e2e8f0'}`,background:c.contractType===ct.id?'#eff6ff':'#f8fafc',cursor:'pointer',transition:'all .14s'}}>
          <div style={{fontWeight:700,fontSize:12,color:c.contractType===ct.id?'#3b82f6':'#0f172a'}}>{ct.l}</div>
          {ct.a > 0 ? <div style={{fontWeight:800,fontSize:15,color:c.contractType===ct.id?'#3b82f6':'#64748b',marginTop:2}}>{fmtN(ct.a)}₸</div>
                    : <div style={{fontSize:11,color:'#94a3b8',marginTop:2}}>сумма вручную</div>}
        </div>
      ))}
    </div>
    {c.contractType && (
      <div style={{background:'linear-gradient(135deg,#eff6ff,#f5f3ff)',border:'2px solid #c7d2fe',borderRadius:13,padding:14,marginBottom:14}}>
        <Fl l="Сумма договора (₸) — изменить вручную" ch={<Inp type="number" value={c.contractAmount} onChange={e=>set('contractAmount',+e.target.value)}/>}/>
        <div style={{fontWeight:900,fontSize:26,color:'#3b82f6',letterSpacing:'-1px'}}>{fmtN(c.contractAmount)}₸</div>
      </div>
    )}
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
      <Fl l="Miro"         ch={<Inp value={c.miroLink||''}    onChange={e=>set('miroLink',e.target.value)}    placeholder="https://miro.com/..."/>}/>
      <Fl l="Google Drive" ch={<Inp value={c.driveLink||''}   onChange={e=>set('driveLink',e.target.value)}   placeholder="https://drive.google.com/..."/>}/>
      <Fl l="Roadmap"      ch={<Inp value={c.roadmapLink||''} onChange={e=>set('roadmapLink',e.target.value)} placeholder="https://..."/>}/>
    </div>
    <Fl l="Имя папки в Google Drive" ch={
      <div style={{display:'flex',gap:8}}>
        <Inp value={c.driveFolderName||''} onChange={e=>set('driveFolderName',e.target.value)} placeholder={c.fio&&c.iin?`${c.fio}_${c.iin}`:'Иванов_123456789012'}/>
        {c.driveLink && <a href={c.driveLink} target="_blank" style={{textDecoration:'none'}}><Btn size="sm"><i className="ti ti-external-link"/>Открыть</Btn></a>}
      </div>
    }/>
    <div style={{fontSize:11,color:'#64748b',background:'#f8fafc',borderRadius:9,padding:'9px 11px',border:'1px solid #e2e8f0'}}>
      💡 Создайте папку в Google Drive с именем выше для хранения всех документов клиента
    </div>
  </>
}

function PaymentsTab({ c, setC, pipeline, canEdit }) {
  const [showAdd, setShowAdd] = useState(false)
  const [nPay, setNPay] = useState({ name:'', amount:'', type:'stage', stageTrigger:'contract', dateTrigger:'', status:'pending', paidAmount:0, paidDate:'', note:'' })
  const pl       = pipeline || PIPELINE_DEFAULT
  const payments = c.payments || []
  const totalPaid    = payments.filter(p=>p.status==='paid').reduce((s,p)=>s+p.paidAmount,0)
  const totalPartial = payments.filter(p=>p.status==='partial').reduce((s,p)=>s+p.paidAmount,0)
  const totalPending = payments.filter(p=>p.status==='pending').reduce((s,p)=>s+p.amount,0)
  const payPct       = c.contractAmount > 0 ? Math.round((totalPaid+totalPartial)/c.contractAmount*100) : 0

  function updPay(id, key, val) {
    // paidAmount и amount должны быть числами, не строками
    const safeVal = (key === 'paidAmount' || key === 'amount') ? (+val || 0) : val
    setC({...c, payments:payments.map(p=>p.id===id?{...p,[key]:safeVal}:p)})
  }
  function setStatus(id, status) {
    const p = payments.find(x=>x.id===id)
    if (status==='paid') setC({...c, payments:payments.map(x=>x.id===id?{...x,status:'paid',paidAmount:x.amount,paidDate:new Date().toLocaleDateString('ru',{day:'numeric',month:'short'})}:x)})
    else updPay(id, 'status', status)
  }
  function addPay() {
    if (!nPay.name||!nPay.amount) return
    setC({...c, payments:[...payments,{...nPay,id:uid(),amount:+nPay.amount}]})
    setNPay({name:'',amount:'',type:'stage',stageTrigger:'contract',dateTrigger:'',status:'pending',paidAmount:0,paidDate:'',note:''})
    setShowAdd(false)
  }
  function delPay(id) { setC({...c, payments:payments.filter(p=>p.id!==id)}) }

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:9,marginBottom:14}}>
        {[{l:'Получено',v:fmtN(totalPaid+totalPartial)+'₸',c:'#10b981'},{l:'Ожидается',v:fmtN(totalPending)+'₸',c:'#f59e0b'},{l:'Договор',v:fmtN(c.contractAmount)+'₸',c:'#3b82f6'}].map(({l,v,c:col})=>(
          <div key={l} style={{background:'#f8fafc',borderRadius:10,padding:12,border:'1.5px solid #e2e8f0'}}>
            <div style={{fontSize:10,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:4}}>{l}</div>
            <div style={{fontWeight:800,fontSize:18,color:col,letterSpacing:'-1px'}}>{v}</div>
          </div>
        ))}
      </div>
      {c.contractAmount > 0 && (
        <div style={{marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:5}}><span style={{fontWeight:600}}>Прогресс оплаты</span><span style={{fontWeight:800,color:payPct===100?'#10b981':'#3b82f6'}}>{payPct}%</span></div>
          <Prog pct={payPct} c={payPct===100?'#10b981':payPct>0?'#3b82f6':'#cbd5e1'} sz='h'/>
        </div>
      )}
      {payments.map(p => {
        const ps  = PAY_ST[p.status] || PAY_ST.pending
        const sn  = pl.find(x=>x.id===p.stageTrigger)?.l
        return (
          <div key={p.id} style={{border:`1.5px solid ${p.status==='paid'?'#10b981':p.status==='partial'?'#0ea5e9':'#e2e8f0'}`,borderRadius:12,padding:13,marginBottom:9,background:p.status==='paid'?'#f0fdf4':p.status==='partial'?'#eff6ff':'#fff'}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:11,marginBottom:9}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:3}}>{p.name}</div>
                <div style={{fontSize:12,color:'#64748b'}}>
                  {p.type==='stage'&&sn&&<span>🎯 При этапе: <b>{sn}</b></span>}
                  {p.type==='date'&&p.dateTrigger&&<span>📅 До: {p.dateTrigger}</span>}
                  {p.note&&<div>{p.note}</div>}
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontWeight:800,fontSize:18,color:ps.c,letterSpacing:'-1px'}}>{fmtN(p.amount)}₸</div>
                <Tag c={ps.c} ch={ps.l}/>
              </div>
            </div>
            {p.status==='partial' && (
              <div style={{marginBottom:8}}>
                <div style={{fontSize:11,color:'#64748b',marginBottom:3}}>Получено: <b>{fmtN(p.paidAmount)}₸</b></div>
                <Prog pct={Math.round(p.paidAmount/p.amount*100)} c='#0ea5e9' sz='sm'/>
              </div>
            )}
            {p.status==='paid'&&p.paidDate&&<div style={{fontSize:12,color:'#10b981',fontWeight:600}}>✅ {p.paidDate}</div>}
            {canEdit && (
              <div style={{display:'flex',gap:7,marginTop:9,flexWrap:'wrap'}}>
                {p.status!=='paid'    && <Btn size="sm" variant="success" onClick={()=>setStatus(p.id,'paid')}><i className="ti ti-check"/>Оплачено</Btn>}
                {p.status==='pending' && <Btn size="sm" variant="warn"    onClick={()=>setStatus(p.id,'partial')}><i className="ti ti-clock"/>Частично</Btn>}
                {p.status==='partial' && <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <Inp type="number" value={p.paidAmount} onChange={e=>updPay(p.id,'paidAmount',+e.target.value)} style={{width:120}}/>
                  <span style={{fontSize:12,color:'#64748b'}}>₸</span>
                </div>}
                {p.status==='paid'    && <Btn size="sm" onClick={()=>setStatus(p.id,'pending')}><i className="ti ti-arrow-back-up"/>Отменить</Btn>}
                <Btn size="sm" variant="danger" onClick={()=>delPay(p.id)}><i className="ti ti-trash"/></Btn>
              </div>
            )}
          </div>
        )
      })}
      {canEdit && (
        <div style={{marginTop:9}}>
          {!showAdd && <Btn variant="primary" size="sm" onClick={()=>setShowAdd(true)}><i className="ti ti-plus"/>Добавить платёж</Btn>}
          {showAdd && (
            <div style={{background:'#f8fafc',borderRadius:13,padding:13,border:'1.5px solid #e2e8f0',marginTop:10}}>
              <Fl l="Название" ch={<Inp value={nPay.name} onChange={e=>setNPay(x=>({...x,name:e.target.value}))} placeholder="Предоплата 30%"/>}/>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <Fl l="Сумма (₸)" ch={<Inp type="number" value={nPay.amount} onChange={e=>setNPay(x=>({...x,amount:e.target.value}))}/>}/>
                <Fl l="Тип" ch={<Sel value={nPay.type} onChange={e=>setNPay(x=>({...x,type:e.target.value}))}><option value="stage">По этапу</option><option value="date">По дате</option><option value="manual">Вручную</option></Sel>}/>
              </div>
              {nPay.type==='stage' && <Fl l="При этапе" ch={<Sel value={nPay.stageTrigger} onChange={e=>setNPay(x=>({...x,stageTrigger:e.target.value}))}>{pl.map(p=><option key={p.id} value={p.id}>{p.l}</option>)}</Sel>}/>}
              {nPay.type==='date'  && <Fl l="Дата" ch={<Inp type="date" value={nPay.dateTrigger} onChange={e=>setNPay(x=>({...x,dateTrigger:e.target.value}))}/>}/>}
              <Fl l="Заметка" ch={<Inp value={nPay.note} onChange={e=>setNPay(x=>({...x,note:e.target.value}))} placeholder="Условия оплаты..."/>}/>
              <div style={{display:'flex',gap:8}}><Btn variant="primary" size="sm" onClick={addPay}><i className="ti ti-plus"/>Добавить</Btn><Btn size="sm" onClick={()=>setShowAdd(false)}>Отмена</Btn></div>
            </div>
          )}
        </div>
      )}
      {payments.length===0 && <div style={{textAlign:'center',padding:'44px 20px',color:'#64748b'}}><i className="ti ti-cash" style={{fontSize:40,display:'block',marginBottom:10,opacity:.2}}/><p style={{fontSize:15,fontWeight:500}}>Нет платежей</p></div>}
    </div>
  )
}

function ReassTab({ c, set, canEdit }) {
  return <>
    <div style={{display:'flex',alignItems:'center',gap:11,padding:13,background:'#f8fafc',borderRadius:13,border:'2px solid #e2e8f0',marginBottom:14}}>
      <span style={{fontWeight:700,fontSize:15,flex:1}}>🔄 Переуступка</span>
      <Tgl on={c.isReassignment} onClick={()=>canEdit&&set('isReassignment',!c.isReassignment)}/>
    </div>
    {c.isReassignment && <>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Fl l="Жилой комплекс" ch={<Inp value={c.reassignmentComplex}    onChange={e=>set('reassignmentComplex',e.target.value)}/>}/>
        <Fl l="Застройщик"     ch={<Inp value={c.reassignmentDeveloper}   onChange={e=>set('reassignmentDeveloper',e.target.value)}/>}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
        <Fl l="Сумма (₸)"         ch={<Inp type="number" value={c.reassignmentAmount} onChange={e=>set('reassignmentAmount',e.target.value)}/>}/>
        <Fl l="Остаток ипотеки (₸)" ch={<Inp type="number" value={c.mortgageBalance}   onChange={e=>set('mortgageBalance',e.target.value)}/>}/>
        <Fl l="Банк"              ch={<Inp value={c.reassignmentBank}    onChange={e=>set('reassignmentBank',e.target.value)}/>}/>
      </div>
      <div style={{display:'flex',gap:10}}>
        {[['hasDebt','⚠️ Есть задолженность','#f59e0b'],['urgentSale','🔥 Срочная продажа','#ef4444']].map(([k,l,col])=>(
          <div key={k} onClick={()=>canEdit&&set(k,!c[k])}
            style={{flex:1,display:'flex',alignItems:'center',gap:10,padding:12,border:`2px solid ${c[k]?col:'#e2e8f0'}`,borderRadius:11,cursor:canEdit?'pointer':'default',background:c[k]?col+'11':'#f8fafc'}}>
            <div style={{width:19,height:19,borderRadius:5,border:`2px solid ${c[k]?col:'#cbd5e1'}`,background:c[k]?col:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              {c[k] && <i className="ti ti-check" style={{fontSize:11,color:'#fff'}}/>}
            </div>
            <span style={{fontSize:14,fontWeight:700,color:c[k]?col:'#0f172a'}}>{l}</span>
          </div>
        ))}
      </div>
    </>}
  </>
}

// ─── ЭТАПЫ КРЕДИТОВАНИЯ (вставляется внутрь AccompTab на этапе "Сделка") ─────
const DEAL_STEPS_LIST = [
  { id:'ds1',  n:'Предварительное одобрение',            sub:'Подача заявки, проверка кредитной истории',                                                   cost:'' },
  { id:'ds2',  n:'Поиск квартиры',                       sub:'После одобрения — ищем подходящий объект',                                                     cost:'' },
  { id:'ds3',  n:'Задаток',                              sub:'Договор задатка с продавцом',                                                                   cost:'от 50 000 — 200 000 ₸ (возвращается)' },
  { id:'ds4',  n:'Оценка недвижимости (1-2 дня)',        sub:'Документы продавца: У/Л, ТП, УГР, ДКП, Форма 2, Свид. о браке',                               cost:'21 600 ₸' },
  { id:'ds5',  n:'Проверка на задолженность',            sub:'У/Л и У/Л супруги — покупателя и продавца',                                                    cost:'' },
  { id:'ds6',  n:'Логин/пароль Отбасы банка',            sub:'Открыть личный кабинет Отбасы',                                                                 cost:'' },
  { id:'ds7',  n:'Открыть текущий счёт',                 sub:'В Отбасы банке для проведения сделки',                                                          cost:'' },
  { id:'ds8',  n:'Кредитная заявка — документы',         sub:'Покупатель: У/Л, свид. о браке, У/Л супруги · Продавец: У/Л, свид. о браке, У/Л супруги, КЗ счёт 20-знач., Форма 2, ТП, УГР, ДКП', cost:'' },
  { id:'ds9',  n:'Уведомление об одобрении',             sub:'Банк выдаёт одобрение на конкретную квартиру',                                                  cost:'' },
  { id:'ds10', n:'ДКП у нотариуса',                      sub:'Покупатель: У/Л, свид. о браке, У/Л супруги · Продавец: + Форма 2, ТП, УГР, ДКП, КЗ счёт',   cost:'51 900 + 2 292 + 6 488 = 60 680 ₸' },
  { id:'ds11', n:'Регистрация ДКП',                      sub:'Ускоренно 2 часа — 7 085 ₸  ·  Обычная 1.5 дня — 1 555 ₸',                                    cost:'1 555 — 7 085 ₸' },
  { id:'ds12', n:'Получить Форму 2',                     sub:'Согласие супруги строго по образцу Отбасы банка',                                               cost:'' },
  { id:'ds13', n:'Сдача документов в банк для ДЗНИ',     sub:'а) ДКП  б) ТП  в) УГР  г) Форма 2  д) Согласие',                                              cost:'' },
  { id:'ds14', n:'Подписание ДЗНИ, ДБЗ, ДЗЖСС',         sub:'Блок чейн тайраса · Форма 2 уверенное · документы до 13:00',                                   cost:'' },
  { id:'ds15', n:'Вынесение текущего счёта, комиссия',   sub:'У блокции · у тәлімберді',                                                                      cost:'' },
  { id:'ds16', n:'Регистрация ДЗНИ у нотариуса',         sub:'Регистрация 23 788 + Заявление 2 292 + Согласие 6 488 = 32 568 ₸',                             cost:'32 568 ₸ (+ ускорено 7 085 ₸)' },
  { id:'ds17', n:'Выдача — перевод денег продавцу',      sub:'Страховка · Календарь и график · Берегите клиента · После одобрения — базар',                  cost:'Страховка ~0.3%/год от цены' },
]

// Отдельный компонент для строки шага — чтобы useState не был внутри .map()
function DealStepRow({ step, i, isDone, note, canEdit, onToggle, onNote }) {
  const [showNote, setShowNote] = useState(false)
  return (
    <div key={step.id} style={{borderBottom:i<DEAL_STEPS_LIST.length-1?'1px solid #f0fdfa':'none'}}>
      <div
        onClick={() => onToggle(step.id)}
        style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 14px',cursor:canEdit?'pointer':'default',
          background:isDone?'#f0fdfa':'transparent',transition:'background .15s'}}
        onMouseEnter={e=>{if(canEdit&&!isDone)e.currentTarget.style.background='#f8fffe'}}
        onMouseLeave={e=>{e.currentTarget.style.background=isDone?'#f0fdfa':'transparent'}}>
        <div style={{width:22,height:22,borderRadius:7,border:`2.5px solid ${isDone?'#14b8a6':'#cbd5e1'}`,
          background:isDone?'#14b8a6':'transparent',display:'flex',alignItems:'center',justifyContent:'center',
          flexShrink:0,marginTop:1,transition:'all .18s'}}>
          {isDone && <i className="ti ti-check" style={{fontSize:12,color:'#fff'}}/>}
        </div>
        <div style={{width:20,height:20,borderRadius:6,background:isDone?'#14b8a6':'#e2e8f0',
          display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>
          <span style={{fontSize:9,fontWeight:700,color:isDone?'#fff':'#64748b'}}>{i+1}</span>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:600,color:isDone?'#0f766e':'#0f172a',
            textDecoration:isDone?'line-through':'none',lineHeight:1.35}}>{step.n}</div>
          {step.sub && <div style={{fontSize:11,color:'#64748b',marginTop:2,lineHeight:1.4}}>{step.sub}</div>}
          {step.cost && (
            <div style={{display:'inline-flex',alignItems:'center',gap:4,marginTop:4,background:'#fef3c7',
              border:'1px solid #fde68a',borderRadius:6,padding:'2px 7px',fontSize:10,fontWeight:600,color:'#92400e'}}>
              <i className="ti ti-coins" style={{fontSize:10}}/>{step.cost}
            </div>
          )}
          {note && <div style={{fontSize:10,color:'#0d9488',marginTop:3,fontStyle:'italic'}}>📝 {note}</div>}
        </div>
        {canEdit && (
          <button
            onClick={e=>{e.stopPropagation();setShowNote(v=>!v)}}
            style={{padding:'3px 7px',border:'1px solid #e2e8f0',borderRadius:6,background:'transparent',
              cursor:'pointer',fontSize:10,color:'#64748b',flexShrink:0,marginTop:1}}>
            <i className="ti ti-notes" style={{fontSize:11}}/>
          </button>
        )}
      </div>
      {showNote && canEdit && (
        <div style={{padding:'0 14px 10px 56px'}} onClick={e=>e.stopPropagation()}>
          <input
            value={note}
            onChange={e=>onNote(step.id,e.target.value)}
            placeholder="Заметка по этому шагу..."
            style={{width:'100%',padding:'6px 10px',border:'1.5px solid #99f6e4',borderRadius:8,
              fontSize:12,background:'#f0fdfa',color:'#0f172a',outline:'none'}}
          />
        </div>
      )}
    </div>
  )
}

function DealStepsBlock({ c, setC, canEdit }) {
  const done  = new Set(c.dealStepsDone || [])
  const notes = c.dealStepsNotes || {}

  function toggle(id) {
    if (!canEdit) return
    const next = new Set(done)
    next.has(id) ? next.delete(id) : next.add(id)
    setC(prev => ({ ...prev, dealStepsDone: [...next] }))
  }

  function setNote(id, val) {
    if (!canEdit) return
    setC(prev => ({ ...prev, dealStepsNotes: { ...(prev.dealStepsNotes||{}), [id]: val } }))
  }

  const pct = Math.round(done.size / DEAL_STEPS_LIST.length * 100)

  return (
    <div style={{background:'#fff',border:'2px solid #14b8a6',borderRadius:14,overflow:'hidden',marginBottom:10,boxShadow:'0 2px 8px rgba(20,184,166,.12)'}}>
      <div style={{padding:'12px 15px',background:'linear-gradient(90deg,#f0fdfa,#e6fffa)',borderBottom:'1.5px solid #99f6e4',display:'flex',alignItems:'center',gap:11}}>
        <div style={{width:36,height:36,borderRadius:11,background:'#14b8a6',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:18}}>📋</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:800,fontSize:14,color:'#0f766e'}}>Этапы кредитования</div>
          <div style={{fontSize:11,color:'#0d9488',marginTop:1}}>Шаг за шагом к ключам — {done.size}/{DEAL_STEPS_LIST.length}</div>
        </div>
        <div style={{fontWeight:900,fontSize:22,color:'#14b8a6',letterSpacing:'-1px'}}>{pct}%</div>
      </div>
      <div style={{height:4,background:'#ccfbf1'}}>
        <div style={{width:pct+'%',height:'100%',background:'#14b8a6',transition:'width .3s'}}/>
      </div>
      {DEAL_STEPS_LIST.map((step, i) => (
        <DealStepRow
          key={step.id}
          step={step}
          i={i}
          isDone={done.has(step.id)}
          note={notes[step.id] || ''}
          canEdit={canEdit}
          onToggle={toggle}
          onNote={setNote}
        />
      ))}
      <div style={{padding:'10px 15px',background:'#f0fdfa',borderTop:'1.5px solid #99f6e4',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontSize:11,color:'#0d9488',fontWeight:500}}>
          {done.size === DEAL_STEPS_LIST.length ? '🎉 Все этапы пройдены!' : `Осталось: ${DEAL_STEPS_LIST.length - done.size} из ${DEAL_STEPS_LIST.length}`}
        </div>
        {canEdit && done.size > 0 && (
          <button onClick={()=>setC(prev=>({...prev,dealStepsDone:[],dealStepsNotes:{}}))}
            style={{fontSize:10,color:'#94a3b8',background:'none',border:'none',cursor:'pointer',padding:'2px 6px'}}>
            Сбросить
          </button>
        )}
      </div>
    </div>
  )
}

function AccompTab({ c, setC, managers, canEdit, checklists, user, accIdx, setAccIdx, autoBanner, setAutoBanner, toggleCheck, overallPct, totalDone, totalItems, getSD, setSD, toast$ }) {
  const [newCmt,  setNewCmt]  = useState({})
  const [newTask, setNewTask] = useState({})
  const fileRefs = useRef({})
  const cls = checklists || {}
  const aStages = c.accompStages || {}

  function addCmt(si) {
    const t = (newCmt[si]||'').trim()
    if (!t) return
    const sd = getSD(si)
    setSD(si, {...sd, comments:[...(sd.comments||[]),{id:uid(),text:t,date:nowStr(),author:user.name}]})
    setNewCmt(x=>({...x,[si]:''}))
  }
  function delCmt(si, cid) {
    const sd = getSD(si)
    setSD(si, {...sd, comments:(sd.comments||[]).filter(c=>c.id!==cid)})
  }
  function addTask(si) {
    const t = newTask[si]
    if (!t?.text?.trim()) return
    const sd   = getSD(si)
    const task = {id:uid(),type:t.type||'📞 Позвонить',text:t.text,due:t.due||'',done:false,created:nowStr(),stage:ACCOMP[si],isStageTask:true}
    setSD(si, {...sd, tasks:[...(sd.tasks||[]),task]})
    setC({...c, tasks:[...(c.tasks||[]),task]})
    setNewTask(x=>({...x,[si]:{type:'📞 Позвонить',text:'',due:''}}))
  }
  function toggleTask(si, tid) {
    const sd = getSD(si)
    const toggle = t => t.id===tid ? {...t, done:!t.done, doneAt: !t.done ? nowStr() : null} : t
    setSD(si, {...sd, tasks:(sd.tasks||[]).map(toggle)})
    setC({...c, tasks:(c.tasks||[]).map(toggle)})
  }
  const [uploading, setUploading] = useState(false)

  async function handleFiles(si, files) {
    const MAX_DOC = 20 * 1024 * 1024  // 20 МБ — лимит Google Drive
    const list = Array.from(files)
    const tooBig = list.filter(f => f.size > MAX_DOC)
    const ok     = list.filter(f => f.size <= MAX_DOC)

    if (tooBig.length) {
      toast$(`⚠️ ${tooBig.length} файл(а) пропущено — больше 20 МБ`, 'err')
    }
    if (!ok.length) return

    setUploading(true)
    let uploaded = 0
    for (const file of ok) {
      try {
        const res = await api.uploadDriveFile(c.id, file, c.driveFolderName || c.fio || '')
        const doc = {
          id:           uid(),
          name:         res.file?.name || file.name,
          type:         file.type.includes('image') ? 'photo' : 'doc',
          driveFileId:  res.file?.id,
          driveLink:    res.file?.webViewLink || res.folderLink,
          size:         file.size,
          uploadDate:   nowStr(),
          note:         '',
          stage:        ACCOMP[si],
        }
        const sdCurr = getSD(si)
        setSD(si, {...sdCurr, docs:[...(sdCurr.docs||[]), doc]})
        // Обновляем ссылку на папку в карточке если её ещё нет
        if (res.folderLink && !c.driveLink) {
          setC(prev => ({...prev, driveLink: res.folderLink, driveFolderName: res.folder?.name || prev.driveFolderName}))
        }
        uploaded++
      } catch (e) {
        toast$(`❌ Ошибка загрузки "${file.name}": ${e.message}`, 'err')
      }
    }
    setUploading(false)
    if (uploaded) toast$(`📎 ${uploaded} файл(а) загружено в Google Drive`)
  }
  function delDoc(si, did) {
    const sd  = getSD(si)
    const doc = (sd.docs||[]).find(d=>d.id===did)
    setSD(si, {...sd, docs:(sd.docs||[]).filter(d=>d.id!==did)})
    // Удаляем из Drive (best-effort — не блокируем UI при ошибке)
    if (doc?.driveFileId) {
      api.deleteDriveFile(c.id, doc.driveFileId).catch(()=>{})
    }
  }

  const nt = newTask[accIdx] || {type:'📞 Позвонить',text:'',due:''}

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:13}}>
        <Fl l="Ответственный менеджер" ch={<Sel value={c.responsibleManager||''} onChange={e=>setC({...c,responsibleManager:e.target.value})} disabled={!canEdit}><option value="">Не назначен</option>{managers.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</Sel>}/>
        <Fl l="Ипотечный специалист"   ch={<Inp value={c.mortgageSpecialist||''} onChange={e=>setC({...c,mortgageSpecialist:e.target.value})} placeholder="ФИО специалиста"/>}/>
      </div>

      {/* Overall progress */}
      <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:14,padding:15,marginBottom:13,boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:9}}>
          <div style={{fontWeight:800,fontSize:14}}>Общий прогресс сопровождения</div>
          <div style={{fontWeight:900,fontSize:22,color:overallPct===100?'#10b981':'#3b82f6',letterSpacing:'-1px'}}>{overallPct}%</div>
        </div>
        <Prog pct={overallPct} c={overallPct===100?'#10b981':'#3b82f6'} sz='h'/>
        <div style={{fontSize:12,color:'#64748b',marginTop:5}}>{totalDone} из {totalItems} пунктов</div>
      </div>

      {/* Auto-transition banner */}
      {autoBanner && (
        <div style={{background:'#f0fdf4',border:'2px solid #86efac',borderRadius:14,padding:14,marginBottom:13,display:'flex',alignItems:'center',gap:12,animation:'slideIn .3s ease'}}>
          <div style={{width:40,height:40,borderRadius:12,background:'#10b981',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:20}}>🎉</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:14,color:'#065f46'}}>"{autoBanner.fromName}" завершён!</div>
            <div style={{fontSize:12,color:'#047857',marginTop:2}}>Перейти к: {autoBanner.toName}?</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <Btn variant="success" size="sm" onClick={()=>{setC({...c,accompStageIndex:autoBanner.toIdx});setAccIdx(autoBanner.toIdx);setAutoBanner(null);toast$('📍 '+autoBanner.toName)}}>
              <i className="ti ti-arrow-right"/>Перейти
            </Btn>
            <Btn size="sm" onClick={()=>setAutoBanner(null)}>Позже</Btn>
          </div>
        </div>
      )}

      {/* Stage dots */}
      <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:14,marginBottom:13,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
        <div style={{padding:'11px 14px',fontWeight:700,fontSize:13,borderBottom:'1px solid #e2e8f0',display:'flex',justifyContent:'space-between'}}>
          <span>Этапы сопровождения</span>
          <span style={{fontSize:12,color:'#64748b',fontWeight:500}}>Текущий: <b style={{color:'#3b82f6'}}>{ACCOMP[c.accompStageIndex]}</b></span>
        </div>
        <div style={{display:'flex',overflowX:'auto',padding:'11px 8px',gap:0}}>
          {ACCOMP.map((s, i) => {
            const sd      = aStages[i]||{}
            const items   = cls[s]||[]
            const done    = (sd.done||[]).length
            const allDone = items.length>0&&done===items.length
            const isAct   = accIdx===i
            return (
              <div key={s} style={{flex:1,minWidth:62,textAlign:'center',position:'relative',cursor:'pointer'}} onClick={()=>setAccIdx(i)}>
                {i<ACCOMP.length-1&&<div style={{position:'absolute',top:11,left:'50%',right:'-50%',height:2,background:allDone?'#10b981':i<c.accompStageIndex?'#3b82f6':'#e2e8f0',zIndex:0}}/>}
                <div style={{width:22,height:22,borderRadius:'50%',border:`2.5px solid ${allDone?'#10b981':isAct?'#3b82f6':'#cbd5e1'}`,background:allDone?'#10b981':isAct?'#3b82f6':'#fff',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 4px',fontSize:9.5,fontWeight:700,color:allDone||isAct?'#fff':'#64748b',position:'relative',zIndex:1,transition:'all .2s',boxShadow:isAct?'0 0 0 5px rgba(59,130,246,.18)':'none'}}>
                  {allDone?<i className="ti ti-check" style={{fontSize:9}}/>:i+1}
                </div>
                <div style={{fontSize:8.5,color:isAct?'#3b82f6':allDone?'#10b981':'#64748b',lineHeight:1.2,fontWeight:isAct||allDone?700:500,padding:'0 1px'}}>{s}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Active stage detail */}
      {ACCOMP.map((sName, si) => {
        if (si !== accIdx) return null
        const sd         = aStages[si]||{}
        const items      = cls[sName]||[]
        const done       = sd.done||[]
        const pct        = items.length>0?Math.round(done.length/items.length*100):100
        const isComplete = pct===100||items.length===0
        const incomplete = items.filter(item=>!done.includes(item.id))
        const stageTasks = sd.tasks||[]
        const stageDocs  = sd.docs||[]
        const stageCmts  = sd.comments||[]

        return (
          <div key={sName}>
            {/* Stage header */}
            <div style={{background:'#fff',border:`2px solid ${isComplete?'#10b981':'#3b82f6'}`,borderRadius:14,overflow:'hidden',marginBottom:10,boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
              <div style={{padding:'13px 15px',background:isComplete?'#f0fdf4':'#eff6ff',display:'flex',alignItems:'center',gap:11}}>
                <div style={{width:36,height:36,borderRadius:11,background:isComplete?'#10b981':'#3b82f6',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  {isComplete?<i className="ti ti-check" style={{color:'#fff',fontSize:17}}/>:<i className="ti ti-clock" style={{color:'#fff',fontSize:17}}/>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:800,fontSize:15,color:isComplete?'#065f46':'#1d4ed8'}}>{sName}</div>
                  <div style={{fontSize:12,color:isComplete?'#047857':'#3b82f6',marginTop:1}}>{isComplete?'Все выполнены ✓':`${done.length}/${items.length}`}</div>
                </div>
                <div style={{fontWeight:900,fontSize:22,color:isComplete?'#10b981':'#3b82f6'}}>{pct}%</div>
                <Btn size="sm" variant="primary" onClick={()=>canEdit&&setC({...c,accompStageIndex:si})}>📍 Текущий</Btn>
              </div>

              {!isComplete && (
                <div style={{background:'#fffbeb',border:'1.5px solid #fde68a',borderRadius:10,padding:'10px 13px',margin:'10px 13px',display:'flex',gap:9,alignItems:'flex-start'}}>
                  <i className="ti ti-alert-triangle" style={{color:'#d97706',fontSize:16,marginTop:2,flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:12,color:'#92400e',marginBottom:5}}>Незавершённые пункты:</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                      {incomplete.map(item => (
                        <span key={item.id} style={{background:'#fff',border:'1px solid #fde68a',borderRadius:5,padding:'2px 8px',fontSize:10,fontWeight:700,color:'#92400e',display:'inline-flex',alignItems:'center',gap:3}}>
                          <i className={`ti ${TI[item.tp||'check']}`} style={{fontSize:10,color:TC[item.tp||'check']}}/>{item.t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {items.length > 0 && <div style={{padding:'0 13px 4px'}}><Prog pct={pct} c={isComplete?'#10b981':'#3b82f6'} sz='sm'/></div>}
            </div>

            {/* Этапы кредитования — показываем только на этапе "Сделка" */}
            {sName === 'Сделка' && (
              <DealStepsBlock c={c} setC={setC} canEdit={canEdit}/>
            )}

            {/* Checklist */}
            {items.length > 0 && (
              <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:14,overflow:'hidden',marginBottom:10,boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 15px',borderBottom:'1.5px solid #e2e8f0',background:'#f8fafc',fontSize:12,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'.05em'}}>
                  <span>📋 Чек-лист</span><span style={{fontWeight:500}}>{done.length}/{items.length}</span>
                </div>
                {items.map(item => {
                  const isDone = done.includes(item.id)
                  return (
                    <div key={item.id} onClick={()=>canEdit&&toggleCheck(si,item.id)}
                      style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderBottom:'1px solid #e2e8f0',cursor:canEdit?'pointer':'default',transition:'background .1s',background:isDone?'#f0fdf4':'transparent'}}
                      onMouseEnter={e=>{if(canEdit)e.currentTarget.style.background=isDone?'#f0fdf4':'#f8fafc'}}
                      onMouseLeave={e=>{e.currentTarget.style.background=isDone?'#f0fdf4':'transparent'}}>
                      <div style={{width:20,height:20,borderRadius:6,border:`2.5px solid ${isDone?'#10b981':'#cbd5e1'}`,background:isDone?'#10b981':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .18s'}}>
                        {isDone && <i className="ti ti-check" style={{fontSize:11,color:'#fff'}}/>}
                      </div>
                      <div style={{width:26,height:26,borderRadius:7,background:TB[item.tp||'check'],display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <i className={`ti ${TI[item.tp||'check']}`} style={{fontSize:13,color:TC[item.tp||'check']}}/>
                      </div>
                      <div style={{flex:1,fontSize:13,fontWeight:500,textDecoration:isDone?'line-through':'none',color:isDone?'#64748b':'#0f172a'}}>{item.t}</div>
                      <span style={{fontSize:9,fontWeight:700,background:TB[item.tp||'check'],color:TC[item.tp||'check'],borderRadius:5,padding:'2px 6px'}}>{TL[item.tp||'check']}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Documents */}
            <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:14,overflow:'hidden',marginBottom:10,boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 15px',borderBottom:'1.5px solid #e2e8f0',background:'#f8fafc',fontSize:12,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'.05em'}}>
                <span>📎 Документы этапа</span><span style={{fontWeight:500}}>{stageDocs.length}</span>
              </div>
              {stageDocs.map(doc => {
                const isImg = doc.type === 'photo'
                return (
                  <div key={doc.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 13px',borderBottom:'1px solid #e2e8f0'}}>
                    <div style={{width:44,height:44,borderRadius:8,background:isImg?'#f0fdf4':'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <i className={isImg?"ti ti-photo":"ti ti-file-text"} style={{fontSize:20,color:isImg?'#10b981':'#3b82f6'}}/>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{doc.name}</div>
                      <div style={{fontSize:11,color:'#64748b'}}>{doc.uploadDate}{doc.size?' · '+fmtSize(doc.size):''}</div>
                    </div>
                    {doc.driveLink && <a href={doc.driveLink} target="_blank" rel="noopener noreferrer" style={{textDecoration:'none'}}><Btn size="sm"><i className="ti ti-external-link" style={{fontSize:14}}/></Btn></a>}
                    {canEdit && <Btn size="sm" variant="danger" onClick={()=>delDoc(si,doc.id)}><i className="ti ti-trash" style={{fontSize:13}}/></Btn>}
                  </div>
                )
              })}
              {canEdit && (
                <div style={{padding:'10px 13px'}}>
                  <div
                    style={{border:'2.5px dashed #cbd5e1',borderRadius:12,padding:24,textAlign:'center',cursor:uploading?'wait':'pointer',transition:'all .15s',opacity:uploading?0.6:1,position:'relative'}}
                    onClick={()=>!uploading&&fileRefs.current[si]?.click()}
                    onDragOver={e=>e.preventDefault()}
                    onDrop={e=>{e.preventDefault();!uploading&&handleFiles(si,e.dataTransfer.files)}}
                    onMouseEnter={e=>{if(!uploading){e.currentTarget.style.borderColor='#3b82f6';e.currentTarget.style.background='#eff6ff'}}}
                    onMouseLeave={e=>{if(!uploading){e.currentTarget.style.borderColor='#cbd5e1';e.currentTarget.style.background='transparent'}}}>
                    {uploading
                      ? <>
                          <i className="ti ti-loader-2 spin" style={{fontSize:26,color:'#3b82f6',display:'block',marginBottom:5}}/>
                          <div style={{fontWeight:600,fontSize:13,color:'#3b82f6'}}>Загрузка в Google Drive...</div>
                        </>
                      : <>
                          <i className="ti ti-cloud-upload" style={{fontSize:26,color:'#94a3b8',display:'block',marginBottom:5}}/>
                          <div style={{fontWeight:600,fontSize:13,color:'#64748b'}}>Перетащите или нажмите для загрузки</div>
                          <div style={{fontSize:11,color:'#94a3b8',marginTop:2}}>Фото, PDF, документы — до 20 МБ</div>
                        </>}
                  </div>
                  <input ref={el=>fileRefs.current[si]=el} type="file" multiple accept="image/*,.pdf,.doc,.docx" style={{display:'none'}} onChange={e=>handleFiles(si,e.target.files)} disabled={uploading}/>
                </div>
              )}
            </div>

            {/* Tasks */}
            <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:14,overflow:'hidden',marginBottom:10,boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 15px',borderBottom:'1.5px solid #e2e8f0',background:'#f8fafc',fontSize:12,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'.05em'}}>
                <span>✅ Задачи этапа</span>
                <Tag c='#3b82f6' ch={`${stageTasks.filter(t=>!t.done).length} открытых`}/>
              </div>
              {stageTasks.map(t => (
                <div key={t.id} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderBottom:'1px solid #e2e8f0',cursor:'pointer',transition:'background .1s',background:t.done?'#f0fdf4':'transparent'}}>
                  <div style={{width:20,height:20,borderRadius:'50%',border:`2.5px solid ${t.done?'#10b981':'#cbd5e1'}`,background:t.done?'#10b981':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,cursor:'pointer',transition:'all .18s'}} onClick={()=>toggleTask(si,t.id)}>
                    {t.done && <i className="ti ti-check" style={{fontSize:11,color:'#fff'}}/>}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:13,textDecoration:t.done?'line-through':'none',color:t.done?'#64748b':'#0f172a'}}>{t.type}</div>
                    {t.text && <div style={{fontSize:11,color:'#64748b'}}>{t.text}</div>}
                    {t.due  && <div style={{fontSize:11,color:t.due<today()&&!t.done?'#ef4444':'#94a3b8',fontWeight:t.due<today()&&!t.done?700:400}}>📅 {t.due}</div>}
                  </div>
                </div>
              ))}
              {canEdit && (
                <div style={{padding:'11px 13px',background:'#f8fafc',borderTop:'1px solid #e2e8f0'}}>
                  <div style={{display:'flex',gap:7,marginBottom:7}}>
                    <Sel value={nt.type||''} onChange={e=>setNewTask(x=>({...x,[si]:{...(x[si]||{}),type:e.target.value}}))} style={{width:180}}>
                      {TASK_T.map(t=><option key={t}>{t}</option>)}
                    </Sel>
                    <Inp type="date" value={nt.due||''} onChange={e=>setNewTask(x=>({...x,[si]:{...(x[si]||{}),due:e.target.value}}))} style={{width:150}}/>
                  </div>
                  <div style={{display:'flex',gap:7}}>
                    <Inp value={nt.text||''} onChange={e=>setNewTask(x=>({...x,[si]:{...(x[si]||{}),text:e.target.value}}))} placeholder="Описание задачи..." style={{flex:1}}
                      onKeyDown={e=>e.key==='Enter'&&addTask(si)}/>
                    <Btn variant="primary" size="sm" onClick={()=>addTask(si)}><i className="ti ti-plus"/></Btn>
                  </div>
                </div>
              )}
            </div>

            {/* Comments */}
            <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:14,overflow:'hidden',marginBottom:10,boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 15px',borderBottom:'1.5px solid #e2e8f0',background:'#f8fafc',fontSize:12,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'.05em'}}>
                <span>💬 Комментарии</span><span style={{fontWeight:500}}>{stageCmts.length}</span>
              </div>
              {stageCmts.length===0 && <div style={{padding:'13px 15px',fontSize:13,color:'#64748b',fontStyle:'italic'}}>Нет комментариев</div>}
              {stageCmts.map(cm => (
                <div key={cm.id} style={{padding:'11px 14px',borderBottom:'1px solid #e2e8f0'}}>
                  <div style={{display:'flex',gap:7,alignItems:'center',fontSize:11,color:'#64748b',marginBottom:3}}>
                    <i className="ti ti-message" style={{fontSize:11}}/><b>{cm.author}</b><span>{cm.date}</span>
                    {canEdit && <button onClick={()=>delCmt(si,cm.id)} style={{marginLeft:'auto',border:'none',background:'transparent',color:'#ef4444',cursor:'pointer',fontSize:11,fontFamily:'inherit'}}><i className="ti ti-trash" style={{fontSize:11}}/></button>}
                  </div>
                  <div style={{fontSize:13,lineHeight:1.55}}>{cm.text}</div>
                </div>
              ))}
              {canEdit && (
                <div style={{display:'flex',gap:7,padding:'11px 13px',borderTop:'1px solid #e2e8f0'}}>
                  <Inp value={newCmt[si]||''} onChange={e=>setNewCmt(x=>({...x,[si]:e.target.value}))} placeholder={`Заметка к "${sName}"...`} style={{flex:1}}
                    onKeyDown={e=>e.key==='Enter'&&addCmt(si)}/>
                  <Btn variant="primary" size="sm" onClick={()=>addCmt(si)}><i className="ti ti-send"/></Btn>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div style={{display:'flex',gap:10,marginBottom:14}}>
              <Btn style={{flex:1,justifyContent:'center',opacity:si===0?.35:1}} onClick={()=>setAccIdx(Math.max(0,si-1))} disabled={si===0}>
                <i className="ti ti-arrow-left"/>Предыдущий
              </Btn>
              <Btn variant="primary" style={{flex:1,justifyContent:'center',opacity:si===ACCOMP.length-1?.35:1}} onClick={()=>setAccIdx(Math.min(ACCOMP.length-1,si+1))} disabled={si===ACCOMP.length-1}>
                Следующий<i className="ti ti-arrow-right"/>
              </Btn>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TasksTabC({ c, setC, user, canEdit }) {
  const [nTask, setNTask] = useState({ type:TASK_T[0], text:'', due:'' })
  const tasks = c.tasks || []
  function add() {
    if (!nTask.text.trim()) return
    setC({...c, tasks:[...tasks,{id:uid(),...nTask,done:false,created:nowStr()}]})
    setNTask({type:TASK_T[0],text:'',due:''})
  }
  function tog(id) { setC({...c, tasks:tasks.map(t=>t.id===id?{...t,done:!t.done,doneAt:!t.done?nowStr():null}:t)}) }
  function del(id) {
    // Удаляем из c.tasks и синхронно из accompStages (задачи дублируются там)
    const newTasks = tasks.filter(t => t.id !== id)
    const newStages = Object.fromEntries(
      Object.entries(c.accompStages || {}).map(([k, v]) => [k, {...v, tasks: (v.tasks||[]).filter(t => t.id !== id)}])
    )
    setC({...c, tasks: newTasks, accompStages: newStages})
  }
  const open = tasks.filter(t=>!t.done)
  const done = tasks.filter(t=>t.done)
  return (
    <div>
      {canEdit && (
        <div style={{background:'#f8fafc',borderRadius:12,padding:13,border:'1.5px solid #e2e8f0',marginBottom:13}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <Fl l="Тип" ch={<Sel value={nTask.type} onChange={e=>setNTask(x=>({...x,type:e.target.value}))}>{TASK_T.map(t=><option key={t}>{t}</option>)}</Sel>}/>
            <Fl l="Срок" ch={<Inp type="date" value={nTask.due} onChange={e=>setNTask(x=>({...x,due:e.target.value}))}/>}/>
          </div>
          <div style={{display:'flex',gap:8}}>
            <Inp value={nTask.text} onChange={e=>setNTask(x=>({...x,text:e.target.value}))} placeholder="Описание задачи..." style={{flex:1}} onKeyDown={e=>e.key==='Enter'&&add()}/>
            <Btn variant="primary" size="sm" onClick={add}><i className="ti ti-plus"/>Добавить</Btn>
          </div>
        </div>
      )}
      {open.map(t => (
        <div key={t.id} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:11,marginBottom:7}}>
          <div style={{width:20,height:20,borderRadius:'50%',border:'2.5px solid #cbd5e1',flexShrink:0,cursor:'pointer'}} onClick={()=>tog(t.id)}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:13}}>{t.type}</div>
            {t.text && <div style={{fontSize:12,color:'#64748b'}}>{t.text}</div>}
            {t.due  && <div style={{fontSize:11,color:t.due<today()?'#ef4444':'#94a3b8',fontWeight:t.due<today()?700:400}}>📅 {t.due}{t.due<today()?' ⚠️':''}</div>}
          </div>
          {canEdit && <Btn size="sm" variant="danger" onClick={()=>del(t.id)} style={{width:34,height:34,padding:0}}><i className="ti ti-trash"/></Btn>}
        </div>
      ))}
      {done.length > 0 && (
        <div style={{marginTop:14,opacity:.6}}>
          <div style={{fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',marginBottom:8}}>Завершённые ({done.length})</div>
          {done.map(t => (
            <div key={t.id} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',background:'#f0fdf4',border:'1.5px solid #bbf7d0',borderRadius:11,marginBottom:6}}>
              <div style={{width:20,height:20,borderRadius:'50%',background:'#10b981',border:'2.5px solid #10b981',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,cursor:'pointer'}} onClick={()=>tog(t.id)}>
                <i className="ti ti-check" style={{fontSize:11,color:'#fff'}}/>
              </div>
              <div style={{flex:1,textDecoration:'line-through',color:'#64748b',fontSize:13}}>{t.type}{t.text?` — ${t.text}`:''}</div>
            </div>
          ))}
        </div>
      )}
      {open.length===0&&done.length===0 && <div style={{textAlign:'center',padding:'44px 20px',color:'#64748b'}}><i className="ti ti-checkbox" style={{fontSize:40,display:'block',marginBottom:10,opacity:.2}}/><p style={{fontSize:15,fontWeight:500}}>Нет задач</p></div>}
    </div>
  )
}

function HistoryTab({ c, setC, user }) {
  // Разделяем обычные комментарии и аудит-записи
  const allEntries = [...(c.comments || [])].sort((a, b) =>
    (a.createdAt || '').localeCompare(b.createdAt || '')
  )
  const [txt, setTxt] = useState('')
  function add() {
    if (!txt.trim()) return
    setC({...c, comments:[...(c.comments||[]),{id:uid(),text:txt,date:nowStr(),author:user.name}]})
    setTxt('')
  }
  return (
    <div>
      <div style={{marginBottom:13}}>
        <div style={{display:'flex',gap:8}}>
          <textarea value={txt} onChange={e=>setTxt(e.target.value)} placeholder="Результат звонка, статус переговоров..."
            style={{flex:1,background:'#f8fafc',border:'2px solid #cbd5e1',borderRadius:10,padding:'10px 12px',fontSize:14,resize:'none',minHeight:60,outline:'none',fontFamily:'inherit'}}
            onFocus={e=>e.target.style.borderColor='#3b82f6'} onBlur={e=>e.target.style.borderColor='#cbd5e1'}/>
          <Btn variant="primary" size="sm" style={{alignSelf:'flex-end',flexShrink:0}} onClick={add}><i className="ti ti-send"/></Btn>
        </div>
      </div>
      {(c.comments||[]).length===0 && <div style={{textAlign:'center',padding:'44px 20px',color:'#64748b'}}><i className="ti ti-messages" style={{fontSize:40,display:'block',marginBottom:10,opacity:.2}}/><p style={{fontSize:15,fontWeight:500}}>История пустая</p></div>}
      {[...(c.comments||[])].reverse().map(cm => (
        <div key={cm.id} style={{padding:'11px 14px',borderBottom:'1px solid #e2e8f0'}}>
          <div style={{display:'flex',gap:7,alignItems:'center',fontSize:11,color:'#64748b',marginBottom:3}}>
            <i className="ti ti-message" style={{fontSize:11}}/><b>{cm.author}</b><span>{cm.date}</span>
          </div>
          <div style={{fontSize:13,lineHeight:1.55}}>{cm.text}</div>
        </div>
      ))}
    </div>
  )
}


// ─── Google Drive Tab ────────────────────────────────────────────────────────
function DriveTab({ c, setC, user }) {
  const [files,      setFiles]      = useState([])
  const [loading,    setLoading]    = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [uploadName, setUploadName] = useState('')
  const [error,      setError]      = useState('')
  const [folderLink, setFolderLink] = useState(c.driveLink || '')
  const driveInputRef = useRef(null)

  // Загружаем список файлов при открытии вкладки
  useEffect(() => {
    let cancelled = false
    loadFiles(cancelled)
    return () => { cancelled = true }  // cleanup: не обновляем стейт после размонтирования
  }, [c.id])

  async function loadFiles(cancelled) {
    setLoading(true)
    setError('')
    try {
      const data = await api.getDriveFiles(c.id, c.driveFolderName || c.fio || '')
      if (cancelled) return
      setFiles(data.files || [])
      if (data.folderLink && !c.driveLink) {
        setFolderLink(data.folderLink)
        setC({ ...c, driveLink: data.folderLink })
      }
    } catch (e) {
      if (!cancelled) setError(e.message)
    } finally {
      if (!cancelled) setLoading(false)
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadName(file.name)
    setError('')
    try {
      const data = await api.uploadDriveFile(c.id, file, c.driveFolderName || c.fio || '')
      if (data.folderLink) {
        setFolderLink(data.folderLink)
        setC({ ...c, driveLink: data.folderLink })
      }
      await loadFiles()
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
      setUploadName('')
      e.target.value = ''
    }
  }

  async function handleDelete(fileId, fileName) {
    if (!confirm(`Удалить файл "${fileName}"?`)) return
    setError('')
    try {
      await api.deleteDriveFile(c.id, fileId)
      setFiles(files.filter(f => f.id !== fileId))
    } catch (e) {
      setError(e.message)
    }
  }

  function fileIcon(mime) {
    if (!mime) return 'ti-file'
    if (mime.startsWith('image/'))                       return 'ti-photo'
    if (mime === 'application/pdf')                      return 'ti-file-type-pdf'
    if (mime.includes('word') || mime.includes('docx'))  return 'ti-file-type-doc'
    if (mime.includes('excel') || mime.includes('xlsx')) return 'ti-file-type-xls'
    if (mime.startsWith('video/'))                       return 'ti-video'
    if (mime.startsWith('audio/'))                       return 'ti-music'
    return 'ti-file'
  }

  const canDelete = user?.role === 'admin' || user?.role === 'head'

  return (
    <div style={{padding:'4px 0'}}>
      {/* Заголовок + кнопки */}
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, gap:10}}>
        <div style={{fontWeight:700, fontSize:14, color:'#0f172a'}}>
          Файлы клиента
          {files.length > 0 && <span style={{marginLeft:6, fontSize:12, fontWeight:500, color:'#64748b'}}>({files.length})</span>}
        </div>
        <div style={{display:'flex', gap:8}}>
          {folderLink && (
            <a href={folderLink} target="_blank" rel="noreferrer" style={{textDecoration:'none'}}>
              <button style={{display:'flex',alignItems:'center',gap:5,padding:'6px 12px',borderRadius:8,border:'1px solid #e2e8f0',background:'#f8fafc',color:'#64748b',fontSize:12,fontWeight:500,cursor:'pointer'}}>
                <i className="ti ti-brand-google-drive" style={{fontSize:14, color:'#1a73e8'}}/>
                Открыть папку
              </button>
            </a>
          )}
          <button
            onClick={() => driveInputRef.current?.click()}
            disabled={uploading}
            style={{display:'flex',alignItems:'center',gap:5,padding:'6px 14px',borderRadius:8,border:'none',background:uploading?'#94a3b8':'#3b82f6',color:'#fff',fontSize:12,fontWeight:600,cursor:uploading?'not-allowed':'pointer'}}>
            {uploading
              ? <><i className="ti ti-loader-2" style={{fontSize:13, animation:'spin 1s linear infinite'}}/>Загружаю...</>
              : <><i className="ti ti-upload" style={{fontSize:13}}/>Загрузить файл</>
            }
          </button>
        </div>
      </div>

      <input ref={driveInputRef} type="file" style={{display:'none'}}
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
        onChange={handleUpload}/>

      {/* Индикатор загрузки */}
      {uploading && (
        <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:10,padding:'10px 14px',marginBottom:12,fontSize:13,color:'#1d4ed8',display:'flex',alignItems:'center',gap:8}}>
          <i className="ti ti-loader-2" style={{fontSize:15}}/>
          Загружаю «{uploadName}» на Google Диск...
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:10,padding:'10px 14px',marginBottom:12,fontSize:13,color:'#dc2626'}}>
          <i className="ti ti-alert-circle" style={{marginRight:6}}/>
          {error.includes('не настроен')
            ? <>Google Drive не настроен. Попросите администратора добавить ключ сервис-аккаунта.</>
            : error
          }
        </div>
      )}

      {/* Список файлов */}
      {loading ? (
        <div style={{textAlign:'center',padding:'32px 0',color:'#94a3b8',fontSize:13}}>
          <i className="ti ti-loader-2" style={{fontSize:22,display:'block',marginBottom:6}}/>
          Загружаю список файлов...
        </div>
      ) : files.length === 0 ? (
        <div style={{textAlign:'center',padding:'40px 20px',color:'#94a3b8'}}>
          <i className="ti ti-folder-open" style={{fontSize:32,display:'block',marginBottom:8,color:'#cbd5e1'}}/>
          <div style={{fontSize:13,fontWeight:500}}>Файлов пока нет</div>
          <div style={{fontSize:12,marginTop:4}}>Нажмите «Загрузить файл» чтобы добавить документы клиента</div>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {files.map(f => (
            <div key={f.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:10,border:'1px solid #e2e8f0',background:'#f8fafc',transition:'background .12s'}}>
              <i className={`ti ${fileIcon(f.mimeType)}`} style={{fontSize:20,color:'#3b82f6',flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:500,color:'#0f172a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.name}</div>
                <div style={{fontSize:11,color:'#94a3b8',marginTop:2}}>
                  {f.size ? fmtSize(+f.size) : ''}
                  {f.size && f.createdTime ? ' · ' : ''}
                  {f.createdTime ? new Date(f.createdTime).toLocaleDateString('ru-RU') : ''}
                </div>
              </div>
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                <a href={f.webViewLink} target="_blank" rel="noreferrer"
                  style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:7,border:'1px solid #e2e8f0',background:'#fff',color:'#374151',fontSize:11,fontWeight:500,textDecoration:'none',cursor:'pointer'}}>
                  <i className="ti ti-eye" style={{fontSize:12}}/>Открыть
                </a>
                {f.webContentLink && (
                  <a href={f.webContentLink} target="_blank" rel="noreferrer"
                    style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:7,border:'1px solid #e2e8f0',background:'#fff',color:'#374151',fontSize:11,fontWeight:500,textDecoration:'none',cursor:'pointer'}}>
                    <i className="ti ti-download" style={{fontSize:12}}/>
                  </a>
                )}
                {canDelete && (
                  <button onClick={() => handleDelete(f.id, f.name)}
                    style={{display:'flex',alignItems:'center',padding:'5px 8px',borderRadius:7,border:'1px solid #fecaca',background:'#fff',color:'#dc2626',fontSize:11,cursor:'pointer'}}>
                    <i className="ti ti-trash" style={{fontSize:12}}/>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Подсказка */}
      <div style={{marginTop:16,fontSize:11,color:'#94a3b8',background:'#f8fafc',borderRadius:9,padding:'9px 12px',border:'1px solid #e2e8f0'}}>
        <i className="ti ti-info-circle" style={{marginRight:5}}/>
        Файлы сохраняются в Google Drive в папке клиента. Форматы: PDF, Word, Excel, изображения, ZIP (до 50 МБ)
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  СТРАНИЦА КАЛЬКУЛЯТОРА
// ════════════════════════════════════════════════════════════════════

// PROGRAMS / PROGS_DATA / D50 / fmtMoney / annuity и др. — теперь в lib/calcData.js
// Здесь только алиасы для обратной совместимости со старым кодом вкладок.


function ClientCalcTab({ c, user, toast$ }) {
  const [program,  setProgram]  = useState('nauryz20')
  const [price,    setPrice]    = useState(c.contractAmount > 0 ? String(c.contractAmount) : '')
  const [salary,   setSalary]   = useState(c.officialIncome || '')
  const [oldCred,  setOldCred]  = useState(c.monthlyLoad || '')
  const [members,  setMembers]  = useState('1')
  const [mode,     setMode]     = useState('price')
  const [result,   setResult]   = useState(null)
  const [busy,     setBusy]     = useState(false)
  const [sending,  setSending]  = useState(false)

  // Считаем суммарный доход (основной + доп)
  const totalIncome = (+(c.officialIncome)||0) + (+(c.extraIncomeConfirmed ? c.extraIncome : 0)||0)
  const [overrideIncome, setOverrideIncome] = React.useState(false)  // позволяет вручную изменить доход

  async function calc() {
    setBusy(true)
    setResult(null)
    try {
      let res
      const effectiveIncome = (!overrideIncome && totalIncome > 0) ? totalIncome : +salary
      if (mode === 'price') {
        res = await api.calc('mortgage_by_price', {
          program,
          price:   +price,
          members: Math.max(1, +members || 1),
          orgs:    [{ income: effectiveIncome, oldCredit: +oldCred }],
        })
      } else {
        res = await api.calc('mortgage_by_salary', {
          program,
          salary:    effectiveIncome,
          members:   Math.max(1, +members || 1),
          oldCredit: +oldCred,
        })
      }
      if (res?.ok) setResult(res)
      else toast$('❌ ' + (res?.message || 'Ошибка расчёта'), 'err')
    } catch(e) {
      toast$('❌ ' + e.message, 'err')
    } finally {
      setBusy(false)
    }
  }

  // Форматирует результат в красивое WA сообщение
  function buildWaMsg(result) {
    const prog = PROGRAMS_FALLBACK.find(p => p.key === program)
    const name = c.fio?.split(' ')[0] || 'Уважаемый клиент'

    if (mode === 'salary' && result.approved) {
      return `Здравствуйте, ${name}! 🏠

По программе *${prog?.name || program}*:

🏠 Максимальная цена квартиры: *${fmtMoney(result.maxPrice)}*
🏦 Сумма займа: *${fmtMoney(result.maxLoan)}*
💰 Первоначальный взнос: *${fmtMoney(result.down)}*
📅 Ежемесячный платёж: *${fmtMoney(result.payment)}*

Расчёт подготовил: ${user?.name || 'Менеджер'}`
    }

    if (mode === 'price' && result.variantsByPrice?.length) {
      const v = result.variantsByPrice[0]
      return `Здравствуйте, ${name}! 🏠

Расчёт по квартире *${fmtMoney(+price)}*
Программа: *${prog?.name || program}*

💵 Первоначальный взнос: *${fmtMoney(v.downPayment)}*
🏦 Сумма займа: *${fmtMoney(v.loanAmount)}*
📅 Платёж: *${fmtMoney(v.monthly)}* / мес
📊 Нужный доход: *${fmtMoney(v.requiredSalary)}*

По вопросам звоните! 🙏
${user?.name || 'Менеджер'}`
    }

    return ''
  }

  async function sendToWA() {
    if (!result) return
    const msg = buildWaMsg(result)
    if (!msg) return
    // Находим WA чат клиента по телефону
    const phone = c.phone?.replace(/\D/g, '')
    if (!phone) { toast$('⚠️ У клиента не указан телефон', 'err'); return }
    setSending(true)
    try {
      await api.sendWaMessage(null, phone, msg, user?.name || 'CRM')
      toast$('✅ Расчёт отправлен клиенту в WhatsApp')
    } catch(e) {
      toast$('❌ Ошибка отправки: ' + e.message, 'err')
    } finally {
      setSending(false)
    }
  }

  const prog = PROGRAMS_FALLBACK.find(p => p.key === program)

  return (
    <div>
      {/* Инфо из карточки */}
      {(totalIncome > 0 || c.monthlyLoad) && (
        <div style={{background:'#f0fdf4',border:'1.5px solid #86efac',borderRadius:12,padding:'10px 14px',marginBottom:14,fontSize:13}}>
          <div style={{fontWeight:700,color:'#15803d',marginBottom:5}}>📋 Данные из карточки клиента</div>
          <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
            {totalIncome > 0 && <span style={{color:'#374151'}}>Доход: <b>{fmtMoney(totalIncome)}</b></span>}
            {c.monthlyLoad  && <span style={{color:'#374151'}}>Кредиты: <b>{fmtMoney(+c.monthlyLoad)}</b></span>}
            {c.contractAmount > 0 && <span style={{color:'#374151'}}>Договор: <b>{fmtMoney(+c.contractAmount)}</b></span>}
          </div>
        </div>
      )}

      {/* Режим */}
      <div style={{display:'flex',gap:8,marginBottom:14}}>
        {[['price','По цене'],['salary','По зарплате']].map(([m,l]) => (
          <button key={m} onClick={()=>{setMode(m);setResult(null)}}
            style={{flex:1,padding:'9px 0',borderRadius:10,border:'2px solid',fontFamily:'inherit',fontSize:13,fontWeight:700,cursor:'pointer',transition:'all .15s',
              borderColor:mode===m?'#3b82f6':'#e2e8f0',
              background: mode===m?'#eff6ff':'#f8fafc',
              color:      mode===m?'#3b82f6':'#64748b'}}>
            {l}
          </button>
        ))}
      </div>

      {/* Программа */}
      <div className="fi">
        <div className="fl">Программа</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
          {PROGRAMS_FALLBACK.map(p => (
            <button key={p.key} onClick={()=>{setProgram(p.key);setResult(null)}}
              style={{padding:'7px 5px',borderRadius:9,border:'2px solid',fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:'pointer',textAlign:'center',transition:'all .15s',
                borderColor:program===p.key?'#3b82f6':'#e2e8f0',
                background: program===p.key?'#eff6ff':'#f8fafc',
                color:      program===p.key?'#3b82f6':'#374151'}}>
              <div style={{fontSize:16,marginBottom:2}}>{p.icon}</div>
              <div style={{fontSize:10,lineHeight:1.2}}>{p.name}</div>
              <div style={{fontSize:9,color:program===p.key?'#93c5fd':'#94a3b8',marginTop:1}}>Взнос {Math.round(p.downRatio*100)}%</div>
            </button>
          ))}
        </div>
      </div>

      <div className="r2">
        {mode==='price' && (
          <div className="fi">
            <div className="fl">Цена квартиры (₸)</div>
            <input className="inp" type="number" value={price}
              onChange={e=>setPrice(e.target.value)}
              placeholder="25 000 000"/>
          </div>
        )}
        <div className="fi">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div className="fl">Доход (₸) {totalIncome>0&&!overrideIncome?'— из карточки':''}</div>
            {totalIncome>0 && (
              <button onClick={()=>setOverrideIncome(v=>!v)}
                style={{fontSize:11,fontWeight:700,color:'#3b82f6',background:'none',border:'none',cursor:'pointer',padding:'0 0 4px'}}>
                {overrideIncome ? '↩ Из карточки' : '✏️ Изменить'}
              </button>
            )}
          </div>
          <input className="inp" type="number"
            value={(!overrideIncome && totalIncome > 0) ? totalIncome : salary}
            onChange={e=>setSalary(e.target.value)}
            readOnly={!overrideIncome && totalIncome > 0}
            style={(!overrideIncome && totalIncome>0)?{background:'#f0fdf4',borderColor:'#86efac'}:{}}
            placeholder="300 000"/>
        </div>
        <div className="fi">
          <div className="fl">Текущие кредиты/мес (₸)</div>
          <input className="inp" type="number" value={oldCred}
            onChange={e=>setOldCred(e.target.value)}
            placeholder="0"/>
        </div>
        <div className="fi">
          <div className="fl">Заёмщиков</div>
          <input className="inp" type="number" min="1" max="20" value={members} onChange={e=>setMembers(e.target.value)} placeholder="1"/>
        </div>
      </div>

      <button className="btn btn-primary btn-block btn-lg" onClick={calc} disabled={busy}
        style={{marginTop:4,marginBottom:result?12:0}}>
        {busy
          ? <><i className="ti ti-loader-2 spin" style={{fontSize:17}}/> Считаю...</>
          : <><i className="ti ti-calculator" style={{fontSize:17}}/> Рассчитать</>}
      </button>

      {/* РЕЗУЛЬТАТ */}
      {result?.ok && (
        <div>
          {/* Основной результат */}
          {mode==='salary' && result.approved && (
            <div style={{background:'#f0fdf4',border:'1.5px solid #86efac',borderRadius:14,padding:16,marginBottom:10}}>
              <div style={{fontWeight:800,fontSize:14,color:'#15803d',marginBottom:10}}>
                ✅ {prog?.icon} {prog?.name} — одобрение возможно
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[
                  ['Максимальная цена', fmtMoney(result.maxPrice)],
                  ['Сумма займа',       fmtMoney(result.maxLoan)],
                  ['Первый взнос',      fmtMoney(result.down)],
                  ['Платёж / мес',      fmtMoney(result.payment)],
                ].map(([l,v]) => (
                  <div key={l} style={{background:'#fff',borderRadius:9,padding:'9px 11px'}}>
                    <div style={{fontSize:9,color:'#64748b',textTransform:'uppercase',fontWeight:700,marginBottom:2}}>{l}</div>
                    <div style={{fontSize:14,fontWeight:800,color:'#0f172a'}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mode==='salary' && !result.approved && (
            <div style={{background:'#fef2f2',border:'1.5px solid #fecaca',borderRadius:14,padding:16,marginBottom:10,textAlign:'center'}}>
              <div style={{fontSize:28,marginBottom:6}}>😔</div>
              <div style={{fontWeight:800,color:'#dc2626',marginBottom:4}}>Одобрение невозможно</div>
              <div style={{fontSize:12,color:'#64748b'}}>
                Доход {fmtMoney(result.totalIncome)} недостаточен<br/>
                М1: {fmtMoney(result.method1)} · М2: {fmtMoney(result.method2)}
              </div>
            </div>
          )}

          {mode==='price' && result.variantsByPrice?.map((v,i) => (
            <div key={i} style={{border:'1.5px solid',borderRadius:12,padding:13,marginBottom:8,
              borderColor:v.canAfford?'#86efac':'#fecaca',
              background: v.canAfford?'#f0fdf4':'#fff7f7'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div style={{fontWeight:700,fontSize:13}}>{v.label}</div>
                <span style={{fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:20,
                  background:v.canAfford?'#dcfce7':'#fee2e2',
                  color:     v.canAfford?'#16a34a':'#dc2626'}}>
                  {v.canAfford?'✅ Доступно':'❌ Не хватает'}
                </span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
                {[
                  ['Платёж / мес',   fmtMoney(v.monthly)],
                  ['Первый взнос',   fmtMoney(v.downPayment)],
                  ['Сумма займа',    fmtMoney(v.loanAmount)],
                  ['Нужна ЗП',       fmtMoney(v.requiredSalary)],
                ].map(([l,val]) => (
                  <div key={l} style={{background:'rgba(255,255,255,.7)',borderRadius:8,padding:'7px 9px'}}>
                    <div style={{fontSize:9,color:'#64748b',textTransform:'uppercase',fontWeight:700,marginBottom:2}}>{l}</div>
                    <div style={{fontSize:13,fontWeight:800}}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Кнопки: копировать + отправить в WhatsApp */}
          <div style={{display:'flex',gap:8,marginTop:4}}>
            <button
              onClick={()=>{
                const msg = buildWaMsg(result)
                if (!msg) { toast$('⚠️ Нечего копировать', 'err'); return }
                try {
                  navigator.clipboard.writeText(msg)
                  toast$('✅ Расчёт скопирован — вставьте клиенту')
                } catch(e) { toast$('❌ Не удалось скопировать', 'err') }
              }}
              style={{flex:c.phone?'0 0 auto':'1',display:'flex',alignItems:'center',justifyContent:'center',gap:7,
                padding:'12px 16px',borderRadius:12,border:'1.5px solid #cbd5e1',cursor:'pointer',
                background:'#f8fafc',color:'#334155',fontFamily:'inherit',fontWeight:700,fontSize:14}}>
              <i className="ti ti-copy" style={{fontSize:17}}/> Копировать
            </button>
            {c.phone && (
              <button
                onClick={sendToWA}
                disabled={sending}
                style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                  padding:'12px',borderRadius:12,border:'none',cursor:sending?'not-allowed':'pointer',
                  background: sending ? '#94a3b8' : '#25d366',
                  color:'#fff',fontFamily:'inherit',fontWeight:700,fontSize:14,transition:'all .15s'}}>
                {sending
                  ? <><i className="ti ti-loader-2 spin" style={{fontSize:16}}/> Отправляю...</>
                  : <><i className="ti ti-brand-whatsapp" style={{fontSize:18}}/> Отправить в WhatsApp</>
                }
              </button>
            )}
          </div>
          {!c.phone && (
            <div style={{textAlign:'center',fontSize:12,color:'#94a3b8',marginTop:8}}>
              ⚠️ Укажите телефон в профиле чтобы отправить в WhatsApp
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function fmtSize(b) { return b<1024?b+'B':b<1048576?(b/1024).toFixed(1)+'KB':(b/1048576).toFixed(1)+'MB' }
