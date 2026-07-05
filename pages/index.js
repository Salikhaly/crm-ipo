// pages/index.js
// Главная страница CRM — полный UI подключённый к бэкенду через /api/*

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Head from 'next/head'
import { api } from '../lib/api'

// Инлайним avgSalary здесь вместо import из lib/calcEngine
// (import ESM-модуля в pages/ вызывает ошибку хуков при сборке Next.js)
function avgSalary(opvList) {
  const list = (opvList || []).map(Number).filter(v => isFinite(v) && v > 0)
  if (!list.length) return 0
  const n   = list.length
  const sum = list.reduce((a, b) => a + b, 0)
  const s1  = sum * 7.9 / 6
  if (n < 3) return Math.round(s1)
  const mx = Math.max(...list)
  const mn = Math.min(...list)
  return Math.round((s1 + (sum - mx - mn) * 7.9 / (n - 2)) / 2)
}

// ═══ КОНСТАНТЫ ═══════════════════════════════════════════════════
// ─── WhatsApp polling ─────────────────────────────────────────────
const WA_CHATS_POLL_MS    = 10_000         // интервал обновления списка чатов
const WA_MESSAGES_POLL_MS = 5_000          // интервал обновления сообщений открытого чата
// ─── Прочие лимиты ────────────────────────────────────────────────
const MIN_SEARCH_LENGTH   = 2              // минимальная длина поисковой строки
const MAX_FILE_SIZE_BYTES = 32 * 1024 * 1024  // 32 МБ лимит медиафайлов

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
    dealStepsDone: [], dealStepsNotes: {},
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
    toastRef.current = setTimeout(() => setToast(null), 4500)
  }

  // ─── AUTH ────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('crm_token')
    const saved = localStorage.getItem('crm_user')
    if (token && saved) {
      try {
        setUser(JSON.parse(saved))
      } catch {
        // Повреждённые данные в localStorage — сбрасываем сессию
        localStorage.removeItem('crm_token')
        localStorage.removeItem('crm_user')
      }
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
  // ─── SWIPE NAVIGATION (mobile) ──────────────────────────
  const swipeStartX  = useRef(null)
  const swipeStartY  = useRef(null)
  const PAGE_ORDER   = ['dashboard','clients','wa','calc','tasks','kpi']

  const onSwipeTouchStart = useCallback((e) => {
    swipeStartX.current = e.touches[0].clientX
    swipeStartY.current = e.touches[0].clientY
  }, [])

  const onSwipeTouchEnd = useCallback((e) => {
    if (swipeStartX.current === null) return
    const dx = e.changedTouches[0].clientX - swipeStartX.current
    const dy = e.changedTouches[0].clientY - swipeStartY.current
    swipeStartX.current = null
    if (Math.abs(dx) < 70 || Math.abs(dy) > 50) return
    setPage(prev => {
      const idx = PAGE_ORDER.indexOf(prev)
      if (idx === -1) return prev
      if (dx < 0 && idx < PAGE_ORDER.length - 1) return PAGE_ORDER[idx + 1]
      if (dx > 0 && idx > 0)                     return PAGE_ORDER[idx - 1]
      return prev
    })
  }, [])

  const loadAll = useCallback(async () => {
    setSyncing(true)
    try {
      // Менеджер получает только своих клиентов через API
      const clientParams = user?.role === 'manager' && user?.manager_id
        ? { manager: user.manager_id }
        : {}
      const [cRes, mRes, uRes, plRes, clRes] = await Promise.all([
        api.getClients(clientParams),
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
      if (cRes?.hasMore) toast$('⚠️ Загружены первые 200 клиентов. Для поиска остальных используйте страницу Поиск.')
    } catch (e) {
      toast$('❌ Ошибка загрузки: ' + e.message, 'err')
    }
    setSyncing(false)
  }, [user])

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
      const requestedChatId = cur.id  // фиксируем на момент запроса
      // Используем id последнего сообщения как курсор (надёжнее чем sent_at при clock skew)
      setWaMessages(prev => {
        const lastMsg = prev.length ? prev[prev.length - 1] : null
        const qs      = lastMsg ? `&after_id=${encodeURIComponent(lastMsg.id)}` : ''
        api.getWaMessages(requestedChatId, qs).then(d => {
          // Пользователь успел переключиться на другой чат, пока ответ был в пути —
          // не вливаем сообщения старого чата в список нового
          if (selWaChatRef.current?.id !== requestedChatId) return
          if (!d?.messages?.length) return
          // Менеджер активно смотрит этот чат и видит новые сообщения — помечаем прочитанными
          const hasIncoming = d.messages.some(m => m.direction === 'in')
          if (hasIncoming) api.markWaChatRead(requestedChatId).catch(() => {})
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

    // Polling: пропускаем тики когда вкладка скрыта (экономия Supabase запросов)
    const t1 = setInterval(() => {
      if (!document.hidden) loadChats()
    }, WA_CHATS_POLL_MS)

    const t2 = setInterval(() => {
      if (!document.hidden) loadMsgs()
    }, WA_MESSAGES_POLL_MS)

    // При возврате на вкладку — сразу обновляем
    const onVisible = () => { if (!document.hidden) { loadChats(); loadMsgs() } }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(t1)
      clearInterval(t2)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [user, page])

  // ── УВЕДОМЛЕНИЯ ПО ЗАДАЧАМ ──────────────────────────────────
  // Проверяем задачи каждые 15 минут и при смене страниц
  useEffect(() => {
    if (!user || !clients.length) return

    function checkTaskReminders() {
      const today = new Date().toISOString().slice(0, 10)
      const now   = new Date()

      clients.forEach(client => {
        (client.tasks || []).forEach(task => {
          if (task.done) return
          if (!task.due) return

          const isToday    = task.due === today
          const isOverdue  = task.due < today
          const taskKey    = `task_notified_${task.id}`
          const alreadyNotified = sessionStorage.getItem(taskKey)

          if ((isToday || isOverdue) && !alreadyNotified) {
            sessionStorage.setItem(taskKey, '1')

            const label   = isOverdue ? '🔴 Просрочена' : '🟡 Сегодня'
            const msgText = `${label}: ${task.text} — ${client.fio || client.phone}`

            // Browser Notification
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              try {
                new Notification('Задача CRM', {
                  body: msgText,
                  icon: '/favicon.ico',
                  tag:  task.id,
                })
              } catch {}
            }

            // Toast в интерфейсе
            toast$(msgText, isOverdue ? 'err' : '')
          }
        })
      })
    }

    checkTaskReminders()
    const t = setInterval(checkTaskReminders, 15 * 60 * 1000) // каждые 15 мин
    return () => clearInterval(t)
  }, [clients, user])

  // Search
  useEffect(() => {
    if (page !== 'search') return
    // Не делаем запрос вхолостую если нет ни текста, ни фильтров
    if (!search.trim() && !fStage && !fMgr) { setSearchRes([]); return }

    let cancelled = false
    const t = setTimeout(() => {
      api.search({ q: search, stage: fStage, manager: fMgr })
        .then(d => {
          // Защита от устаревшего ответа: если эффект уже пересоздан (новый ввод),
          // не перезаписываем результаты более старым network-ответом
          if (!cancelled && d?.results) setSearchRes(d.results)
        })
        .catch(() => {})
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [search, fStage, fMgr, page])

  // ─── CLIENT ACTIONS ──────────────────────────────────────
  async function saveClient(c) {
    // Валидация ИИН
    if (c.iin && !/^\d{12}$/.test(c.iin)) {
      toast$('❌ ИИН должен содержать ровно 12 цифр', 'err'); return
    }
    // Проверка дубля по ИИН
    if (c.iin) {
      const dup = clients.find(x => x.id !== c.id && x.iin === c.iin)
      if (dup) {
        toast$(`⚠️ ИИН уже есть у клиента: ${dup.fio || dup.phone}`, 'err'); return
      }
    }
    // Проверка дубля по телефону (при создании и при обновлении)
    if (c.phone) {
      const phone = c.phone.replace(/\D/g, '')
      const dup = clients.find(x => x.id !== c.id && x.phone && x.phone.replace(/\D/g, '') === phone)
      if (dup) {
        toast$(`⚠️ Телефон уже есть у клиента: ${dup.fio || dup.phone}`, 'err'); return
      }
    }
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
    const prev    = c.stage
    const updated = { ...c, stage }
    // Оптимистичное обновление — сразу показываем новую позицию
    setClients(cs => cs.map(x => x.id === id ? updated : x))
    if (selClient?.id === id) setSelClient(updated)
    try {
      await api.updateClient(id, updated)
      toast$(`📌 ${pipeline.find(p => p.id === stage)?.l || stage}`)
    } catch (e) {
      // Rollback при ошибке
      setClients(cs => cs.map(x => x.id === id ? { ...x, stage: prev } : x))
      if (selClient?.id === id) setSelClient({ ...updated, stage: prev })
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
    setSyncing(true)
    try {
      await api.deleteManager(id)
      setManagers(ms => ms.filter(x => x.id !== id))
      toast$('🗑 Менеджер удалён')
      setModal(null)
    } catch (e) {
      toast$('❌ ' + e.message, 'err')
    }
    setSyncing(false)
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
    setSyncing(true)
    try {
      await api.deleteUser(id)
      setUsers(us => us.filter(x => x.id !== id))
      toast$('🗑 Удалено')
      setModal(null)
    } catch (e) {
      toast$('❌ ' + e.message, 'err')
    }
    setSyncing(false)
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
  const loadWaMessages = useCallback(async function loadWaMessages(chatId) {
    try {
      const d = await api.getWaMessages(chatId)
      if (d?.messages) setWaMessages(d.messages)
      setWaChats(cs => cs.map(c => c.id === chatId ? { ...c, unread_count: 0 } : c))
    } catch (e) { toast$('❌ ' + e.message, 'err') }
  }, []) // setWaMessages и setWaChats — стабильные setState, не нужны в deps

  const sendWaMsg = useCallback(async function sendWaMsg(chatId, phone, text) {
    if (!text.trim()) return
    try {
      await api.sendWaMessage(chatId, phone, text, user?.name)
      await loadWaMessages(chatId)
    } catch (e) { toast$('❌ ' + e.message, 'err') }
  }, [user, loadWaMessages])

  const sendWaMedia = useCallback(async function sendWaMedia(chatId, phone, file, caption) {
    try {
      await api.sendWaMedia(chatId, phone, file, caption, user?.name)
      await loadWaMessages(chatId)
      toast$('✅ Файл отправлен')
    } catch (e) {
      toast$('❌ ' + e.message, 'err')
      throw e
    }
  }, [user, loadWaMessages])

  const assignWaChat = useCallback(async function assignWaChat(chatId, managerId) {
    try {
      await api.assignWaChat(chatId, managerId)
      setWaChats(cs => cs.map(c => c.id === chatId ? { ...c, assigned_to: managerId } : c))
      toast$('✅ Менеджер назначен')
    } catch (e) { toast$('❌ ' + e.message, 'err') }
  }, []) // useCallback

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
        await api.linkWaChat(linkWaChatId, saved.id).catch(() => {})
        setWaChats(cs => cs.map(ch => ch.id === linkWaChatId ? { ...ch, client_id: saved.id } : ch))
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
  // Техник (admin) видит всех клиентов и имеет полный доступ — как head
  const isSuperUser = isAdmin || isHead

  // ── Мемоизированные вычисления: пересчёт только при изменении зависимостей ──
  const myCl = useMemo(
    // Менеджер видит только своих клиентов. Техник (admin) и руководитель видят всех.
    () => isMgr ? clients.filter(c => c.manager === user?.manager_id) : clients,
    [clients, isMgr, user?.manager_id]
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
    { id:'calc',      l:'Калькулятор',        i:'ti-calculator' },
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
              <div style={{width:28,height:28,borderRadius:'50%',background:role?.c||'#3b82f6',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:11,color:'#fff',flexShrink:0}}>{user.name?.[0]||'?'}</div>
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
            <Btn variant="primary" size="sm" onClick={() => setModal({ type:'new_client', c: emptyClient(user.manager_id||'') })}>
              <i className="ti ti-plus"/><span style={{display:'none'}} className="btn-text-desktop">Новый клиент</span><span style={{display:'inline'}}>+</span>
            </Btn>
            <Btn size="sm" onClick={loadAll} disabled={syncing}>
              <i className={`ti ti-refresh${syncing?' spin':''}`}/>
            </Btn>
          </div>

          {/* Page content */}
          <div className="main-content" onTouchStart={onSwipeTouchStart} onTouchEnd={onSwipeTouchEnd}>
            {page==='dashboard' && <DashPage data={dashData} pipeline={pipeline} managers={managers} onOpen={c => setSelClient(c)} onLoadDash={() => api.getDashboard().then(d => setDashData(d))}/>}
            {page==='clients'   && <ClientsPage clients={filtered} managers={managers} pipeline={pipeline} onOpen={c => setSelClient(c)} drag={drag} setDrag={setDrag} dragOv={dragOv} setDragOv={setDragOv} onMove={moveClient}/>}
            {page==='search'    && <SearchPage clients={searchRes.length||search||fStage||fMgr?searchRes:myCl} managers={managers} pipeline={pipeline} checklists={checklists} search={search} setSearch={setSearch} fStage={fStage} setFStage={setFStage} fMgr={fMgr} setFMgr={setFMgr} onOpen={c => setSelClient(c)} waNew={myCl.filter(c=>c.isWhatsApp&&c.stage==='new_lead')}/>}
            {page==='wa'        && <WAPage chats={waChats} messages={waMessages} managers={managers} clients={myCl} selChat={selWaChat} onSelChat={c=>{selWaChatRef.current=c;setSelWaChat(c);setWaMessages([]);if(c)loadWaMessages(c.id)}} onSend={sendWaMsg} onSendMedia={sendWaMedia} onImport={importWaLead} onAssign={assignWaChat} onUpdateStatus={updateWaChatStatus} user={user} onOpenClient={c=>setSelClient(c)} mgrById={mgrById}/>}
            {page==='calc'      && <CalcPage user={user} clients={myCl} toast$={toast$}/>}
            {page==='tasks'     && <TasksPage clients={myCl} managers={managers} onOpen={c => setSelClient(c)} user={user} onSave={saveClient}/>}
            {page==='kpi'       && <KPIPage data={kpiData} period={kpiPeriod} setPeriod={setKpiPeriod}/>}
            {page==='admin'     && isAdmin && <AdminPage managers={managers} pipeline={pipeline} checklists={checklists} users={users} user={user} onSaveMgr={saveMgr} onDelMgr={delMgr} onSaveUser={saveUser} onDelUser={delUser} onSavePL={savePL} onSaveCL={saveCL} onModal={setModal} reload={loadAll} syncing={syncing}/>}
          </div>
        </div>
      </div>

      {/* Bottom nav (mobile) */}
      {/* Swipe page indicator — mobile only */}
      <div style={{display:'none',justifyContent:'center',gap:6,padding:'5px 0',
        background:'#f8fafc',borderTop:'1px solid #e2e8f0',
        position:'fixed',bottom:62,left:0,right:0,zIndex:199}}
        className="swipe-dots-bar">
        <style>{`.swipe-dots-bar{display:none!important}@media(max-width:768px){.swipe-dots-bar{display:flex!important}}`}</style>
        {['dashboard','clients','wa','calc','tasks','kpi'].map((p,i)=>(
          <div key={p} onClick={()=>setPage(p)} style={{
            width: page===p?18:6, height:6, borderRadius:3, cursor:'pointer', transition:'all .2s',
            background: page===p?'#3b82f6':'#cbd5e1',
          }}/>
        ))}
      </div>
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
        <div role="alert" aria-live="polite" className={`toast${toast.type==='err'?' err':''}`}>
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

  // PROD: подсказки паролей скрыты. Раскомментируйте для dev/тестирования
  const hints = process.env.NODE_ENV === 'development' ? [
    { l:'admin',   p:'admin123', r:'Техник' },
    { l:'head',    p:'head123',  r:'Руководитель' },
    { l:'aigerim', p:'a123',     r:'Менеджер' },
    { l:'daniyar', p:'d123',     r:'Менеджер' },
  ] : []

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
        <Fl l="Пароль" ch={<Inp type="password" value={pw} onChange={e=>{setPw(e.target.value);setErr('')}} placeholder="Ваш пароль" style={{fontSize:16,padding:'12px 14px',borderRadius:12}} onKeyDown={e=>e.key==='Enter'&&go()}/>}/>
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
    { id:'dashboard', l:'Главная',    i:'ti-home' },
    { id:'search',    l:'Поиск',      i:'ti-search' },
    { id:'wa',        l:'WhatsApp',   i:'ti-brand-whatsapp', cnt:waUnread, wa:true },
    { id:'calc',      l:'Калькулятор',i:'ti-calculator' },
    { id:'tasks',     l:'Задачи',     i:'ti-checkbox', cnt:openTasks, warn:overdueTasks>0 },
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
  useEffect(() => { if (!data) onLoadDash() }, [data, onLoadDash])

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
          { l:'Всего клиентов', v:metrics.trueTotal,    s:`${metrics.thisMonth} за месяц`,    c:'#6366f1', i:'ti-users' },
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

// ─── ШАБЛОНЫ СООБЩЕНИЙ ────────────────────────────────────────
// Переменные: {{имя}}, {{сумма}}, {{банк}}, {{дата}}, {{этап}}
const MSG_TEMPLATES = [
  {
    cat: '👋 Приветствие',
    items: [
      { id: 't1', label: 'Приветствие', text: 'Здравствуйте, {{имя}}! Меня зовут {{менеджер}}, я ипотечный специалист. Чем могу помочь?' },
      { id: 't2', label: 'Ответ на заявку', text: 'Здравствуйте, {{имя}}! Получили вашу заявку. Готов помочь подобрать лучшую ипотечную программу. Когда удобно поговорить?' },
      { id: 't3', label: 'Первый контакт', text: 'Добрый день, {{имя}}! Спасибо за обращение. Расскажите подробнее — какую недвижимость рассматриваете?' },
    ]
  },
  {
    cat: '📄 Документы',
    items: [
      { id: 'd1', label: 'Запрос ИИН', text: 'Для предварительного расчёта, пожалуйста, пришлите ваш ИИН (12 цифр).' },
      { id: 'd2', label: 'Список документов', text: 'Для подачи заявки понадобятся:\n• Удостоверение личности\n• Справка о доходах (форма банка)\n• ИИН и ЭЦП\n• Выписка ЕНПФ\n\nЕсть созаёмщик? Те же документы.' },
      { id: 'd3', label: 'Документы получены', text: '{{имя}}, документы получили, проверяем ✅ Результат сообщу в течение 24 часов.' },
      { id: 'd4', label: 'Нужны доп. документы', text: '{{имя}}, для оформления нужны дополнительные документы. Пришлите, пожалуйста: {{документы}}' },
    ]
  },
  {
    cat: '🏦 Одобрение',
    items: [
      { id: 'a1', label: 'Заявка подана', text: '{{имя}}, заявка подана в {{банк}} ✅ Ожидаем решение 3-5 рабочих дней. Как только будет ответ — сразу сообщу!' },
      { id: 'a2', label: 'Одобрено!', text: '🎉 {{имя}}, отличные новости! Банк {{банк}} одобрил ипотеку на сумму {{сумма}} ₸. Когда можете встретиться для обсуждения условий?' },
      { id: 'a3', label: 'Отказ банка', text: '{{имя}}, к сожалению {{банк}} отказал в этот раз. Не переживайте — есть другие варианты. Предлагаю рассмотреть альтернативные банки. Когда удобно обсудить?' },
      { id: 'a4', label: 'Нужна доработка', text: '{{имя}}, банк запросил дополнительную информацию. Нужно уточнить: {{запрос}}. Пожалуйста, пришлите в ближайшее время.' },
    ]
  },
  {
    cat: '📅 Встреча',
    items: [
      { id: 'm1', label: 'Назначить встречу', text: '{{имя}}, предлагаю встретиться для детального обсуждения. Вам удобно {{дата}}? Офис: пр. Абая 150, 3 этаж.' },
      { id: 'm2', label: 'Подтверждение встречи', text: '{{имя}}, подтверждаем встречу {{дата}} ✅ Жду вас! Если что-то изменится — пишите заранее.' },
      { id: 'm3', label: 'Напоминание о встрече', text: '{{имя}}, напоминаю — завтра встреча в {{время}}. Не забудьте взять оригиналы документов 📋' },
    ]
  },
  {
    cat: '💰 Сделка',
    items: [
      { id: 'c1', label: 'Дата сделки', text: '{{имя}}, сделка назначена на {{дата}} в {{время}}. Место: {{банк}}. Возьмите с собой все оригиналы документов и ЭЦП.' },
      { id: 'c2', label: 'Сделка прошла', text: '🎉 Поздравляю, {{имя}}! Сделка успешно завершена! Ключи скоро будут ваши. Спасибо за доверие! Буду рад рекомендациям 🙏' },
      { id: 'c3', label: 'Запрос отзыва', text: '{{имя}}, рады были помочь! Если остались довольны — буду признателен за отзыв в Google. Это очень важно для нас 🙏' },
    ]
  },
  {
    cat: '⚡ Быстрые',
    items: [
      { id: 'q1', label: 'Принято', text: 'Принято, {{имя}}! Займусь этим прямо сейчас.' },
      { id: 'q2', label: 'Перезвоню', text: '{{имя}}, перезвоню вам в течение часа.' },
      { id: 'q3', label: 'Уточняю', text: 'Уточняю информацию, {{имя}}, отвечу в ближайшее время.' },
      { id: 'q4', label: 'На связи', text: 'Всегда на связи! Пишите если есть вопросы 😊' },
      { id: 'q5', label: 'Спасибо', text: 'Спасибо за доверие, {{имя}}! 🙏' },
    ]
  },
]

// Быстрые ответы (короткий список для быстрого доступа)
const QUICK_REPLIES = MSG_TEMPLATES.find(c => c.cat.includes('Быстрые'))?.items.map(i => i.text) || []

const WA_STATUSES = [
  { id: 'all',        l: 'Все',       color: '#64748b' },
  { id: 'new',        l: 'Новые',     color: '#f59e0b' },
  { id: 'in_work',    l: 'В работе',  color: '#3b82f6' },
  { id: 'done',       l: 'Закрытые',  color: '#10b981' },
]

function WAPage({ chats, messages, managers, clients, selChat, onSelChat, onSend, onSendMedia, onImport, onAssign, onUpdateStatus, user, onOpenClient, mgrById }) {
  const [msgText,         setMsgText]         = useState('')
  const [showChatView,    setShowChatView]     = useState(false)
  const [showQR,          setShowQR]           = useState(false)
  const [showTemplates,   setShowTemplates]    = useState(false)
  const [tmplCat,         setTmplCat]          = useState(0)
  const [tmplSearch,      setTmplSearch]       = useState('')
  const [showNewLead,     setShowNewLead]       = useState(false)
  const [showClientPanel, setShowClientPanel]  = useState(false)
  const [showAssignDlg,   setShowAssignDlg]    = useState(false)
  const [waSearch,        setWaSearch]         = useState('')
  const [quickReplies,    setQuickReplies]     = useState([])
  const [showQuickMenu,   setShowQuickMenu]    = useState(false)
  const [quickFilter,     setQuickFilter]      = useState('')
  const debouncedSearch = useDebounce(waSearch, 150)  // 150ms debounce
  const [waFilter,        setWaFilter]         = useState('all')   // all | new | in_work | done
  const [waMgrFilter,     setWaMgrFilter]      = useState('')      // '' = все
  const [nLead, setNLead] = useState({ fio:'', phone:'', iin:'', source:'whatsapp', assignTo:'', msg:'', city:'Алматы', contactStatus:'', creditStatus:'good' })
  const msgsEndRef = useRef(null)
  const inputRef   = useRef(null)
  const fileRef    = useRef(null)

  const totalUnread  = chats.reduce((s,c) => s+(c.unread_count||0), 0)
  const linkedClient = selChat ? clients.find(c => c.id === selChat.client_id) : null

  // Загружаем быстрые ответы один раз
  useEffect(() => {
    api.getCalcSettings().then(d => {
      if (d?.replies?.length) setQuickReplies(d.replies.filter(r => r.active !== false))
    }).catch(() => {})
  }, [])

  // Логика быстрого меню через /
  function handleMsgChange(val) {
    setMsgText(val)
    if (val === '/' || (val.startsWith('/') && val.length <= 30)) {
      const q = val.slice(1).toLowerCase()
      setQuickFilter(q)
      setShowQuickMenu(true)
    } else {
      setShowQuickMenu(false)
      setQuickFilter('')
    }
  }

  function applyQuickReply(r) {
    const client = linkedClient
    let text = r.body
    if (client) {
      text = text
        .replace(/\{\{имя\}\}/g,      client.fio?.split(' ')[0] || client.fio || '')
        .replace(/\{\{менеджер\}\}/g,  user?.name || '')
        .replace(/\{\{сумма\}\}/g,     client.contract_amount ? Math.round(client.contract_amount).toLocaleString('ru') + ' ₸' : '')
        .replace(/\{\{программа\}\}/g, client.contract_type || '')
    }
    text = text.replace(/\{\{менеджер\}\}/g, user?.name || '')
    setMsgText(text)
    setShowQuickMenu(false)
    setQuickFilter('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const filteredQuickReplies = quickReplies.filter(r => {
    if (!quickFilter) return true
    return r.trigger.toLowerCase().includes(quickFilter) ||
           r.title.toLowerCase().includes(quickFilter)
  })

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
    setShowTemplates(false)
    inputRef.current?.focus()
  }

  // Подставляет переменные шаблона из данных клиента/чата/менеджера
  function applyTemplate(text) {
    const lc  = linkedClient
    const mgr = mgrById[selChat?.assigned_to]
    const now = new Date()
    const dateStr = now.toLocaleDateString('ru', { day:'numeric', month:'long' })
    const timeStr = now.toLocaleTimeString('ru', { hour:'2-digit', minute:'2-digit' })
    let result = text
      .replace(/{{имя}}/g,     lc?.fio?.split(' ')[0] || selChat?.name?.split(' ')[0] || 'клиент')
      .replace(/{{фио}}/g,     lc?.fio || selChat?.name || 'клиент')
      .replace(/{{менеджер}}/g, mgr?.name || user?.name || 'менеджер')
      .replace(/{{телефон}}/g,  lc?.phone || selChat?.phone || '')
      .replace(/{{банк}}/g,     lc?.depositBank || 'банк')
      .replace(/{{сумма}}/g,    lc?.contractAmount ? fmtN(lc.contractAmount) : '___')
      .replace(/{{дата}}/g,     dateStr)
      .replace(/{{время}}/g,    timeStr)
      .replace(/{{этап}}/g,     lc?.stage || '')
    return result
  }

  function useTemplate(tmpl) {
    const applied = applyTemplate(tmpl.text)
    setMsgText(applied)
    setShowTemplates(false)
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
    Promise.resolve(onSendMedia(selChat.id, selChat.phone, file, caption))
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
    <div className={"wa-sidebar" + (showChatView ? " slide-out" : "")}>
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
                {chat.name?.[0]?.toUpperCase()||'?'}
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
    <div className={"wa-main" + (!showChatView ? " slide-out" : "")}>
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
            <button aria-label="Назад к списку чатов" onClick={backToList} style={{border:'none',background:'rgba(255,255,255,.15)',color:'#fff',borderRadius:8,width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
              <i className="ti ti-arrow-left" style={{fontSize:18}}/>
            </button>
            <div style={{width:38,height:38,borderRadius:'50%',background:'rgba(255,255,255,.2)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:16,flexShrink:0}}>
              {selChat.name?.[0]?.toUpperCase()||'?'}
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
              : <button onClick={()=>{
                    // Автозаполняем из данных чата
                    setNLead(x=>({
                      ...x,
                      phone: selChat.phone || '',
                      fio:   selChat.name && !selChat.name.startsWith('+') ? selChat.name : '',
                      msg:   messages.slice(-3).map(m=>m.body).filter(Boolean).join(' / ') || '',
                    }))
                    setShowNewLead(true)
                  }}
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

          {/* Панель шаблонов */}
          {showTemplates && (
            <div style={{background:'#fff',borderTop:'1.5px solid #e2e8f0',display:'flex',flexDirection:'column',maxHeight:340,flexShrink:0}}>
              {/* Поиск по шаблонам */}
              <div style={{padding:'8px 10px',borderBottom:'1px solid #f1f5f9',display:'flex',gap:8,alignItems:'center'}}>
                <i className="ti ti-search" style={{color:'#94a3b8',fontSize:14,flexShrink:0}}/>
                <input
                  value={tmplSearch}
                  onChange={e=>setTmplSearch(e.target.value)}
                  placeholder="Поиск по шаблонам..."
                  style={{flex:1,border:'none',outline:'none',fontSize:13,color:'#0f172a',fontFamily:'inherit'}}
                />
                {tmplSearch && <button onClick={()=>setTmplSearch('')} style={{border:'none',background:'transparent',color:'#94a3b8',cursor:'pointer',fontSize:16}}>×</button>}
              </div>
              {/* Категории */}
              {!tmplSearch && (
                <div style={{display:'flex',gap:4,padding:'7px 10px',borderBottom:'1px solid #f1f5f9',overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
                  {MSG_TEMPLATES.map((cat,i) => (
                    <button key={i} onClick={()=>setTmplCat(i)}
                      style={{padding:'4px 10px',borderRadius:20,border:'none',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'inherit',whiteSpace:'nowrap',flexShrink:0,
                        background:tmplCat===i?'#3b82f6':'#f1f5f9',color:tmplCat===i?'#fff':'#64748b',transition:'all .15s'}}>
                      {cat.cat}
                    </button>
                  ))}
                </div>
              )}
              {/* Список шаблонов */}
              <div style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch'}}>
                {(() => {
                  const items = tmplSearch
                    ? MSG_TEMPLATES.flatMap(c=>c.items).filter(t=>t.label.toLowerCase().includes(tmplSearch.toLowerCase())||t.text.toLowerCase().includes(tmplSearch.toLowerCase()))
                    : MSG_TEMPLATES[tmplCat]?.items || []
                  return items.length === 0
                    ? <div style={{padding:'20px',textAlign:'center',color:'#94a3b8',fontSize:13}}>Ничего не найдено</div>
                    : items.map(tmpl => (
                      <div key={tmpl.id} onClick={()=>useTemplate(tmpl)}
                        style={{padding:'10px 12px',borderBottom:'1px solid #f8fafc',cursor:'pointer',transition:'background .1s'}}
                        onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <div style={{fontWeight:700,fontSize:12,color:'#3b82f6',marginBottom:3}}>{tmpl.label}</div>
                        <div style={{fontSize:12,color:'#374151',lineHeight:1.4,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>
                          {tmpl.text}
                        </div>
                      </div>
                    ))
                })()}
              </div>
              {/* Подсказка про переменные */}
              <div style={{padding:'6px 12px',background:'#f8fafc',borderTop:'1px solid #f1f5f9',fontSize:10,color:'#94a3b8'}}>
                <i className="ti ti-info-circle" style={{marginRight:4}}/>
                Переменные подставляются автоматически: {{имя}}, {{банк}}, {{сумма}}, {{дата}}
              </div>
            </div>
          )}

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
            {/* Шаблоны сообщений */}
            <button onClick={()=>{setShowTemplates(!showTemplates);setShowQR(false)}} title="Шаблоны сообщений"
              style={{width:38,height:38,borderRadius:'50%',border:'none',background:showTemplates?'#3b82f6':'#e9e9e9',color:showTemplates?'#fff':'#555',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,transition:'all .15s'}}>
              <i className="ti ti-template" style={{fontSize:18}}/>
            </button>
            {/* Быстрые ответы */}
            <button onClick={()=>{setShowQR(!showQR);setShowTemplates(false)}} title="Быстрые ответы"
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
              onChange={e=>handleMsgChange(e.target.value)}
              placeholder="Написать сообщение... (/ для быстрых ответов)"
              rows={1}
              onKeyDown={e=>{
                if(showQuickMenu && (e.key==='ArrowDown'||e.key==='ArrowUp'||e.key==='Escape')){
                  if(e.key==='Escape'){setShowQuickMenu(false);setMsgText('')}
                  e.preventDefault(); return
                }
                if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(!showQuickMenu)sendMsg()}
              }}
              style={{minHeight:40}}
            />

            {/* ─── Меню быстрых ответов через / ─── */}
            {showQuickMenu && filteredQuickReplies.length > 0 && (
              <div style={{position:'absolute',bottom:'100%',left:0,right:0,marginBottom:6,
                background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:14,
                boxShadow:'0 8px 30px rgba(0,0,0,.15)',overflow:'hidden',zIndex:100,maxHeight:320,overflowY:'auto'}}>
                <div style={{padding:'8px 12px',background:'#f8fafc',borderBottom:'1px solid #f1f5f9',
                  fontSize:11,color:'#64748b',fontWeight:600}}>
                  ⚡ Быстрые ответы — введите / и начните набирать
                </div>
                {filteredQuickReplies.map(r => (
                  <div key={r.id} onClick={()=>applyQuickReply(r)}
                    style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 14px',cursor:'pointer',
                      borderBottom:'1px solid #f8fafc',transition:'background .1s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#f0fdf4'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <div style={{fontFamily:'monospace',fontWeight:700,fontSize:12,color:'#3b82f6',
                      background:'#eff6ff',padding:'2px 7px',borderRadius:5,flexShrink:0,marginTop:1}}>
                      {r.trigger}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:12,color:'#0f172a',marginBottom:2}}>{r.title}</div>
                      <div style={{fontSize:11,color:'#94a3b8',overflow:'hidden',textOverflow:'ellipsis',
                        whiteSpace:'nowrap'}}>{r.body.slice(0,60)}...</div>
                    </div>
                  </div>
                ))}
                <div style={{padding:'6px 12px',background:'#f8fafc',borderTop:'1px solid #f1f5f9',
                  fontSize:10,color:'#94a3b8'}}>
                  Нажмите на шаблон или Esc для закрытия
                </div>
              </div>
            )}
            {showQuickMenu && filteredQuickReplies.length === 0 && (
              <div style={{position:'absolute',bottom:'100%',left:0,right:0,marginBottom:6,
                background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:12,padding:'12px 14px',
                boxShadow:'0 4px 16px rgba(0,0,0,.1)',zIndex:100,fontSize:12,color:'#94a3b8'}}>
                Шаблоны не найдены по «/{quickFilter}». Техник добавляет шаблоны в Панели техника.
              </div>
            )}
            <button onClick={sendMsg} disabled={!msgText.trim()}
              style={{width:44,height:44,borderRadius:'50%',border:'none',background:msgText.trim()?'#25d366':'#e9e9e9',color:msgText.trim()?'#fff':'#94a3b8',display:'flex',alignItems:'center',justifyContent:'center',cursor:msgText.trim()?'pointer':'default',flexShrink:0,transition:'all .15s'}}>
              <i className="ti ti-send" style={{fontSize:20}}/>
            </button>
          </div>
        </>
      )}
    </div>
  ), [selChat, messages, showChatView, showAssignDlg, showQR, msgText, sendingFile, managers, linkedClient, showClientPanel, mgrById, showQuickMenu, filteredQuickReplies, quickFilter])

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
function TasksPage({ clients, managers, onOpen, user, onSave }) {
  const todayStr  = today()
  const [showNew, setShowNew] = useState(false)
  const [newTask, setNewTask] = useState({ text:'', due:'', clientId:'', note:'' })

  function createTask() {
    if (!newTask.text.trim()) return
    if (!newTask.clientId)    return
    const client = clients.find(c => c.id === newTask.clientId)
    if (!client) return
    const task = {
      id:         'task_' + Date.now(),
      text:       newTask.text.trim(),
      due:        newTask.due || '',
      note:       newTask.note || '',
      done:       false,
      // admin/head не привязаны к manager_id — задача создаётся без назначения,
      // менеджер клиента (client.manager) остаётся основным ответственным
      assignedTo: user?.role === 'manager' ? (user?.manager_id || '') : '',
      createdAt:  new Date().toISOString().slice(0,10),
    }
    onSave && onSave({ ...client, tasks: [...(client.tasks||[]), task] })
    setShowNew(false)
    setNewTask({ text:'', due:'', clientId:'', note:'' })
  }

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
function AdminPage({ managers, pipeline, checklists, users, user, onSaveMgr, onDelMgr, onSaveUser, onDelUser, onSavePL, onSaveCL, onModal, reload, syncing }) {
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
        {[{id:'managers',l:'👤 Менеджеры'},{id:'pipeline',l:'🔄 Воронка'},{id:'checklists',l:'✅ Чек-листы'},{id:'users',l:'🔐 Пользователи'},{id:'calc',l:'🧮 Калькулятор'},{id:'wa_replies',l:'⚡ Быстрые ответы WA'}].map(t => (
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
    </div>
  )
}

AdminPage = React.memo(AdminPage)

// ─── ПАНЕЛЬ НАСТРОЕК КАЛЬКУЛЯТОРА (техник) ────────────────────────────────────
function CalcSettingsPanel() {
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
        },
        programs: programsToSave,
      })
      await api.invalidateCalcCache().catch(()=>{})
      if (res?.ok) toast('✅ Настройки сохранены и применены сразу!')
      else toast('⚠️ Сохранено с ошибками — проверьте данные', false)
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

      {/* ── Навигация по разделам ── */}
      <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:14,background:'#f8fafc',padding:5,borderRadius:10,border:'1px solid #e2e8f0'}}>
        {[
          {id:'main',      l:'📊 Базовые'},
          {id:'progs_api', l:'🏦 API-программы'},
          {id:'progs_new', l:'🏠 Программы (новый)'},
          {id:'expenses',  l:'💸 Расходы'},
          {id:'steps',     l:'📋 Этапы'},
          {id:'mrp',       l:'📌 МРП справочник'},
        ].map(s=>(
          <button key={s.id} onClick={()=>setActiveSection(s.id)}
            style={{padding:'5px 10px',border:'none',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:500,
              background:activeSection===s.id?'#3b82f6':'transparent',
              color:activeSection===s.id?'#fff':'#64748b'}}>
            {s.l}
          </button>
        ))}
      </div>

      {/* Показываем нужную секцию */}
      {(activeSection==='main') && (<>
        {/* ── Базовые показатели (МРП и ПМ) ── уже рендерится выше ──*/}
      </>)}

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



  useEffect(() => {
    api.getCalcSettings().then(d => {
      if (d?.settings) setCfg({
        mrp:      d.settings.mrp        || 4325,
        pmNauryz: d.settings.pm_nauryz  || 10,
        pmOther:  d.settings.pm_other   || 13,
      })
      if (d?.programs?.length) setPrograms(d.programs.map(p => ({
        key:       p.key,
        name:      p.name,
        icon:      p.icon         || '🏠',
        downRatio: parseFloat(p.down_ratio) || 0.20,
        desc:      p.desc_text    || '',
        active:    p.active       !== false,
        sortOrder: p.sort_order   || 0,
        variants:  Array.isArray(p.variants) ? p.variants : [],
      })))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const setCfgF   = (k,v) => setCfg(s=>({...s,[k]:v}))
  const setProg   = (key,field,val) => setPrograms(ps => ps.map(p => p.key===key ? {...p,[field]:val} : p))
  const setVar    = (key,vi,field,val) => setPrograms(ps => ps.map(p => p.key===key
    ? {...p, variants: p.variants.map((v,i)=>i===vi?{...v,[field]:field==='coeff'?+val:val}:v)} : p))
  const addVar    = (key) => setPrograms(ps => ps.map(p => p.key===key
    ? {...p, variants:[...p.variants,{label:'',coeff:0.01}]} : p))
  const removeVar = (key,vi) => setPrograms(ps => ps.map(p => p.key===key
    ? {...p, variants:p.variants.filter((_,i)=>i!==vi)} : p))

  function addProgram() {
    const key = 'prog_'+Date.now()
    setPrograms(ps=>[...ps,{key,name:'Новая программа',icon:'🏠',downRatio:0.20,desc:'',active:true,sortOrder:ps.length,variants:[{label:'7% — 25 лет',coeff:0.00783333}]}])
    setEditKey(key)
  }

  async function deleteProgram(key) {
    if (!window.confirm('Удалить программу?')) return
    await api.deleteCalcProgram(key).catch(()=>{})
    setPrograms(ps=>ps.filter(p=>p.key!==key))
    toast('🗑 Программа удалена')
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
      setLoading(false)
    }).catch(()=>setLoading(false))
  }, [])

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
      if (res?.ok) toast('✅ Шаблоны сохранены!')
      else toast('⚠️ Сохранено с ошибками')
    } catch(e) { toast('❌ '+e.message) }
    setSaving(false)
  }

  if (loading) return <div style={{textAlign:'center',padding:40,color:'#94a3b8'}}>⏳ Загрузка...</div>

  return (
    <div style={{position:'relative'}}>
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


// ─── CLIENT DETAIL (full card) ────────────────────────────────────
function ClientDetail({ client, managers, pipeline, checklists, user, onSave, onDelete, onMove, onBack, toast$, setHasChanges, syncing }) {
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

// ─── SIMPLE MODALS ───────────────────────────────────────────────
function ModalWrap({ title, sub, onClose, children, footer, size='md' }) {
  const widths = { sm:400, md:500, lg:660, xl:980 }
  const titleId = `modal-title-${Math.random().toString(36).slice(2,7)}`
  return (
    <div role="presentation" style={{position:'fixed',inset:0,background:'rgba(15,23,42,.52)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:14,backdropFilter:'blur(4px)'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} style={{background:'#fff',borderRadius:18,boxShadow:'0 24px 80px rgba(0,0,0,.22)',width:widths[size],maxWidth:'100%',maxHeight:'92vh',display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'15px 19px',borderBottom:'1.5px solid #e2e8f0'}}>
          <div>
            <div id={titleId} style={{fontSize:16,fontWeight:800,letterSpacing:'-.3px'}}>{title}</div>
            {sub && <div style={{fontSize:11,color:'#64748b',marginTop:2}}>{sub}</div>}
          </div>
          <Btn aria-label="Закрыть диалог" onClick={onClose}><i className="ti ti-x"/></Btn>
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

const PROGRAMS = [
  { key:'5050',     name:'Ипотека 50/50',      icon:'🏛️', downRatio:0.50 },
  { key:'3070',     name:'30/70',               icon:'🏠', downRatio:0.30 },
  { key:'nauryz20', name:'Наурыз 20%',           icon:'🌸', downRatio:0.20 },
  { key:'nauryz10', name:'Наурыз 10%',           icon:'🌷', downRatio:0.10 },
  { key:'jasyl',    name:'Жасыл',                icon:'🌿', downRatio:0.20 },
  { key:'askeri',   name:'Аскери',               icon:'🎖️', downRatio:0.00 },
]

const CONTRACT_TYPES = ['Трудовой', 'ГПХ']

function fmtMoney(n) {
  if (!n && n !== 0) return '—'
  return new Intl.NumberFormat('ru').format(Math.round(n)) + ' ₸'
}

// ─── DATA ────────────────────────────────────────────────────────
const PROGS_DATA = [
  {id:'5050p', n:'50/50 Промзаём', r:8.5,  t:8,  d:0.50, grp:'g', note:'ОП=5 мес · взнос 50% · платёж по таблице'},
  {id:'5050zh',n:'50/50 Жилзаём',  r:5,    t:9,  d:0.50, grp:'g', note:'ОП=16 мес · взнос 50% · пониженная ставка'},
  {id:'720',   n:'7-20-25',        r:7,    t:25, d:0.20, grp:'g', note:'Взнос 20% · только первичка · макс 25 млн ₸ кредита'},
  {id:'otau',  n:'Отау',           r:9,    t:19, d:0.20, grp:'g', note:'Взнос 20% · молодёжь до 35 лет'},
  {id:'n20',   n:'Наурыз 20%',    r:9,    t:19, d:0.20, grp:'g', note:'Взнос 20%'},
  {id:'n10',   n:'Наурыз 10%',    r:9,    t:19, d:0.10, grp:'g', note:'Взнос 10%'},
  {id:'jsyl',  n:'Жасыл',         r:12.5, t:25, d:0.20, grp:'g', note:'Взнос 20% · эко-сертиф. ЖК'},
  {id:'shan',  n:'Шаңырақ',       r:5,    t:20, d:0.10, grp:'g', note:'Взнос 10% · только очередники акиматов'},
  {id:'baqyt', n:'Бақытты отбасы',r:2,    t:20, d:0.20, grp:'g', note:'2% · многодетные · соц. уязвимые'},
  {id:'umay',  n:'Умай ♀',        r:14.4, t:25, d:0.20, grp:'g', note:'Женщины · запуск II пол. 2026 · макс 50 млн займа'},
  {id:'ask',   n:'Аскери',        r:5,    t:20, d:0.00, grp:'g', note:'Взнос 0% · военнослужащие'},
  {id:'halyk', n:'Халык Банк',    r:20,   t:25, d:0.20, grp:'c', note:'Коммерч. · первичка · партнёры застройщики'},
  {id:'forte', n:'ForteBank',     r:21,   t:25, d:0.20, grp:'c', note:'Коммерч. · первичка и вторичка'},
  {id:'free',  n:'Freedom Bank',  r:20,   t:25, d:0.20, grp:'c', note:'Коммерч. · цифровая ипотека'},
]

const D50 = [
  [10000000,50000,80523,160000,80573],[11000000,55000,88575,176000,88572],[12000000,60000,96627,192000,96627],
  [13000000,65000,104679,208000,104679],[14000000,70000,112731,224000,112731],[15000000,75000,120783,240000,120783],
  [16000000,80000,128836,256000,128836],[17000000,85000,136888,272000,136888],[18000000,90000,144941,288000,144940],
  [19000000,95000,152993,304000,152993],[20000000,100000,161045,320000,161045],[21000000,105000,169098,336000,169098],
  [22000000,110000,177150,352000,177150],[23000000,115000,185202,368000,185202],[24000000,120000,193255,384000,193255],
  [25000000,125000,201307,400000,201307],[26000000,130000,209359,416000,209359],[27000000,135000,217411,432000,217411],
  [28000000,140000,225464,448000,225464],[29000000,145000,233516,464000,233516],[30000000,150000,241568,480000,241568],
  [31000000,155000,249620,496000,249620],[32000000,160000,257673,512000,257673],[33000000,165000,265725,528000,265725],
  [34000000,170000,273777,544000,273777],[35000000,175000,281829,560000,281829],[36000000,180000,289882,576000,289882],
  [37000000,185000,297934,592000,297934],[38000000,190000,305986,608000,305986],[39000000,195000,314039,624000,314039],
  [40000000,200000,322091,640000,322091],[41000000,205000,330143,656000,330143],[42000000,210000,338195,672000,338195],
  [43000000,215000,346248,688000,346248],[44000000,220000,354300,704000,354300],[45000000,225000,362352,720000,362352],
  [46000000,230000,370404,736000,370404],[47000000,235000,378457,752000,378457],[48000000,240000,386509,768000,386509],
  [49000000,245000,394561,784000,394561],[50000000,250000,402614,800000,402614],[51000000,255000,410666,816000,410666],
  [52000000,260000,418718,832000,418718],[53000000,265000,426770,848000,426770],[54000000,270000,434823,864000,434823],
  [55000000,275000,442875,880000,442875],[56000000,280000,450927,896000,450927],[57000000,285000,458979,912000,458979],
  [58000000,290000,467032,928000,467032],[59000000,295000,475084,944000,475084],[60000000,300000,483136,960000,483136],
  [61000000,305000,491189,976000,491189],[62000000,310000,499241,992000,499241],[63000000,315000,507293,1008000,507293],
  [64000000,320000,515345,1024000,515345],[65000000,325000,523398,1040000,523398],[66000000,330000,531450,1056000,531450],
  [67000000,335000,539502,1072000,539502],
]

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
  {n:'Подписание договоров ДЗНИ, ДБЗ, ДЗЖСС', sub:'Блок чейн таырасо · Форма 2 уверенное · документы до 13:00', cost:''},
  {n:'Вынесение текущего счёта, комиссия банка', sub:'', cost:''},
  {n:'Регистрация ДЗНИ у нотариуса', sub:'Регистрация 23 788 + Заявление 2 292 + Согласие 6 488', cost:'32 568 ₸ (+ ускоренно 7 085 ₸)'},
  {n:'Выдача — перевод денег продавцу', sub:'Страховка · Календарь и график берегите клиента · После одобрения — базар', cost:'Страховка ~0.3%/год от цены'},
]

// ─── HELPERS ─────────────────────────────────────────────────────
function annuity(pr, ra, mo) {
  if (!ra) return pr / mo
  const r = ra / 12 / 100
  return pr * r * Math.pow(1 + r, mo) / (Math.pow(1 + r, mo) - 1)
}
function buildSch(pr, ra, mo) {
  const r = ra / 12 / 100, pm = annuity(pr, ra, mo)
  let b = pr, ci = 0
  return Array.from({ length: mo }, (_, i) => {
    const in_ = b * r, bo = pm - in_
    b = Math.max(0, b - bo); ci += in_
    return { n: i + 1, pm, bo, in_, b, ci }
  })
}
function fmtK(n) { return Math.round(n).toLocaleString('ru-KZ') }
function fmtM(n) { return fmtK(n) + ' ₸' }
function kdColor(kd) { return kd <= 0.4 ? '#0F6E56' : kd <= 0.5 ? '#854F0B' : '#993C1D' }
function kdText(kd) { return kd <= 0.4 ? 'Отлично — одобрение вероятно' : kd <= 0.5 ? 'Пограничный КД — нужно подтверждение' : 'КД > 50% — высокий риск отказа' }

// ─── CALC PAGE ───────────────────────────────────────────────────
function CalcPage({ user, clients, toast$ }) {
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
      </div>

      {/* Новый калькулятор — вкладки */}
      <div style={{fontSize:10,fontWeight:600,color:'#94a3b8',marginBottom:4,letterSpacing:'.06em'}}>НОВЫЙ КАЛЬКУЛЯТОР</div>
      <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:6,background:'#f8fafc',padding:4,borderRadius:12,border:'1px solid #e2e8f0'}}>
        {newTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{flex:'1',minWidth:64,padding:'6px 3px',border:'none',borderRadius:8,cursor:'pointer',fontSize:10,fontWeight:500,
              background: tab===t.id ? '#fff' : 'transparent',
              color: tab===t.id ? '#0f172a' : '#64748b',
              boxShadow: tab===t.id ? '0 1px 3px rgba(0,0,0,.06)' : 'none',
              transition:'all .15s', whiteSpace:'nowrap'}}>
            <i className={`ti ${t.icon}`} style={{fontSize:12,marginRight:2}}/>{t.l}
          </button>
        ))}
      </div>

      {/* Старый калькулятор — вкладки */}
      <div style={{fontSize:10,fontWeight:600,color:'#94a3b8',marginBottom:4,letterSpacing:'.06em'}}>РАСЧЁТЫ ЧЕРЕЗ API</div>
      <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:16,background:'#f8fafc',padding:4,borderRadius:12,border:'1px solid #e2e8f0'}}>
        {oldTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{flex:'1',minWidth:80,padding:'6px 4px',border:'none',borderRadius:8,cursor:'pointer',fontSize:11,fontWeight:500,
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
      {tab==='t50'      && <Calc50Tab/>}
      {tab==='pay'      && <CalcPayTab/>}
      {tab==='cmp'      && <CalcCmpTab/>}
      {tab==='early'    && <CalcEarlyTab/>}
      {tab==='inc'      && <CalcIncTab/>}
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
    const tbl = D50.find(d => Math.abs(d[0] - credit) < 1000001)
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
            style={{padding:'8px 7px',border:`1px solid ${selP===pg.id?'#1D9E75':'#e2e8f0'}`,borderRadius:10,cursor:'pointer',
              background:selP===pg.id?'#E1F5EE':'#fff',textAlign:'left',transition:'all .15s'}}>
            <div style={{fontSize:11,fontWeight:500,color:'#0f172a'}}>{pg.n}</div>
            <div style={{fontSize:10,color:'#64748b',marginTop:1}}>{pg.r}% · до {pg.t} лет</div>
            <div style={{fontSize:10,color:'#0F6E56',marginTop:1}}>ПВ {Math.round(pg.d*100)}%</div>
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
            {[['Платёж/мес',fmtM(res.pm),'#0F6E56'],['Кредит',fmtM(res.credit),'#0f172a'],['Взнос',fmtM(res.down),'#0f172a'],['Итого',fmtM(res.tot),'#0f172a']].map(([l,v,col])=>(
              <div key={l} style={C.met}><div style={C.ml}>{l}</div><div style={{...C.mv,color:col}}>{v}</div></div>
            ))}
          </div>

          {res.tbl && (
            <div style={{...C.note('#E1F5EE','#5DCAA5','#085041')}}>
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
          <input type="number" value={price} onChange={e=>setPrice(+e.target.value)}
            style={{width:140,padding:'4px 8px',border:'1px solid #e2e8f0',borderRadius:8,textAlign:'right',fontSize:12,background:'#fff',color:'#0f172a'}}/>
        </div>
        <div style={{...C.row,borderBottom:'1px solid #f8fafc',paddingTop:8}}>
          <span style={C.rk}>Первоначальный взнос</span>
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            {[0,10,20,30,50].map(p=>(
              <button key={p} onClick={()=>setDnPct(p)}
                style={{padding:'3px 8px',border:`1px solid ${dnPct===p?'#1D9E75':'#e2e8f0'}`,borderRadius:6,cursor:'pointer',
                  background:dnPct===p?'#E1F5EE':'#fff',fontSize:10,fontWeight:500,color:dnPct===p?'#0F6E56':'#64748b'}}>
                {p}%
              </button>
            ))}
          </div>
        </div>
        <div style={{...C.row,borderBottom:'1px solid #f8fafc'}}><span style={C.rk}>Сумма взноса</span><span style={{...C.rv,color:'#0F6E56'}}>{fmtM(down)}</span></div>
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
        <div style={{...C.row,borderBottom:'1px solid #f8fafc'}}><span style={C.rk}>Первоначальный взнос ({dnPct}%)</span><span style={{...C.rv,color:'#0F6E56'}}>{fmtM(down)}</span></div>
        <div style={{...C.row,borderBottom:'none'}}><span style={C.rk}>Расходы на оформление</span><span style={{...C.rv,color:'#993C1D'}}>{fmtM(oblig)}</span></div>
        <div style={C.tot('#E1F5EE','#0F6E56')}><span style={{fontSize:13}}>ИТОГО</span><span style={{fontSize:18}}>{fmtM(need)}</span></div>
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
function Calc50Tab() {
  const [search, setSearch] = useState('')
  const q = +search
  const data = q ? D50.filter(r => Math.abs(r[0] - q) < 3000001) : D50
  return (
    <div>
      <div style={{...C.note('#E6F1FB','#85B7EB','#0C447C')}}>
        Промзаём ~8 лет (ОП=5 мес.) · Жилзаём ~9 лет (ОП=16 мес.) — точные данные из вашей таблицы
      </div>
      <div style={C.card}>
        <div style={C.sec}>Поиск по сумме</div>
        <input type="number" placeholder="Введите договорную сумму, напр. 24000000"
          value={search} onChange={e=>setSearch(e.target.value)}
          style={{width:'100%',padding:'8px 12px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:13,background:'#fff',color:'#0f172a'}}/>
      </div>
      <div style={{border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden'}}>
        <div style={{maxHeight:420,overflowY:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
            <thead>
              <tr style={{position:'sticky',top:0,background:'#fff'}}>
                <th style={{padding:'7px 8px',textAlign:'left',fontSize:10,fontWeight:600,color:'#64748b',borderBottom:'1px solid #e2e8f0'}}>Дог. сумма</th>
                <th style={{padding:'7px 8px',textAlign:'right',fontSize:10,fontWeight:600,color:'#854F0B',borderBottom:'1px solid #e2e8f0'}}>ОПВ (ОП=5)</th>
                <th style={{padding:'7px 8px',textAlign:'right',fontSize:10,fontWeight:600,color:'#0F6E56',borderBottom:'1px solid #e2e8f0'}}>Платёж 8.5%</th>
                <th style={{padding:'7px 8px',textAlign:'right',fontSize:10,fontWeight:600,color:'#854F0B',borderBottom:'1px solid #e2e8f0'}}>ОПВ (ОП=16)</th>
                <th style={{padding:'7px 8px',textAlign:'right',fontSize:10,fontWeight:600,color:'#0F6E56',borderBottom:'1px solid #e2e8f0'}}>Платёж 5%</th>
              </tr>
            </thead>
            <tbody>
              {data.map(([s,o5,p85,o16,p5]) => {
                const hi = q && Math.abs(s-q) < 1000001
                return (
                  <tr key={s} style={{background:hi?'#E1F5EE':'transparent'}}>
                    <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc',fontWeight:hi?500:400,color:'#0f172a'}}>{fmtK(s)}{hi&&' ←'}</td>
                    <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc',textAlign:'right',color:'#854F0B'}}>{fmtK(o5)}</td>
                    <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc',textAlign:'right',color:'#0F6E56',fontWeight:500}}>{fmtK(p85)}</td>
                    <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc',textAlign:'right',color:'#854F0B'}}>{fmtK(o16)}</td>
                    <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc',textAlign:'right',color:'#0F6E56',fontWeight:500}}>{fmtK(p5)}</td>
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
function CalcPayTab() {
  const [cr, setCr]     = useState(24000000)
  const [rate, setRate] = useState(8.5)
  const [term, setTerm] = useState(8)
  const [yrFlt, setYrFlt] = useState(null)

  const mo = term * 12
  const pm = annuity(cr, rate, mo)
  const tot = pm * mo, ov = tot - cr
  const r = rate / 12 / 100
  const sch = buildSch(cr, rate, mo)
  const filtSch = yrFlt ? sch.filter(row => Math.ceil(row.n/12) === yrFlt) : sch
  const tbl = D50.find(d => Math.abs(d[0]-cr) < 1000001)
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
          {[[5,'Жилзаём'],[7,'Наурыз'],[8.5,'Промзаём'],[9,'Отау'],[20,'Коммерч.']].map(([rv,l])=>(
            <button key={rv} onClick={()=>setRate(rv)}
              style={{padding:'4px 8px',border:`1px solid ${rate===rv?'#1D9E75':'#e2e8f0'}`,borderRadius:6,cursor:'pointer',
                background:rate===rv?'#E1F5EE':'#fff',fontSize:10,fontWeight:500,color:rate===rv?'#0F6E56':'#64748b'}}>
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
              style={{padding:'4px 8px',border:`1px solid ${term===tv?'#1D9E75':'#e2e8f0'}`,borderRadius:6,cursor:'pointer',
                background:term===tv?'#E1F5EE':'#fff',fontSize:10,fontWeight:500,color:term===tv?'#0F6E56':'#64748b'}}>
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
        {[['Платёж/мес',fmtM(pm),'#0F6E56'],['Кредит',fmtM(cr),'#0f172a'],['Переплата',fmtM(ov),'#854F0B'],['Итого',fmtM(tot),'#0f172a']].map(([l,v,col])=>(
          <div key={l} style={C.met}><div style={C.ml}>{l}</div><div style={{...C.mv,color:col}}>{v}</div></div>
        ))}
      </div>

      {tbl && (
        <div style={{...C.note('#E1F5EE','#5DCAA5','#085041')}}>
          <b>По таблице 50/50</b> (~{fmtK(tbl[0])} ₸): Промзаём 8.5% = <b>{fmtM(tbl[2])}/мес</b> · Жилзаём 5% = <b>{fmtM(tbl[4])}/мес</b>
        </div>
      )}

      <div style={C.card}>
        <div style={C.sec}>Разбивка первого платежа</div>
        {[['Проценты (1-й мес.)',fmtM(cr*r),'#854F0B'],['Тело долга (1-й мес.)',fmtM(pm-cr*r),'#0F6E56'],
          ['Тело за 1-й год',fmtM(sch.slice(0,12).reduce((s,x)=>s+x.bo,0)),'#0F6E56'],
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
                style={{padding:'3px 7px',border:`1px solid ${yrFlt===y?'#1D9E75':'#e2e8f0'}`,borderRadius:6,cursor:'pointer',
                  background:yrFlt===y?'#E1F5EE':'#fff',fontSize:10,color:yrFlt===y?'#0F6E56':'#64748b'}}>
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
                    <td style={{padding:'4px 7px',borderBottom:'1px solid #f8fafc',color:'#0F6E56'}}>{fmtK(row.bo)}</td>
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
function CalcCmpTab() {
  const [price, setPrice] = useState(30000000)
  const [term, setTerm]   = useState(17)
  const gov = PROGS_DATA.filter(p=>p.grp==='g')
  const com = PROGS_DATA.filter(p=>p.grp==='c')

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
          <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc',color:'#0F6E56',fontWeight:500}}>{fmtK(pm)} ₸</td>
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
          <div style={{...C.mv,color:'#0F6E56'}}>{fmtM(pm+extra)}/мес</div>
          <div style={{fontSize:10,color:'#64748b',marginTop:4}}>Переплата: {fmtM(ovE)}<br/>Итого: {fmtM(totE)}</div>
        </div>
      </div>
      <div style={{...C.card,background:'#E1F5EE',border:'1px solid #5DCAA5'}}>
        <div style={{...C.sec,color:'#085041',borderColor:'#9FE1CB'}}>Выгода от досрочного погашения</div>
        {[
          ['Экономия на процентах', fmtM(saved), '#0F6E56'],
          ['Срок сокращается на', savedMo + ' мес. (' + (savedMo/12).toFixed(1) + ' лет)', '#0F6E56'],
          ['Новый срок', moE + ' мес. (' + (moE/12).toFixed(1) + ' лет)', '#0f172a'],
          ['Закроете ипотеку в', closeDate, '#0f172a'],
        ].map(([k,v,col]) => (
          <div key={k} style={{...C.row,borderBottom:'1px solid #9FE1CB'}}><span style={C.rk}>{k}</span><span style={{...C.rv,color:col}}>{v}</span></div>
        ))}
      </div>
    </div>
  )
}

// ─── TAB: ПО ДОХОДУ ───────────────────────────────────────────────
function CalcIncTab() {
  const [inc, setInc]   = useState(500000)
  const [oc, setOc]     = useState(0)
  const [kdL, setKdL]   = useState(50)
  const maxPmt = inc * kdL / 100 - oc
  const gov = PROGS_DATA.filter(p => p.grp === 'g')
  const com = PROGS_DATA.filter(p => p.grp === 'c')

  function TblRows({ progs }) {
    return progs.map(p => {
      const maxCr = Math.round(maxPmt / annuity(1, p.r, p.t * 12))
      const maxP = Math.round(maxCr / (1 - p.d))
      return maxCr > 0 ? (
        <tr key={p.id}>
          <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc',fontWeight:500}}>{p.n}</td>
          <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc'}}>{p.r}%</td>
          <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc'}}>{fmtM(maxPmt)}</td>
          <td style={{padding:'5px 8px',borderBottom:'1px solid #f8fafc',color:'#0F6E56',fontWeight:500}}>{fmtM(maxCr)}</td>
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
      <div style={{...C.note('#E1F5EE','#5DCAA5','#085041')}}>Введите доход — покажу максимальную цену квартиры по каждой программе.</div>
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
                style={{padding:'4px 10px',border:`1px solid ${kdL===kv?'#1D9E75':'#e2e8f0'}`,borderRadius:6,cursor:'pointer',
                  background:kdL===kv?'#E1F5EE':'#fff',fontSize:11,fontWeight:500,color:kdL===kv?'#0F6E56':'#64748b'}}>
                {kv}%
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{...C.met,marginBottom:12}}>
        <div style={C.ml}>Макс. платёж при КД {kdL}%</div>
        <div style={{...C.mv,color:'#0F6E56'}}>{fmtM(Math.max(0,maxPmt))}/мес</div>
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
  let savAcc = down
  for (let m = 0; m < mo; m++) savAcc = savAcc * (1 + sav / 12 / 100) + (diff > 0 ? diff : 0)
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
        <Sl label="Депозит % год." min={3} max={20} step={0.5} val={sav} onChange={setSav} fmt={v=>v.toFixed(1)+'%'}/>
        <div style={C.sep}/>
        <Sl label="Рост цен недвиж. % год." min={0} max={20} step={1} val={grow} onChange={setGrow} fmt={v=>v+'%'}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
        <div style={C.met}>
          <div style={C.ml}>🏠 Ипотека / мес</div>
          <div style={C.mv}>{fmtM(pm)}</div>
          <div style={{fontSize:10,color:'#64748b',marginTop:4}}>Выплат: {fmtM(tot)}<br/>Переплата: {fmtM(ov)}<br/>Цена через {term}л: {fmtM(finalP)}<br/><b style={{color:'#0F6E56'}}>Актив: {fmtM(netI)}</b></div>
        </div>
        <div style={C.met}>
          <div style={C.ml}>🏘️ Аренда / мес</div>
          <div style={C.mv}>{fmtM(rent)}</div>
          <div style={{fontSize:10,color:'#64748b',marginTop:4}}>Аренда за {term}л: {fmtM(rent*mo)}<br/>Разница: {fmtM(Math.abs(diff))}<br/><br/><b style={{color:'#0F6E56'}}>Накопления: {fmtM(savAcc)}</b></div>
        </div>
      </div>
      <div style={{...C.note(winner?'#E1F5EE':'#FAEEDA', winner?'#5DCAA5':'#FAC775', winner?'#085041':'#633806')}}>
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
        <div style={{width:(done.size/steps.length*100).toFixed(1)+'%',height:'100%',background:'#1D9E75',borderRadius:2,transition:'width .3s'}}/>
      </div>

      <div style={C.card}>
        {steps.map((s,i) => (
          <div key={i} style={{display:'flex',gap:10,padding:'8px 0',borderBottom:i<steps.length-1?'1px solid #f8fafc':'none'}}>
            <div onClick={()=>toggle(i)}
              style={{width:22,height:22,borderRadius:'50%',flexShrink:0,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:500,transition:'all .15s',
                background:done.has(i)?'#1D9E75':'#E1F5EE',color:done.has(i)?'#fff':'#0F6E56',border:'1px solid '+(done.has(i)?'#1D9E75':'#5DCAA5')}}>
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

const OLD_PROGRAMS = [
  { key:'5050',     name:'Ипотека 50/50',      icon:'🏛️', downRatio:0.50 },
  { key:'3070',     name:'30/70',               icon:'🏠', downRatio:0.30 },
  { key:'nauryz20', name:'Наурыз 20%',           icon:'🌸', downRatio:0.20 },
  { key:'nauryz10', name:'Наурыз 10%',           icon:'🌷', downRatio:0.10 },
  { key:'jasyl',    name:'Жасыл',                icon:'🌿', downRatio:0.20 },
  { key:'askeri',   name:'Аскери',               icon:'🎖️', downRatio:0.00 },
]

function CalcMortgageTab({ doCalc, clients }) {
  const [mode,    setMode]    = useState('price')
  const [program, setProgram] = useState('nauryz20')
  const [price,   setPrice]   = useState('')
  const [salary,  setSalary]  = useState('')
  const [members, setMembers] = useState('1')
  const [oldCred, setOldCred] = useState('')
  const [result,  setResult]  = useState(null)
  const [busy,    setBusy]    = useState(false)
  const prog = OLD_PROGRAMS.find(p => p.key === program)

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
    <input className="inp" type="number" placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}
      style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:10,padding:'10px 12px',color:'#0f172a',fontSize:14,width:'100%',marginBottom:8}}/>
  )

  return (
    <div>
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
        {OLD_PROGRAMS.map(p=>(
          <button key={p.key} onClick={()=>setProgram(p.key)}
            style={{padding:'8px 6px',border:`1.5px solid ${program===p.key?'#3b82f6':'#e2e8f0'}`,borderRadius:10,cursor:'pointer',
              background:program===p.key?'#eff6ff':'#fff',textAlign:'left'}}>
            <div style={{fontSize:12,fontWeight:500}}>{p.icon} {p.name}</div>
            <div style={{fontSize:10,color:'#64748b',marginTop:2}}>ПВ {Math.round(p.downRatio*100)}%</div>
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
            <input type="number" value={oldCred} onChange={e=>setOldCred(e.target.value)} placeholder="0"
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
    return (
      <div style={{background:'#fef2f2',border:'1.5px solid #fecaca',borderRadius:12,padding:14}}>
        <div style={{fontSize:13,color:'#dc2626',fontWeight:700}}>❌ Доход недостаточен для программы {result.prog?.name || prog?.name}</div>
        <div style={{fontSize:12,color:'#64748b',marginTop:6}}>Метод 1 (КД): {Math.round(result.method1||0).toLocaleString('ru-RU')} ₸ · Метод 2 (ПМ): {Math.round(result.method2||0).toLocaleString('ru-RU')} ₸</div>
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
                <input type="number" value={o.income} onChange={e=>setOrg(i,'income',e.target.value)} placeholder="300 000"
                  style={{width:'100%',padding:'8px 10px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:13,background:'#fff',color:'#0f172a'}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:'#64748b',marginBottom:3}}>Кредиты/мес (₸)</div>
                <input type="number" value={o.oldCredit} onChange={e=>setOrg(i,'oldCredit',e.target.value)} placeholder="0"
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
              <input value={target} onChange={e=>setTarget(e.target.value)} type="number"
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
                <input value={income} onChange={e=>setIncome(e.target.value)} type="number" placeholder="300 000"
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
              <input value={salaryBuh} onChange={e=>setSalaryBuh(e.target.value)} type="number" placeholder="300 000"
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
          <input type="number" value={salary}
            onChange={e=>{setSalary(e.target.value);setResult(null);setErr('')}}
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
          <input type="number" value={buhFee}
            onChange={e=>setBuhFee(e.target.value)}
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
    const prog = PROGRAMS.find(p => p.key === program)
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

  const prog = PROGRAMS.find(p => p.key === program)

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
          {PROGRAMS.map(p => (
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

          {/* Кнопка отправить в WhatsApp */}
          {c.phone && (
            <button
              onClick={sendToWA}
              disabled={sending}
              style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                padding:'12px',borderRadius:12,border:'none',cursor:sending?'not-allowed':'pointer',
                background: sending ? '#94a3b8' : '#25d366',
                color:'#fff',fontFamily:'inherit',fontWeight:700,fontSize:14,marginTop:4,transition:'all .15s'}}>
              {sending
                ? <><i className="ti ti-loader-2 spin" style={{fontSize:16}}/> Отправляю...</>
                : <><i className="ti ti-brand-whatsapp" style={{fontSize:18}}/> Отправить расчёт клиенту в WhatsApp</>
              }
            </button>
          )}
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
