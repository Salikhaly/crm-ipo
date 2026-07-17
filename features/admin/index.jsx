// features/admin/index.jsx
// Админ-панель (Панель техника) — вынесена из pages/index.js.
// Экспортирует AdminPage и CalcSettingsPanel (последний нужен отдельно для head).

import React, { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { ROLE, COLORS, PIPELINE_DEFAULT, ALL_ACCOMP_STAGES, DEFAULT_CHECKLISTS, ACCOMP_TEMPLATES, STAGE_GUIDE, uid, TI, TC, TB } from '../../lib/constants'
import { Btn, Tag } from '../../components/ui'
import { DOC_TEMPLATES_FALLBACK, DOC_PLACEHOLDERS } from '../../lib/docTemplates'

export function AdminPage({ managers, pipeline, checklists, users, user, onSaveMgr, onDelMgr, onSaveUser, onDelUser, onSavePL, onSaveCL, onModal, reload, syncing }) {
  const [tab, setTab] = useState('managers')
  const pl = pipeline || PIPELINE_DEFAULT
  // Свои маршруты из админки: их этапы тоже должны получать чек-листы (H4)
  const [accompOv, setAccompOv] = useState(null)
  useEffect(() => {
    api.calc('accomp_templates', {})
      .then(r => { if (r?.templates && typeof r.templates === 'object') setAccompOv(r.templates) })
      .catch(() => {})
  }, [])
  const customStages = accompOv
    ? Object.values(accompOv).flatMap(t => (t?.stages || []).map(s => (typeof s === 'string' ? s : s?.name)).filter(Boolean))
    : []
  const clStages = [...new Set([...ALL_ACCOMP_STAGES, ...customStages])]

  return (
    <div>
      <div style={{background:'linear-gradient(135deg,#0f172a,#1e3a5f)',borderRadius:15,padding:17,marginBottom:17,color:'#fff',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <div style={{fontSize:19,fontWeight:900,marginBottom:3}}>⚙️ Панель техника</div>
          <div style={{fontSize:13,color:'#94a3b8'}}>Полный конструктор системы</div>
        </div>
        <Btn onClick={reload} disabled={syncing} style={{background:'rgba(255,255,255,.1)',color:'#fff',border:'1px solid rgba(255,255,255,.2)'}}>
          <i className={`ti ti-refresh${syncing?' spin':''}`}/>{syncing?'Синхронизация...':'Обновить'}
        </Btn>
      </div>

      {/* Вкладки сгруппированы по смыслу — 11 в один ряд не находились глазами */}
      <div style={{display:'flex',gap:14,marginBottom:18,flexWrap:'wrap'}}>
        {[
          { g:'КОМАНДА',      items:[{id:'managers',l:'👤 Менеджеры'},{id:'users',l:'🔐 Пользователи'}] },
          { g:'ПРОЦЕССЫ',     items:[{id:'pipeline',l:'🔄 Воронка'},{id:'routes',l:'🗺 Маршруты'},{id:'checklists',l:'✅ Чек-листы'}] },
          { g:'ИНСТРУМЕНТЫ',  items:[{id:'calc',l:'🧮 Калькулятор'},{id:'docs',l:'📄 Договоры'},{id:'fields',l:'🧩 Поля карточки'},{id:'wa_replies',l:'⚡ WhatsApp'}] },
          { g:'СИСТЕМА',      items:[{id:'backup',l:'💾 Бэкап'},{id:'logs',l:'📜 Журнал'},{id:'trash',l:'🗑 Корзина'},{id:'wa_cleanup',l:'🧹 Чистка WA'}] },
        ].map(grp => (
          <div key={grp.g} style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:12,padding:'8px 10px'}}>
            <div style={{fontSize:9,fontWeight:800,color:'#94a3b8',letterSpacing:'.08em',marginBottom:6}}>{grp.g}</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {grp.items.map(t => (
                <Btn key={t.id} size="sm" variant={tab===t.id?'primary':'ghost'} onClick={()=>setTab(t.id)}>{t.l}</Btn>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* MANAGERS */}
      {tab === 'managers' && <>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:13}}>
          <div style={{fontWeight:800,fontSize:16}}>Менеджеры ({managers.length})</div>
          <Btn variant="primary" onClick={()=>onModal({type:'mgr_edit',item:{id:uid(),name:'',phone:'',role:'manager',color:'#3b82f6',active:true}})}>
            <i className="ti ti-plus"/>Добавить
          </Btn>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:11}}>
          {managers.map(m => (
            <div key={m.id} style={{background:'#fff',border:`2px solid ${m.color||'#3b82f6'}33`,borderRadius:14,padding:15,boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
              <div style={{display:'flex',gap:11,marginBottom:11,alignItems:'center'}}>
                <div style={{width:44,height:44,borderRadius:13,background:(m.color||'#3b82f6')+'22',color:m.color||'#3b82f6',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:18}}>{m.name?.[0]}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:800,fontSize:15}}>{m.name}</div>
                  <div style={{fontSize:12,color:'#64748b'}}>{m.phone}</div>
                </div>
                <span style={{background:m.active?'#f0fdf4':'#fef2f2',color:m.active?'#10b981':'#ef4444',border:`1px solid ${m.active?'#bbf7d0':'#fecaca'}`,borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:700}}>{m.active?'Активен':'Неакт.'}</span>
              </div>
              <div style={{display:'flex',gap:7,flexWrap:'wrap',marginBottom:11}}>
                {COLORS.map(c => (
                  <div key={c} onClick={()=>onSaveMgr({...m,color:c})}
                    style={{width:24,height:24,borderRadius:7,background:c,cursor:'pointer',transition:'all .14s',boxShadow:m.color===c?`0 0 0 3px #fff,0 0 0 5px #1a1a1a`:'none'}}/>
                ))}
              </div>
              <div style={{display:'flex',gap:7}}>
                <Btn size="sm" onClick={()=>onModal({type:'mgr_edit',item:{...m}})} style={{flex:1,justifyContent:'center'}}>
                  <i className="ti ti-edit"/>Изменить
                </Btn>
                <Btn size="sm" onClick={()=>onSaveMgr({...m,active:!m.active})}>
                  {m.active ? <i className="ti ti-eye-off"/> : <i className="ti ti-eye"/>}
                </Btn>
                <Btn size="sm" variant="danger" onClick={()=>{if(window.confirm('Удалить?'))onDelMgr(m.id)}}>
                  <i className="ti ti-trash"/>
                </Btn>
              </div>
            </div>
          ))}
        </div>
      </>}

      {/* PIPELINE */}
      {tab === 'pipeline' && <>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:13}}>
          <div style={{fontWeight:800,fontSize:16}}>Этапы воронки ({pl.length})</div>
          <Btn variant="primary" onClick={()=>onModal({type:'pl_edit'})}><i className="ti ti-edit"/>Редактировать</Btn>
        </div>
        {pl.map((p, i) => (
          <div key={p.id} style={{background:'#fff',border:`1.5px solid ${p.c}33`,borderRadius:13,padding:'12px 15px',marginBottom:8,display:'flex',alignItems:'center',gap:11,boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
            <span style={{fontSize:13,fontWeight:700,color:'#64748b',width:22,flexShrink:0}}>{i+1}.</span>
            <span style={{width:9,height:9,borderRadius:'50%',background:p.c,display:'inline-block'}}/>
            <span style={{flex:1,fontWeight:700,fontSize:14,color:p.c}}>{p.l}</span>
            <span style={{fontFamily:'monospace',fontSize:11,color:'#94a3b8',background:'#f1f5f9',padding:'2px 6px',borderRadius:4}}>{p.id}</span>
            <div style={{display:'flex',gap:5}}>
              {COLORS.map(c => (
                <div key={c} onClick={()=>onSavePL(pl.map(x=>x.id===p.id?{...x,c}:x))}
                  style={{width:18,height:18,borderRadius:5,background:c,cursor:'pointer',boxShadow:p.c===c?`0 0 0 2px #fff,0 0 0 4px #1a1a1a`:'none'}}/>
              ))}
            </div>
          </div>
        ))}
      </>}

      {/* CHECKLISTS */}
      {tab === 'checklists' && <>
        <div style={{fontWeight:800,fontSize:16,marginBottom:7}}>Чек-листы по этапам сопровождения</div>
        <div style={{background:'#fffbeb',border:'1.5px solid #fde68a',borderRadius:12,padding:'11px 13px',marginBottom:13,fontSize:13,color:'#92400e',display:'flex',gap:8,alignItems:'flex-start'}}>
          <i className="ti ti-info-circle" style={{marginTop:2}}/>
          <div>Нажмите на этап для редактирования пунктов. Чек-лист привязан к <b>названию этапа</b> и общий для всех маршрутов (Полное сопровождение, Отбасы, Госпрограмма, Аудирование по кредитованию, Поиск дома, Онлайн, Коммерческая). Этапы с пометкой «дефолт» используют встроенный чек-лист, пока вы не сохраните свой.</div>
        </div>
        {clStages.map(stage => {
          const own     = (checklists||{})[stage]||[]
          const isDef   = !own.length && !!DEFAULT_CHECKLISTS[stage]
          const items   = own.length ? own : (DEFAULT_CHECKLISTS[stage]||[])
          return (
            <div key={stage} onClick={()=>onModal({type:'cl_edit',stage,items:JSON.parse(JSON.stringify(items))})}
              style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:13,padding:'13px 15px',marginBottom:9,cursor:'pointer',transition:'all .14s',boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}
              onMouseEnter={e=>e.currentTarget.style.borderColor='#3b82f6'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='#e2e8f0'}>
              <div style={{display:'flex',alignItems:'center',gap:11}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:6}}>{stage}
                    {isDef && <span style={{marginLeft:7,fontSize:9.5,fontWeight:700,background:'#eef2ff',color:'#4f46e5',border:'1px solid #c7d2fe',borderRadius:20,padding:'1px 7px',verticalAlign:'middle'}}>дефолт</span>}
                  </div>
                  <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                    {items.slice(0,5).map(item => (
                      <span key={item.id} style={{background:TB[item.tp||'check'],borderRadius:5,padding:'2px 7px',fontSize:10,color:TC[item.tp||'check'],display:'inline-flex',alignItems:'center',gap:3,fontWeight:600,border:`1px solid ${TC[item.tp||'check']}33`}}>
                        <i className={`ti ${TI[item.tp||'check']}`} style={{fontSize:10}}/>{item.t}
                      </span>
                    ))}
                    {items.length > 5 && <span style={{fontSize:10,color:'#64748b',fontStyle:'italic'}}>+{items.length-5}</span>}
                  </div>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
                  <span style={{fontWeight:700,fontSize:12,color:'#64748b'}}>{items.length} пунктов</span>
                  <Btn size="sm"><i className="ti ti-edit"/>Настроить</Btn>
                </div>
              </div>
            </div>
          )
        })}
      </>}

      {/* USERS */}
      {tab === 'users' && <>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:13}}>
          <div style={{fontWeight:800,fontSize:16}}>Пользователи ({users.length})</div>
          <Btn variant="primary" onClick={()=>onModal({type:'user_edit',item:{id:uid(),name:'',login:'',pwd:'',role:'manager',mid:null}})}>
            <i className="ti ti-plus"/>Добавить
          </Btn>
        </div>
        <div style={{background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:12,padding:'11px 13px',marginBottom:13,fontSize:13,color:'#1d4ed8'}}>
          <i className="ti ti-info-circle"/> Меняйте логины и пароли прямо здесь. Изменения сохраняются в базе данных.
        </div>
        {users.map(u => {
          const r = ROLE[u.role]
          return (
            <div key={u.id} style={{display:'flex',alignItems:'center',gap:11,padding:'12px 15px',background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:12,marginBottom:8,boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
              <div style={{width:34,height:34,borderRadius:10,background:(r?.c||'#3b82f6')+'22',color:r?.c||'#3b82f6',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:14,flexShrink:0}}>{u.name?.[0]}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:13}}>{u.name}</div>
                <div style={{fontSize:11,color:'#64748b'}}>
                  Логин: <b style={{fontFamily:'monospace'}}>{u.login}</b> · Пароль: <b style={{fontFamily:'monospace',color:'#94a3b8'}}>••••••••</b>
                </div>
              </div>
              {r && <Tag c={r.c} ch={r.l}/>}
              <Btn size="sm" onClick={()=>onModal({type:'user_edit',item:{...u,mid:u.manager_id}})}><i className="ti ti-edit"/>Изменить</Btn>
              {u.id !== user?.id && (
                <Btn size="sm" variant="danger" onClick={()=>{if(window.confirm(`Удалить пользователя ${u.name}?`))onDelUser(u.id)}}><i className="ti ti-trash"/></Btn>
              )}
            </div>
          )
        })}
      </>}
      {tab === 'calc'       && <CalcSettingsPanel/>}
      {tab === 'wa_replies' && <WaRepliesPanel/>}
      {tab === 'docs' && <DocTemplatesPanel/>}
      {tab === 'routes' && <RoutesPanel/>}
      {tab === 'fields' && <CustomFieldsPanel/>}
      {tab === 'backup' && <BackupPanel/>}
      {tab === 'logs' && <ActionLogPanel/>}
      {tab === 'trash' && <TrashPanel reload={reload}/>}
      {tab === 'wa_cleanup' && <WaCleanupPanel reload={reload}/>}
    </div>
  )
}

// AdminPage экспортируется как function (React.memo убран — конфликтует с export)

// ─── ПАНЕЛЬ НАСТРОЕК КАЛЬКУЛЯТОРА (техник) ────────────────────────────────────
export function CalcSettingsPanel() {
  // Дефолтные программы (fallback если БД пустая — до запуска migration 005)
  const DEFAULT_PROGS_UI = [
    { key:'5050',     name:'Ипотека 50/50',      icon:'🏛️', downRatio:0.50, desc:'Взнос 50%',  active:true, sortOrder:0, isNauryz:false,
      variants:[{label:'8.5% — 8 лет',coeff:0.0080522},{label:'5% — 6 лет',coeff:0.0080525}] },
    { key:'3070',     name:'Программа 30/70',    icon:'🏠', downRatio:0.30, desc:'Взнос 30%',  active:true, sortOrder:1, isNauryz:false,
      variants:[{label:'~10-12 лет',  coeff:0.00886788}] },
    { key:'nauryz20', name:'Наурыз 20%',          icon:'🌸', downRatio:0.20, desc:'Взнос 20%',  active:true, sortOrder:2, isNauryz:true,
      variants:[{label:'7% — 19 лет', coeff:0.00843335},{label:'9% — 19 лет',coeff:0.0101}] },
    { key:'nauryz10', name:'Наурыз 10%',          icon:'🌷', downRatio:0.10, desc:'Взнос 10%',  active:true, sortOrder:3, isNauryz:true,
      variants:[{label:'7% — 19 лет', coeff:0.00943335},{label:'9% — 19 лет',coeff:0.0111}] },
    { key:'jasyl',    name:'Жасыл Ипотека',      icon:'🌿', downRatio:0.20, desc:'Взнос 20%',  active:true, sortOrder:4, isNauryz:false,
      variants:[{label:'7% очередники',coeff:0.00783333},{label:'11% военные',coeff:0.01116667},{label:'15% все',coeff:0.01241667}] },
    { key:'askeri',   name:'Наурыз Аскери',      icon:'🎖️', downRatio:0.00, desc:'Взнос 0%',   active:true, sortOrder:5, isNauryz:true,
      variants:[{label:'1-8 лет',     coeff:0.0127},{label:'9-19 лет',coeff:0.00376}] },
  ]

  const DEFAULT_KD = { p1:40, p2:65, p3:90, v1:40, v2:50, v3:60, v4:70 }

  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [cfg,      setCfg]      = useState({ mrp:4325, pmNauryz:10, pmOther:13 })
  const [kd,       setKd]       = useState(DEFAULT_KD)
  const [programs, setPrograms] = useState([])
  const [editKey,  setEditKey]  = useState(null)
  const [msg,      setMsg]      = useState('')

  const toast = (t,ok=true) => { setMsg({t,ok}); setTimeout(()=>setMsg(''), 4000) }

  useEffect(() => {
    api.getCalcSettings().then(d => {
      if (d?.settings) {
        setCfg({
          mrp:      d.settings.mrp        || 4325,
          pmNauryz: d.settings.pm_nauryz  || 10,
          pmOther:  d.settings.pm_other   || 13,
        })
        // КД пороги из БД или дефолт
        if (d.settings.kd) {
          const k = d.settings.kd
          setKd({
            p1: Math.round((k.p1||40)*1), p2: Math.round((k.p2||65)*1), p3: Math.round((k.p3||90)*1),
            v1: Math.round((k.v1||0.40)*100), v2: Math.round((k.v2||0.50)*100),
            v3: Math.round((k.v3||0.60)*100), v4: Math.round((k.v4||0.70)*100),
          })
        }
      }
      if (d?.settings?.progs_data?.length)     setProgsNew(d.settings.progs_data)
      if (d?.settings?.expense_otbasy?.length)  setExpOtbasy(d.settings.expense_otbasy)
      if (d?.settings?.expense_other?.length)   setExpOther(d.settings.expense_other)
      if (d?.settings?.mrp_ref?.length)         setMrpRef(d.settings.mrp_ref)
      if (d?.settings?.deal_steps?.length)      setDealSteps(d.settings.deal_steps)
      if (d?.settings?.insurance_pct)           setInsPct(+(d.settings.insurance_pct * 100).toFixed(2))
      if (d?.settings?.tax_config) {
        const t = d.settings.tax_config
        setTaxCfg(x => ({ ...x, ...t, soRate: t.soRate != null ? +(t.soRate * 100).toFixed(2) : x.soRate }))
      }
      // Если программ в БД нет — используем дефолты (до migration 005)
      if (d?.programs?.length) {
        setPrograms(d.programs.map(p => ({
          key:       p.key,
          name:      p.name,
          icon:      p.icon         || '🏠',
          downRatio: parseFloat(p.down_ratio) || 0.20,
          desc:      p.desc_text    || '',
          active:    p.active       !== false,
          sortOrder: p.sort_order   || 0,
          isNauryz:  p.is_nauryz    || false,
          variants:  Array.isArray(p.variants) ? p.variants : [],
        })))
      } else {
        // БД пустая — подгружаем дефолты чтобы показать и дать отредактировать
        setPrograms(DEFAULT_PROGS_UI)
        toast('ℹ️ Программы загружены из defaults — нажмите Сохранить чтобы записать в БД', true)
      }
      setLoading(false)
    }).catch(() => { setPrograms(DEFAULT_PROGS_UI); setLoading(false) })
  }, [])

  const setCfgF   = (k,v) => setCfg(s=>({...s,[k]:v}))
  const setKdF    = (k,v) => setKd(s=>({...s,[k]:+v||0}))
  const setProg   = (key,field,val) => setPrograms(ps => ps.map(p => p.key===key ? {...p,[field]:val} : p))
  const setVar    = (key,vi,field,val) => setPrograms(ps => ps.map(p => p.key===key
    ? {...p, variants: p.variants.map((v,i)=>i===vi?{...v,[field]:field==='coeff'?+val:val}:v)} : p))
  const addVar    = (key) => setPrograms(ps => ps.map(p => p.key===key
    ? {...p, variants:[...p.variants,{label:'',coeff:0.01}]} : p))
  const removeVar = (key,vi) => setPrograms(ps => ps.map(p => p.key===key
    ? {...p, variants:p.variants.filter((_,i)=>i!==vi)} : p))

  function addProgram() {
    const key = 'prog_'+Date.now()
    setPrograms(ps=>[...ps,{key,name:'Новая программа',icon:'🏠',downRatio:0.20,desc:'',active:true,sortOrder:ps.length,isNauryz:false,
      variants:[{label:'7% — 25 лет',coeff:0.00783333}]}])
    setEditKey(key)
  }

  async function deleteProgram(key) {
    if (!window.confirm('Деактивировать программу? Старые расчёты не пострадают.')) return
    await api.deleteCalcProgram(key).catch(()=>{})
    setPrograms(ps=>ps.filter(p=>p.key!==key))
    toast('🗑 Программа удалена')
  }

  const [expOtbasy,  setExpOtbasy]  = useState([])
  const [expOther,   setExpOther]   = useState([])
  const [mrpRef,     setMrpRef]     = useState([])
  const [dealSteps,  setDealSteps]  = useState([])
  const [progsNew,   setProgsNew]   = useState([])
  const [insPct,     setInsPct]     = useState(0.3)
  // Налоги калькулятора «Налоги» (миграция 016); дефолты = DEFAULT_TAX движка
  const [taxCfg, setTaxCfg] = useState({ vosmsCap:34000, soRate:4.5, soCap:29750, ipnDeduction:129750, ipnThreshold:147444, workFee:15000 })
  const [activeSection, setActiveSection] = useState('main') // main|progs_api|progs_new|expenses|steps|mrp

  async function saveAll() {
    setSaving(true)
    try {
      const kdToSave = {
        p1: kd.p1, p2: kd.p2, p3: kd.p3,
        v1: kd.v1/100, v2: kd.v2/100, v3: kd.v3/100, v4: kd.v4/100,
      }
      const programsToSave = programs.map((p,i) => ({...p, sortOrder: i}))
      const res = await api.saveCalcSettings({
        settings: {
          ...cfg, kd: kdToSave,
          progs_data:     progsNew,
          expense_otbasy: expOtbasy,
          expense_other:  expOther,
          mrp_ref:        mrpRef,
          deal_steps:     dealSteps,
          insurance_pct:  insPct / 100,
          tax_config: { ...taxCfg, soRate: taxCfg.soRate / 100 },
        },
        programs: programsToSave,
      })
      await api.invalidateCalcCache().catch(()=>{})
      if (res?.ok) {
        toast('✅ Настройки сохранены и применены сразу!')
      } else if (res?.errors?.length) {
        // Показываем что именно не сохранилось (фикс АП-3)
        const details = res.errors.map(e => e.section).join(', ')
        toast(`⚠️ Не сохранились: ${details}. Проверьте данные.`, false)
      } else {
        toast('⚠️ Сохранено с ошибками — проверьте данные', false)
      }
    } catch(e) { toast('❌ ' + e.message, false) }
    setSaving(false)
  }

  if (loading) return <div style={{textAlign:'center',padding:40,color:'#94a3b8',fontSize:14}}>⏳ Загрузка...</div>

  const inp = (val, onChange, extra={}) => (
    <input value={val} onChange={e=>onChange(e.target.value)} {...extra}
      style={{padding:'8px 11px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13,
        background:'#fff',color:'#0f172a',width:'100%',fontFamily:'inherit',boxSizing:'border-box',
        ...(extra.style||{})}}/>
  )

  const numInp = (val, onChange, extra={}) => inp(val, onChange, {type:'number', ...extra})

  return (
    <div style={{position:'relative'}}>
      {/* Toast */}
      {msg && (
        <div style={{position:'fixed',top:20,right:20,zIndex:9999,
          background: msg.ok!==false ? '#0f172a' : '#dc2626',
          color:'#fff',padding:'10px 18px',borderRadius:10,
          fontSize:13,boxShadow:'0 4px 20px rgba(0,0,0,.3)',maxWidth:320}}>
          {msg.t}
        </div>
      )}

      {/* ── Навигация по разделам (перемещена наверх — фикс АП-1) ── */}
      <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:14,background:'#f8fafc',padding:5,borderRadius:10,border:'1px solid #e2e8f0'}}>
        {[
          {id:'main',      l:'📊 Базовые'},
          {id:'progs_api', l:'🏦 API-программы'},
          {id:'progs_new', l:'🏠 Программы (новый)'},
          {id:'expenses',  l:'💸 Расходы'},
          {id:'steps',     l:'📋 Этапы'},
          {id:'mrp',       l:'📌 МРП справочник'},
          {id:'taxes',     l:'🧾 Налоги'},
        ].map(s=>(
          <button key={s.id} onClick={()=>setActiveSection(s.id)}
            style={{padding:'5px 10px',border:'none',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:500,
              background:activeSection===s.id?'#3b82f6':'transparent',
              color:activeSection===s.id?'#fff':'#64748b'}}>
            {s.l}
          </button>
        ))}
      </div>

      {/* ── Секция «Налоги» (activeSection==='taxes') — константы калькулятора Налоги ── */}
      {activeSection==='taxes' && (
        <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:13,padding:16,marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:6,color:'#0f172a'}}>🧾 Налоги и отчисления (калькулятор «Налоги»)</div>
          <div style={{fontSize:11.5,color:'#64748b',marginBottom:14,lineHeight:1.5}}>
            При изменении налогов РК правьте здесь — без программиста. Применяется сразу после сохранения
            (кнопка «Сохранить» внизу). ОПВ 10%, ВОСМС 2%, ставки работодателя (ОПВР 3,5% / ООСМС 3%) — фиксированы законом.
            <b> Требуется миграция 016.</b>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
            {[
              ['vosmsCap','Потолок ВОСМС, ₸','максимум взноса 2%'],
              ['soRate','СО, % от ЗП','социальные отчисления'],
              ['soCap','Потолок СО, ₸','максимум СО'],
              ['ipnDeduction','Вычет ИПН, ₸','30 МРП стандартный вычет'],
              ['ipnThreshold','Порог ИПН, ₸','до этой ЗП ИПН = 0 (Трудовой)'],
              ['workFee','Работа бухгалтера, ₸','фикс за оформление'],
            ].map(([k,l,sub])=>(
              <div key={k}>
                <div style={{fontSize:11,fontWeight:700,color:'#64748b',marginBottom:2}}>{l}</div>
                <div style={{fontSize:10,color:'#94a3b8',marginBottom:4}}>{sub}</div>
                <input type="number" step="0.1" value={taxCfg[k]} onChange={e=>setTaxCfg(x=>({...x,[k]:+e.target.value||0}))}
                  style={{width:'100%',padding:'8px 10px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13,color:'#0f172a',outline:'none',boxSizing:'border-box'}}/>
              </div>
            ))}
          </div>
          <div style={{marginTop:12,fontSize:11.5,color:'#1e40af',background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:9,padding:'8px 12px'}}>
            💵 В разбивке для клиента теперь есть строка <b>«Останется на руки»</b> — зарплата минус удержания работника (ОПВ, ВОСМС, СО, ИПН).
          </div>
        </div>
      )}

      {/* ── Секция «Базовые»: МРП, ПМ, КД (видна только когда activeSection==='main') ── */}
      {activeSection==='main' && (<>
      {/* ── Базовые показатели ── */}
      <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:13,padding:16,marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:12,color:'#0f172a',display:'flex',alignItems:'center',gap:8}}>
          <span style={{background:'#eff6ff',padding:'4px 8px',borderRadius:7,fontSize:12}}>📊</span>
          Базовые показатели (МРП и ПМ)
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:10}}>
          {[
            {k:'mrp',      label:'МРП (₸)',                  hint:'2026 = 4 325 ₸'},
            {k:'pmNauryz', label:'ПМ × МРП (Наурыз)',        hint:'обычно 10'},
            {k:'pmOther',  label:'ПМ × МРП (остальные)',     hint:'обычно 13'},
          ].map(({k,label,hint}) => (
            <div key={k}>
              <div style={{fontSize:11,color:'#64748b',marginBottom:4,fontWeight:500}}>{label}</div>
              {numInp(cfg[k], v=>setCfgF(k,+v), {placeholder:hint})}
              <div style={{fontSize:10,color:'#94a3b8',marginTop:3}}>{hint}</div>
            </div>
          ))}
        </div>
        <div style={{background:'#f0fdf4',borderRadius:9,padding:'8px 12px',fontSize:12,color:'#166534'}}>
          💡 ПМ Наурыз: {cfg.pmNauryz} × {cfg.mrp} = <b>{(cfg.pmNauryz * cfg.mrp).toLocaleString('ru-RU')} ₸</b>
          &nbsp;·&nbsp;
          ПМ остальные: {cfg.pmOther} × {cfg.mrp} = <b>{(cfg.pmOther * cfg.mrp).toLocaleString('ru-RU')} ₸</b>
        </div>
      </div>

      {/* ── КД таблица ── */}
      <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:13,padding:16,marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:4,color:'#0f172a',display:'flex',alignItems:'center',gap:8}}>
          <span style={{background:'#fef9c3',padding:'4px 8px',borderRadius:7,fontSize:12}}>📐</span>
          Коэффициент долговой нагрузки (КД)
        </div>
        <div style={{fontSize:11,color:'#64748b',marginBottom:12}}>
          КД определяет максимальный % дохода на ипотеку. Пороги задаются в МРП, КД — в процентах.
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{background:'#f8fafc'}}>
                <th style={{padding:'8px 10px',textAlign:'left',border:'1px solid #e2e8f0',color:'#475569',fontWeight:600}}>Порог (МРП кратных)</th>
                <th style={{padding:'8px 10px',textAlign:'center',border:'1px solid #e2e8f0',color:'#475569',fontWeight:600}}>КД (%)</th>
                <th style={{padding:'8px 10px',textAlign:'left',border:'1px solid #e2e8f0',color:'#475569',fontWeight:600}}>При ЗП</th>
              </tr>
            </thead>
            <tbody>
              {[
                {range:`до ${kd.p1} МРП`, vField:'v1', pField:'p1', label:`до ${(kd.p1*cfg.mrp).toLocaleString('ru-RU')} ₸`},
                {range:`${kd.p1}–${kd.p2} МРП`, vField:'v2', pField:'p2', label:`${(kd.p1*cfg.mrp).toLocaleString('ru-RU')} – ${(kd.p2*cfg.mrp).toLocaleString('ru-RU')} ₸`},
                {range:`${kd.p2}–${kd.p3} МРП`, vField:'v3', pField:'p3', label:`${(kd.p2*cfg.mrp).toLocaleString('ru-RU')} – ${(kd.p3*cfg.mrp).toLocaleString('ru-RU')} ₸`},
                {range:`выше ${kd.p3} МРП`, vField:'v4', pField:null, label:`выше ${(kd.p3*cfg.mrp).toLocaleString('ru-RU')} ₸`},
              ].map(({range,vField,pField,label},i) => (
                <tr key={i} style={{background:i%2?'#f8fafc':'#fff'}}>
                  <td style={{padding:'8px 10px',border:'1px solid #e2e8f0'}}>
                    <div style={{fontWeight:500}}>{range}</div>
                    {pField && (
                      <div style={{display:'flex',alignItems:'center',gap:5,marginTop:4}}>
                        <span style={{fontSize:10,color:'#94a3b8'}}>порог:</span>
                        <input type="number" value={kd[pField]} onChange={e=>setKdF(pField,e.target.value)}
                          style={{width:60,padding:'3px 6px',border:'1px solid #e2e8f0',borderRadius:6,fontSize:11,textAlign:'center'}}/>
                        <span style={{fontSize:10,color:'#94a3b8'}}>МРП</span>
                      </div>
                    )}
                  </td>
                  <td style={{padding:'8px 10px',border:'1px solid #e2e8f0',textAlign:'center'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
                      <input type="number" min="10" max="90" value={kd[vField]} onChange={e=>setKdF(vField,e.target.value)}
                        style={{width:55,padding:'4px 6px',border:'1.5px solid #3b82f6',borderRadius:7,
                          fontSize:14,fontWeight:700,textAlign:'center',color:'#1d4ed8'}}/>
                      <span style={{fontSize:12,color:'#64748b'}}>%</span>
                    </div>
                  </td>
                  <td style={{padding:'8px 10px',border:'1px solid #e2e8f0',fontSize:11,color:'#64748b'}}>{label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{background:'#fef9c3',borderRadius:8,padding:'7px 11px',fontSize:11,color:'#854d0e',marginTop:8}}>
          ⚠️ КД = максимальный платёж / доход. Пример при КД 50%: доход 500 000 ₸ → платёж не более 250 000 ₸.
          Меняется только при изменении законодательства РК.
        </div>
      </div>
      </>)}
      {/* ── конец секции «Базовые» ── */}

      {/* ── Секция «API-программы» (activeSection==='progs_api') ── */}
      {activeSection==='progs_api' && (
      <>
      {/* ── Ипотечные программы ── */}
      <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:13,padding:16,marginBottom:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:14,color:'#0f172a',display:'flex',alignItems:'center',gap:8}}>
            <span style={{background:'#eff6ff',padding:'4px 8px',borderRadius:7,fontSize:12}}>🏠</span>
            Ипотечные программы ({programs.length})
          </div>
          <button onClick={addProgram}
            style={{padding:'7px 14px',border:'1.5px solid #3b82f6',borderRadius:8,
              background:'#eff6ff',color:'#1d4ed8',fontSize:12,fontWeight:600,cursor:'pointer'}}>
            + Добавить
          </button>
        </div>

        {programs.map(p => (
          <div key={p.key}
            style={{border:`1.5px solid ${editKey===p.key?'#3b82f6':'#e2e8f0'}`,
              borderRadius:11,marginBottom:9,overflow:'hidden',
              opacity:p.active?1:0.55,transition:'opacity .2s'}}>

            {/* Заголовок программы */}
            <div onClick={()=>setEditKey(editKey===p.key?null:p.key)}
              style={{display:'flex',alignItems:'center',gap:10,padding:'10px 13px',
                cursor:'pointer',background:editKey===p.key?'#eff6ff':'#f8fafc',userSelect:'none'}}>
              <span style={{fontSize:20}}>{p.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13,display:'flex',alignItems:'center',gap:6}}>
                  {p.name}
                  {p.isNauryz && <span style={{fontSize:10,background:'#fef9c3',color:'#854d0e',padding:'1px 6px',borderRadius:5,fontWeight:500}}>Наурыз ПМ</span>}
                </div>
                <div style={{fontSize:11,color:'#64748b'}}>
                  ПВ {Math.round(p.downRatio*100)}% · {p.variants.length} вариант(ов)
                  {!p.active && <span style={{color:'#ef4444',marginLeft:8,fontWeight:600}}>⛔ отключена</span>}
                </div>
              </div>
              <div style={{display:'flex',gap:5}}>
                <button onClick={e=>{e.stopPropagation();setProg(p.key,'active',!p.active)}}
                  style={{padding:'3px 9px',border:'1px solid #e2e8f0',borderRadius:6,fontSize:10,
                    fontWeight:600,cursor:'pointer',
                    background:p.active?'#e1f5ee':'#fef2f2',
                    color:p.active?'#0f766e':'#991b1b'}}>
                  {p.active?'✅ Активна':'❌ Откл.'}
                </button>
                <button onClick={e=>{e.stopPropagation();deleteProgram(p.key)}}
                  style={{padding:'3px 8px',border:'1px solid #fecaca',borderRadius:6,
                    background:'#fef2f2',color:'#dc2626',fontSize:11,cursor:'pointer'}}>🗑</button>
              </div>
            </div>

            {/* Редактор программы */}
            {editKey === p.key && (
              <div style={{padding:14,background:'#fff',borderTop:'1px solid #e2e8f0'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 64px 64px',gap:9,marginBottom:12}}>
                  <div>
                    <div style={{fontSize:11,color:'#64748b',marginBottom:3}}>Название</div>
                    {inp(p.name, v=>setProg(p.key,'name',v))}
                  </div>
                  <div>
                    <div style={{fontSize:11,color:'#64748b',marginBottom:3}}>Описание</div>
                    {inp(p.desc, v=>setProg(p.key,'desc',v), {placeholder:'Взнос 20%'})}
                  </div>
                  <div>
                    <div style={{fontSize:11,color:'#64748b',marginBottom:3}}>Иконка</div>
                    {inp(p.icon, v=>setProg(p.key,'icon',v), {placeholder:'🏠',style:{textAlign:'center',fontSize:18}})}
                  </div>
                  <div>
                    <div style={{fontSize:11,color:'#64748b',marginBottom:3}}>ПВ %</div>
                    <input type="number" min="0" max="100" step="5"
                      value={Math.round(p.downRatio*100)}
                      onChange={e=>setProg(p.key,'downRatio',+e.target.value/100)}
                      style={{padding:'8px 6px',border:'1.5px solid #e2e8f0',borderRadius:9,
                        fontSize:13,width:'100%',textAlign:'center',background:'#fff',color:'#0f172a',boxSizing:'border-box'}}/>
                  </div>
                </div>

                {/* Флаг Наурыз ПМ */}
                <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,cursor:'pointer',fontSize:13}}>
                  <input type="checkbox" checked={!!p.isNauryz} onChange={e=>setProg(p.key,'isNauryz',e.target.checked)}
                    style={{width:16,height:16,cursor:'pointer'}}/>
                  <span>Использовать <b>Наурыз ПМ</b> (облегчённый прожиточный минимум × {cfg.pmNauryz} МРП)</span>
                </label>

                {/* Варианты ставок */}
                <div style={{fontSize:12,fontWeight:600,color:'#374151',marginBottom:7}}>Варианты ставок:</div>
                {p.variants.map((v, vi) => (
                  <div key={vi} style={{display:'grid',gridTemplateColumns:'1fr 1fr 32px',gap:7,marginBottom:6,alignItems:'start'}}>
                    <div>
                      <div style={{fontSize:10,color:'#64748b',marginBottom:2}}>Название</div>
                      <input value={v.label} placeholder="напр. 7% — 19 лет"
                        onChange={e=>setVar(p.key,vi,'label',e.target.value)}
                        style={{padding:'7px 10px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:12,width:'100%',background:'#fff',color:'#0f172a',boxSizing:'border-box'}}/>
                    </div>
                    <div>
                      <div style={{fontSize:10,color:'#64748b',marginBottom:2}}>Коэффициент аннуитета</div>
                      <input type="number" step="0.0000001" value={v.coeff}
                        onChange={e=>setVar(p.key,vi,'coeff',e.target.value)}
                        placeholder="0.00843335"
                        style={{padding:'7px 10px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:12,width:'100%',background:'#fff',color:'#0f172a',boxSizing:'border-box'}}/>
                      {v.coeff > 0 && (
                        <div style={{fontSize:9,color:'#94a3b8',marginTop:2}}>
                          При цене 30М → платёж ≈ {Math.round(30000000*v.coeff).toLocaleString('ru')} ₸/мес
                        </div>
                      )}
                    </div>
                    <button onClick={()=>removeVar(p.key,vi)}
                      style={{width:32,height:32,marginTop:18,border:'1px solid #fecaca',borderRadius:7,
                        background:'#fef2f2',color:'#dc2626',cursor:'pointer',fontSize:14,
                        display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
                  </div>
                ))}
                <button onClick={()=>addVar(p.key)}
                  style={{padding:'5px 12px',border:'1.5px dashed #cbd5e1',borderRadius:8,
                    background:'transparent',color:'#64748b',fontSize:11,cursor:'pointer',marginTop:3}}>
                  + Добавить вариант ставки
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      </>
      )}
      {/* ── конец секции «API-программы» ── */}

      {/* ── Новый калькулятор: программы ── */}
      {activeSection==='progs_new' && (
        <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:13,padding:16,marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:10,color:'#0f172a'}}>🏠 Программы нового калькулятора (вкладка «Программы»)</div>
          <div style={{fontSize:11,color:'#64748b',marginBottom:10}}>
            Это программы во вкладке «Программы» с ползунками. Поля: id (не менять), n — название, r — ставка %, t — срок лет, d — ПВ (0.20 = 20%), grp — «g» госпрограмма / «c» коммерческий, note — описание.
          </div>
          {progsNew.map((p,i) => (
            <div key={p.id||i} style={{display:'grid',gridTemplateColumns:'90px 1fr 50px 50px 50px 30px 1fr 30px',gap:6,marginBottom:7,alignItems:'center'}}>
              <input value={p.id||''} onChange={e=>{const a=[...progsNew];a[i]={...a[i],id:e.target.value};setProgsNew(a)}}
                placeholder="id" style={{padding:'5px 7px',border:'1.5px solid #e2e8f0',borderRadius:7,fontSize:11,background:'#f8fafc',color:'#64748b'}}/>
              <input value={p.n||''} onChange={e=>{const a=[...progsNew];a[i]={...a[i],n:e.target.value};setProgsNew(a)}}
                placeholder="Название" style={{padding:'5px 7px',border:'1.5px solid #e2e8f0',borderRadius:7,fontSize:12}}/>
              <input type="number" step="0.1" value={p.r||''} onChange={e=>{const a=[...progsNew];a[i]={...a[i],r:+e.target.value};setProgsNew(a)}}
                placeholder="%" title="Ставка %" style={{padding:'5px 4px',border:'1.5px solid #e2e8f0',borderRadius:7,fontSize:11,textAlign:'center'}}/>
              <input type="number" value={p.t||''} onChange={e=>{const a=[...progsNew];a[i]={...a[i],t:+e.target.value};setProgsNew(a)}}
                placeholder="лет" title="Макс срок лет" style={{padding:'5px 4px',border:'1.5px solid #e2e8f0',borderRadius:7,fontSize:11,textAlign:'center'}}/>
              <input type="number" step="0.01" value={p.d||''} onChange={e=>{const a=[...progsNew];a[i]={...a[i],d:+e.target.value};setProgsNew(a)}}
                placeholder="ПВ" title="ПВ (0.20=20%)" style={{padding:'5px 4px',border:'1.5px solid #3b82f6',borderRadius:7,fontSize:11,textAlign:'center',color:'#1d4ed8'}}/>
              <select value={p.grp||'g'} onChange={e=>{const a=[...progsNew];a[i]={...a[i],grp:e.target.value};setProgsNew(a)}}
                style={{padding:'5px 2px',border:'1.5px solid #e2e8f0',borderRadius:7,fontSize:10,background:'#fff'}}>
                <option value="g">Гос</option><option value="c">Ком</option>
              </select>
              <input value={p.note||''} onChange={e=>{const a=[...progsNew];a[i]={...a[i],note:e.target.value};setProgsNew(a)}}
                placeholder="Описание / условия" style={{padding:'5px 7px',border:'1.5px solid #e2e8f0',borderRadius:7,fontSize:11}}/>
              <button onClick={()=>setProgsNew(ps=>ps.filter((_,j)=>j!==i))}
                style={{width:28,height:28,border:'1px solid #fecaca',borderRadius:6,background:'#fef2f2',color:'#dc2626',cursor:'pointer',fontSize:13}}>✕</button>
            </div>
          ))}
          <button onClick={()=>setProgsNew(ps=>[...ps,{id:'new_'+Date.now(),n:'',r:9,t:20,d:0.20,grp:'g',note:''}])}
            style={{padding:'5px 12px',border:'1.5px dashed #cbd5e1',borderRadius:8,background:'transparent',color:'#64748b',fontSize:11,cursor:'pointer',marginTop:4}}>
            + Добавить программу
          </button>
        </div>
      )}

      {/* ── Расходы на оформление ── */}
      {activeSection==='expenses' && (
        <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:13,padding:16,marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:4,color:'#0f172a'}}>💸 Расходы на оформление (вкладка «Расходы»)</div>
          <div style={{fontSize:11,color:'#64748b',marginBottom:12}}>
            Сумма страховки считается автоматически от цены квартиры × % страховки.
            marr:true — показывать только в браке, marr:false — только не в браке.
            regType:«fast» — ускоренная, regType:«slow» — обычная регистрация.
          </div>
          <div style={{marginBottom:8}}>
            <div style={{fontSize:12,fontWeight:600,color:'#0f172a',marginBottom:5}}>Страховка</div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <input type="number" step="0.01" min="0.1" max="2" value={insPct}
                onChange={e=>setInsPct(+e.target.value)}
                style={{width:80,padding:'6px 10px',border:'1.5px solid #3b82f6',borderRadius:8,fontSize:13,textAlign:'center',color:'#1d4ed8',fontWeight:700}}/>
              <span style={{fontSize:12,color:'#64748b'}}>% от цены квартиры в год</span>
            </div>
          </div>
          {[
            {title:'Отбасы банк', data:expOtbasy, setData:setExpOtbasy},
            {title:'Другие банки (Халык и др.)', data:expOther, setData:setExpOther},
          ].map(({title,data,setData}) => (
            <div key={title} style={{marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:600,color:'#374151',marginBottom:6,paddingTop:4,borderTop:'1px solid #e2e8f0'}}>{title}</div>
              {data.map((r,i) => (
                <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 90px 32px',gap:6,marginBottom:5}}>
                  <input value={r.k||''} onChange={e=>{const a=[...data];a[i]={...a[i],k:e.target.value};setData(a)}}
                    placeholder="Название строки" style={{padding:'5px 8px',border:'1.5px solid #e2e8f0',borderRadius:7,fontSize:12}}/>
                  <input type="number" value={r.v||0} onChange={e=>{const a=[...data];a[i]={...a[i],v:+e.target.value};setData(a)}}
                    placeholder="₸" style={{padding:'5px 6px',border:'1.5px solid #e2e8f0',borderRadius:7,fontSize:12,textAlign:'right'}}/>
                  <button onClick={()=>setData(d=>d.filter((_,j)=>j!==i))}
                    style={{width:30,height:30,border:'1px solid #fecaca',borderRadius:6,background:'#fef2f2',color:'#dc2626',cursor:'pointer'}}>✕</button>
                </div>
              ))}
              <button onClick={()=>setData(d=>[...d,{k:'',v:0,req:true}])}
                style={{padding:'4px 10px',border:'1.5px dashed #cbd5e1',borderRadius:7,background:'transparent',color:'#64748b',fontSize:11,cursor:'pointer'}}>
                + Добавить строку
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Этапы сделки ── */}
      {activeSection==='steps' && (
        <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:13,padding:16,marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:10,color:'#0f172a'}}>📋 Этапы сделки (вкладка «Этапы»)</div>
          {dealSteps.map((s,i) => (
            <div key={i} style={{border:'1.5px solid #e2e8f0',borderRadius:9,padding:10,marginBottom:7}}>
              <div style={{display:'flex',gap:6,marginBottom:6}}>
                <span style={{minWidth:22,height:22,background:'#0f172a',color:'#fff',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0}}>{i+1}</span>
                <input value={s.n||''} onChange={e=>{const a=[...dealSteps];a[i]={...a[i],n:e.target.value};setDealSteps(a)}}
                  placeholder="Название этапа"
                  style={{flex:1,padding:'5px 8px',border:'1.5px solid #e2e8f0',borderRadius:7,fontSize:12,fontWeight:600}}/>
                <button onClick={()=>setDealSteps(d=>d.filter((_,j)=>j!==i))}
                  style={{width:28,height:28,border:'1px solid #fecaca',borderRadius:6,background:'#fef2f2',color:'#dc2626',cursor:'pointer',fontSize:12,flexShrink:0}}>✕</button>
              </div>
              <input value={s.sub||''} onChange={e=>{const a=[...dealSteps];a[i]={...a[i],sub:e.target.value};setDealSteps(a)}}
                placeholder="Описание / документы"
                style={{width:'100%',padding:'5px 8px',border:'1.5px solid #e2e8f0',borderRadius:7,fontSize:11,boxSizing:'border-box',marginBottom:5,color:'#64748b'}}/>
              <input value={s.cost||''} onChange={e=>{const a=[...dealSteps];a[i]={...a[i],cost:e.target.value};setDealSteps(a)}}
                placeholder="Стоимость (например: 21 600 ₸)"
                style={{width:'100%',padding:'5px 8px',border:'1.5px solid #e2e8f0',borderRadius:7,fontSize:11,boxSizing:'border-box',color:'#854d0e'}}/>
            </div>
          ))}
          <button onClick={()=>setDealSteps(d=>[...d,{n:'',sub:'',cost:''}])}
            style={{padding:'5px 12px',border:'1.5px dashed #cbd5e1',borderRadius:8,background:'transparent',color:'#64748b',fontSize:11,cursor:'pointer'}}>
            + Добавить этап
          </button>
        </div>
      )}

      {/* ── МРП справочник ── */}
      {activeSection==='mrp' && (
        <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:13,padding:16,marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:4,color:'#0f172a'}}>📌 МРП / МЗП / ВПМ справочник (вкладка «Расходы»)</div>
          <div style={{fontSize:11,color:'#64748b',marginBottom:10}}>Обновляйте каждый январь когда выходят новые значения МРП, МЗП и тарифов нотариусов.</div>
          {mrpRef.map((r,i) => (
            <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr 30px',gap:6,marginBottom:5}}>
              <input value={r.k||''} onChange={e=>{const a=[...mrpRef];a[i]={...a[i],k:e.target.value};setMrpRef(a)}}
                placeholder="Название (МРП 2026)" style={{padding:'5px 8px',border:'1.5px solid #e2e8f0',borderRadius:7,fontSize:12}}/>
              <input value={r.v||''} onChange={e=>{const a=[...mrpRef];a[i]={...a[i],v:e.target.value};setMrpRef(a)}}
                placeholder="Значение (4 325 ₸)" style={{padding:'5px 8px',border:'1.5px solid #e2e8f0',borderRadius:7,fontSize:12}}/>
              <button onClick={()=>setMrpRef(d=>d.filter((_,j)=>j!==i))}
                style={{width:28,height:28,border:'1px solid #fecaca',borderRadius:6,background:'#fef2f2',color:'#dc2626',cursor:'pointer',fontSize:12}}>✕</button>
            </div>
          ))}
          <button onClick={()=>setMrpRef(d=>[...d,{k:'',v:''}])}
            style={{padding:'4px 10px',border:'1.5px dashed #cbd5e1',borderRadius:7,background:'transparent',color:'#64748b',fontSize:11,cursor:'pointer',marginTop:4}}>
            + Добавить строку
          </button>
        </div>
      )}

      {/* Кнопка сохранить */}
      <button onClick={saveAll} disabled={saving}
        style={{width:'100%',padding:13,border:'none',borderRadius:12,fontWeight:700,fontSize:14,
          cursor:saving?'not-allowed':'pointer',marginBottom:4,
          background:saving?'#93c5fd':'linear-gradient(135deg,#3b82f6,#1d4ed8)',
          color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',gap:8,
          boxShadow:saving?'none':'0 4px 14px rgba(59,130,246,.4)'}}>
        {saving
          ? <><i className="ti ti-loader-2 spin" style={{fontSize:16}}/>Сохраняю...</>
          : <><i className="ti ti-device-floppy" style={{fontSize:16}}/>Сохранить все настройки калькулятора</>}
      </button>
      <div style={{fontSize:11,color:'#94a3b8',textAlign:'center',marginTop:5}}>
        Изменения применяются сразу после сохранения
      </div>
    </div>
  )
}


// ─── ПАНЕЛЬ БЫСТРЫХ ОТВЕТОВ WA (техник) ───────────────────────────────────────
function WaRepliesPanel() {
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [replies, setReplies] = useState([])
  const [editId,  setEditId]  = useState(null)
  const [msg,     setMsg]     = useState('')

  const toast = t => { setMsg(t); setTimeout(()=>setMsg(''), 3500) }
  const CATS  = ['greeting','approval','rejection','docs','calc','meeting','thanks','status','general']

  // №5: автоответ новым лидам
  const [autoOn,   setAutoOn]   = useState(false)
  const [autoText, setAutoText] = useState('')
  const [autoSaving, setAutoSaving] = useState(false)
  const [rrOn,       setRrOn]       = useState(false)  // round-robin распределение лидов
  const [rrSaving,   setRrSaving]   = useState(false)
  // Автоответ в нерабочее время (миграция 017, wa_config)
  const [ohOn,   setOhOn]   = useState(false)
  const [ohText, setOhText] = useState('')
  const [ohFrom, setOhFrom] = useState('09:00')
  const [ohTo,   setOhTo]   = useState('18:00')
  const [ohSaving, setOhSaving] = useState(false)

  useEffect(() => {
    api.getCalcSettings().then(d => {
      if (d?.replies) setReplies(d.replies.map(r => ({
        id:        r.id,
        trigger:   r.trigger,
        title:     r.title,
        body:      r.body,
        category:  r.category  || 'general',
        active:    r.active    !== false,
        sortOrder: r.sort_order || 0,
      })))
      if (d?.settings) {
        setAutoOn(!!d.settings.wa_auto_greeting_on)
        setAutoText(d.settings.wa_auto_greeting || '')
        setRrOn(!!d.settings.wa_round_robin)
        const wc = d.settings.wa_config || {}
        setOhOn(!!wc.offhours_on)
        setOhText(wc.offhours_text || '')
        setOhFrom(wc.work_from || '09:00')
        setOhTo(wc.work_to || '18:00')
      }
      setLoading(false)
    }).catch(()=>setLoading(false))
  }, [])

  async function saveOffHours() {
    setOhSaving(true)
    try {
      const res = await api.saveCalcSettings({ settings: { wa_config: {
        offhours_on: ohOn, offhours_text: ohText, work_from: ohFrom, work_to: ohTo,
      } } })
      toast(res?.ok ? '✅ Автоответ нерабочего времени сохранён' : '⚠️ Ошибка — применена ли миграция 017?')
    } catch(e) { toast('❌ ' + e.message) }
    setOhSaving(false)
  }

  async function saveAutoGreeting() {
    setAutoSaving(true)
    try {
      const res = await api.saveCalcSettings({
        settings: { wa_auto_greeting: autoText, wa_auto_greeting_on: autoOn },
      })
      toast(res?.ok ? '✅ Автоответ сохранён' : '⚠️ Ошибка сохранения')
    } catch(e) { toast('❌ ' + e.message) }
    setAutoSaving(false)
  }

  const setR = (id,f,v) => setReplies(rs=>rs.map(r=>r.id===id?{...r,[f]:v}:r))

  function addReply() {
    const id = 'reply_'+Date.now()
    setReplies(rs=>[...rs,{id,trigger:'/новый',title:'Новый шаблон',body:'Текст...',category:'general',active:true,sortOrder:rs.length}])
    setEditId(id)
  }

  async function deleteReply(id) {
    if (!window.confirm('Удалить шаблон?')) return
    await api.deleteQuickReply(id).catch(()=>{})
    setReplies(rs=>rs.filter(r=>r.id!==id))
    toast('🗑 Удалено')
  }

  async function saveAll() {
    setSaving(true)
    try {
      const res = await api.saveCalcSettings({ replies })
      // Без текста ошибки менеджер не поймёт, что чинить (частый случай — занятая команда «/»)
      if (res?.ok) toast('✅ Шаблоны сохранены!')
      else toast('⚠️ ' + (res?.errors?.[0]?.error || 'Сохранено с ошибками'))
    } catch(e) { toast('❌ '+e.message) }
    setSaving(false)
  }

  if (loading) return <div style={{textAlign:'center',padding:40,color:'#94a3b8'}}>⏳ Загрузка...</div>

  return (
    <div style={{position:'relative'}}>
      {/* №5: Автоответ новым лидам */}
      <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:13,padding:16,marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <div style={{fontWeight:700,fontSize:14,color:'#0f172a'}}>🤖 Автоответ новым лидам</div>
          <div onClick={()=>setAutoOn(v=>!v)} style={{width:44,height:24,background:autoOn?'#10b981':'#cbd5e1',borderRadius:20,position:'relative',cursor:'pointer',transition:'background .2s'}}>
            <div style={{position:'absolute',top:3,left:autoOn?23:3,width:18,height:18,background:'#fff',borderRadius:'50%',transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
          </div>
        </div>
        <div style={{fontSize:11.5,color:'#64748b',marginBottom:10,lineHeight:1.5}}>
          Когда человек пишет в WhatsApp <b>впервые</b>, CRM автоматически отправит это сообщение.
          Лид не остынет пока менеджер занят. Шлётся только новым чатам.
        </div>
        <textarea value={autoText} onChange={e=>setAutoText(e.target.value)}
          placeholder="Здравствуйте! 👋 Спасибо за обращение — подбираем ипотеку под ваш доход. Какая примерно стоимость квартиры интересует? Менеджер скоро ответит."
          rows={4}
          style={{width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontSize:13,fontFamily:'inherit',resize:'vertical',boxSizing:'border-box',marginBottom:10,color:'#0f172a',background:autoOn?'#fff':'#f8fafc'}}/>
        <button onClick={saveAutoGreeting} disabled={autoSaving}
          style={{padding:'9px 18px',border:'none',borderRadius:9,background:autoSaving?'#94a3b8':'#10b981',color:'#fff',fontSize:13,fontWeight:700,cursor:autoSaving?'default':'pointer',fontFamily:'inherit'}}>
          {autoSaving ? '⏳ Сохраняю...' : '💾 Сохранить автоответ'}
        </button>
      </div>

      {/* Автоответ в нерабочее время */}
      <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:13,padding:16,marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <div style={{fontWeight:700,fontSize:14,color:'#0f172a'}}>🌙 Автоответ в нерабочее время</div>
          <div onClick={()=>setOhOn(v=>!v)} style={{width:44,height:24,background:ohOn?'#10b981':'#cbd5e1',borderRadius:20,position:'relative',cursor:'pointer',transition:'background .2s'}}>
            <div style={{position:'absolute',top:3,left:ohOn?23:3,width:18,height:18,background:'#fff',borderRadius:'50%',transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
          </div>
        </div>
        <div style={{fontSize:11.5,color:'#64748b',marginBottom:10,lineHeight:1.5}}>
          Вне рабочих часов (время Казахстана) CRM сама ответит на входящее — не чаще 1 раза в 6 часов на чат. Клиент не чувствует игнора, менеджер спокойно отдыхает.
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:10,flexWrap:'wrap'}}>
          <label style={{fontSize:12,color:'#334155',fontWeight:600}}>Рабочее время: с
            <input type="time" value={ohFrom} onChange={e=>setOhFrom(e.target.value)} style={{margin:'0 6px',padding:'5px 8px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,fontFamily:'inherit'}}/>
            до
            <input type="time" value={ohTo} onChange={e=>setOhTo(e.target.value)} style={{marginLeft:6,padding:'5px 8px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,fontFamily:'inherit'}}/>
          </label>
        </div>
        <textarea value={ohText} onChange={e=>setOhText(e.target.value)}
          placeholder="Спасибо за обращение! Сейчас нерабочее время. Ответим в рабочие часы с 9:00 до 18:00. 🌙"
          rows={3}
          style={{width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontSize:13,fontFamily:'inherit',resize:'vertical',boxSizing:'border-box',marginBottom:10,color:'#0f172a',background:ohOn?'#fff':'#f8fafc'}}/>
        <button onClick={saveOffHours} disabled={ohSaving}
          style={{padding:'9px 18px',border:'none',borderRadius:9,background:ohSaving?'#94a3b8':'#10b981',color:'#fff',fontSize:13,fontWeight:700,cursor:ohSaving?'default':'pointer',fontFamily:'inherit'}}>
          {ohSaving ? '⏳ Сохраняю...' : '💾 Сохранить'}
        </button>
      </div>

      {/* Round-robin: автораспределение лидов */}
      <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:13,padding:16,marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <div style={{fontWeight:700,fontSize:14,color:'#0f172a'}}>🔄 Автораспределение лидов по менеджерам</div>
          <div onClick={async()=>{
            const next = !rrOn
            setRrOn(next); setRrSaving(true)
            try {
              const res = await api.saveCalcSettings({ settings: { wa_round_robin: next } })
              toast(res?.ok ? (next?'✅ Автораспределение включено':'✅ Автораспределение выключено') : '⚠️ Ошибка — применена ли миграция 011?')
              if (!res?.ok) setRrOn(!next)
            } catch(e) { toast('❌ '+e.message); setRrOn(!next) }
            setRrSaving(false)
          }} style={{width:44,height:24,background:rrOn?'#10b981':'#cbd5e1',borderRadius:20,position:'relative',cursor:rrSaving?'wait':'pointer',transition:'background .2s',opacity:rrSaving?.6:1}}>
            <div style={{position:'absolute',top:3,left:rrOn?23:3,width:18,height:18,background:'#fff',borderRadius:'50%',transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
          </div>
        </div>
        <div style={{fontSize:11.5,color:'#64748b',lineHeight:1.5}}>
          Новый WhatsApp-лид автоматически назначается менеджеру с наименьшим числом активных чатов —
          и в чате, и в карточке клиента. Никто не ждёт распределения вручную.
          <b> Требуется миграция 011.</b>
        </div>
      </div>

      {msg && (
        <div style={{position:'fixed',top:20,right:20,zIndex:9999,
          background:'#0f172a',color:'#fff',padding:'10px 18px',borderRadius:10,
          fontSize:13,boxShadow:'0 4px 20px rgba(0,0,0,.3)'}}>
          {msg}
        </div>
      )}

      <div style={{background:'#e1f5ee',border:'1.5px solid #5dcaa5',borderRadius:11,
        padding:'10px 14px',marginBottom:14,fontSize:12,color:'#085041',lineHeight:1.6}}>
        <b>⚡ Быстрые ответы через /</b><br/>
        В чате WhatsApp введите <code style={{background:'#fff',padding:'1px 6px',borderRadius:4}}>/</code> и выберите из меню.
        Переменные: <code>{'{{имя}}'}</code> <code>{'{{менеджер}}'}</code> <code>{'{{сумма}}'}</code> <code>{'{{программа}}'}</code>
      </div>

      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
        <button onClick={addReply}
          style={{padding:'7px 15px',border:'1.5px solid #3b82f6',borderRadius:8,
            background:'#eff6ff',color:'#1d4ed8',fontSize:12,fontWeight:600,cursor:'pointer'}}>
          + Добавить шаблон
        </button>
      </div>

      {!replies.length && (
        <div style={{border:'1.5px dashed #cbd5e1',borderRadius:11,padding:'22px 16px',textAlign:'center',color:'#64748b',fontSize:12.5,lineHeight:1.6,marginBottom:9}}>
          Шаблонов пока нет.<br/>
          Нажмите <b>«+ Добавить шаблон»</b> — задайте команду (например <code>/привет</code>),
          название и текст, затем <b>«Сохранить шаблоны»</b>.
        </div>
      )}

      {replies.map(r => (
        <div key={r.id}
          style={{border:`1.5px solid ${editId===r.id?'#3b82f6':'#e2e8f0'}`,
            borderRadius:11,marginBottom:9,overflow:'hidden',
            opacity:r.active?1:0.55}}>

          {/* Заголовок */}
          <div onClick={()=>setEditId(editId===r.id?null:r.id)}
            style={{display:'flex',alignItems:'center',gap:10,padding:'9px 13px',
              cursor:'pointer',background:editId===r.id?'#eff6ff':'#f8fafc',userSelect:'none'}}>
            <code style={{fontWeight:700,fontSize:13,color:'#3b82f6',
              background:'#eff6ff',padding:'2px 8px',borderRadius:6,
              border:'1px solid #bfdbfe',flexShrink:0}}>
              {r.trigger}
            </code>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,fontSize:12,color:'#0f172a'}}>{r.title}</div>
              <div style={{fontSize:11,color:'#94a3b8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {r.body.slice(0,70)}{r.body.length>70?'…':''}
              </div>
            </div>
            <div style={{display:'flex',gap:5,flexShrink:0}}>
              <span style={{fontSize:10,padding:'2px 7px',borderRadius:5,background:'#f1f5f9',color:'#64748b'}}>{r.category}</span>
              <button onClick={e=>{e.stopPropagation();setR(r.id,'active',!r.active)}}
                style={{padding:'3px 8px',border:'1px solid #e2e8f0',borderRadius:6,fontSize:10,
                  fontWeight:600,cursor:'pointer',
                  background:r.active?'#e1f5ee':'#fef2f2',
                  color:r.active?'#0f766e':'#991b1b'}}>
                {r.active?'✓ Вкл':'✗ Выкл'}
              </button>
              <button onClick={e=>{e.stopPropagation();deleteReply(r.id)}}
                style={{padding:'3px 8px',border:'1px solid #fecaca',borderRadius:6,
                  background:'#fef2f2',color:'#dc2626',fontSize:11,cursor:'pointer'}}>🗑</button>
            </div>
          </div>

          {/* Редактор */}
          {editId===r.id && (
            <div style={{padding:14,background:'#fff',borderTop:'1px solid #e2e8f0'}}>
              <div style={{display:'grid',gridTemplateColumns:'130px 1fr 150px',gap:10,marginBottom:10}}>
                <div>
                  <div style={{fontSize:11,color:'#64748b',marginBottom:3}}>Триггер (с /)</div>
                  <input value={r.trigger} onChange={e=>setR(r.id,'trigger',e.target.value)}
                    style={{padding:'7px 10px',border:'1.5px solid #e2e8f0',borderRadius:8,
                      fontSize:13,fontFamily:'monospace',width:'100%',background:'#fff',color:'#0f172a'}}/>
                </div>
                <div>
                  <div style={{fontSize:11,color:'#64748b',marginBottom:3}}>Заголовок в меню</div>
                  <input value={r.title} onChange={e=>setR(r.id,'title',e.target.value)}
                    style={{padding:'7px 10px',border:'1.5px solid #e2e8f0',borderRadius:8,
                      fontSize:13,width:'100%',background:'#fff',color:'#0f172a'}}/>
                </div>
                <div>
                  <div style={{fontSize:11,color:'#64748b',marginBottom:3}}>Категория</div>
                  <select value={r.category} onChange={e=>setR(r.id,'category',e.target.value)}
                    style={{padding:'7px 10px',border:'1.5px solid #e2e8f0',borderRadius:8,
                      fontSize:13,width:'100%',background:'#fff',color:'#0f172a'}}>
                    {CATS.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{fontSize:11,color:'#64748b',marginBottom:4}}>Текст сообщения</div>
              <textarea value={r.body} onChange={e=>setR(r.id,'body',e.target.value)} rows={5}
                style={{width:'100%',padding:'9px 11px',border:'1.5px solid #e2e8f0',borderRadius:9,
                  fontSize:12,background:'#fff',color:'#0f172a',resize:'vertical',
                  fontFamily:'inherit',lineHeight:1.55}}/>
              <div style={{fontSize:10,color:'#94a3b8',marginTop:4}}>
                Переменные: {'{{имя}}'} {'{{менеджер}}'} {'{{сумма}}'} {'{{программа}}'} {'{{цена}}'} {'{{взнос}}'} {'{{кредит}}'} {'{{платёж}}'} {'{{ставка}}'}
              </div>
            </div>
          )}
        </div>
      ))}

      <button onClick={saveAll} disabled={saving}
        style={{width:'100%',padding:13,border:'none',borderRadius:12,fontWeight:700,fontSize:14,
          cursor:saving?'not-allowed':'pointer',
          background:saving?'#93c5fd':'linear-gradient(135deg,#3b82f6,#1d4ed8)',
          color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',gap:8,
          boxShadow:saving?'none':'0 4px 14px rgba(59,130,246,.4)'}}>
        {saving
          ? <><i className="ti ti-loader-2 spin" style={{fontSize:16}}/>Сохраняю...</>
          : <><i className="ti ti-device-floppy" style={{fontSize:16}}/>Сохранить шаблоны</>}
      </button>
    </div>
  )
}



// ─── ШАБЛОНЫ ДОКУМЕНТОВ (договор, расписка) ─────────────────────────────────
// Хранятся в calc_settings.doc_templates (миграция 013). Плейсхолдеры
// подставляются из карточки клиента при формировании (см. lib/docTemplates).
function DocTemplatesPanel() {
  const [tpls,    setTpls]    = useState(null)   // null = загрузка
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState('')

  useEffect(() => {
    api.getCalcSettings().then(d => {
      const fromDb = d?.settings?.doc_templates
      setTpls(Array.isArray(fromDb) && fromDb.length ? fromDb : DOC_TEMPLATES_FALLBACK)
    }).catch(() => setTpls(DOC_TEMPLATES_FALLBACK))
  }, [])

  function toast(t) { setMsg(t); setTimeout(() => setMsg(''), 3000) }
  const upd = (id, f, v) => setTpls(ts => ts.map(t => t.id === id ? { ...t, [f]: v } : t))

  function add() {
    setTpls(ts => [...ts, { id: 'doc_' + Date.now(), name: 'Новый документ', body: 'Текст документа…\n\nКлиент: {{ФИО}}, ИИН {{ИИН}}' }])
  }
  function del(id) {
    if (!window.confirm('Удалить шаблон?')) return
    setTpls(ts => ts.filter(t => t.id !== id))
  }
  async function saveAll() {
    setSaving(true)
    try {
      const res = await api.saveCalcSettings({ settings: { doc_templates: tpls } })
      toast(res?.ok ? '✅ Шаблоны сохранены' : '⚠️ Ошибка — применена ли миграция 013?')
    } catch (e) { toast('❌ ' + e.message) }
    setSaving(false)
  }

  if (!tpls) return <div style={{textAlign:'center',padding:40,color:'#94a3b8'}}>⏳ Загрузка...</div>

  return (
    <div>
      {msg && <div style={{position:'fixed',top:20,right:20,zIndex:9999,background:'#0f172a',color:'#fff',padding:'10px 16px',borderRadius:10,fontSize:13,fontWeight:600}}>{msg}</div>}

      <div style={{background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:12,padding:'11px 14px',marginBottom:13,fontSize:12.5,color:'#1e40af',lineHeight:1.6}}>
        <b>Как это работает:</b> менеджер в карточке клиента (вкладка Договор) жмёт «Сформировать документ» —
        плейсхолдеры заменяются данными клиента, документ уходит на печать/PDF.<br/>
        Доступные плейсхолдеры: {DOC_PLACEHOLDERS.map(p => <code key={p} style={{background:'#fff',border:'1px solid #bfdbfe',borderRadius:5,padding:'1px 6px',margin:'0 2px',fontSize:11}}>{p}</code>)}
        <br/><b>Требуется миграция 013.</b> Юридический текст согласуйте со своим юристом.
      </div>

      <div style={{display:'flex',gap:8,marginBottom:13}}>
        <Btn variant="primary" size="sm" onClick={add}><i className="ti ti-plus"/>Добавить шаблон</Btn>
        <Btn variant="success" size="sm" onClick={saveAll} disabled={saving}>
          {saving ? <><i className="ti ti-loader spin"/>Сохраняю…</> : <><i className="ti ti-device-floppy"/>Сохранить все</>}
        </Btn>
      </div>

      {tpls.map(t => (
        <div key={t.id} style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:13,padding:14,marginBottom:12}}>
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:9}}>
            <input value={t.name} onChange={e=>upd(t.id,'name',e.target.value)}
              style={{flex:1,padding:'8px 11px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:14,fontWeight:700,color:'#0f172a',outline:'none',fontFamily:'inherit'}}/>
            <Btn size="sm" variant="danger" onClick={()=>del(t.id)}><i className="ti ti-trash" style={{fontSize:12}}/></Btn>
          </div>
          <textarea value={t.body} onChange={e=>upd(t.id,'body',e.target.value)} rows={12}
            style={{width:'100%',padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,fontSize:12.5,fontFamily:'monospace',lineHeight:1.55,resize:'vertical',color:'#0f172a',boxSizing:'border-box'}}/>
        </div>
      ))}
    </div>
  )
}

// ─── ЖУРНАЛ ДЕЙСТВИЙ ────────────────────────────────────────────────────────
// Читает action_logs через /api/logs (миграция 014). Только admin/head.
const LOG_ACTION_META = {
  create:   { l:'Создан',        c:'#10b981', i:'ti-plus' },
  update:   { l:'Изменён',       c:'#3b82f6', i:'ti-pencil' },
  stage:    { l:'Смена этапа',   c:'#8b5cf6', i:'ti-arrow-right' },
  delete:   { l:'Удалён',        c:'#ef4444', i:'ti-trash' },
  pipeline: { l:'Воронка',       c:'#f59e0b', i:'ti-git-branch' },
  settings: { l:'Настройки',     c:'#64748b', i:'ti-settings' },
}
function ActionLogPanel() {
  const [logs, setLogs]   = useState(null)
  const [ready, setReady] = useState(true)

  function load() {
    setLogs(null)
    api.getLogs().then(d => { setLogs(d?.logs || []); setReady(d?.ready !== false) })
      .catch(() => { setLogs([]); setReady(false) })
  }
  useEffect(load, [])

  if (logs === null) return <div style={{textAlign:'center',padding:40,color:'#94a3b8'}}>⏳ Загрузка...</div>

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:13}}>
        <div style={{fontWeight:800,fontSize:16}}>Журнал действий ({logs.length})</div>
        <Btn size="sm" onClick={load}><i className="ti ti-refresh"/>Обновить</Btn>
      </div>
      {!ready && (
        <div style={{background:'#fffbeb',border:'1.5px solid #fde68a',borderRadius:12,padding:'11px 14px',marginBottom:13,fontSize:12.5,color:'#92400e',lineHeight:1.6}}>
          Журнал ещё не активирован — примените <b>миграцию 014</b> в Supabase. После этого все действия
          (создание, правка, смена этапа, удаление клиентов, изменения воронки) начнут записываться.
        </div>
      )}
      {logs.length === 0 && ready && (
        <div style={{textAlign:'center',padding:'34px 20px',color:'#94a3b8'}}>
          <i className="ti ti-history" style={{fontSize:38,display:'block',marginBottom:10,opacity:.2}}/>
          Записей пока нет — они появятся после действий пользователей.
        </div>
      )}
      {logs.length > 0 && (
        <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:13,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
          {logs.map(g => {
            const m = LOG_ACTION_META[g.action] || { l:g.action, c:'#64748b', i:'ti-point' }
            const when = g.created_at ? new Date(g.created_at).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : ''
            return (
              <div key={g.id} style={{display:'flex',alignItems:'center',gap:11,padding:'10px 14px',borderBottom:'1px solid #f1f5f9'}}>
                <div style={{width:30,height:30,borderRadius:9,background:m.c+'18',color:m.c,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <i className={`ti ${m.i}`} style={{fontSize:15}}/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700}}>
                    <span style={{color:m.c}}>{m.l}</span>
                    {g.entity_name && <span style={{color:'#0f172a'}}> · {g.entity_name}</span>}
                  </div>
                  <div style={{fontSize:11,color:'#94a3b8'}}>
                    {g.user_name || 'система'}{g.detail ? ' · ' + g.detail : ''}
                  </div>
                </div>
                <div style={{fontSize:11,color:'#94a3b8',flexShrink:0,whiteSpace:'nowrap'}}>{when}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── КОНСТРУКТОР ДОП. ПОЛЕЙ КАРТОЧКИ ────────────────────────────────────────
// Хранится в calc_settings.custom_fields (миграция 014). Значения — в clients.custom.
const FIELD_TYPES = [
  { id:'text',   l:'Текст' },
  { id:'number', l:'Число' },
  { id:'date',   l:'Дата' },
  { id:'select', l:'Список' },
]
function CustomFieldsPanel() {
  const [fields,  setFields]  = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState('')

  useEffect(() => {
    api.getCalcSettings().then(d => setFields(Array.isArray(d?.settings?.custom_fields) ? d.settings.custom_fields : []))
      .catch(() => setFields([]))
  }, [])
  function toast(t) { setMsg(t); setTimeout(() => setMsg(''), 3000) }
  const upd = (id, f, v) => setFields(fs => fs.map(x => x.id === id ? { ...x, [f]: v } : x))

  function add() {
    setFields(fs => [...fs, { id:'cf_'+Date.now(), key:'field_'+(fs.length+1), label:'Новое поле', type:'text', options:'' }])
  }
  function del(id) { setFields(fs => fs.filter(x => x.id !== id)) }
  async function saveAll() {
    setSaving(true)
    try {
      const res = await api.saveCalcSettings({ settings: { custom_fields: fields } })
      toast(res?.ok ? '✅ Поля сохранены' : '⚠️ Ошибка — применена ли миграция 014?')
    } catch (e) { toast('❌ ' + e.message) }
    setSaving(false)
  }

  if (!fields) return <div style={{textAlign:'center',padding:40,color:'#94a3b8'}}>⏳ Загрузка...</div>

  return (
    <div>
      {msg && <div style={{position:'fixed',top:20,right:20,zIndex:9999,background:'#0f172a',color:'#fff',padding:'10px 16px',borderRadius:10,fontSize:13,fontWeight:600}}>{msg}</div>}
      <div style={{background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:12,padding:'11px 14px',marginBottom:13,fontSize:12.5,color:'#1e40af',lineHeight:1.6}}>
        <b>Свои поля в карточке клиента.</b> Добавьте поля под ваш процесс (например «Ставка банка», «Дата встречи»,
        «Ответственный юрист»). Они появятся в карточке во вкладке «Клиент». <b>Требуется миграция 014.</b>
      </div>
      <div style={{display:'flex',gap:8,marginBottom:13}}>
        <Btn variant="primary" size="sm" onClick={add}><i className="ti ti-plus"/>Добавить поле</Btn>
        <Btn variant="success" size="sm" onClick={saveAll} disabled={saving}>
          {saving ? <><i className="ti ti-loader spin"/>Сохраняю…</> : <><i className="ti ti-device-floppy"/>Сохранить все</>}
        </Btn>
      </div>
      {fields.length === 0 && <div style={{textAlign:'center',padding:'28px',color:'#94a3b8',fontSize:13}}>Пока нет доп. полей — добавьте первое.</div>}
      {fields.map(f => (
        <div key={f.id} style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:12,padding:12,marginBottom:9,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <input value={f.label} onChange={e=>upd(f.id,'label',e.target.value)} placeholder="Название"
            style={{flex:'1 1 160px',minWidth:0,padding:'8px 11px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13,fontWeight:700,color:'#0f172a',outline:'none',fontFamily:'inherit'}}/>
          <select value={f.type} onChange={e=>upd(f.id,'type',e.target.value)}
            style={{width:120,padding:'8px 10px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13,color:'#0f172a',outline:'none',cursor:'pointer',fontFamily:'inherit'}}>
            {FIELD_TYPES.map(t => <option key={t.id} value={t.id}>{t.l}</option>)}
          </select>
          {f.type === 'select' && (
            <input value={f.options||''} onChange={e=>upd(f.id,'options',e.target.value)} placeholder="Варианты через запятую"
              style={{flex:'1 1 180px',minWidth:0,padding:'8px 11px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:12.5,color:'#0f172a',outline:'none',fontFamily:'inherit'}}/>
          )}
          <Btn size="sm" variant="danger" onClick={()=>del(f.id)}><i className="ti ti-trash" style={{fontSize:12}}/></Btn>
        </div>
      ))}
    </div>
  )
}

// ─── МАРШРУТЫ СОПРОВОЖДЕНИЯ ПО ГРУППАМ ПРОГРАММ ─────────────────────────────
// Редактор этапов: у каждой группы (полное, онлайн, аудирование, Отбасы,
// госпрограмма, поиск дома, коммерческая) свой список этапов + «что делать»
// и «что говорить» для менеджера. Хранится в calc_settings.accomp_templates
// (миграция 015); пока не сохранено — карточки работают на встроенных маршрутах.
function RoutesPanel() {
  const [tpls,   setTpls]   = useState(null)   // { groupKey: {l, stages:[{name,do,say}]} }
  const [grp,    setGrp]    = useState('full')
  const [saving, setSaving] = useState(false)
  const [msg,    setMsg]    = useState('')

  // Стартовое состояние: настройки из БД, недостающие группы — из кода (+гайды)
  function seed(fromDb) {
    const out = {}
    for (const [key, t] of Object.entries(ACCOMP_TEMPLATES)) {
      const db = fromDb && fromDb[key]
      if (db && Array.isArray(db.stages) && db.stages.length) {
        out[key] = { l: db.l || t.l, stages: db.stages.map(s => ({ name: s.name || s, do: s.do || '', say: s.say || '' })) }
      } else {
        out[key] = { l: t.l, stages: t.stages.map(n => ({ name: n, do: (STAGE_GUIDE[n]||{}).do || '', say: (STAGE_GUIDE[n]||{}).say || '' })) }
      }
    }
    return out
  }

  useEffect(() => {
    api.getCalcSettings()
      .then(d => setTpls(seed(d?.settings?.accomp_templates)))
      .catch(() => setTpls(seed(null)))
  }, [])

  function toast(t) { setMsg(t); setTimeout(() => setMsg(''), 3000) }
  const cur = tpls?.[grp]

  function updStage(i, f, v) {
    setTpls(ts => ({ ...ts, [grp]: { ...ts[grp], stages: ts[grp].stages.map((s, idx) => idx === i ? { ...s, [f]: v } : s) } }))
  }
  function addStage() {
    setTpls(ts => ({ ...ts, [grp]: { ...ts[grp], stages: [...ts[grp].stages, { name: 'Новый этап', do: '', say: '' }] } }))
  }
  function delStage(i) {
    if (!window.confirm('Удалить этап? Отметки клиентов на этапах ПОСЛЕ него сдвинутся на один назад.')) return
    setTpls(ts => ({ ...ts, [grp]: { ...ts[grp], stages: ts[grp].stages.filter((_, idx) => idx !== i) } }))
  }
  function mvStage(i, dir) {
    setTpls(ts => {
      const arr = [...ts[grp].stages]
      const j = i + dir
      if (j < 0 || j >= arr.length) return ts
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      return { ...ts, [grp]: { ...ts[grp], stages: arr } }
    })
  }
  async function saveAll() {
    setSaving(true)
    try {
      // Этапы без названия не сохраняем — они бессмысленны и ломали бы карточку
      const cleaned = Object.fromEntries(Object.entries(tpls).map(([k, t]) => [k, {
        ...t, stages: t.stages.filter(st => (st.name || '').trim()),
      }]))
      const res = await api.saveCalcSettings({ settings: { accomp_templates: cleaned } })
      toast(res?.ok ? '✅ Маршруты сохранены' : '⚠️ Ошибка — применена ли миграция 015?')
    } catch (e) { toast('❌ ' + e.message) }
    setSaving(false)
  }

  if (!tpls) return <div style={{textAlign:'center',padding:40,color:'#94a3b8'}}>⏳ Загрузка...</div>

  return (
    <div>
      {msg && <div style={{position:'fixed',top:20,right:20,zIndex:9999,background:'#0f172a',color:'#fff',padding:'10px 16px',borderRadius:10,fontSize:13,fontWeight:600}}>{msg}</div>}

      <div style={{background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:12,padding:'11px 14px',marginBottom:13,fontSize:12.5,color:'#1e40af',lineHeight:1.6}}>
        <b>У каждой группы программ — свой маршрут.</b> Название этапа + «что делать» (инструкция менеджеру)
        + «что говорить» (готовый скрипт клиенту). Всё это менеджер видит в карточке на вкладке Сопровождение.
        <br/><b>⚠️ Важно:</b> прогресс клиентов привязан к порядковому номеру этапа. Переименовывать и править
        тексты можно свободно; новые этапы добавляйте <b>в конец</b> — вставка/удаление в середине сдвинет
        отметки уже ведущихся клиентов. <b>Требуется миграция 015.</b>
      </div>

      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:13}}>
        {Object.entries(tpls).map(([key, t]) => (
          <button key={key} onClick={()=>setGrp(key)}
            style={{padding:'7px 13px',borderRadius:20,border:`1.5px solid ${grp===key?'#3b82f6':'#e2e8f0'}`,background:grp===key?'#eff6ff':'#fff',color:grp===key?'#1d4ed8':'#64748b',fontSize:12.5,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
            {t.l} <span style={{opacity:.6}}>({t.stages.length})</span>
          </button>
        ))}
      </div>

      <div style={{display:'flex',gap:8,marginBottom:13,alignItems:'center'}}>
        <Btn variant="primary" size="sm" onClick={addStage}><i className="ti ti-plus"/>Добавить этап (в конец)</Btn>
        <Btn variant="success" size="sm" onClick={saveAll} disabled={saving}>
          {saving ? <><i className="ti ti-loader spin"/>Сохраняю…</> : <><i className="ti ti-device-floppy"/>Сохранить все маршруты</>}
        </Btn>
      </div>

      {cur && cur.stages.map((s, i) => (
        <div key={i} style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:13,padding:13,marginBottom:10}}>
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:9}}>
            <span style={{width:26,height:26,borderRadius:8,background:'#eff6ff',color:'#1d4ed8',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:12,flexShrink:0}}>{i+1}</span>
            <input value={s.name} onChange={e=>updStage(i,'name',e.target.value)}
              style={{flex:1,padding:'8px 11px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:14,fontWeight:700,color:'#0f172a',outline:'none',fontFamily:'inherit'}}/>
            <Btn size="sm" onClick={()=>mvStage(i,-1)} disabled={i===0} style={{width:28,height:28,padding:0,opacity:i===0?.3:1}}><i className="ti ti-arrow-up" style={{fontSize:11}}/></Btn>
            <Btn size="sm" onClick={()=>mvStage(i,1)} disabled={i===cur.stages.length-1} style={{width:28,height:28,padding:0,opacity:i===cur.stages.length-1?.3:1}}><i className="ti ti-arrow-down" style={{fontSize:11}}/></Btn>
            <Btn size="sm" variant="danger" onClick={()=>delStage(i)} style={{width:28,height:28,padding:0}}><i className="ti ti-trash" style={{fontSize:11}}/></Btn>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:'#64748b',textTransform:'uppercase',marginBottom:4}}>🛠 Что делать (менеджеру)</div>
              <textarea value={s.do} onChange={e=>updStage(i,'do',e.target.value)} rows={3} placeholder="Инструкция менеджеру на этом этапе…"
                style={{width:'100%',padding:'8px 10px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:12,lineHeight:1.5,resize:'vertical',color:'#0f172a',boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:'#64748b',textTransform:'uppercase',marginBottom:4}}>💬 Что говорить (клиенту)</div>
              <textarea value={s.say} onChange={e=>updStage(i,'say',e.target.value)} rows={3} placeholder="Готовый скрипт для клиента…"
                style={{width:'100%',padding:'8px 10px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:12,lineHeight:1.5,resize:'vertical',color:'#0f172a',boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}


// ─── КОРЗИНА КЛИЕНТОВ ────────────────────────────────────────────────────────
// Удалённые клиенты (deleted_clients, миграция 015): восстановить или удалить навсегда.
// Чистка старых WA-лидов: авто-созданные из WhatsApp, без договора, застрявшие
// в «Новом лиде». Мягко в корзину (восстановимо). Только admin/head.
function WaCleanupPanel({ reload }) {
  const [items, setItems] = useState(null)
  const [sel,   setSel]   = useState(() => new Set())
  const [busy,  setBusy]  = useState(false)
  const [msg,   setMsg]   = useState('')
  const toast = t => { setMsg(t); setTimeout(() => setMsg(''), 3500) }

  function load() {
    setItems(null); setSel(new Set())
    api.getWaJunk().then(d => {
      const list = d?.clients || []
      setItems(list)
      setSel(new Set(list.map(c => c.id)))  // по умолчанию выбраны все
    }).catch(() => setItems([]))
  }
  useEffect(() => { load() }, [])

  const toggle = id => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSel(s => s.size === (items||[]).length ? new Set() : new Set((items||[]).map(c=>c.id)))

  async function clean() {
    if (!sel.size) return
    if (!window.confirm(`Переместить ${sel.size} лид(ов) в корзину? Их можно восстановить в разделе «Корзина».`)) return
    setBusy(true)
    try {
      const res = await api.cleanWaJunk([...sel])
      toast(res?.ok ? `✅ В корзину перемещено: ${res.deleted}` : '⚠️ Ошибка')
      reload && reload()
      load()
    } catch (e) { toast('❌ ' + e.message) }
    setBusy(false)
  }

  return (
    <div style={{position:'relative'}}>
      {msg && <div style={{position:'fixed',top:16,right:16,background:'#0f172a',color:'#fff',padding:'10px 16px',borderRadius:10,fontSize:13,zIndex:200,boxShadow:'0 4px 16px rgba(0,0,0,.2)'}}>{msg}</div>}
      <div style={{fontWeight:800,fontSize:16,marginBottom:7}}>🧹 Чистка старых WhatsApp-лидов</div>
      <div style={{background:'#fffbeb',border:'1.5px solid #fde68a',borderRadius:12,padding:'11px 13px',marginBottom:13,fontSize:13,color:'#92400e',lineHeight:1.5}}>
        Здесь — лиды, которые <b>сами создались из WhatsApp</b> до смены модели: без договора и застрявшие в «Новом лиде». Это обычно случайные обращения. Перемещение — <b>в корзину</b>, откуда всё можно восстановить.
      </div>

      {items === null && <div style={{textAlign:'center',padding:30,color:'#94a3b8'}}>⏳ Загрузка…</div>}
      {items && items.length === 0 && (
        <div style={{textAlign:'center',padding:'40px 20px',color:'#64748b'}}>
          <i className="ti ti-sparkles" style={{fontSize:40,display:'block',marginBottom:10,color:'#10b981',opacity:.4}}/>
          <p style={{fontSize:15,fontWeight:600}}>База чистая — старых WA-лидов нет 🎉</p>
        </div>
      )}
      {items && items.length > 0 && (
        <>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10,flexWrap:'wrap'}}>
            <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,fontWeight:600,color:'#334155',cursor:'pointer'}}>
              <input type="checkbox" checked={sel.size === items.length} onChange={toggleAll}/>
              Выбрать все ({items.length})
            </label>
            <Btn variant="danger" size="sm" disabled={busy || !sel.size} onClick={clean} style={{marginLeft:'auto'}}>
              <i className="ti ti-trash"/>{busy ? 'Перемещаю…' : `В корзину (${sel.size})`}
            </Btn>
          </div>
          <div style={{border:'1.5px solid #e2e8f0',borderRadius:12,overflow:'hidden',maxHeight:'55vh',overflowY:'auto'}}>
            {items.map(c => (
              <label key={c.id} style={{display:'flex',alignItems:'center',gap:11,padding:'10px 13px',borderBottom:'1px solid #f1f5f9',cursor:'pointer',background:sel.has(c.id)?'#fef2f2':'#fff'}}>
                <input type="checkbox" checked={sel.has(c.id)} onChange={()=>toggle(c.id)}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,color:'#0f172a'}}>{c.fio || 'Без имени'}</div>
                  <div style={{fontSize:11.5,color:'#94a3b8'}}>{c.phone || '—'}{c.dateIn ? ' · ' + c.dateIn : ''}</div>
                </div>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── БЭКАП БАЗЫ ──────────────────────────────────────────────────
// На бесплатном Supabase автобэкапов нет: эта кнопка — единственная защита
// от потери базы. Раз в неделю выгрузить и положить файл в облако.
const BACKUP_SHEETS = {
  clients:             'Клиенты',
  managers:            'Менеджеры',
  users:               'Пользователи',
  pipeline_stages:     'Воронка',
  checklist_templates: 'Чек-листы',
  calc_settings:       'Настройки',
  calc_programs:       'Программы',
  wa_chats:            'WhatsApp чаты',
  wa_messages:         'WhatsApp сообщения',
  wa_quick_replies:    'WhatsApp шаблоны',
  action_logs:         'Журнал действий',
  deleted_clients:     'Корзина',
}

// Excel не умеет вложенность: задачи, комментарии, платежи, расчёты кладём
// JSON-строкой в ячейку — читается глазами и переживает восстановление копипастом.
function flatBackupRow(r) {
  const out = {}
  for (const [k, v] of Object.entries(r || {})) {
    out[k] = (v && typeof v === 'object') ? JSON.stringify(v) : (v ?? '')
  }
  return out
}

function BackupPanel() {
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState(null)
  const [msg,  setMsg]  = useState('')
  function toast(t) { setMsg(t); setTimeout(() => setMsg(''), 4500) }

  async function download() {
    setBusy(true)
    try {
      const d = await api.getBackup()
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      for (const [name, rows] of Object.entries(d.tables || {})) {
        const ws = (rows && rows.length)
          ? XLSX.utils.json_to_sheet(rows.map(flatBackupRow))
          : XLSX.utils.aoa_to_sheet([['(пусто)']])
        // имя листа в Excel — максимум 31 символ
        XLSX.utils.book_append_sheet(wb, ws, (BACKUP_SHEETS[name] || name).slice(0, 31))
      }
      const day = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `Бэкап CRM ${day}.xlsx`)
      setLast({ counts: d.counts || {}, skipped: d.skipped || [] })
      toast('✅ Файл скачан — положите его в облако или на флешку')
    } catch (e) { toast('❌ ' + (e.message || e)) }
    setBusy(false)
  }

  const total = last ? Object.values(last.counts).reduce((a, b) => a + b, 0) : 0

  return (
    <div>
      {msg && <div style={{position:'fixed',top:20,right:20,zIndex:9999,background:'#0f172a',color:'#fff',padding:'10px 16px',borderRadius:10,fontSize:13,fontWeight:600}}>{msg}</div>}
      <div style={{fontWeight:800,fontSize:16,marginBottom:13}}>Бэкап базы</div>

      <div style={{background:'#fef2f2',border:'1.5px solid #fecaca',borderRadius:12,padding:'13px 15px',marginBottom:14,fontSize:12.5,color:'#991b1b',lineHeight:1.65}}>
        <b>Автоматических бэкапов нет.</b> База живёт на бесплатном тарифе Supabase — если её потерять,
        восстановить будет неоткуда. Эта кнопка выгружает <b>всю базу целиком</b> в один Excel-файл:
        клиенты со всеми полями, переписка WhatsApp, менеджеры, настройки, журнал и корзина.
        <div style={{marginTop:7}}>
          👉 <b>Раз в неделю нажмите кнопку и сохраните файл</b> в облако (Google Drive) или на флешку.
          Пароли в файл не попадают.
        </div>
      </div>

      <Btn variant="primary" onClick={download} disabled={busy}>
        {busy ? <><i className="ti ti-loader spin"/>Собираю базу...</> : <><i className="ti ti-download"/>Скачать бэкап (Excel)</>}
      </Btn>

      {last && (
        <div style={{marginTop:16,background:'#f0fdf4',border:'1.5px solid #bbf7d0',borderRadius:12,padding:'13px 15px'}}>
          <div style={{fontWeight:800,fontSize:13,color:'#166534',marginBottom:8}}>
            ✅ Выгружено записей: {total}
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:'5px 14px',fontSize:12,color:'#15803d'}}>
            {Object.entries(last.counts).map(([t, n]) => (
              <span key={t}>{BACKUP_SHEETS[t] || t}: <b>{n}</b></span>
            ))}
          </div>
          {!!last.skipped.length && (
            <div style={{marginTop:9,fontSize:12,color:'#92400e',lineHeight:1.6}}>
              ⚠️ Не попали в файл (таблицы нет — миграция не применена): <b>{last.skipped.join(', ')}</b>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TrashPanel({ reload }) {
  const [items, setItems] = useState(null)
  const [ready, setReady] = useState(true)
  const [busy,  setBusy]  = useState('')
  const [msg,   setMsg]   = useState('')

  function toast(t) { setMsg(t); setTimeout(() => setMsg(''), 3500) }
  function load() {
    setItems(null)
    api.getTrash().then(d => { setItems(d?.items || []); setReady(d?.ready !== false) })
      .catch(() => { setItems([]); setReady(false) })
  }
  useEffect(load, [])

  async function restore(id) {
    setBusy(id)
    try {
      await api.restoreClient(id)
      toast('✅ Клиент восстановлен — появится в списке')
      load(); reload && reload()
    } catch (e) { toast('❌ ' + e.message) }
    setBusy('')
  }
  async function purge(id) {
    if (!window.confirm('Удалить НАВСЕГДА? Это действие необратимо.')) return
    setBusy(id)
    try { await api.purgeClient(id); toast('🗑 Удалено навсегда'); load() }
    catch (e) { toast('❌ ' + e.message) }
    setBusy('')
  }

  if (items === null) return <div style={{textAlign:'center',padding:40,color:'#94a3b8'}}>⏳ Загрузка...</div>

  return (
    <div>
      {msg && <div style={{position:'fixed',top:20,right:20,zIndex:9999,background:'#0f172a',color:'#fff',padding:'10px 16px',borderRadius:10,fontSize:13,fontWeight:600}}>{msg}</div>}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:13}}>
        <div style={{fontWeight:800,fontSize:16}}>Корзина ({items.length})</div>
        <Btn size="sm" onClick={load}><i className="ti ti-refresh"/>Обновить</Btn>
      </div>
      {!ready && (
        <div style={{background:'#fffbeb',border:'1.5px solid #fde68a',borderRadius:12,padding:'11px 14px',marginBottom:13,fontSize:12.5,color:'#92400e',lineHeight:1.6}}>
          Корзина не активирована — примените <b>миграцию 015</b> в Supabase. До этого удаление клиентов безвозвратное.
        </div>
      )}
      {items.length === 0 && ready && (
        <div style={{textAlign:'center',padding:'34px 20px',color:'#94a3b8'}}>
          <i className="ti ti-trash" style={{fontSize:38,display:'block',marginBottom:10,opacity:.2}}/>
          Корзина пуста. Удалённые клиенты будут появляться здесь — их можно восстановить.
        </div>
      )}
      {items.map(it => (
        <div key={it.id} style={{display:'flex',alignItems:'center',gap:11,background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:12,padding:'11px 14px',marginBottom:8}}>
          <div style={{width:34,height:34,borderRadius:10,background:'#fef2f2',color:'#ef4444',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <i className="ti ti-user-x" style={{fontSize:16}}/>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:13.5}}>{it.fio || 'Без имени'}</div>
            <div style={{fontSize:11.5,color:'#94a3b8'}}>
              {it.phone || '—'} · удалил: {it.deleted_by || '—'} · {it.deleted_at ? new Date(it.deleted_at).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : ''}
            </div>
          </div>
          <Btn size="sm" variant="success" onClick={()=>restore(it.id)} disabled={busy===it.id}>
            {busy===it.id ? <i className="ti ti-loader spin"/> : <><i className="ti ti-restore"/>Восстановить</>}
          </Btn>
          <Btn size="sm" variant="danger" onClick={()=>purge(it.id)} disabled={busy===it.id}>
            <i className="ti ti-trash-x" style={{fontSize:12}}/>
          </Btn>
        </div>
      ))}
    </div>
  )
}
