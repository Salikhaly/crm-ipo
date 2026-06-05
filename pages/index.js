// pages/index.js
// Главная страница CRM — полный UI подключённый к бэкенду через /api/*

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Head from 'next/head'
import { api } from '../lib/api'

// ═══ КОНСТАНТЫ ═══════════════════════════════════════════════════
const PIPELINE_DEFAULT = [
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
const ACCOMP = [
  'Сбор документов','Проверка БКИ','Подготовка доходов','Выбор программы',
  'Подача заявки','Одобрение','Поиск квартиры','Оценка','Сделка','Выдача ипотеки','Закрытие'
]
const CONTRACTS = [
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
const CT = Object.fromEntries(CONTRACTS.map(c => [c.id, c]))
const SRCS = [
  { id: 'instagram',      l: 'Instagram',    c: '#e1306c' },
  { id: 'tiktok',         l: 'TikTok',       c: '#010101' },
  { id: 'whatsapp',       l: 'WhatsApp',     c: '#25d366' },
  { id: 'recommendation', l: 'Рекомендация', c: '#f59e0b' },
  { id: 'site',           l: 'Сайт',         c: '#3b82f6' },
  { id: 'kaspi',          l: 'Kaspi',        c: '#ef4444' },
  { id: 'telegram',       l: 'Telegram',     c: '#0088cc' },
  { id: 'other',          l: 'Другое',       c: '#64748b' },
]
const SRC = Object.fromEntries(SRCS.map(s => [s.id, s]))
const CR_ST = [
  { id: 'good',      l: 'Хорошая',      c: '#10b981' },
  { id: 'medium',    l: 'Средняя',      c: '#f59e0b' },
  { id: 'bad',       l: 'Плохая',       c: '#ef4444' },
  { id: 'overdue',   l: 'Просрочки',    c: '#dc2626' },
  { id: 'current',   l: 'Тек.кредиты', c: '#f97316' },
  { id: 'microloans',l: 'Микрозаймы',  c: '#f97316' },
  { id: 'arrests',   l: 'Аресты',      c: '#991b1b' },
  { id: 'none',      l: 'Нет КИ',      c: '#64748b' },
]
const CR = Object.fromEntries(CR_ST.map(c => [c.id, c]))
const ROLES = [
  { id: 'admin',     l: 'Техник',         c: '#ef4444' },
  { id: 'head',      l: 'Руководитель',   c: '#8b5cf6' },
  { id: 'manager',   l: 'Менеджер',       c: '#3b82f6' },
  { id: 'specialist',l: 'Специалист',     c: '#14b8a6' },
]
const ROLE = Object.fromEntries(ROLES.map(r => [r.id, r]))
const CONTACT_ST  = ['Дозвонился','Не отвечает','Перезвонить','Отказ','Думает','Назначена встреча']
const CITIES      = ['Алматы','Астана','Шымкент','Актобе','Другой']
const MARITAL     = ['Женат/Замужем','Холост/Не замужем','Разведён(а)','Вдовец/Вдова']
const WORK_T      = [{ id:'official',l:'Официальная'},{ id:'ip',l:'ИП'},{ id:'self',l:'Самозанятый'},{ id:'none',l:'Без офиц.работы'}]
const DOWN_T      = [{ id:'cash',l:'Наличка'},{ id:'deposit',l:'Депозит'},{ id:'mixed',l:'Смешанный'}]
const TASK_T      = ['📞 Позвонить','📄 Запросить документы','📧 Отправить договор','🤝 Назначить встречу','🏦 Проверить депозит','📊 Проверить БКИ','✅ Другое']
const COLORS      = ['#6366f1','#10b981','#f59e0b','#ec4899','#0ea5e9','#14b8a6','#ef4444','#8b5cf6','#f97316','#64748b']
const TI          = { check:'ti-checkbox', ecp:'ti-writing-sign', doc:'ti-file-text' }
const TC          = { check:'#64748b', ecp:'#8b5cf6', doc:'#0ea5e9' }
const TB          = { check:'#f1f5f9', ecp:'#f5f3ff', doc:'#eff6ff' }
const TL          = { check:'Пункт', ecp:'ЭЦП', doc:'Документ' }
const PAY_ST      = {
  pending: { l:'Ожидает',   c:'#f59e0b', bg:'#fffbeb' },
  partial: { l:'Частично',  c:'#0ea5e9', bg:'#eff6ff' },
  paid:    { l:'Оплачено',  c:'#10b981', bg:'#f0fdf4' },
}

// ═══ UTILS ═══════════════════════════════════════════════════════
const uid    = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
const fmt    = n  => n ? new Intl.NumberFormat('ru').format(Math.round(n)) : '—'
const today  = () => new Date().toISOString().split('T')[0]
const nowStr = () => new Date().toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})

function emptyClient(mid = '') {
  return {
    id: uid(), fio:'', iin:'', phone:'', city:'Алматы',
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
    driveFolderName:'', comments:[], tasks:[],
    contracts5y:{}, contracts5yPlus:{},
    createdAt: new Date().toISOString(),
  }
}

// ═══ SMALL HELPERS UI ════════════════════════════════════════════
function Fl({ l, req, ch }) {
  return <div style={{marginBottom:13}}>
    <div style={{fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:5}}>
      {l}{req && <span style={{color:'#ef4444',marginLeft:3}}>*</span>}
    </div>
    {ch}
  </div>
}
function Tag({ c, ch }) {
  return <span style={{padding:'3px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:c+'22',color:c,display:'inline-flex',alignItems:'center',gap:3,whiteSpace:'nowrap'}}>{ch}</span>
}
function StTag({ id, pl }) {
  const p = (pl||PIPELINE_DEFAULT).find(x => x.id === id)
  return p ? <Tag c={p.c} ch={p.l}/> : null
}
function SrTag({ id }) {
  const s = SRC[id]
  return s ? <span style={{padding:'2px 6px',borderRadius:4,fontSize:10,fontWeight:700,textTransform:'uppercase',background:s.c+'22',color:s.c}}>{s.l}</span> : null
}
function CrTag({ id }) {
  const c = CR[id]
  return c ? <Tag c={c.c} ch={c.l}/> : null
}
function Tgl({ on, onClick }) {
  return <div onClick={onClick} style={{width:40,height:22,background:on?'#3b82f6':'#cbd5e1',borderRadius:20,position:'relative',cursor:'pointer',transition:'background .2s',flexShrink:0,display:'inline-block'}}>
    <div style={{position:'absolute',top:3,left:on?21:3,width:16,height:16,background:'#fff',borderRadius:'50%',transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
  </div>
}
function Prog({ pct, c, sz='h' }) {
  const h = sz==='h'?7:sz==='sm'?5:4
  return <div style={{background:'#e2e8f0',borderRadius:20,overflow:'hidden',height:h}}>
    <div style={{height:'100%',width:`${Math.min(100,Math.max(0,pct||0))}%`,background:c||'#3b82f6',borderRadius:20,transition:'width .4s'}}/>
  </div>
}
function Inp({ value, onChange, placeholder, type='text', disabled, maxLength, style={} }) {
  return <input type={type} value={value||''} onChange={onChange} placeholder={placeholder} disabled={disabled} maxLength={maxLength}
    style={{background:'#f8fafc',border:'2px solid #cbd5e1',borderRadius:10,padding:'10px 12px',color:'#0f172a',fontSize:14,width:'100%',outline:'none',transition:'border .15s',...style}}
    onFocus={e=>e.target.style.borderColor='#3b82f6'}
    onBlur={e=>e.target.style.borderColor='#cbd5e1'}
  />
}
function Sel({ value, onChange, children, disabled, style={} }) {
  return <select value={value||''} onChange={onChange} disabled={disabled}
    style={{background:'#f8fafc',border:'2px solid #cbd5e1',borderRadius:10,padding:'10px 12px',color:'#0f172a',fontSize:14,width:'100%',outline:'none',cursor:'pointer',...style}}>
    {children}
  </select>
}
function Btn({ children, onClick, variant='ghost', size='md', disabled, style={} }) {
  const base = {display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6,border:'2px solid transparent',borderRadius:10,fontFamily:'inherit',fontWeight:700,cursor:disabled?'not-allowed':'pointer',transition:'all .15s',whiteSpace:'nowrap',opacity:disabled?.6:1,...style}
  const sz   = size==='sm'?{padding:'6px 11px',fontSize:12,borderRadius:8}:size==='lg'?{padding:'13px 22px',fontSize:15,borderRadius:14}:{padding:'9px 15px',fontSize:13}
  const va   = variant==='primary'?{background:'#3b82f6',color:'#fff'}:variant==='success'?{background:'#10b981',color:'#fff'}:variant==='danger'?{background:'#fef2f2',color:'#ef4444',borderColor:'#fecaca'}:variant==='warn'?{background:'#fffbeb',color:'#f59e0b',borderColor:'#fde68a'}:{background:'#f1f5f9',color:'#64748b',borderColor:'#cbd5e1'}
  return <button onClick={disabled?undefined:onClick} style={{...base,...sz,...va}}>{children}</button>
}

// ═══ MAIN APP ═════════════════════════════════════════════════════
export default function CRM() {
  // Auth
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  // Data
  const [clients,    setClients]    = useState([])
  const [managers,   setManagers]   = useState([])
  const [users,      setUsers]      = useState([])
  const [pipeline,   setPipeline]   = useState(PIPELINE_DEFAULT)
  const [checklists, setChecklists] = useState({})
  const [waChats,    setWaChats]    = useState([])
  const [waMessages, setWaMessages] = useState([])
  const [dashData,   setDashData]   = useState(null)
  const [kpiData,    setKpiData]    = useState(null)
  const [kpiPeriod,  setKpiPeriod]  = useState('month')

  // UI state
  const [page,        setPage]       = useState('dashboard')
  const [selClient,   setSelClient]  = useState(null)
  const [selWaChat,   setSelWaChat]  = useState(null)
  const selWaChatRef = useRef(null)  // для polling без race condition
  const [modal,       setModal]      = useState(null)
  const [search,      setSearch]     = useState('')
  const [fMgr,        setFMgr]       = useState('')
  const [fStage,      setFStage]     = useState('')
  const [searchRes,   setSearchRes]  = useState([])
  const [drag,        setDrag]       = useState(null)
  const [dragOv,      setDragOv]     = useState(null)
  const [toast,       setToast]      = useState(null)
  const [syncing,     setSyncing]    = useState(false)
  const [hasChanges,  setHasChanges] = useState(false)
  const [exitDlg,     setExitDlg]    = useState(null)
  const toastRef = useRef(null)
  const waInputRef = useRef(null)

  // ─── TOAST ──────────────────────────────────────────────
  function toast$(msg, type='ok') {
    setToast({ msg, type })
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 3000)
  }

  // ─── AUTH ────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('crm_token')
    const saved = localStorage.getItem('crm_user')
    if (token && saved) {
      setUser(JSON.parse(saved))
    }
    setLoading(false)
  }, [])

  async function login(lg, pw) {
    try {
      const data = await api.login(lg, pw)
      localStorage.setItem('crm_token', data.token)
      localStorage.setItem('crm_user', JSON.stringify(data.user))
      setUser(data.user)
    } catch (e) {
      throw e
    }
  }

  function logout() {
    localStorage.removeItem('crm_token')
    localStorage.removeItem('crm_user')
    setUser(null)
    setClients([])
    setPage('dashboard')
  }

  // ─── LOAD DATA ───────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setSyncing(true)
    try {
      const [cRes, mRes, uRes, plRes, clRes] = await Promise.all([
        api.getClients(),
        api.getManagers(),
        api.getUsers().catch(() => ({ users: [] })),
        api.getPipeline(),
        api.getChecklists(),
      ])
      if (cRes?.clients)    setClients(cRes.clients)
      if (mRes?.managers)   setManagers(mRes.managers)
      if (uRes?.users)      setUsers(uRes.users)
      if (plRes?.pipeline)  setPipeline(plRes.pipeline)
      if (clRes?.checklists) setChecklists(clRes.checklists)
    } catch (e) {
      toast$('❌ Ошибка загрузки: ' + e.message, 'err')
    }
    setSyncing(false)
  }, [])

  useEffect(() => {
    if (user) loadAll()
  }, [user, loadAll])

  // Load dashboard
  useEffect(() => {
    if (user && page === 'dashboard') {
      api.getDashboard().then(d => setDashData(d)).catch(() => {})
    }
  }, [user, page])

  // Load KPI
  useEffect(() => {
    if (user && page === 'kpi') {
      api.getKPI(kpiPeriod).then(d => setKpiData(d)).catch(() => {})
    }
  }, [user, page, kpiPeriod])

  // Load WA chats + polling every 10s
  useEffect(() => {
    if (!user || page !== 'wa') return

    // Загружает список чатов, уведомляет о новых
    const loadChats = () => api.getWaChats().then(d => {
      if (!d?.chats) return
      setWaChats(prev => {
        const prevUnread = prev.reduce((s,c) => s+(c.unread_count||0), 0)
        const newUnread  = d.chats.reduce((s,c) => s+(c.unread_count||0), 0)
        if (newUnread > prevUnread &&
            typeof Notification !== 'undefined' &&
            Notification.permission === 'granted' &&
            document.hidden) {
          new Notification('WhatsApp CRM', { body: `${newUnread} новых сообщений`, icon: '/favicon.ico' })
        }
        return d.chats
      })
    }).catch(() => {})

    // Инкрементальный polling сообщений — только новые, не весь список
    const loadMsgs = () => {
      if (typeof document !== 'undefined' && document.hidden) return  // вкладка не активна
      const cur = selWaChatRef.current
      if (!cur?.id) return
      // Берём id последнего известного сообщения чтобы загружать только новые
      setWaMessages(prev => {
        const lastId  = prev.length ? prev[prev.length - 1].sent_at : null
        const qs      = lastId ? `&after=${encodeURIComponent(lastId)}` : ''
        api.getWaMessages(cur.id, qs).then(d => {
          if (!d?.messages?.length) return
          setWaMessages(existing => {
            // Merge: добавляем только действительно новые (по id)
            const existingIds = new Set(existing.map(m => m.id))
            const fresh = d.messages.filter(m => !existingIds.has(m.id))
            if (!fresh.length) return existing
            // Обновляем статусы уже существующих (delivered → read)
            const updated = existing.map(m => {
              const newer = d.messages.find(nm => nm.id === m.id)
              return newer && newer.status !== m.status ? { ...m, status: newer.status } : m
            })
            return [...updated, ...fresh]
          })
        }).catch(() => {})
        return prev  // не меняем состояние в этом setWaMessages
      })
    }

    loadChats()
    loadMsgs()
    const t1 = setInterval(loadChats, WA_CHATS_POLL_MS)
    const t2 = setInterval(loadMsgs,  WA_MESSAGES_POLL_MS)
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [user, page])

  // Search
  useEffect(() => {
    if (page !== 'search') return
    const t = setTimeout(() => {
      api.search({ q: search, stage: fStage, manager: fMgr })
        .then(d => { if (d?.results) setSearchRes(d.results) })
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [search, fStage, fMgr, page])

  // ─── CLIENT ACTIONS ──────────────────────────────────────
  async function saveClient(c) {
    setSyncing(true)
    try {
      const existing = clients.find(x => x.id === c.id)
      let saved
      if (existing) {
        const res = await api.updateClient(c.id, c)
        saved = res.client
      } else {
        const res = await api.createClient(c)
        saved = res.client
      }
      setClients(cs => {
        const i = cs.findIndex(x => x.id === c.id)
        return i >= 0 ? cs.map(x => x.id === c.id ? saved||c : x) : [saved||c, ...cs]
      })
      if (selClient?.id === c.id) setSelClient(saved || c)
      setHasChanges(false)
      toast$('✅ Сохранено')
      setModal(null)
    } catch (e) {
      toast$('❌ ' + e.message, 'err')
    }
    setSyncing(false)
  }

  async function delClient(id) {
    setSyncing(true)
    try {
      await api.deleteClient(id)
      setClients(cs => cs.filter(x => x.id !== id))
      setSelClient(null)
      setHasChanges(false)
      toast$('🗑 Удалено')
      setModal(null)
    } catch (e) {
      toast$('❌ ' + e.message, 'err')
    }
    setSyncing(false)
  }

  async function moveClient(id, stage) {
    const c = clients.find(x => x.id === id)
    if (!c) return
    const updated = { ...c, stage }
    try {
      await api.updateClient(id, updated)
      setClients(cs => cs.map(x => x.id === id ? updated : x))
      if (selClient?.id === id) setSelClient(updated)
      toast$(`📌 ${pipeline.find(p => p.id === stage)?.l}`)
    } catch (e) {
      toast$('❌ ' + e.message, 'err')
    }
  }

  // ─── MANAGER ACTIONS ─────────────────────────────────────
  async function saveMgr(m) {
    setSyncing(true)
    try {
      const exists = managers.find(x => x.id === m.id)
      let saved
      if (exists) {
        const res = await api.updateManager(m.id, m)
        saved = res.manager
      } else {
        const res = await api.createManager(m)
        saved = res.manager
      }
      setManagers(ms => {
        const i = ms.findIndex(x => x.id === m.id)
        return i >= 0 ? ms.map(x => x.id === m.id ? saved||m : x) : [...ms, saved||m]
      })
      toast$('✅ Менеджер сохранён')
      setModal(null)
    } catch (e) {
      toast$('❌ ' + e.message, 'err')
    }
    setSyncing(false)
  }

  async function delMgr(id) {
    try {
      await api.deleteManager(id)
      setManagers(ms => ms.filter(x => x.id !== id))
      toast$('🗑 Менеджер удалён')
      setModal(null)
    } catch (e) {
      toast$('❌ ' + e.message, 'err')
    }
  }

  // ─── USER ACTIONS ────────────────────────────────────────
  async function saveUser(u) {
    setSyncing(true)
    try {
      const exists = users.find(x => x.id === u.id)
      let saved
      if (exists) {
        const res = await api.updateUser(u.id, u)
        saved = res.user
      } else {
        const res = await api.createUser(u)
        saved = res.user
      }
      setUsers(us => {
        const i = us.findIndex(x => x.id === u.id)
        return i >= 0 ? us.map(x => x.id === u.id ? saved||u : x) : [...us, saved||u]
      })
      toast$('✅ Пользователь сохранён')
      setModal(null)
    } catch (e) {
      toast$('❌ ' + e.message, 'err')
    }
    setSyncing(false)
  }

  async function delUser(id) {
    try {
      await api.deleteUser(id)
      setUsers(us => us.filter(x => x.id !== id))
      toast$('🗑 Удалено')
      setModal(null)
    } catch (e) {
      toast$('❌ ' + e.message, 'err')
    }
  }

  // ─── PIPELINE + CHECKLISTS ───────────────────────────────
  async function savePL(stages) {
    try {
      await api.updatePipeline(stages)
      setPipeline(stages)
      toast$('✅ Воронка сохранена')
      setModal(null)
    } catch (e) { toast$('❌ ' + e.message, 'err') }
  }

  async function saveCL(stage_name, items) {
    try {
      await api.updateChecklist(stage_name, items)
      setChecklists(cl => ({ ...cl, [stage_name]: items }))
      toast$('✅ Чек-лист сохранён')
      setModal(null)
    } catch (e) { toast$('❌ ' + e.message, 'err') }
  }

  // ─── WA ACTIONS ──────────────────────────────────────────
  async function loadWaMessages(chatId) {
    try {
      const d = await api.getWaMessages(chatId)
      if (d?.messages) setWaMessages(d.messages)
      setWaChats(cs => cs.map(c => c.id === chatId ? { ...c, unread_count: 0 } : c))
    } catch (e) { toast$('❌ ' + e.message, 'err') }
  }

  const sendWaMsg = useCallback(async function sendWaMsg(chatId, phone, text) {
    if (!text.trim()) return
    try {
      await api.sendWaMessage(chatId, phone, text, user?.name)
      await loadWaMessages(chatId)
    } catch (e) { toast$('❌ ' + e.message, 'err') }
  }, [user]) // useCallback

  const sendWaMedia = useCallback(async function sendWaMedia(chatId, phone, file, caption) {
    try {
      await api.sendWaMedia(chatId, phone, file, caption, user?.name)
      await loadWaMessages(chatId)
      toast$('✅ Файл отправлен')
    } catch (e) {
      toast$('❌ ' + e.message, 'err')
      throw e
    }
  }, [user]) // useCallback

  const assignWaChat = useCallback(async function assignWaChat(chatId, managerId) {
    try {
      await api.assignWaChat(chatId, managerId)
      setWaChats(cs => cs.map(c => c.id === chatId ? { ...c, assigned_to: managerId } : c))
      toast$('✅ Менеджер назначен')
    } catch (e) { toast$('❌ ' + e.message, 'err') }
  }

  const updateWaChatStatus = useCallback(async function updateWaChatStatus(chatId, newStatus) {
    try {
      await api.updateWaChatStatus(chatId, newStatus)
      setWaChats(cs => cs.map(c => c.id === chatId ? { ...c, status: newStatus } : c))
    } catch (e) { toast$('❌ ' + e.message, 'err') }
  }, []) // useCallback

  async function importWaLead(c, linkWaChatId) {
    try {
      const res = await api.createClient(c)
      const saved = res.client || c
      setClients(cs => [saved, ...cs])
      // Привязываем wa_chat к созданному клиенту
      if (linkWaChatId && saved?.id) {
        const waId = linkWaChatId
        // Привязываем клиента к чату (используем api через request — с auth header)
        await api.updateWaChatStatus(waId, undefined).catch(() => {})  // no-op warmup
        await fetch('/api/wa/chats', {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('crm_token')}` },
          body:    JSON.stringify({ chatId: waId, clientId: saved.id }),
        }).catch(() => {})
        setWaChats(cs => cs.map(ch => ch.id === waId ? { ...ch, client_id: saved.id } : ch))
      }
      toast$('✅ WhatsApp лид добавлен!')
    } catch (e) { toast$('❌ ' + e.message, 'err') }
  }

  // ─── NAV ─────────────────────────────────────────────────
  function goBack() {
    if (hasChanges) { setExitDlg({ onConfirm: () => { setHasChanges(false); setSelClient(null); setExitDlg(null) } }) }
    else setSelClient(null)
  }

  function navTo(p) {
    if (hasChanges && selClient) { setExitDlg({ onConfirm: () => { setHasChanges(false); setSelClient(null); setPage(p); setExitDlg(null) } }) }
    else { setSelClient(null); setPage(p) }
  }

  // ─── COMPUTED ────────────────────────────────────────────
  const isMgr   = user?.role === 'manager'
  const isAdmin = user?.role === 'admin'
  const isHead  = user?.role === 'head'

  // ── Мемоизированные вычисления: пересчёт только при изменении зависимостей ──
  const myCl = useMemo(
    () => isMgr ? clients.filter(c => c.manager === user?.mid) : clients,
    [clients, isMgr, user?.mid]
  )

  const filtered = useMemo(() => {
    if (!search && !fMgr && !fStage) return myCl          // fast path: нет фильтров
    const q = search ? search.toLowerCase() : null
    return myCl.filter(c => {
      if (q && !c.fio.toLowerCase().includes(q) && !c.phone.includes(q) && !(c.iin||'').includes(q)) return false
      if (fMgr   && c.manager !== fMgr)   return false
      if (fStage && c.stage   !== fStage) return false
      return true
    })
  }, [myCl, search, fMgr, fStage])

  // Единый проход по задачам вместо двух flatMap
  const { openTasks, overdueTasks } = useMemo(() => {
    const td = today()
    let open = 0, overdue = 0
    for (const c of myCl) {
      for (const t of c.tasks || []) {
        if (!t.done) { open++; if (t.due && t.due < td) overdue++ }
      }
    }
    return { openTasks: open, overdueTasks: overdue }
  }, [myCl])

  // Memoized stage counts — O(n) one pass instead of O(stages×n) every render
  // Memoized manager lookup — O(1) access instead of O(n) × 10 managers.find() calls
  const mgrById = useMemo(() =>
    Object.fromEntries(managers.map(m => [m.id, m])),
  [managers])

    const stageCounts = useMemo(() => {
    const counts = {}
    for (const c of myCl) counts[c.stage] = (counts[c.stage] || 0) + 1
    return counts
  }, [myCl])


  const waUnread = useMemo(
    () => waChats.reduce((s, c) => s + (c.unread_count || 0), 0),
    [waChats]
  )

  const NAV = [
    { id:'dashboard', l:'Дашборд',            i:'ti-layout-dashboard' },
    { id:'clients',   l:'Клиенты',            i:'ti-users' },
    { id:'search',    l:'Поиск / Все клиенты',i:'ti-search' },
    { id:'wa',        l:'WhatsApp',           i:'ti-brand-whatsapp', cnt:waUnread, wa:true },
    { id:'tasks',     l:'Задачи',             i:'ti-checkbox', cnt:openTasks, warn:overdueTasks>0 },
    { id:'kpi',       l:'KPI',               i:'ti-chart-bar' },
    ...(isAdmin ? [{ id:'admin', l:'Панель техника', i:'ti-settings-2' }] : []),
  ]

  // ─── LOADING ─────────────────────────────────────────────
  if (loading) return (
    <div style={{minHeight:'100vh',background:'#0f172a',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16,color:'#fff'}}>
      <div style={{fontSize:40}}>🏠</div>
      <div style={{fontSize:16,fontWeight:700}}>Ипотека CRM</div>
      <div style={{fontSize:13,color:'#64748b'}}>Загрузка...</div>
    </div>
  )

  if (!user) return <LoginPage onLogin={login}/>

  const role = ROLE[user.role]

  if (selClient) return (
    <ClientDetail
      client={selClient} managers={managers} pipeline={pipeline}
      checklists={checklists} user={user}
      onSave={saveClient} onDelete={delClient} onMove={moveClient}
      onBack={goBack} toast$={toast$}
      setHasChanges={setHasChanges} syncing={syncing}
    />
  )

  return (
    <>
      <Head>
        <title>Ипотека CRM</title>
        <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css"/>
      </Head>

      <div className="app-layout" style={{fontFamily:"'Inter',system-ui,sans-serif"}}>
        {/* ── SIDEBAR ── */}
        <div className="sidebar">
          <div style={{padding:'16px 15px 13px',borderBottom:'1px solid rgba(255,255,255,.07)'}}>
            <div style={{fontSize:20,marginBottom:4}}>🏠</div>
            <div style={{fontSize:14,fontWeight:800,color:'#fff'}}>Ипотека CRM</div>
            <div style={{fontSize:10,color:'#475569',marginTop:2,display:'flex',alignItems:'center',gap:5}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:syncing?'#f59e0b':'#10b981',display:'inline-block'}}/>
              {syncing ? 'Синхронизация...' : 'Подключено'}
            </div>
          </div>
          <div style={{padding:'9px 8px',flex:1,display:'flex',flexDirection:'column',gap:2,overflowY:'auto'}}>
            {NAV.map(n => (
              <button key={n.id} onClick={() => navTo(n.id)}
                style={{display:'flex',alignItems:'center',gap:8,padding:'9px 11px',borderRadius:9,
                  color:page===n.id?'#fff':n.wa?'#25d366':'#64748b',
                  background:page===n.id?'#3b82f6':'transparent',
                  fontWeight:page===n.id?700:500,fontSize:12.5,width:'100%',
                  textAlign:'left',border:'none',cursor:'pointer',transition:'all .14s',fontFamily:'inherit'}}>
                <i className={`ti ${n.i}`} style={{fontSize:16,width:17,flexShrink:0}}/>
                {n.l}
                {n.cnt > 0 && <span style={{marginLeft:'auto',fontSize:10,fontWeight:700,padding:'1px 6px',borderRadius:20,background:n.warn?'#ef4444':n.wa?'#25d366':'rgba(255,255,255,.12)',color:'#fff'}}>{n.cnt}</span>}
              </button>
            ))}
            <div style={{padding:'8px 10px 3px',fontSize:9,fontWeight:700,letterSpacing:'.09em',color:'#374151',textTransform:'uppercase',marginTop:6}}>Воронка</div>
            {pipeline.map(p => {
              const cnt = stageCounts[p.id] || 0
              return <button key={p.id} onClick={() => { setPage('clients'); setFStage(p.id) }}
                style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:7,padding:'8px 11px',borderRadius:9,color:'#64748b',background:'transparent',fontSize:12,width:'100%',textAlign:'left',border:'none',cursor:'pointer',fontFamily:'inherit'}}>
                <span style={{display:'flex',alignItems:'center',gap:7}}><span style={{width:7,height:7,borderRadius:'50%',background:p.c,display:'inline-block'}}/>{p.l}</span>
                {cnt > 0 && <span style={{background:p.c+'33',color:p.c,borderRadius:20,padding:'1px 6px',fontSize:10,fontWeight:700}}>{cnt}</span>}
              </button>
            })}
          </div>
          <div style={{padding:11,borderTop:'1px solid rgba(255,255,255,.07)'}}>
            <button onClick={() => { if (hasChanges) setExitDlg({ onConfirm: () => { setHasChanges(false); logout(); setExitDlg(null) } }); else logout() }}
              style={{display:'flex',alignItems:'center',gap:8,padding:'9px 10px',background:'rgba(255,255,255,.06)',borderRadius:10,cursor:'pointer',width:'100%',border:'none',fontFamily:'inherit',transition:'background .14s'}}>
              <div style={{width:28,height:28,borderRadius:'50%',background:role?.c||'#3b82f6',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:11,color:'#fff',flexShrink:0}}>{user.name[0]}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:600,color:'#94a3b8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.name}</div>
                <span style={{fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:20,background:(role?.c||'#3b82f6')+'22',color:role?.c||'#3b82f6'}}>{role?.l}</span>
              </div>
              <i className="ti ti-logout" style={{fontSize:13,color:'#475569'}}/>
            </button>
          </div>
        </div>

        {/* ── MAIN ── */}
        <div className="main-area">
          {/* Topbar */}
          <div className="topbar">
            <div className="topbar-title">
              {NAV.find(n => n.id === page)?.l || 'CRM'}
            </div>
            {page === 'clients' && <>
              <div style={{display:'flex',alignItems:'center',gap:7,background:'#f1f5f9',borderRadius:10,padding:'7px 11px',flex:1,maxWidth:220}}>
                <i className="ti ti-search" style={{color:'#64748b',fontSize:14,flexShrink:0}}/>
                <input style={{border:'none',background:'transparent',fontSize:13,color:'#0f172a',width:'100%',outline:'none'}} placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)}/>
              </div>
              <div className="topbar-filters" style={{display:'contents'}}>
                {!isMgr && <Sel value={fMgr} onChange={e => setFMgr(e.target.value)} style={{width:140}}>
                  <option value="">Все менеджеры</option>
                  {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </Sel>}
                <Sel value={fStage} onChange={e => setFStage(e.target.value)} style={{width:150}}>
                  <option value="">Все этапы</option>
                  {pipeline.map(p => <option key={p.id} value={p.id}>{p.l}</option>)}
                </Sel>
              </div>
            </>}
            <Btn variant="primary" size="sm" onClick={() => setModal({ type:'new_client', c: emptyClient(user.mid||'') })}>
              <i className="ti ti-plus"/><span style={{display:'none'}} className="btn-text-desktop">Новый клиент</span><span style={{display:'inline'}}>+</span>
            </Btn>
            <Btn size="sm" onClick={loadAll} disabled={syncing}>
              <i className={`ti ti-refresh${syncing?' spin':''}`}/>
            </Btn>
          </div>

          {/* Page content */}
          <div className="main-content">
            {page==='dashboard' && <DashPage data={dashData} pipeline={pipeline} managers={managers} onOpen={c => setSelClient(c)} onLoadDash={() => api.getDashboard().then(d => setDashData(d))}/>}
            {page==='clients'   && <ClientsPage clients={filtered} managers={managers} pipeline={pipeline} onOpen={c => setSelClient(c)} drag={drag} setDrag={setDrag} dragOv={dragOv} setDragOv={setDragOv} onMove={moveClient}/>}
            {page==='search'    && <SearchPage clients={searchRes.length||search||fStage||fMgr?searchRes:myCl} managers={managers} pipeline={pipeline} checklists={checklists} search={search} setSearch={setSearch} fStage={fStage} setFStage={setFStage} fMgr={fMgr} setFMgr={setFMgr} onOpen={c => setSelClient(c)} waNew={myCl.filter(c=>c.isWhatsApp&&c.stage==='new_lead')}/>}
            {page==='wa'        && <WAPage chats={waChats} messages={waMessages} managers={managers} clients={myCl} selChat={selWaChat} onSelChat={c=>{selWaChatRef.current=c;setSelWaChat(c);setWaMessages([]);if(c)loadWaMessages(c.id)}} onSend={sendWaMsg} onSendMedia={sendWaMedia} onImport={importWaLead} onAssign={assignWaChat} onUpdateStatus={updateWaChatStatus} user={user} onOpenClient={c=>setSelClient(c)}/>}
            {page==='tasks'     && <TasksPage clients={myCl} managers={managers} onOpen={c => setSelClient(c)}/>}
            {page==='kpi'       && <KPIPage data={kpiData} period={kpiPeriod} setPeriod={setKpiPeriod}/>}
            {page==='admin'     && isAdmin && <AdminPage managers={managers} pipeline={pipeline} checklists={checklists} users={users} onSaveMgr={saveMgr} onDelMgr={delMgr} onSaveUser={saveUser} onDelUser={delUser} onSavePL={savePL} onSaveCL={saveCL} onModal={setModal} reload={loadAll} syncing={syncing}/>}
          </div>
        </div>
      </div>

      {/* Bottom nav (mobile) */}
      <BottomNav page={page} navTo={navTo} openTasks={openTasks} overdueTasks={overdueTasks} waUnread={waUnread}/>

      {/* Modals */}
      {modal?.type==='new_client'    && <NewClientModal    client={modal.c} managers={managers} pipeline={pipeline} onSave={saveClient} onClose={()=>setModal(null)} syncing={syncing}/>}
      {modal?.type==='mgr_edit'      && <MgrModal          item={modal.item} onSave={saveMgr} onClose={()=>setModal(null)} syncing={syncing}/>}
      {modal?.type==='user_edit'     && <UserModal         item={modal.item} managers={managers} onSave={saveUser} onClose={()=>setModal(null)} syncing={syncing}/>}
      {modal?.type==='cl_edit'       && <CLModal           stage={modal.stage} items={modal.items} onSave={saveCL} onClose={()=>setModal(null)} syncing={syncing}/>}
      {modal?.type==='pl_edit'       && <PLModal           pipeline={pipeline} onSave={savePL} onClose={()=>setModal(null)} syncing={syncing}/>}

      {/* Exit dialog */}
      {exitDlg && (
        <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.52)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)',padding:16}}>
          <div className="exit-dlg">
            <div style={{fontSize:40,marginBottom:12}}>⚠️</div>
            <div style={{fontSize:18,fontWeight:800,marginBottom:8}}>Несохранённые изменения</div>
            <div style={{fontSize:14,color:'#64748b',marginBottom:22}}>Выйти без сохранения? Все изменения будут потеряны.</div>
            <div style={{display:'flex',gap:9,justifyContent:'center'}}>
              <Btn onClick={() => setExitDlg(null)}>Остаться</Btn>
              <Btn variant="danger" onClick={() => exitDlg.onConfirm()}><i className="ti ti-arrow-left"/>Выйти</Btn>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast${toast.type==='err'?' err':''}`}>
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin .8s linear infinite}
        @media(max-width:768px){
          .sidebar{display:none!important}
          .bot-nav{display:block!important}
          .btn-text-desktop{display:none!important}
          .topbar-filters{display:none!important}
        }
      `}</style>
    </>
  )
}

// ─── LOGIN PAGE ──────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [lg, setLg]   = useState('')
  const [pw, setPw]   = useState('')
  const [err, setErr] = useState('')
  const [ld, setLd]   = useState(false)

  async function go() {
    setLd(true); setErr('')
    try { await onLogin(lg, pw) }
    catch (e) { setErr(e.message || 'Неверный логин или пароль') }
    setLd(false)
  }

  const hints = [
    { l:'admin',   p:'admin123', r:'Техник' },
    { l:'head',    p:'head123',  r:'Руководитель' },
    { l:'aigerim', p:'a123',     r:'Менеджер' },
    { l:'daniyar', p:'d123',     r:'Менеджер' },
  ]

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(160deg,#0f172a,#1e3a5f)',display:'flex',alignItems:'center',justifyContent:'center',padding:20,fontFamily:"'Inter',system-ui,sans-serif"}}>
      <Head>
        <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css"/>
      </Head>
      <div style={{background:'#fff',borderRadius:22,padding:'34px 30px',width:'100%',maxWidth:380,boxShadow:'0 24px 80px rgba(0,0,0,.3)'}}>
        <div style={{textAlign:'center',marginBottom:26}}>
          <div style={{fontSize:42,marginBottom:8}}>🏠</div>
          <div style={{fontSize:22,fontWeight:900,letterSpacing:'-.5px'}}>Ипотека CRM</div>
          <div style={{fontSize:13,color:'#64748b',marginTop:4}}>Войдите в систему</div>
        </div>
        <Fl l="Логин" ch={<Inp value={lg} onChange={e=>{setLg(e.target.value);setErr('')}} placeholder="Ваш логин" style={{fontSize:16,padding:'12px 14px',borderRadius:12}}/>}/>
        <Fl l="Пароль" ch={<Inp type="password" value={pw} onChange={e=>{setPw(e.target.value);setErr('')}} placeholder="Ваш пароль" style={{fontSize:16,padding:'12px 14px',borderRadius:12}}/>}/>
        {err && <div style={{background:'#fef2f2',color:'#ef4444',border:'1.5px solid #fecaca',borderRadius:10,padding:'10px 13px',fontSize:13,fontWeight:600,marginBottom:12,textAlign:'center'}}>{err}</div>}
        <Btn variant="primary" onClick={go} disabled={ld} style={{width:'100%',justifyContent:'center',padding:'13px',fontSize:15,borderRadius:14,marginBottom:18}}>
          {ld ? <><i className="ti ti-loader spin"/>Вход...</> : <><i className="ti ti-login"/>Войти</>}
        </Btn>
        <div style={{background:'#f8fafc',borderRadius:12,border:'1px solid #e2e8f0',overflow:'hidden'}}>
          <div style={{padding:'9px 13px',fontSize:10,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'.06em',borderBottom:'1px solid #e2e8f0'}}>Нажмите для входа:</div>
          {hints.map(h => (
            <div key={h.l} onClick={() => { setLg(h.l); setPw(h.p); setErr('') }}
              style={{display:'flex',justifyContent:'space-between',padding:'10px 13px',borderBottom:'1px solid #e2e8f0',cursor:'pointer',transition:'background .1s'}}
              onMouseEnter={e => e.currentTarget.style.background='#e2e8f0'}
              onMouseLeave={e => e.currentTarget.style.background=''}>
              <span style={{fontWeight:700,fontSize:13}}>{h.l} / {h.p}</span>
              <span style={{color:'#64748b',fontSize:12}}>{h.r}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

LoginPage = React.memo(LoginPage)

// ─── BOTTOM NAV (mobile) ─────────────────────────────────────────
function BottomNav({ page, navTo, openTasks, overdueTasks, waUnread }) {
  const items = [
    { id:'dashboard', l:'Главная',  i:'ti-home' },
    { id:'search',    l:'Поиск',    i:'ti-search' },
    { id:'wa',        l:'WhatsApp', i:'ti-brand-whatsapp', cnt:waUnread, wa:true },
    { id:'tasks',     l:'Задачи',   i:'ti-checkbox', cnt:openTasks, warn:overdueTasks>0 },
    { id:'kpi',       l:'KPI',      i:'ti-chart-bar' },
  ]
  return (
    <nav className="bot-nav" style={{background:'#fff',borderTop:'1.5px solid #e2e8f0',position:'fixed',bottom:0,left:0,right:0,zIndex:200}}>
      <div style={{display:'flex',paddingBottom:'env(safe-area-inset-bottom)'}}>
        {items.map(n => (
          <button key={n.id} onClick={() => navTo(n.id)}
            style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'8px 4px 6px',cursor:'pointer',border:'none',background:'transparent',
              color:n.wa?'#25d366':page===n.id?'#3b82f6':'#94a3b8',
              fontFamily:'inherit',transition:'color .14s',position:'relative',minWidth:0}}>
            <div style={{position:'relative',display:'inline-flex',width:26,height:26,alignItems:'center',justifyContent:'center'}}>
              <i className={`ti ${n.i}`} style={{fontSize:23}}/>
              {n.cnt > 0 && <span style={{position:'absolute',top:-4,right:-6,background:n.warn?'#ef4444':n.wa?'#25d366':'#ef4444',color:'#fff',borderRadius:20,fontSize:9,fontWeight:800,padding:'1px 5px',minWidth:16,textAlign:'center',lineHeight:1.4}}>{n.cnt}</span>}
            </div>
            <span style={{fontSize:10,fontWeight:700,letterSpacing:'.02em'}}>{n.l}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}

// ─── DASHBOARD PAGE ──────────────────────────────────────────────
function DashPage({ data, pipeline, managers, onOpen, onLoadDash }) {
  useEffect(() => { if (!data) onLoadDash() }, [])

  if (!data) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:300,color:'#64748b',gap:10}}>
      <i className="ti ti-loader spin" style={{fontSize:24}}/>Загрузка дашборда...
    </div>
  )

  const { metrics, funnel, managers: mgrStats, recent } = data
  const pl = pipeline || PIPELINE_DEFAULT

  return (
    <div>
      {/* Metrics */}
      <div className='mg4'>
        {[
          { l:'Всего клиентов', v:metrics.total,        s:`${metrics.thisMonth} за месяц`,    c:'#6366f1', i:'ti-users' },
          { l:'Договоров',      v:metrics.contracts,    s:`${metrics.conversion}% конверсия`, c:'#ec4899', i:'ti-file-certificate' },
          { l:'Получено',       v:fmtN(metrics.paidRev)+'₸', s:`Выручка: ${fmtN(metrics.rev)}₸`, c:'#10b981', i:'ti-cash' },
          { l:'Просроч.задач',  v:metrics.overdueTasks, s:`${metrics.waNewLeads} WA лидов`,   c:metrics.overdueTasks>0?'#ef4444':'#10b981', i:'ti-checkbox' },
        ].map(({ l,v,s,c,i }) => (
          <div key={l} style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:14,padding:'14px 15px',boxShadow:'0 1px 4px rgba(0,0,0,.07)',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:c,borderRadius:'4px 4px 0 0'}}/>
            <div style={{fontSize:10,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>{l}</div>
            <div style={{fontSize:24,fontWeight:800,letterSpacing:'-1px',color:c,lineHeight:1}}>{v}</div>
            <div style={{fontSize:11,color:'#94a3b8',marginTop:3}}>{s}</div>
            <i className={`ti ${i}`} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',fontSize:28,opacity:.07}}/>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {metrics.overdueTasks > 0 && (
        <div style={{background:'#fef2f2',border:'2px solid #fecaca',borderRadius:13,padding:13,marginBottom:13,display:'flex',gap:11,alignItems:'center'}}>
          <div style={{width:38,height:38,borderRadius:11,background:'#ef4444',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><i className="ti ti-alert-triangle" style={{color:'#fff',fontSize:19}}/></div>
          <div><div style={{fontWeight:800,fontSize:14,color:'#ef4444'}}>⚠️ {metrics.overdueTasks} просроченных задач!</div><div style={{fontSize:12,color:'#64748b',marginTop:2}}>Откройте раздел "Задачи"</div></div>
        </div>
      )}
      {metrics.waNewLeads > 0 && (
        <div style={{background:'#f0fdf4',border:'2px solid #86efac',borderRadius:13,padding:13,marginBottom:13,display:'flex',gap:11,alignItems:'center'}}>
          <div style={{width:38,height:38,borderRadius:11,background:'#25d366',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><i className="ti ti-brand-whatsapp" style={{color:'#fff',fontSize:19}}/></div>
          <div><div style={{fontWeight:800,fontSize:14,color:'#065f46'}}>🔔 {metrics.waNewLeads} WhatsApp лидов ждут</div></div>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:13,marginBottom:13}}>
        {/* Funnel */}
        <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:14,padding:16,boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
          <div style={{fontWeight:800,fontSize:14,marginBottom:12}}>Воронка продаж</div>
          {pl.map(p => {
            const cnt = funnel[p.id] || 0
            const total = Object.values(funnel).reduce((s,n) => s+n, 0)
            const pct = total ? Math.round(cnt/total*100) : 0
            return (
              <div key={p.id} style={{marginBottom:9}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
                  <span style={{display:'flex',alignItems:'center',gap:6,fontWeight:500}}><span style={{width:7,height:7,borderRadius:'50%',background:p.c,display:'inline-block'}}/>{p.l}</span>
                  <span style={{fontWeight:700,color:'#64748b'}}>{cnt}</span>
                </div>
                <Prog pct={pct} c={p.c} sz='xs'/>
              </div>
            )
          })}
        </div>

        {/* Managers rating */}
        <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:14,padding:16,boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
          <div style={{fontWeight:800,fontSize:14,marginBottom:12}}>Рейтинг менеджеров</div>
          {(mgrStats||[]).map(m => {
            const maxRev = Math.max(...(mgrStats||[]).map(x=>x.rev), 1)
            return (
              <div key={m.id} style={{display:'flex',alignItems:'center',gap:9,marginBottom:11}}>
                <div style={{width:24,height:24,borderRadius:'50%',background:(m.color||'#3b82f6')+'22',color:m.color||'#3b82f6',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:11,flexShrink:0}}>{m.name?.[0]}</div>
                <div style={{flex:1}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                    <span style={{fontWeight:700,fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:110}}>{m.name}</span>
                    <span style={{fontWeight:800,color:'#10b981',fontSize:12,flexShrink:0}}>{m.rev>0?fmtN(m.rev)+'₸':'—'}</span>
                  </div>
                  <Prog pct={Math.round(m.rev/maxRev*100)} c={m.color||'#3b82f6'} sz='xs'/>
                </div>
                <span style={{fontSize:11,color:'#64748b',fontWeight:700,width:28,textAlign:'right',flexShrink:0}}>{m.conv}%</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent clients */}
      <div style={{fontWeight:800,fontSize:14,marginBottom:11}}>Последние клиенты</div>
      <div style={{border:'1.5px solid #e2e8f0',borderRadius:14,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr style={{background:'#f8fafc'}}>
            {['Клиент','Менеджер','Этап','Договор',''].map(h => (
              <th key={h} style={{padding:'9px 12px',textAlign:'left',fontSize:10,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1.5px solid #e2e8f0'}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {(recent||[]).map(c => {
              const m = managers.find(x => x.id === c.manager)
              const p = pl.find(x => x.id === c.stage)
              return (
                <tr key={c.id} onClick={() => onOpen(c)} style={{cursor:'pointer',transition:'background .1s'}}
                  onMouseEnter={e => e.currentTarget.querySelectorAll('td').forEach(td=>td.style.background='#f8fafc')}
                  onMouseLeave={e => e.currentTarget.querySelectorAll('td').forEach(td=>td.style.background='')}>
                  <td style={{padding:'11px 12px',borderBottom:'1px solid #e2e8f0'}}>
                    <div style={{fontWeight:700}}>{c.fio||'—'}</div>
                    <div style={{fontSize:11,color:'#64748b'}}>{c.phone}</div>
                  </td>
                  <td style={{padding:'11px 12px',borderBottom:'1px solid #e2e8f0',fontSize:13}}>
                    {m ? <span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:6,height:6,borderRadius:'50%',background:m.color,display:'inline-block'}}/>{m.name}</span> : '—'}
                  </td>
                  <td style={{padding:'11px 12px',borderBottom:'1px solid #e2e8f0'}}>
                    {p && <Tag c={p.c} ch={p.l}/>}
                  </td>
                  <td style={{padding:'11px 12px',borderBottom:'1px solid #e2e8f0',fontWeight:700,color:'#10b981'}}>
                    {c.contract_amount > 0 ? fmtN(c.contract_amount)+'₸' : '—'}
                  </td>
                  <td style={{padding:'11px 12px',borderBottom:'1px solid #e2e8f0'}}>
                    <i className="ti ti-arrow-right" style={{color:'#94a3b8'}}/>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function fmtN(n) { return n ? new Intl.NumberFormat('ru').format(Math.round(n))+' ' : '— ' }

DashPage = React.memo(DashPage)

// ─── CLIENTS KANBAN ──────────────────────────────────────────────
function ClientsPage({ clients, managers, pipeline, onOpen, drag, setDrag, dragOv, setDragOv, onMove }) {
  const pl = pipeline || PIPELINE_DEFAULT
  return (
    <div className='kb'>
      {pl.map(p => {
        const sc = clients.filter(c => c.stage === p.id)
        const sv = sc.reduce((s, c) => s + (c.contractAmount||0), 0)
        return (
          <div key={p.id}
            style={{background:dragOv===p.id?'#eff6ff':'#f1f5f9',border:`1.5px solid ${dragOv===p.id?'#3b82f6':'#e2e8f0'}`,borderRadius:14,minWidth:185,flex:'0 0 185px',display:'flex',flexDirection:'column',transition:'all .14s'}}
            onDragOver={e=>{e.preventDefault();setDragOv(p.id)}}
            onDragLeave={()=>setDragOv(null)}
            onDrop={e=>{e.preventDefault();if(drag)onMove(drag,p.id);setDrag(null);setDragOv(null)}}>
            <div style={{padding:'11px 11px 9px',borderBottom:'1.5px solid #e2e8f0'}}>
              <div style={{fontSize:11.5,fontWeight:700,display:'flex',alignItems:'center',gap:6}}>
                <span style={{width:7,height:7,borderRadius:'50%',background:p.c,display:'inline-block'}}/>
                <span style={{color:p.c}}>{p.l}</span>
                <span style={{marginLeft:'auto',fontSize:10,fontWeight:700,background:'#fff',border:'1px solid #e2e8f0',borderRadius:20,padding:'1px 6px',color:'#64748b'}}>{sc.length}</span>
              </div>
              {sv > 0 && <div style={{fontSize:10,color:'#64748b',marginTop:3,fontWeight:500}}>{fmtN(sv)}₸</div>}
            </div>
            <div style={{padding:7,flex:1,display:'flex',flexDirection:'column',gap:6,overflowY:'auto',maxHeight:'62vh'}}>
              {sc.map(c => {
                const m = managers.find(x => x.id === c.manager)
                const cr = CR[c.creditStatus]
                return (
                  <div key={c.id} draggable
                    onDragStart={e=>{e.stopPropagation();setDrag(c.id)}}
                    onDragEnd={()=>{setDrag(null);setDragOv(null)}}
                    onClick={()=>onOpen(c)}
                    style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:11,padding:11,cursor:'pointer',transition:'all .14s',boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='#3b82f6';e.currentTarget.style.transform='translateY(-1px)'}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.transform='translateY(0)'}}>
                    <div style={{display:'flex',gap:5,marginBottom:2,alignItems:'flex-start'}}>
                      {c.isWhatsApp && <i className="ti ti-brand-whatsapp" style={{fontSize:12,color:'#25d366',marginTop:2}}/>}
                      <div style={{fontWeight:700,fontSize:12.5}}>{c.fio||'—'}</div>
                    </div>
                    <div style={{fontSize:11,color:'#64748b',marginBottom:5}}>{c.phone}</div>
                    <div style={{display:'flex',gap:3,flexWrap:'wrap',marginBottom:c.contractAmount?5:0}}>
                      <SrTag id={c.source}/>
                      {cr && <Tag c={cr.c} ch={cr.l}/>}
                    </div>
                    {c.contractAmount > 0 && <div style={{fontWeight:800,fontSize:12,color:p.c}}>{fmtN(c.contractAmount)}₸</div>}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:5}}>
                      <span style={{fontSize:10,color:'#94a3b8'}}>{c.dateIn}</span>
                      {m && <span style={{fontSize:10,color:'#64748b',fontWeight:600,display:'flex',alignItems:'center',gap:3}}><span style={{width:5,height:5,borderRadius:'50%',background:m.color,display:'inline-block'}}/>{m.name?.split(' ')[0]}</span>}
                    </div>
                  </div>
                )
              })}
              {sc.length === 0 && <div style={{textAlign:'center',color:'#94a3b8',fontSize:11,padding:'16px 0',fontStyle:'italic'}}>Пусто</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

ClientsPage = React.memo(ClientsPage)

// ─── BIG CLIENT CARD ─────────────────────────────────────────────
function BigClientCard({ c, managers, pipeline, checklists, onOpen }) {
  const m   = managers.find(x => x.id === c.manager)
  const pl  = pipeline || PIPELINE_DEFAULT
  const p   = pl.find(x => x.id === c.stage)
  const cr  = CR[c.creditStatus]
  const ctO = CT[c.contractType]
  const src = SRC[c.source]
  const cls = checklists || {}
  const totalItems = ACCOMP.reduce((s,st) => s+(cls[st]||[]).length, 0)
  const totalDone  = ACCOMP.reduce((s,st,i) => s+((c.accompStages||{})[i]?.done||[]).length, 0)
  const pct        = totalItems > 0 ? Math.round(totalDone/totalItems*100) : 0
  const paid       = (c.payments||[]).filter(x=>x.status==='paid').reduce((s,x)=>s+x.paidAmount,0)
  const partial    = (c.payments||[]).filter(x=>x.status==='partial').reduce((s,x)=>s+x.paidAmount,0)
  const payPct     = c.contractAmount > 0 ? Math.round((paid+partial)/c.contractAmount*100) : 0
  const openTasks  = (c.tasks||[]).filter(t=>!t.done)
  const overdue    = openTasks.filter(t=>t.due&&t.due<today())
  const lastCmt    = [...(c.comments||[])].sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0]
  const docsCount  = ACCOMP.reduce((s,st,i)=>s+((c.accompStages||{})[i]?.docs||[]).length, 0)
  const stageColor = p?.c || '#3b82f6'

  return (
    <div onClick={onOpen}
className='search-card'
      style={{}}>
      <div style={{height:4,background:`linear-gradient(90deg,${stageColor},${stageColor}66)`}}/>
      <div style={{padding:'14px 17px 12px',background:`linear-gradient(135deg,${stageColor}0a,transparent)`,borderBottom:'1px solid #e2e8f0'}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
          <div style={{display:'flex',gap:11,alignItems:'center',flex:1,minWidth:0}}>
            <div style={{width:44,height:44,borderRadius:13,background:stageColor+'22',color:stageColor,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:19,flexShrink:0,border:`2px solid ${stageColor}33`}}>{c.fio?c.fio[0]:'?'}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap',marginBottom:3}}>
                <span style={{fontWeight:900,fontSize:17,letterSpacing:'-.3px'}}>{c.fio||'—'}</span>
                {c.isWhatsApp && <span style={{background:'#25d36622',color:'#25d366',border:'1px solid #25d36644',borderRadius:20,padding:'1px 7px',fontSize:10,fontWeight:700,display:'inline-flex',alignItems:'center',gap:3}}><i className="ti ti-brand-whatsapp" style={{fontSize:10}}/>WA</span>}
              </div>
              <div style={{display:'flex',gap:7,flexWrap:'wrap',alignItems:'center'}}>
                {c.iin && <span style={{fontFamily:'monospace',fontSize:11,background:'#f1f5f9',padding:'2px 7px',borderRadius:5,color:'#64748b',border:'1px solid #e2e8f0'}}>{c.iin}</span>}
                <span style={{fontSize:12,color:'#64748b'}}>{c.phone}</span>
                <span style={{fontSize:12,color:'#64748b'}}>{c.city}</span>
              </div>
            </div>
          </div>
          {p && <div style={{flexShrink:0,textAlign:'right'}}>
            <Tag c={p.c} ch={p.l}/>
            <div style={{fontSize:10,color:'#64748b',marginTop:4}}>{c.dateIn}</div>
          </div>}
        </div>
      </div>
      <div style={{padding:'12px 17px'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:7,marginBottom:11}}>
          {[
            { l:'Менеджер', v: m ? <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:7,height:7,borderRadius:'50%',background:m.color,display:'inline-block',flexShrink:0}}/><span style={{fontWeight:700,fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.name}</span></span> : <span style={{fontSize:11,color:'#64748b'}}>—</span> },
            { l:'Источник',  v: src ? <span style={{background:src.c+'22',color:src.c,borderRadius:4,padding:'2px 6px',fontSize:10,fontWeight:700}}>{src.l}</span> : '—' },
            { l:'КИ',        v: cr  ? <span style={{background:cr.c+'22',color:cr.c,borderRadius:4,padding:'2px 6px',fontSize:10,fontWeight:700}}>{cr.l}</span> : '—' },
            { l:'Доход',     v: <div style={{fontWeight:700,fontSize:11}}>{c.officialIncome?fmtN(+c.officialIncome)+'₸':'—'}</div> },
          ].map(({ l, v }) => (
            <div key={l} style={{background:'#f8fafc',borderRadius:9,padding:'9px 10px',border:'1px solid #e2e8f0'}}>
              <div style={{fontSize:9,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:3}}>{l}</div>
              {v}
            </div>
          ))}
        </div>

        {c.contractType && (
          <div style={{background:'linear-gradient(135deg,#eff6ff,#f5f3ff)',borderRadius:11,padding:'11px 13px',marginBottom:10,border:'1.5px solid #c7d2fe'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:'#6366f1',textTransform:'uppercase',marginBottom:2}}>💼 {ctO?.l}</div>
                <div style={{fontWeight:900,fontSize:18,color:'#1d4ed8',letterSpacing:'-1px'}}>{fmtN(c.contractAmount)}₸</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:11,color:'#64748b',marginBottom:3}}>Получено: <b style={{color:'#10b981'}}>{fmtN(paid+partial)}₸</b></div>
                <div style={{fontWeight:800,fontSize:15,color:payPct===100?'#10b981':payPct>0?'#3b82f6':'#f59e0b'}}>{payPct}%</div>
              </div>
            </div>
            <Prog pct={payPct} c={payPct===100?'#10b981':payPct>0?'#3b82f6':'#f59e0b'} sz='sm'/>
          </div>
        )}

        {c.stage === 'accompaniment' && (
          <div style={{background:'#f0fdf4',borderRadius:11,padding:'11px 13px',marginBottom:10,border:'1.5px solid #bbf7d0'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
              <div style={{fontWeight:700,fontSize:12,color:'#065f46'}}>🗺 Сопровождение</div>
              <div style={{fontWeight:900,fontSize:17,color:pct===100?'#10b981':'#3b82f6'}}>{pct}%</div>
            </div>
            <Prog pct={pct} c={pct===100?'#10b981':pct>50?'#3b82f6':'#f59e0b'} sz='sm'/>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:6,fontSize:11}}>
              <span style={{color:'#047857',fontWeight:600}}>📍 {ACCOMP[c.accompStageIndex]}</span>
              <span style={{color:'#64748b'}}>{totalDone}/{totalItems}</span>
            </div>
            <div style={{display:'flex',gap:3,marginTop:8,flexWrap:'wrap'}}>
              {ACCOMP.map((s,i) => {
                const sd = (c.accompStages||{})[i]||{}
                const items = (checklists||{})[s]||[]
                const done  = (sd.done||[]).length
                const allDone = items.length>0&&done===items.length
                const isCur = c.accompStageIndex===i
                return <div key={s} title={s} style={{width:isCur?26:18,height:18,borderRadius:5,background:allDone?'#10b981':isCur?'#3b82f6':'#e2e8f0',color:allDone||isCur?'#fff':'#94a3b8',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,flexShrink:0,transition:'all .2s'}}>{allDone?'✓':i+1}</div>
              })}
            </div>
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:7,marginBottom:openTasks.length||lastCmt?10:0}}>
          {[
            { l:'✅ Задачи', v:<div style={{fontWeight:800,fontSize:17,color:overdue.length>0?'#ef4444':openTasks.length>0?'#3b82f6':'#10b981',letterSpacing:'-1px'}}>{openTasks.length}</div>, warn:overdue.length>0 },
            { l:'📎 Документы', v:<div style={{fontWeight:800,fontSize:17,color:'#8b5cf6',letterSpacing:'-1px'}}>{docsCount}</div> },
            { l:'💬 История', v:<div style={{fontWeight:800,fontSize:17,color:'#14b8a6',letterSpacing:'-1px'}}>{(c.comments||[]).length}</div> },
          ].map(({ l, v, warn }) => (
            <div key={l} style={{background:'#f8fafc',borderRadius:9,padding:'9px',border:`1.5px solid ${warn?'#fecaca':'#e2e8f0'}`}}>
              <div style={{fontSize:9,fontWeight:700,color:'#64748b',textTransform:'uppercase',marginBottom:3}}>{l}</div>
              {v}
            </div>
          ))}
        </div>

        {lastCmt && (
          <div style={{background:'#fffbeb',borderRadius:9,padding:'9px 11px',marginBottom:10,border:'1px solid #fde68a'}}>
            <div style={{fontSize:10,fontWeight:700,color:'#92400e',marginBottom:2}}>{lastCmt.author} · {lastCmt.date}</div>
            <div style={{fontSize:12,color:'#78350f',lineHeight:1.4,overflow:'hidden',textOverflow:'ellipsis',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{lastCmt.text}</div>
          </div>
        )}

        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',gap:5}}>
            {c.miroLink && <a href={c.miroLink} target="_blank" onClick={e=>e.stopPropagation()} style={{background:'#fef9c3',color:'#854d0e',borderRadius:6,padding:'3px 8px',fontSize:10,fontWeight:700,display:'inline-flex',alignItems:'center',gap:3,border:'1px solid #fde68a',textDecoration:'none'}}><i className="ti ti-brand-miro" style={{fontSize:11}}/>Miro</a>}
            {c.driveLink && <a href={c.driveLink} target="_blank" onClick={e=>e.stopPropagation()} style={{background:'#eff6ff',color:'#1d4ed8',borderRadius:6,padding:'3px 8px',fontSize:10,fontWeight:700,display:'inline-flex',alignItems:'center',gap:3,border:'1px solid #bfdbfe',textDecoration:'none'}}><i className="ti ti-brand-google-drive" style={{fontSize:11}}/>Drive</a>}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:4,color:'#3b82f6',fontWeight:700,fontSize:11}}>
            Открыть<i className="ti ti-arrow-right" style={{fontSize:13}}/>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── SEARCH PAGE ─────────────────────────────────────────────────
function SearchPage({ clients, managers, pipeline, checklists, search, setSearch, fStage, setFStage, fMgr, setFMgr, onOpen, waNew }) {
  const pl = pipeline || PIPELINE_DEFAULT
  return (
    <div>
      <div style={{background:'linear-gradient(135deg,#0f172a,#1e3a5f)',borderRadius:14,padding:'15px',marginBottom:14,color:'#fff'}}>
        <div style={{fontSize:16,fontWeight:900,marginBottom:3}}>🔍 Поиск клиентов</div>
        <div style={{fontSize:12,color:'#94a3b8',marginBottom:12}}>ИИН, имя, телефон или город</div>
        <div style={{display:'flex',alignItems:'center',gap:10,background:'rgba(255,255,255,.1)',borderRadius:11,padding:'10px 13px',border:'1px solid rgba(255,255,255,.15)',marginBottom:9}}>
          <i className="ti ti-search" style={{color:'rgba(255,255,255,.6)',fontSize:18,flexShrink:0}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Начните вводить..." autoFocus
            style={{border:'none',background:'transparent',fontSize:15,color:'#fff',flex:1,outline:'none'}}/>
          {search && <button onClick={()=>setSearch('')} style={{border:'none',background:'rgba(255,255,255,.2)',color:'#fff',borderRadius:7,width:26,height:26,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <i className="ti ti-x" style={{fontSize:13}}/>
          </button>}
        </div>
        <div style={{display:'flex',gap:8}}>
          <select value={fStage} onChange={e=>setFStage(e.target.value)} style={{flex:1,background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.2)',borderRadius:9,padding:'8px 10px',color:'#fff',fontSize:12,outline:'none',cursor:'pointer'}}>
            <option value="" style={{color:'#000'}}>Все этапы</option>
            {pl.map(p => <option key={p.id} value={p.id} style={{color:'#000'}}>{p.l}</option>)}
          </select>
          <select value={fMgr} onChange={e=>setFMgr(e.target.value)} style={{flex:1,background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.2)',borderRadius:9,padding:'8px 10px',color:'#fff',fontSize:12,outline:'none',cursor:'pointer'}}>
            <option value="" style={{color:'#000'}}>Все менеджеры</option>
            {managers.map(m => <option key={m.id} value={m.id} style={{color:'#000'}}>{m.name}</option>)}
          </select>
        </div>
      </div>

      {waNew?.length > 0 && !search && !fStage && !fMgr && (
        <div style={{background:'#f0fdf4',border:'2px solid #86efac',borderRadius:13,padding:'13px',marginBottom:14,display:'flex',gap:11,alignItems:'center'}}>
          <div style={{width:40,height:40,borderRadius:12,background:'#25d366',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><i className="ti ti-brand-whatsapp" style={{color:'#fff',fontSize:20}}/></div>
          <div style={{flex:1}}><div style={{fontWeight:800,fontSize:13,color:'#065f46'}}>🔔 {waNew.length} WhatsApp лидов ждут</div></div>
          {waNew.slice(0,3).map(c => <div key={c.id} onClick={()=>onOpen(c)} style={{background:'#fff',border:'1px solid #bbf7d0',borderRadius:7,padding:'4px 9px',fontSize:12,fontWeight:700,cursor:'pointer',color:'#065f46',flexShrink:0}}>{c.fio||c.phone}</div>)}
        </div>
      )}

      {clients.length > 0 && (
        <div style={{fontSize:13,color:'#64748b',fontWeight:600,marginBottom:12,display:'flex',alignItems:'center',gap:6}}>
          <i className="ti ti-list" style={{fontSize:14}}/>
          Найдено: <b style={{color:'#0f172a'}}>{clients.length}</b>
          {(fStage||fMgr) && <button onClick={()=>{setFStage('');setFMgr('')}} style={{background:'#fef2f2',color:'#ef4444',border:'none',borderRadius:6,padding:'2px 8px',fontSize:11,fontWeight:700,cursor:'pointer',marginLeft:4}}>Сбросить</button>}
        </div>
      )}

      {clients.map(c => <BigClientCard key={c.id} c={c} managers={managers} pipeline={pl} checklists={checklists} onOpen={()=>onOpen(c)}/>)}
      {clients.length === 0 && <div style={{textAlign:'center',padding:'44px 20px',color:'#64748b'}}><i className="ti ti-search" style={{fontSize:40,display:'block',marginBottom:10,opacity:.2}}/><p style={{fontSize:15,fontWeight:500}}>Ничего не найдено</p></div>}
    </div>
  )
}

SearchPage = React.memo(SearchPage)

// ─── WHATSAPP PAGE ───────────────────────────────────────────────
// ─── useDebounce hook ─────────────────────────────────────
function useDebounce(value, delay = 200) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ─── APP CONSTANTS ─────────────────────────────────────────────
const WA_CHATS_POLL_MS    = 10_000   // интервал обновления списка чатов
const WA_MESSAGES_POLL_MS = 5_000    // интервал обновления сообщений открытого чата
const API_TIMEOUT_MS      = 15_000   // таймаут fetch запросов
const MAX_MESSAGES_FETCH  = 200      // максимум сообщений при полной загрузке
const MAX_FILE_SIZE_BYTES = 32 * 1024 * 1024  // 32 МБ лимит медиафайлов
const MIN_SEARCH_LENGTH   = 2        // минимальная длина поисковой строки

const QUICK_REPLIES = [
  'Здравствуйте! Как я могу помочь?',
  'Когда вам удобно позвонить?',
  'Отправьте, пожалуйста, ваш ИИН',
  'Ваша заявка одобрена ✅',
  'Документы получены, обрабатываем',
  'Назначим встречу — выберите время',
  'Отправлю КП в течение часа',
  'Спасибо за обращение! 🙏',
]

const WA_STATUSES = [
  { id: 'all',        l: 'Все',       color: '#64748b' },
  { id: 'new',        l: 'Новые',     color: '#f59e0b' },
  { id: 'in_work',    l: 'В работе',  color: '#3b82f6' },
  { id: 'done',       l: 'Закрытые',  color: '#10b981' },
]

function WAPage({ chats, messages, managers, clients, selChat, onSelChat, onSend, onSendMedia, onImport, onAssign, onUpdateStatus, user, onOpenClient }) {
  const [msgText,         setMsgText]         = useState('')
  const [showChatView,    setShowChatView]     = useState(false)
  const [showQR,          setShowQR]           = useState(false)
  const [showNewLead,     setShowNewLead]       = useState(false)
  const [showClientPanel, setShowClientPanel]  = useState(false)
  const [showAssignDlg,   setShowAssignDlg]    = useState(false)
  const [waSearch,        setWaSearch]         = useState('')
  const debouncedSearch = useDebounce(waSearch, 150)  // 150ms debounce
  const [waFilter,        setWaFilter]         = useState('all')   // all | new | in_work | done
  const [waMgrFilter,     setWaMgrFilter]      = useState('')      // '' = все
  const [nLead, setNLead] = useState({ fio:'', phone:'', iin:'', source:'whatsapp', assignTo:'', msg:'', city:'Алматы', contactStatus:'', creditStatus:'good' })
  const msgsEndRef = useRef(null)
  const inputRef   = useRef(null)
  const fileRef    = useRef(null)

  const totalUnread  = chats.reduce((s,c) => s+(c.unread_count||0), 0)
  const linkedClient = selChat ? clients.find(c => c.id === selChat.client_id) : null

  // Запрашиваем уведомления при первом открытии
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Фильтрация чатов ───────────────────────────────────────────
  // newChatsCount мемоизируем отдельно чтобы не пересчитывать при каждом вводе поиска
  const newChatsCount = useMemo(() => chats.filter(c => c.status === 'new').length, [chats])

  const filteredChats = useMemo(() => {
    // fast-path: нет фильтров и поиска
    if (waFilter === 'all' && !waMgrFilter && !debouncedSearch.trim()) return chats
    let res = chats
    if (waFilter !== 'all') res = res.filter(c => c.status === waFilter)
    if (waMgrFilter)        res = res.filter(c => c.assigned_to === waMgrFilter)
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase()
      res = res.filter(c => (c.name||'').toLowerCase().includes(q) || (c.phone||'').includes(q))
    }
    return res
  }, [chats, waFilter, waMgrFilter, debouncedSearch])

  // ── Отправка ───────────────────────────────────────────────────
  function sendMsg() {
    if (!msgText.trim() || !selChat) return
    onSend(selChat.id, selChat.phone, msgText)
    setMsgText('')
    setShowQR(false)
    inputRef.current?.focus()
  }

  function useQR(text) {
    setMsgText(text)
    setShowQR(false)
    inputRef.current?.focus()
  }

  const [sendingFile, setSendingFile] = useState(false)

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file || !selChat) return
    const MAX = 32 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE_BYTES) { alert('Файл слишком большой (макс. 32 МБ)'); e.target.value = ''; return }
    const caption = file.type.startsWith('image/') ? '' : file.name
    setSendingFile(true)
    onSendMedia(selChat.id, selChat.phone, file, caption)
      .finally(() => setSendingFile(false))
    e.target.value = ''
  }

  function openChat(chat) {
    onSelChat(chat)
    setShowChatView(true)
    setShowClientPanel(false)
  }

  function backToList() {
    setShowChatView(false)
    setShowClientPanel(false)
  }

  function addLead() {
    if (!nLead.phone) return
    const c = {
      ...emptyClient(nLead.assignTo),
      fio: nLead.fio, phone: nLead.phone, iin: nLead.iin,
      city: nLead.city, source: 'whatsapp', isWhatsApp: true,
      waMsgPreview: nLead.msg, stage: 'new_lead',
      contactStatus: nLead.contactStatus,
      creditStatus: nLead.creditStatus,
    }
    if (selChat) c.waMsgPreview = messages.slice(-3).map(m=>m.body).filter(Boolean).join(' / ') || nLead.msg
    if (selChat) c._linkWaChatId = selChat.id   // передаём chatId для привязки
    const { _linkWaChatId, ...cClean } = c       // убираем служебное поле перед API
    onImport(cClean, _linkWaChatId)
    setNLead({ fio:'', phone:'', iin:'', source:'whatsapp', assignTo:'', msg:'', city:'Алматы', contactStatus:'', creditStatus:'good' })
    setShowNewLead(false)
  }

  // ── Рендер одного сообщения — useCallback: не пересоздаётся если нет изменений
  const renderMessage = useCallback(function renderMessage(msg) {
    const isOut = msg.direction === 'out'
    const time  = msg.sent_at ? new Date(msg.sent_at).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'}) : ''
    const cls   = isOut ? 'wa-bubble-out' : 'wa-bubble-in'

    const StatusTick = () => {
      if (!isOut) return null
      const icon  = (msg.status === 'read' || msg.status === 'delivered') ? 'ti-checks' : 'ti-check'
      const color = msg.status === 'read' ? '#60a5fa' : msg.status === 'failed' ? '#ef4444' : msg.status === 'delivered' ? '#94a3b8' : '#94a3b8'
      return <i className={`ti ${icon}`} style={{fontSize:12,color,marginLeft:2}}/>
    }

    return (
      <div key={msg.id} style={{display:'flex',flexDirection:'column',alignItems:isOut?'flex-end':'flex-start',marginBottom:2}}>
        <div className={cls}>
          {msg.type === 'text' && <div style={{fontSize:14,lineHeight:1.5,wordBreak:'break-word',whiteSpace:'pre-wrap'}}>{msg.body}</div>}

          {msg.type === 'image' && (
            <div>
              {msg.media_url
                ? <img src={msg.media_url} alt="Фото" style={{maxWidth:'100%',borderRadius:8,display:'block',marginBottom:4,maxHeight:260,objectFit:'cover',cursor:'pointer'}} onClick={()=>window.open(msg.media_url,'_blank')}/>
                : <div style={{background:'rgba(0,0,0,.06)',borderRadius:8,padding:'12px 16px',display:'flex',alignItems:'center',gap:8,fontSize:13,color:'#64748b'}}><i className="ti ti-photo" style={{fontSize:22}}/>📷 Фото</div>}
              {msg.body && <div style={{fontSize:13,lineHeight:1.4,marginTop:4}}>{msg.body}</div>}
            </div>
          )}

          {(msg.type === 'audio' || msg.type === 'voice') && (
            <div style={{display:'flex',alignItems:'center',gap:10,minWidth:180}}>
              <div style={{width:38,height:38,borderRadius:'50%',background:isOut?'rgba(0,0,0,.1)':'#25d36622',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <i className="ti ti-microphone" style={{fontSize:18,color:isOut?'#555':'#25d366'}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600,marginBottom:4}}>🎤 Голосовое</div>
                {msg.media_url
                  ? <audio controls src={msg.media_url} style={{width:'100%',height:34,outline:'none'}}/>
                  : <div style={{fontSize:11,color:'#94a3b8'}}>Загрузка...</div>}
              </div>
            </div>
          )}

          {msg.type === 'video' && (
            <div>
              {msg.media_url
                ? <video src={msg.media_url} controls style={{maxWidth:'100%',borderRadius:8,maxHeight:240,display:'block'}}/>
                : <div style={{background:'rgba(0,0,0,.06)',borderRadius:8,padding:'12px 16px',display:'flex',alignItems:'center',gap:8,fontSize:13,color:'#64748b'}}><i className="ti ti-video" style={{fontSize:22}}/>🎥 Видео</div>}
            </div>
          )}

          {msg.type === 'document' && (
            <a href={msg.media_url||'#'} target="_blank" rel="noreferrer" style={{display:'flex',alignItems:'center',gap:10,textDecoration:'none',color:'inherit',background:'rgba(0,0,0,.05)',borderRadius:9,padding:'9px 12px',minWidth:180}}>
              <div style={{width:38,height:38,borderRadius:10,background:isOut?'rgba(0,0,0,.1)':'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <i className="ti ti-file-text" style={{fontSize:20,color:isOut?'#444':'#3b82f6'}}/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{msg.media_name||'Документ'}</div>
                <div style={{fontSize:11,color:isOut?'rgba(0,0,0,.5)':'#94a3b8'}}>Нажмите для скачивания</div>
              </div>
            </a>
          )}

          <div style={{fontSize:10,opacity:.55,marginTop:5,textAlign:'right',display:'flex',alignItems:'center',justifyContent:'flex-end',gap:4}}>
            {time}<StatusTick/>
          </div>
        </div>
      </div>
    )
  }, []) // eslint-disable-line — зависимости из замыканий стабильны

  // ── Sidebar: список чатов — useMemo чтобы не пересчитывать при несвязанных рендерах
  const ChatList = useMemo(() => (
    <div className="wa-sidebar" style={showChatView?{transform:'translateX(-100%)'}:{}}>
      {/* Header */}
      <div style={{padding:'12px 14px',borderBottom:'1px solid #e2e8f0',background:'#075e54',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
          <i className="ti ti-brand-whatsapp" style={{color:'#fff',fontSize:22}}/>
          <span style={{fontWeight:800,fontSize:16,color:'#fff',flex:1}}>WhatsApp</span>
          {totalUnread > 0 && <span style={{background:'#25d366',color:'#fff',borderRadius:20,padding:'2px 8px',fontSize:12,fontWeight:700}}>{totalUnread}</span>}
          <button onClick={()=>setShowNewLead(true)} style={{background:'rgba(255,255,255,.2)',border:'none',borderRadius:8,padding:'6px 10px',color:'#fff',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit',display:'flex',alignItems:'center',gap:5}}>
            <i className="ti ti-plus"/>Лид
          </button>
        </div>

        {/* Поиск */}
        <div style={{position:'relative',marginBottom:8}}>
          <i className="ti ti-search" style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'rgba(255,255,255,.6)',fontSize:14,pointerEvents:'none'}}/>
          <input
            value={waSearch}
            onChange={e=>setWaSearch(e.target.value)}
            placeholder="Поиск по имени или номеру..."
            style={{width:'100%',padding:'7px 10px 7px 32px',borderRadius:8,border:'none',background:'rgba(255,255,255,.15)',color:'#fff',fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}
            onFocus={e=>e.target.style.background='rgba(255,255,255,.25)'}
            onBlur={e=>e.target.style.background='rgba(255,255,255,.15)'}
          />
          {waSearch && <button onClick={()=>setWaSearch('')} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',border:'none',background:'transparent',color:'rgba(255,255,255,.8)',cursor:'pointer',fontSize:16,padding:0,lineHeight:1}}>×</button>}
        </div>

        {/* Фильтры статуса */}
        <div style={{display:'flex',gap:5,marginBottom:6,flexWrap:'wrap'}}>
          {WA_STATUSES.map(s => (
            <button key={s.id} onClick={()=>setWaFilter(s.id)}
              style={{padding:'4px 10px',borderRadius:20,border:'none',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'inherit',
                background:waFilter===s.id?s.color:'rgba(255,255,255,.15)',
                color:waFilter===s.id?'#fff':'rgba(255,255,255,.8)',transition:'all .15s'}}>
              {s.l}
              {s.id==='new' && newChatsCount > 0 &&
                <span style={{marginLeft:4,background:'rgba(255,255,255,.3)',borderRadius:10,padding:'0 5px'}}>{newChatsCount}</span>}
            </button>
          ))}
        </div>

        {/* Фильтр по менеджеру */}
        <select value={waMgrFilter} onChange={e=>setWaMgrFilter(e.target.value)}
          style={{width:'100%',padding:'6px 10px',borderRadius:8,border:'none',background:'rgba(255,255,255,.15)',color:'#fff',fontSize:12,outline:'none',fontFamily:'inherit',cursor:'pointer'}}>
          <option value="" style={{color:'#000'}}>👤 Все менеджеры</option>
          {managers.map(m=><option key={m.id} value={m.id} style={{color:'#000'}}>{m.name}</option>)}
        </select>
      </div>

      {/* Список */}
      <div style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch'}}>
        {filteredChats.length === 0 && (
          <div style={{textAlign:'center',padding:'40px 20px',color:'#64748b'}}>
            <i className="ti ti-brand-whatsapp" style={{fontSize:44,display:'block',marginBottom:10,color:'#25d366',opacity:.25}}/>
            <p style={{fontSize:14,fontWeight:600}}>{waSearch || waFilter!=='all' ? 'Ничего не найдено' : 'Нет чатов'}</p>
            <p style={{fontSize:12,marginTop:4}}>
              {waSearch || waFilter!=='all' ? 'Попробуйте изменить фильтры' : 'После подключения Green API\nсообщения появятся здесь'}
            </p>
          </div>
        )}
        {filteredChats.map(chat => {
          const lc   = clients.find(c => c.id === chat.client_id)
          const mgr  = mgrById[chat.assigned_to]
          const isAct = selChat?.id === chat.id
          const stColor = WA_STATUSES.find(s=>s.id===chat.status)?.color || '#64748b'
          return (
            <div key={chat.id} onClick={() => openChat(chat)}
              style={{display:'flex',gap:11,padding:'12px 14px',borderBottom:'1px solid #f0f0f0',cursor:'pointer',background:isAct?'#f0f9ff':'transparent',transition:'background .1s',minHeight:70,position:'relative'}}
              onMouseEnter={e=>{if(!isAct)e.currentTarget.style.background='#f8fafc'}}
              onMouseLeave={e=>{if(!isAct)e.currentTarget.style.background='transparent'}}>
              <div style={{width:44,height:44,borderRadius:'50%',background:'#25d36622',color:'#25d366',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:18,flexShrink:0,position:'relative'}}>
                {chat.name?chat.name[0].toUpperCase():'?'}
                {(chat.unread_count||0) > 0 && (
                  <span style={{position:'absolute',top:-2,right:-2,background:'#25d366',color:'#fff',borderRadius:'50%',width:18,height:18,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800}}>{chat.unread_count}</span>
                )}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:2}}>
                  <span style={{fontWeight:700,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:150}}>{chat.name||chat.phone}</span>
                  <span style={{fontSize:10,color:'#94a3b8',flexShrink:0,marginLeft:6}}>{chat.last_message_at?new Date(chat.last_message_at).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'}):''}</span>
                </div>
                <div style={{fontSize:12,color:'#94a3b8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:3}}>{chat.last_message||'Нет сообщений'}</div>
                <div style={{display:'flex',gap:5,alignItems:'center',flexWrap:'wrap'}}>
                  <span style={{fontSize:10,fontWeight:700,color:stColor,background:stColor+'18',borderRadius:6,padding:'1px 6px'}}>{WA_STATUSES.find(s=>s.id===chat.status)?.l||chat.status}</span>
                  {mgr && <span style={{fontSize:10,color:'#64748b',display:'flex',alignItems:'center',gap:2}}><i className="ti ti-user" style={{fontSize:9}}/>{mgr.name}</span>}
                  {lc && <span style={{fontSize:10,color:'#25d366',display:'flex',alignItems:'center',gap:2}}><i className="ti ti-link" style={{fontSize:9}}/>{lc.fio}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  ), [filteredChats, selChat, waSearch, waFilter, waMgrFilter, totalUnread, managers, clients, showChatView, mgrById])

  // ── Chat view — useMemo чтобы не перестраивать при изменении списка чатов
  const ChatView = useMemo(() => (
    <div className="wa-main" style={!showChatView&&typeof window!=='undefined'&&window.innerWidth<=768?{transform:'translateX(100%)'}:{}}>
      {!selChat ? (
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#64748b',gap:12,background:'#f0f0f0'}}>
          <i className="ti ti-brand-whatsapp" style={{fontSize:56,color:'#25d366',opacity:.25}}/>
          <div style={{fontWeight:700,fontSize:16}}>Выберите чат</div>
          <div style={{fontSize:13,textAlign:'center'}}>Нажмите на чат слева<br/>или добавьте новый лид</div>
        </div>
      ) : (
        <>
          {/* Chat header */}
          <div style={{padding:'10px 14px',borderBottom:'1px solid #e2e8f0',background:'#075e54',display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
            <button onClick={backToList} style={{border:'none',background:'rgba(255,255,255,.15)',color:'#fff',borderRadius:8,width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
              <i className="ti ti-arrow-left" style={{fontSize:18}}/>
            </button>
            <div style={{width:38,height:38,borderRadius:'50%',background:'rgba(255,255,255,.2)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:16,flexShrink:0}}>
              {selChat.name?selChat.name[0].toUpperCase():'?'}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:14,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{selChat.name||selChat.phone}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,.7)',display:'flex',gap:6,alignItems:'center'}}>
                {selChat.phone}
                {selChat.assigned_to && <span style={{background:'rgba(255,255,255,.2)',borderRadius:6,padding:'1px 5px'}}>👤 {mgrById[selChat.assigned_to]?.name||'Назначен'}</span>}
              </div>
            </div>

            {/* Назначить менеджера */}
            <button onClick={()=>setShowAssignDlg(!showAssignDlg)} title="Назначить менеджера / сменить статус"
              style={{border:'none',background:'rgba(255,255,255,.15)',color:'#fff',borderRadius:8,width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
              <i className="ti ti-user-check" style={{fontSize:16}}/>
            </button>

            {/* Карточка клиента */}
            {linkedClient
              ? <button onClick={()=>setShowClientPanel(!showClientPanel)}
                  style={{border:'none',background:'rgba(255,255,255,.15)',color:'#fff',borderRadius:8,width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
                  <i className="ti ti-user" style={{fontSize:16}}/>
                </button>
              : <button onClick={()=>setShowNewLead(true)}
                  style={{border:'none',background:'#25d366',color:'#fff',borderRadius:8,padding:'6px 10px',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit',display:'flex',alignItems:'center',gap:5,flexShrink:0}}>
                  <i className="ti ti-user-plus" style={{fontSize:14}}/><span className="btn-text-desktop">Клиент</span>
                </button>}

            <a href={`https://wa.me/${(selChat.phone||'').replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
              style={{border:'none',background:'rgba(255,255,255,.15)',color:'#fff',borderRadius:8,padding:'6px 8px',display:'flex',alignItems:'center',cursor:'pointer',textDecoration:'none',flexShrink:0}}>
              <i className="ti ti-external-link" style={{fontSize:16}}/>
            </a>
          </div>

          {/* Диалог назначения менеджера и смены статуса */}
          {showAssignDlg && (
            <div style={{padding:'12px 14px',background:'#f8fafc',borderBottom:'1px solid #e2e8f0',display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
              <div style={{flex:1,minWidth:140}}>
                <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>МЕНЕДЖЕР</label>
                <select
                  value={selChat.assigned_to||''}
                  onChange={e=>{onAssign(selChat.id, e.target.value); setShowAssignDlg(false)}}
                  style={{width:'100%',padding:'7px 10px',borderRadius:8,border:'1.5px solid #cbd5e1',background:'#fff',fontSize:13,outline:'none',fontFamily:'inherit',cursor:'pointer'}}>
                  <option value="">— Не назначен</option>
                  {managers.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div style={{flex:1,minWidth:140}}>
                <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>СТАТУС ЧАТА</label>
                <select
                  value={selChat.status||'new'}
                  onChange={e=>{onUpdateStatus(selChat.id, e.target.value); setShowAssignDlg(false)}}
                  style={{width:'100%',padding:'7px 10px',borderRadius:8,border:'1.5px solid #cbd5e1',background:'#fff',fontSize:13,outline:'none',fontFamily:'inherit',cursor:'pointer'}}>
                  {WA_STATUSES.filter(s=>s.id!=='all').map(s=><option key={s.id} value={s.id}>{s.l}</option>)}
                </select>
              </div>
              <button onClick={()=>setShowAssignDlg(false)} style={{border:'none',background:'transparent',color:'#94a3b8',cursor:'pointer',fontSize:20,padding:'4px',marginTop:16}}>×</button>
            </div>
          )}

          {/* Messages */}
          <div className="wa-msgs">
            {messages.length === 0 && (
              <div style={{textAlign:'center',color:'#64748b',fontSize:13,padding:'30px',background:'rgba(255,255,255,.6)',borderRadius:12,margin:'20px auto',maxWidth:240}}>
                Нет сообщений.<br/>Клиент ещё не писал.
              </div>
            )}
            {messages.map(msg => renderMessage(msg))}
            <div ref={msgsEndRef}/>
          </div>

          {/* Quick replies */}
          {showQR && (
            <div className="qr-list">
              {QUICK_REPLIES.map(t => (
                <button key={t} className="qr-chip" onClick={()=>useQR(t)}>{t}</button>
              ))}
            </div>
          )}

          {/* Input bar */}
          <div className="wa-input">
            {/* Быстрые ответы */}
            <button onClick={()=>setShowQR(!showQR)} title="Быстрые ответы"
              style={{width:38,height:38,borderRadius:'50%',border:'none',background:showQR?'#25d366':'#e9e9e9',color:showQR?'#fff':'#555',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,transition:'all .15s'}}>
              <i className="ti ti-bolt" style={{fontSize:18}}/>
            </button>

            {/* Прикрепить файл */}
            <input ref={fileRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt" style={{display:'none'}} onChange={handleFileChange}/>
            <button onClick={()=>!sendingFile&&fileRef.current?.click()} title="Прикрепить файл"
              style={{width:38,height:38,borderRadius:'50%',border:'none',background:sendingFile?'#25d366':'#e9e9e9',color:sendingFile?'#fff':'#555',display:'flex',alignItems:'center',justifyContent:'center',cursor:sendingFile?'not-allowed':'pointer',flexShrink:0,transition:'all .15s'}}>
              <i className={`ti ${sendingFile ? 'ti-loader-2' : 'ti-paperclip'}`} style={{fontSize:18,animation:sendingFile?'spin 1s linear infinite':undefined}}/>
            </button>

            <textarea
              ref={inputRef}
              className="wa-textarea"
              value={msgText}
              onChange={e=>setMsgText(e.target.value)}
              placeholder="Написать сообщение..."
              rows={1}
              onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg()}}}
              style={{minHeight:40}}
            />
            <button onClick={sendMsg} disabled={!msgText.trim()}
              style={{width:44,height:44,borderRadius:'50%',border:'none',background:msgText.trim()?'#25d366':'#e9e9e9',color:msgText.trim()?'#fff':'#94a3b8',display:'flex',alignItems:'center',justifyContent:'center',cursor:msgText.trim()?'pointer':'default',flexShrink:0,transition:'all .15s'}}>
              <i className="ti ti-send" style={{fontSize:20}}/>
            </button>
          </div>
        </>
      )}
    </div>
  ), [selChat, messages, showChatView, showAssignDlg, showQR, msgText, sendingFile, managers, linkedClient, showClientPanel, mgrById])

  // ── Client panel ──────────────────────────────────────────────
  const ClientPanel = showClientPanel && linkedClient && (
    <div className="wa-client-panel">
      <div style={{padding:'13px 14px',background:'#f8fafc',borderBottom:'1px solid #e2e8f0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontWeight:700,fontSize:14}}>Клиент</div>
        <button onClick={()=>setShowClientPanel(false)} style={{border:'none',background:'transparent',color:'#64748b',cursor:'pointer',fontSize:18}}>×</button>
      </div>
      <div style={{padding:'14px'}}>
        <div style={{width:56,height:56,borderRadius:'50%',background:'#3b82f622',color:'#3b82f6',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:22,margin:'0 auto 10px'}}>
          {linkedClient.fio?linkedClient.fio[0]:'?'}
        </div>
        <div style={{textAlign:'center',fontWeight:800,fontSize:16,marginBottom:4}}>{linkedClient.fio||'—'}</div>
        <div style={{textAlign:'center',fontSize:12,color:'#64748b',marginBottom:14}}>{linkedClient.phone}</div>
        {[['ИИН',linkedClient.iin||'—'],['Город',linkedClient.city||'—'],['КИ',CR[linkedClient.creditStatus]?.l||'—'],['Доход',linkedClient.officialIncome?fmtN(+linkedClient.officialIncome)+'₸':'—'],['Договор',linkedClient.contractAmount>0?fmtN(linkedClient.contractAmount)+'₸':'—']].map(([l,v])=>(
          <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #f1f5f9',fontSize:13}}>
            <span style={{color:'#64748b'}}>{l}</span>
            <span style={{fontWeight:600}}>{v}</span>
          </div>
        ))}
        <button onClick={()=>onOpenClient(linkedClient)} style={{width:'100%',marginTop:14,padding:'11px',borderRadius:11,background:'#3b82f6',color:'#fff',border:'none',cursor:'pointer',fontWeight:700,fontSize:14,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:7}}>
          <i className="ti ti-external-link"/>Открыть карточку
        </button>
      </div>
    </div>
  )

  return (
    <div style={{position:'relative',overflow:'hidden'}}>
      <div className="wa-layout">
        {ChatList}
        {ChatView}
        {ClientPanel}
      </div>

      {/* New Lead Modal */}
      {showNewLead && (
        <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.55)',zIndex:600,display:'flex',alignItems:'flex-end',justifyContent:'center',backdropFilter:'blur(4px)'}}>
          <div style={{background:'#fff',borderRadius:'22px 22px 0 0',width:'100%',maxWidth:600,maxHeight:'90dvh',display:'flex',flexDirection:'column',overflow:'hidden',animation:'slideUp .25s ease'}}>
            <div style={{padding:'16px 18px',borderBottom:'1.5px solid #e2e8f0',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#f8fafc',flexShrink:0}}>
              <div>
                <div style={{fontSize:17,fontWeight:800}}>
                  {selChat ? '✏️ Создать клиента из чата' : '➕ Новый WhatsApp лид'}
                </div>
                {selChat && <div style={{fontSize:12,color:'#64748b',marginTop:2}}>{selChat.name||selChat.phone}</div>}
              </div>
              <button onClick={()=>setShowNewLead(false)} style={{border:'none',background:'#f1f5f9',borderRadius:8,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:18,color:'#64748b'}}>×</button>
            </div>
            <div style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch',padding:'15px 18px'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:11}}>
                <div style={{gridColumn:'1/-1'}}>
                  <Fl l="Имя клиента" ch={<Inp value={nLead.fio} onChange={e=>setNLead(x=>({...x,fio:e.target.value}))} placeholder="Из переписки"/>}/>
                </div>
                <Fl l="Телефон *" req ch={<Inp value={nLead.phone} onChange={e=>setNLead(x=>({...x,phone:e.target.value}))} placeholder="+7 701 ..."/>}/>
                <Fl l="ИИН" ch={<Inp value={nLead.iin} onChange={e=>setNLead(x=>({...x,iin:e.target.value}))} placeholder="123456789012" maxLength={12}/>}/>
                <Fl l="Город" ch={<Sel value={nLead.city} onChange={e=>setNLead(x=>({...x,city:e.target.value}))}>{CITIES.map(c=><option key={c}>{c}</option>)}</Sel>}/>
                <Fl l="Менеджер" ch={<Sel value={nLead.assignTo} onChange={e=>setNLead(x=>({...x,assignTo:e.target.value}))}><option value="">—</option>{managers.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</Sel>}/>
                <Fl l="Статус связи" ch={<Sel value={nLead.contactStatus} onChange={e=>setNLead(x=>({...x,contactStatus:e.target.value}))}><option value="">—</option>{CONTACT_ST.map(s=><option key={s}>{s}</option>)}</Sel>}/>
                <Fl l="КИ" ch={<Sel value={nLead.creditStatus} onChange={e=>setNLead(x=>({...x,creditStatus:e.target.value}))}>{CR_ST.map(c=><option key={c.id} value={c.id}>{c.l}</option>)}</Sel>}/>
                <div style={{gridColumn:'1/-1'}}>
                  <Fl l="Сообщение из чата" ch={<textarea value={nLead.msg} onChange={e=>setNLead(x=>({...x,msg:e.target.value}))} placeholder="Вставьте текст переписки..." style={{background:'#f8fafc',border:'2px solid #cbd5e1',borderRadius:10,padding:'10px 12px',fontSize:14,width:'100%',resize:'none',minHeight:72,outline:'none',fontFamily:'inherit'}}/>}/>
                </div>
              </div>
            </div>
            <div style={{padding:'12px 18px',borderTop:'1.5px solid #e2e8f0',display:'flex',gap:9,background:'#f8fafc',flexShrink:0,paddingBottom:'max(12px,env(safe-area-inset-bottom))'}}>
              <button onClick={()=>setShowNewLead(false)} style={{flex:1,padding:'12px',borderRadius:11,border:'2px solid #cbd5e1',background:'#f8fafc',color:'#64748b',fontWeight:700,fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>Отмена</button>
              <button onClick={addLead} style={{flex:2,padding:'12px',borderRadius:11,border:'none',background:'#25d366',color:'#fff',fontWeight:700,fontSize:14,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                <i className="ti ti-brand-whatsapp"/>Создать лид
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp{from{transform:translateY(50px);opacity:.6}to{transform:translateY(0);opacity:1}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .wa-input input[type=range]{-webkit-appearance:none;accent-color:#25d366}
        @media(max-width:768px){
          .wa-layout{position:relative;height:calc(100dvh - 52px - 62px);border-radius:10px}
          .wa-sidebar{position:absolute;inset:0;z-index:10;width:100%;transition:transform .25s cubic-bezier(.4,0,.2,1)}
          .wa-main{position:absolute;inset:0;z-index:5;transition:transform .25s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column}
          .wa-client-panel{display:none}
        }
      `}</style>
    </div>
  )
}

WAPage = React.memo(WAPage)

// ─── TASKS PAGE ──────────────────────────────────────────────────
function TasksPage({ clients, managers, onOpen }) {
  // Stable today ref — computed once per render, not 3x
  const todayStr = today()
  // Memoize: 5 array passes on clients — only recompute when clients change
  const { all, open, overdue, todayT, rest, done } = useMemo(() => {
    const td  = todayStr
    const all = clients.flatMap(c => (c.tasks||[]).map(t => ({ ...t, cFio:c.fio, cl:c })))
    // Single pass to bucket tasks instead of 4 separate filter passes
    const open = [], overdue = [], todayT = [], rest = [], done = []
    for (const t of all) {
      if (t.done) { done.push(t); continue }
      open.push(t)
      if      (t.due && t.due < td) overdue.push(t)
      else if (t.due === td)        todayT.push(t)
      else                          rest.push(t)
    }
    return { all, open, overdue, todayT, rest, done }
  }, [clients])

  const S = { background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:14,boxShadow:'0 1px 4px rgba(0,0,0,.07)' }

  return (
    <div>
      <div className='mg3'>
        {[{l:'Открытых',v:open.length,c:'#f59e0b'},{l:'🔴 Просрочено',v:overdue.length,c:'#ef4444'},{l:'✅ Завершено',v:done.length,c:'#10b981'}].map(({l,v,c})=>(
          <div key={l} style={{...S,padding:'14px 15px',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:c}}/>
            <div style={{fontSize:10,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>{l}</div>
            <div style={{fontSize:24,fontWeight:800,letterSpacing:'-1px',color:c}}>{v}</div>
          </div>
        ))}
      </div>

      {overdue.length > 0 && (
        <div style={{background:'#fef2f2',border:'2px solid #fecaca',borderRadius:13,overflow:'hidden',marginBottom:13}}>
          <div style={{padding:'10px 13px',fontWeight:800,fontSize:13,color:'#ef4444',borderBottom:'1px solid #fecaca',background:'#fff5f5'}}>🔴 Просроченные ({overdue.length})</div>
          {overdue.map(t => (
            <div key={t.id} onClick={()=>onOpen(t.cl)} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 13px',borderBottom:'1px solid #fecaca',cursor:'pointer',background:'transparent',transition:'background .1s'}}
              onMouseEnter={e=>e.currentTarget.style.background='#fff5f5'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <div style={{width:20,height:20,borderRadius:'50%',border:'2.5px solid #ef4444',flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,color:'#ef4444'}}>{t.type}</div>
                {t.text && <div style={{fontSize:12,color:'#64748b'}}>{t.text}</div>}
                <div style={{fontSize:11,color:'#ef4444',fontWeight:700}}>{t.due}</div>
              </div>
              <span style={{fontSize:12,fontWeight:700,color:'#64748b'}}>{t.cFio}</span>
            </div>
          ))}
        </div>
      )}

      {[
        { title:'📅 Сегодня', tasks:todayT, color:'#3b82f6' },
        { title:'📋 Предстоящие', tasks:rest, color:'#64748b' },
      ].map(({ title, tasks, color }) => tasks.length > 0 && (
        <div key={title} style={{marginBottom:13}}>
          <div style={{fontWeight:800,fontSize:13,color:color,marginBottom:9}}>{title} ({tasks.length})</div>
          {tasks.map(t => (
            <div key={t.id} onClick={()=>onOpen(t.cl)} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 13px',background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:11,marginBottom:7,cursor:'pointer',transition:'all .1s'}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='#cbd5e1';e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,.07)'}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.boxShadow='none'}}>
              <div style={{width:20,height:20,borderRadius:'50%',border:'2.5px solid #cbd5e1',flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13}}>{t.type}{t.text&&<span style={{color:'#64748b',fontWeight:400}}> — {t.text}</span>}</div>
                {t.due && <div style={{fontSize:11,color:'#94a3b8'}}>{t.due}</div>}
              </div>
              <span style={{fontSize:12,color:'#64748b',fontWeight:600}}>{t.cFio}</span>
            </div>
          ))}
        </div>
      ))}

      {open.length === 0 && (
        <div style={{textAlign:'center',padding:'50px 20px',color:'#64748b'}}>
          <i className="ti ti-circle-check" style={{fontSize:44,display:'block',marginBottom:12,opacity:.2,color:'#10b981'}}/>
          <p style={{fontSize:15,fontWeight:500}}>Все задачи выполнены!</p>
        </div>
      )}
    </div>
  )
}

TasksPage = React.memo(TasksPage)

// ─── KPI PAGE ────────────────────────────────────────────────────
function KPIPage({ data, period, setPeriod }) {
  if (!data) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:300,color:'#64748b',gap:10}}>
      <i className="ti ti-loader spin" style={{fontSize:24}}/>Загрузка KPI...
    </div>
  )

  const { stats, totals } = data
  const maxRev = Math.max(...(stats||[]).map(s => s.rev), 1)

  return (
    <div>
      <div style={{display:'flex',gap:7,marginBottom:18}}>
        {[{id:'week',l:'Неделя'},{id:'month',l:'Месяц'},{id:'all',l:'Всё время'}].map(p => (
          <Btn key={p.id} variant={period===p.id?'primary':'ghost'} onClick={()=>setPeriod(p.id)}>{p.l}</Btn>
        ))}
      </div>

      <div className='mg4'>
        {[
          {l:'Клиентов',  v:totals.clients,          c:'#6366f1'},
          {l:'Договоров', v:totals.contracts,         c:'#ec4899'},
          {l:'Выручка',   v:fmtN(totals.rev)+'₸',    c:'#8b5cf6'},
          {l:'Получено',  v:fmtN(totals.paidRev)+'₸',c:'#10b981'},
        ].map(({l,v,c}) => (
          <div key={l} style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:14,padding:'14px 15px',boxShadow:'0 1px 4px rgba(0,0,0,.07)',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:c}}/>
            <div style={{fontSize:10,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>{l}</div>
            <div style={{fontSize:24,fontWeight:800,letterSpacing:'-1px',color:c}}>{v}</div>
          </div>
        ))}
      </div>

      {(stats||[]).map(s => (
        <div key={s.manager.id} style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:15,padding:16,marginBottom:11,boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
          <div style={{display:'flex',alignItems:'center',gap:11,marginBottom:12}}>
            <div style={{width:42,height:42,borderRadius:13,background:(s.manager.color||'#3b82f6')+'22',color:s.manager.color||'#3b82f6',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:17,flexShrink:0}}>{s.manager.name?.[0]}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:800,fontSize:15}}>{s.manager.name}</div>
              <div style={{fontSize:12,color:'#64748b',marginTop:2}}>{s.all} клиентов · {s.contracts} договоров · {s.conv}% конверсия</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontWeight:900,fontSize:20,color:s.manager.color||'#3b82f6',letterSpacing:'-1px'}}>{fmtN(s.rev)}₸</div>
              <div style={{fontSize:11,color:'#10b981',fontWeight:700}}>💰 {fmtN(s.paidRev)}₸ получено</div>
            </div>
          </div>
          <div style={{height:7,background:'#e2e8f0',borderRadius:20,overflow:'hidden',marginBottom:11}}>
            <div style={{height:'100%',width:`${Math.round(s.rev/maxRev*100)}%`,background:s.manager.color||'#3b82f6',borderRadius:20,transition:'width .4s'}}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:6}}>
            {[
              ['В работе', s.inWork,                         '#0ea5e9'],
              ['Дог.',     s.contracts,                      '#ec4899'],
              ['Одобр.',   s.approved,                       '#10b981'],
              ['Закр.',    s.closed,                         '#22c55e'],
              ['Лид→Дог',  s.conv+'%',                       s.conv>=50?'#10b981':s.conv>=25?'#f59e0b':'#ef4444'],
              ['Дог→Одоб', s.convCA+'%',                     s.convCA>=50?'#10b981':s.convCA>=25?'#f59e0b':'#ef4444'],
              ['Задачи',   `${s.doneTasks}/${s.tasks}`,      '#14b8a6'],
              ['Просроч.', s.overdue, s.overdue>0?'#ef4444':'#10b981'],
            ].map(([l,v,c]) => (
              <div key={l} style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:9,padding:'8px 5px',textAlign:'center'}}>
                <div style={{fontWeight:800,fontSize:15,color:c,letterSpacing:'-.5px'}}>{v}</div>
                <div style={{fontSize:9,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'.04em',marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:9,padding:'8px 11px',background:'#f8fafc',borderRadius:9,display:'flex',gap:18,flexWrap:'wrap'}}>
            <span style={{fontSize:12}}><span style={{color:'#64748b'}}>За период: </span><b style={{color:s.manager.color||'#3b82f6'}}>{s.pLeads} лидов</b></span>
            <span style={{fontSize:12}}><span style={{color:'#64748b'}}>Договоров: </span><b style={{color:s.manager.color||'#3b82f6'}}>{s.pCt}</b></span>
            <span style={{fontSize:12}}><span style={{color:'#64748b'}}>Выручка: </span><b style={{color:s.manager.color||'#3b82f6'}}>{fmtN(s.pRev)}₸</b></span>
            <span style={{fontSize:12}}><span style={{color:'#64748b'}}>Получено: </span><b style={{color:'#10b981'}}>{fmtN(s.paidRev)}₸</b></span>
          </div>
        </div>
      ))}
    </div>
  )
}

KPIPage = React.memo(KPIPage)

// ─── ADMIN PAGE ──────────────────────────────────────────────────
function AdminPage({ managers, pipeline, checklists, users, onSaveMgr, onDelMgr, onSaveUser, onDelUser, onSavePL, onSaveCL, onModal, reload, syncing }) {
  const [tab, setTab] = useState('managers')
  const pl = pipeline || PIPELINE_DEFAULT

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

      <div style={{display:'flex',gap:7,marginBottom:18,flexWrap:'wrap'}}>
        {[{id:'managers',l:'👤 Менеджеры'},{id:'pipeline',l:'🔄 Воронка'},{id:'checklists',l:'✅ Чек-листы'},{id:'users',l:'🔐 Пользователи'}].map(t => (
          <Btn key={t.id} variant={tab===t.id?'primary':'ghost'} onClick={()=>setTab(t.id)}>{t.l}</Btn>
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
        <div style={{background:'#fffbeb',border:'1.5px solid #fde68a',borderRadius:12,padding:'11px 13px',marginBottom:13,fontSize:13,color:'#92400e',display:'flex',gap:8,alignItems:'center'}}>
          <i className="ti ti-info-circle"/>Нажмите на этап для редактирования пунктов
        </div>
        {ACCOMP.map(stage => {
          const items = (checklists||{})[stage]||[]
          return (
            <div key={stage} onClick={()=>onModal({type:'cl_edit',stage,items:JSON.parse(JSON.stringify(items))})}
              style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:13,padding:'13px 15px',marginBottom:9,cursor:'pointer',transition:'all .14s',boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}
              onMouseEnter={e=>e.currentTarget.style.borderColor='#3b82f6'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='#e2e8f0'}>
              <div style={{display:'flex',alignItems:'center',gap:11}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:6}}>{stage}</div>
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
                  Логин: <b style={{fontFamily:'monospace'}}>{u.login}</b> · Пароль: <b style={{fontFamily:'monospace'}}>{u.pwd}</b>
                </div>
              </div>
              {r && <Tag c={r.c} ch={r.l}/>}
              <Btn size="sm" onClick={()=>onModal({type:'user_edit',item:{...u,mid:u.manager_id}})}><i className="ti ti-edit"/>Изменить</Btn>
              <Btn size="sm" variant="danger" onClick={()=>{if(window.confirm('Удалить?'))onDelUser(u.id)}}><i className="ti ti-trash"/></Btn>
            </div>
          )
        })}
      </>}
    </div>
  )
}

AdminPage = React.memo(AdminPage)

// ─── CLIENT DETAIL (full card) ────────────────────────────────────
function ClientDetail({ client, managers, pipeline, checklists, user, onSave, onDelete, onMove, onBack, toast$, setHasChanges, syncing }) {
  const [c,      setC]      = useState(JSON.parse(JSON.stringify(client)))
  const [tab,    setTab]    = useState('profile')
  const [accIdx, setAccIdx] = useState(c.accompStageIndex||0)
  const [autoBanner, setAutoBanner] = useState(null)
  const [isDirty, setIsDirty] = useState(false)
  const canEdit = user.role !== 'qa'
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
  ]

  const stageColor = stageObj?.c || '#3b82f6'

  return (
    <>
      <Head>
        <title>{c.fio||'Клиент'} — Ипотека CRM</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css"/>
      </Head>
      <div style={{display:'flex',minHeight:'100vh',fontFamily:"'Inter',system-ui,sans-serif"}}>
        {/* Sidebar */}
        <div style={{width:220,background:'#0f172a',display:'flex',flexDirection:'column',position:'sticky',top:0,height:'100vh',overflowY:'auto',flexShrink:0}}>
          <div style={{padding:'16px 15px 13px',borderBottom:'1px solid rgba(255,255,255,.07)'}}>
            <div style={{fontSize:20,marginBottom:4}}>🏠</div>
            <div style={{fontSize:14,fontWeight:800,color:'#fff'}}>Ипотека CRM</div>
            <div style={{fontSize:10,color:'#475569',marginTop:2}}>Карточка клиента</div>
          </div>
          <div style={{padding:'9px 8px',flex:1,display:'flex',flexDirection:'column',gap:2}}>
            <button onClick={onBack} style={{display:'flex',alignItems:'center',gap:8,padding:'9px 11px',borderRadius:9,color:'#64748b',background:'transparent',fontSize:12.5,width:'100%',textAlign:'left',border:'none',cursor:'pointer',fontFamily:'inherit'}}>
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

  function updPay(id, key, val) { setC({...c, payments:payments.map(p=>p.id===id?{...p,[key]:val}:p)}) }
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
    setSD(si, {...sd, tasks:(sd.tasks||[]).map(t=>t.id===tid?{...t,done:!t.done}:t)})
    setC({...c, tasks:(c.tasks||[]).map(t=>t.id===tid?{...t,done:!t.done}:t)})
  }
  function handleFiles(si, files) {
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = e => {
        const doc = {id:uid(),name:file.name,type:file.type.includes('image')?'photo':'doc',base64:e.target.result,size:file.size,uploadDate:nowStr(),note:'',stage:ACCOMP[si]}
        const sdCurr = getSD(si)
        setSD(si, {...sdCurr, docs:[...(sdCurr.docs||[]),doc]})
      }
      reader.readAsDataURL(file)
    })
    if (files.length) toast$('📎 '+files.length+' файл(а) добавлено')
  }
  function delDoc(si, did) {
    const sd = getSD(si)
    setSD(si, {...sd, docs:(sd.docs||[]).filter(d=>d.id!==did)})
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
                const isImg = doc.base64&&doc.base64.startsWith('data:image')
                return (
                  <div key={doc.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 13px',borderBottom:'1px solid #e2e8f0'}}>
                    {isImg
                      ? <img src={doc.base64} alt={doc.name} style={{width:44,height:44,borderRadius:8,objectFit:'cover',border:'1px solid #e2e8f0',flexShrink:0}}/>
                      : <div style={{width:44,height:44,borderRadius:8,background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><i className="ti ti-file-text" style={{fontSize:20,color:'#3b82f6'}}/></div>}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{doc.name}</div>
                      <div style={{fontSize:11,color:'#64748b'}}>{doc.uploadDate}{doc.size?' · '+fmtSize(doc.size):''}</div>
                    </div>
                    {doc.base64 && <a href={doc.base64} download={doc.name} style={{textDecoration:'none'}}><Btn size="sm"><i className="ti ti-download" style={{fontSize:14}}/></Btn></a>}
                    {canEdit && <Btn size="sm" variant="danger" onClick={()=>delDoc(si,doc.id)}><i className="ti ti-trash" style={{fontSize:13}}/></Btn>}
                  </div>
                )
              })}
              {canEdit && (
                <div style={{padding:'10px 13px'}}>
                  <div
                    style={{border:'2.5px dashed #cbd5e1',borderRadius:12,padding:24,textAlign:'center',cursor:'pointer',transition:'all .15s'}}
                    onClick={()=>fileRefs.current[si]?.click()}
                    onDragOver={e=>e.preventDefault()}
                    onDrop={e=>{e.preventDefault();handleFiles(si,e.dataTransfer.files)}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='#3b82f6';e.currentTarget.style.background='#eff6ff'}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='#cbd5e1';e.currentTarget.style.background='transparent'}}>
                    <i className="ti ti-cloud-upload" style={{fontSize:26,color:'#94a3b8',display:'block',marginBottom:5}}/>
                    <div style={{fontWeight:600,fontSize:13,color:'#64748b'}}>Перетащите или нажмите для загрузки</div>
                    <div style={{fontSize:11,color:'#94a3b8',marginTop:2}}>Фото, PDF, документы</div>
                  </div>
                  <input ref={el=>fileRefs.current[si]=el} type="file" multiple accept="image/*,.pdf,.doc,.docx" style={{display:'none'}} onChange={e=>handleFiles(si,e.target.files)}/>
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
  function tog(id) { setC({...c, tasks:tasks.map(t=>t.id===id?{...t,done:!t.done}:t)}) }
  function del(id) { setC({...c, tasks:tasks.filter(t=>t.id!==id)}) }
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

// ─── SIMPLE MODALS ───────────────────────────────────────────────
function ModalWrap({ title, sub, onClose, children, footer, size='md' }) {
  const widths = { sm:400, md:500, lg:660, xl:980 }
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.52)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:14,backdropFilter:'blur(4px)'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'#fff',borderRadius:18,boxShadow:'0 24px 80px rgba(0,0,0,.22)',width:widths[size],maxWidth:'100%',maxHeight:'92vh',display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'15px 19px',borderBottom:'1.5px solid #e2e8f0'}}>
          <div>
            <div style={{fontSize:16,fontWeight:800,letterSpacing:'-.3px'}}>{title}</div>
            {sub && <div style={{fontSize:11,color:'#64748b',marginTop:2}}>{sub}</div>}
          </div>
          <Btn onClick={onClose}><i className="ti ti-x"/></Btn>
        </div>
        <div className='modal-body'>{children}</div>
        {footer && <div className='modal-ft'>{footer}</div>}
      </div>
    </div>
  )
}

function NewClientModal({ client, managers, pipeline, onSave, onClose, syncing }) {
  const [f, sf] = useState({...client})
  const set = (k,v) => sf(x=>({...x,[k]:v}))
  const pl = pipeline || PIPELINE_DEFAULT
  return (
    <ModalWrap title="Новый клиент" onClose={onClose} size="md"
      footer={<><Btn onClick={onClose}>Отмена</Btn><Btn variant="primary" onClick={()=>onSave(f)} disabled={syncing}>{syncing?<><i className="ti ti-loader spin"/>Создаю...</>:<><i className="ti ti-device-floppy"/>Создать клиента</>}</Btn></>}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
        <Fl l="ФИО *" req ch={<Inp value={f.fio} onChange={e=>set('fio',e.target.value)} placeholder="Фамилия Имя"/>}/>
        <Fl l="ИИН"      ch={<Inp value={f.iin} onChange={e=>set('iin',e.target.value)} placeholder="123456789012" maxLength={12}/>}/>
        <Fl l="Телефон *" req ch={<Inp value={f.phone} onChange={e=>set('phone',e.target.value)} placeholder="+7 701 ..."/>}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
        <Fl l="Город"    ch={<Sel value={f.city}    onChange={e=>set('city',e.target.value)}>{CITIES.map(c=><option key={c}>{c}</option>)}</Sel>}/>
        <Fl l="Менеджер" ch={<Sel value={f.manager||''} onChange={e=>set('manager',e.target.value)}><option value="">—</option>{managers.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</Sel>}/>
        <Fl l="Источник" ch={<Sel value={f.source}  onChange={e=>set('source',e.target.value)}>{SRCS.map(s=><option key={s.id} value={s.id}>{s.l}</option>)}</Sel>}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Fl l="Этап" ch={<Sel value={f.stage} onChange={e=>set('stage',e.target.value)}>{pl.map(p=><option key={p.id} value={p.id}>{p.l}</option>)}</Sel>}/>
        <Fl l="КИ"   ch={<Sel value={f.creditStatus} onChange={e=>set('creditStatus',e.target.value)}>{CR_ST.map(c=><option key={c.id} value={c.id}>{c.l}</option>)}</Sel>}/>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 13px',background:'#f8fafc',borderRadius:11,border:'2px solid #e2e8f0',marginBottom:13}}>
        <i className="ti ti-brand-whatsapp" style={{fontSize:18,color:'#25d366'}}/><span style={{fontWeight:600,flex:1}}>Лид из WhatsApp</span><Tgl on={f.isWhatsApp} onClick={()=>set('isWhatsApp',!f.isWhatsApp)}/>
      </div>
      <Fl l="Статус связи" ch={<div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{CONTACT_ST.map(s=><button key={s} onClick={()=>set('contactStatus',s)} style={{padding:'8px 13px',borderRadius:20,border:`2px solid ${f.contactStatus===s?'#3b82f6':'#e2e8f0'}`,background:f.contactStatus===s?'#eff6ff':'#fff',fontSize:12,fontWeight:600,cursor:'pointer',color:f.contactStatus===s?'#3b82f6':'#64748b',fontFamily:'inherit',transition:'all .14s'}}>{s}</button>)}</div>}/>
    </ModalWrap>
  )
}

function MgrModal({ item, onSave, onClose, syncing }) {
  const [f, sf] = useState({...item})
  const set = (k,v) => sf(x=>({...x,[k]:v}))
  return (
    <ModalWrap title={f.name||'Новый менеджер'} onClose={onClose} size="sm"
      footer={<><Btn onClick={onClose}>Отмена</Btn><Btn variant="primary" onClick={()=>onSave(f)} disabled={syncing}>{syncing?<><i className="ti ti-loader spin"/>...</>:<><i className="ti ti-device-floppy"/>Сохранить</>}</Btn></>}>
      <Fl l="ФИО *" req ch={<Inp value={f.name}  onChange={e=>set('name',e.target.value)}  placeholder="Фамилия Имя"/>}/>
      <Fl l="Телефон"    ch={<Inp value={f.phone||''} onChange={e=>set('phone',e.target.value)} placeholder="+7 701 000-00-00"/>}/>
      <Fl l="Роль" ch={<Sel value={f.role} onChange={e=>set('role',e.target.value)}>{ROLES.filter(r=>r.id!=='admin').map(r=><option key={r.id} value={r.id}>{r.l}</option>)}</Sel>}/>
      <Fl l="Цвет" ch={<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{COLORS.map(c=><div key={c} onClick={()=>set('color',c)} style={{width:28,height:28,borderRadius:8,background:c,cursor:'pointer',boxShadow:f.color===c?`0 0 0 3px #fff,0 0 0 5px #1a1a1a`:'none',transition:'all .14s'}}/>)}</div>}/>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 13px',background:'#f8fafc',borderRadius:11,border:'2px solid #e2e8f0',marginTop:4}}>
        <span style={{fontWeight:600,flex:1}}>Активен</span><Tgl on={f.active!==false} onClick={()=>set('active',!f.active)}/>
      </div>
    </ModalWrap>
  )
}

function UserModal({ item, managers, onSave, onClose, syncing }) {
  const [f, sf] = useState({...item})
  const set = (k,v) => sf(x=>({...x,[k]:v}))
  return (
    <ModalWrap title={`Пользователь: ${f.name||'Новый'}`} onClose={onClose} size="sm"
      footer={<><Btn onClick={onClose}>Отмена</Btn><Btn variant="primary" onClick={()=>onSave(f)} disabled={syncing}>{syncing?<><i className="ti ti-loader spin"/>...</>:<><i className="ti ti-device-floppy"/>Сохранить</>}</Btn></>}>
      <Fl l="Имя" ch={<Inp value={f.name} onChange={e=>set('name',e.target.value)}/>}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Fl l="Логин"  ch={<Inp value={f.login} onChange={e=>set('login',e.target.value)} placeholder="Логин"/>}/>
        <Fl l="Пароль" ch={<Inp value={f.pwd}   onChange={e=>set('pwd',e.target.value)}   placeholder="Пароль"/>}/>
      </div>
      <Fl l="Роль" ch={<Sel value={f.role} onChange={e=>set('role',e.target.value)}>{ROLES.map(r=><option key={r.id} value={r.id}>{r.l}</option>)}</Sel>}/>
      <Fl l="Менеджер (если роль — менеджер)" ch={<Sel value={f.mid||''} onChange={e=>set('mid',e.target.value||null)}><option value="">—</option>{managers.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</Sel>}/>
    </ModalWrap>
  )
}

function CLModal({ stage, items: init, onSave, onClose, syncing }) {
  const [items, setItems] = useState([...(init||[])])
  const [nItem, setNItem] = useState({ t:'', tp:'check' })
  function add() { if (!nItem.t.trim()) return; setItems(x=>[...x,{id:uid(),...nItem}]); setNItem({t:'',tp:'check'}) }
  function del(id) { setItems(x=>x.filter(i=>i.id!==id)) }
  function mv(id, dir) {
    const idx = items.findIndex(i=>i.id===id)
    if (idx<0) return
    const arr = [...items]; const t = arr[idx]; arr[idx] = arr[idx+dir]; arr[idx+dir] = t; setItems(arr)
  }
  return (
    <ModalWrap title={`Чек-лист: ${stage}`} sub={`${items.length} пунктов`} onClose={onClose} size="lg"
      footer={<><Btn onClick={onClose}>Отмена</Btn><Btn variant="primary" onClick={()=>onSave(stage,items)} disabled={syncing}>{syncing?<><i className="ti ti-loader spin"/>...</>:<><i className="ti ti-device-floppy"/>Сохранить</>}</Btn></>}>
      <div style={{background:'#f8fafc',borderRadius:13,padding:13,border:'1.5px solid #e2e8f0',marginBottom:13}}>
        <div style={{display:'flex',gap:7,marginBottom:8}}>
          {[{id:'check',l:'✓ Пункт'},{id:'ecp',l:'🔏 ЭЦП'},{id:'doc',l:'📄 Документ'}].map(t=>(
            <Btn key={t.id} size="sm" variant={nItem.tp===t.id?'primary':'ghost'} onClick={()=>setNItem(x=>({...x,tp:t.id}))}>{t.l}</Btn>
          ))}
        </div>
        <div style={{display:'flex',gap:8}}>
          <Inp value={nItem.t} onChange={e=>setNItem(x=>({...x,t:e.target.value}))} placeholder="Текст пункта..." style={{flex:1}} onKeyDown={e=>e.key==='Enter'&&add()}/>
          <Btn variant="primary" onClick={add}><i className="ti ti-plus"/>Добавить</Btn>
        </div>
      </div>
      {items.length===0 && <div style={{textAlign:'center',padding:'44px 20px',color:'#64748b'}}><i className="ti ti-list-check" style={{fontSize:40,display:'block',marginBottom:10,opacity:.2}}/><p style={{fontSize:15,fontWeight:500}}>Добавьте пункты</p></div>}
      {items.map((item, idx) => (
        <div key={item.id} style={{display:'flex',alignItems:'center',gap:9,padding:'9px 12px',background:'#f8fafc',borderRadius:10,border:'1.5px solid #e2e8f0',marginBottom:7}}>
          <div style={{width:28,height:28,borderRadius:8,background:TB[item.tp||'check'],display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <i className={`ti ${TI[item.tp||'check']}`} style={{fontSize:13,color:TC[item.tp||'check']}}/>
          </div>
          <span style={{flex:1,fontSize:13,fontWeight:500}}>{item.t}</span>
          <span style={{fontSize:9,fontWeight:700,background:TB[item.tp||'check'],color:TC[item.tp||'check'],borderRadius:5,padding:'2px 6px'}}>{TL[item.tp||'check']}</span>
          <div style={{display:'flex',gap:4}}>
            <Btn size="sm" onClick={()=>idx>0&&mv(item.id,-1)} disabled={idx===0} style={{width:28,height:28,padding:0,opacity:idx===0?.3:1}}><i className="ti ti-arrow-up" style={{fontSize:11}}/></Btn>
            <Btn size="sm" onClick={()=>idx<items.length-1&&mv(item.id,1)} disabled={idx===items.length-1} style={{width:28,height:28,padding:0,opacity:idx===items.length-1?.3:1}}><i className="ti ti-arrow-down" style={{fontSize:11}}/></Btn>
            <Btn size="sm" variant="danger" onClick={()=>del(item.id)} style={{width:28,height:28,padding:0}}><i className="ti ti-trash" style={{fontSize:11}}/></Btn>
          </div>
        </div>
      ))}
    </ModalWrap>
  )
}

function PLModal({ pipeline, onSave, onClose, syncing }) {
  const [stages, setStages] = useState(JSON.parse(JSON.stringify(pipeline)))
  function upd(id, field, val) { setStages(s=>s.map(x=>x.id===id?{...x,[field]:val}:x)) }
  function add() { setStages(s=>[...s,{id:'stage_'+uid(),l:'Новый этап',c:'#64748b'}]) }
  function del(id) { setStages(s=>s.filter(x=>x.id!==id)) }
  function mv(id, dir) {
    const idx = stages.findIndex(x=>x.id===id)
    if (idx<0) return
    const arr = [...stages]; const t = arr[idx]; arr[idx] = arr[idx+dir]; arr[idx+dir] = t; setStages(arr)
  }
  return (
    <ModalWrap title="Редактировать воронку" sub="Порядок, названия, цвета" onClose={onClose} size="lg"
      footer={<><Btn onClick={onClose}>Отмена</Btn><Btn variant="primary" onClick={()=>onSave(stages)} disabled={syncing}>{syncing?<><i className="ti ti-loader spin"/>...</>:<><i className="ti ti-device-floppy"/>Сохранить воронку</>}</Btn></>}>
      <Btn variant="primary" size="sm" onClick={add} style={{marginBottom:13}}><i className="ti ti-plus"/>Добавить этап</Btn>
      {stages.map((p, i) => (
        <div key={p.id} style={{display:'flex',alignItems:'center',gap:9,padding:'10px 12px',background:'#f8fafc',borderRadius:11,border:'1.5px solid #e2e8f0',marginBottom:8}}>
          <span style={{fontSize:12,fontWeight:700,color:'#64748b',width:20,flexShrink:0}}>{i+1}.</span>
          <Inp value={p.l} onChange={e=>upd(p.id,'l',e.target.value)} style={{flex:1,minWidth:0}}/>
          <div style={{display:'flex',gap:5}}>{COLORS.map(c=><div key={c} onClick={()=>upd(p.id,'c',c)} style={{width:20,height:20,borderRadius:5,background:c,cursor:'pointer',boxShadow:p.c===c?`0 0 0 2px #fff,0 0 0 4px #1a1a1a`:'none'}}/>)}</div>
          <div style={{display:'flex',gap:4}}>
            <Btn size="sm" onClick={()=>i>0&&mv(p.id,-1)} disabled={i===0} style={{width:28,height:28,padding:0,opacity:i===0?.3:1}}><i className="ti ti-arrow-up" style={{fontSize:11}}/></Btn>
            <Btn size="sm" onClick={()=>i<stages.length-1&&mv(p.id,1)} disabled={i===stages.length-1} style={{width:28,height:28,padding:0,opacity:i===stages.length-1?.3:1}}><i className="ti ti-arrow-down" style={{fontSize:11}}/></Btn>
            <Btn size="sm" variant="danger" onClick={()=>del(p.id)} style={{width:28,height:28,padding:0}}><i className="ti ti-trash" style={{fontSize:11}}/></Btn>
          </div>
        </div>
      ))}
    </ModalWrap>
  )
}

function fmtSize(b) { return b<1024?b+'B':b<1048576?(b/1024).toFixed(1)+'KB':(b/1048576).toFixed(1)+'MB' }
