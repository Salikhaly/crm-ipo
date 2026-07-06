// pages/index.js
// Главная страница CRM — полный UI подключённый к бэкенду через /api/*

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Head from 'next/head'
import { api } from '../lib/api'
import {
  PROGRAMS_FALLBACK, getPrograms,
  annuity, buildSch, fmtMoney, fmtK, fmtM,
  kdColor, kdText, avgSalary,
  D50_FALLBACK, getD50,
} from '../lib/calcData'
import {
  WA_CHATS_POLL_MS, WA_MESSAGES_POLL_MS, MIN_SEARCH_LENGTH, MAX_FILE_SIZE_BYTES,
  PIPELINE_DEFAULT, ACCOMP, CONTRACTS, CT, SRCS, SRC, CR_ST, CR, ROLES, ROLE,
  CONTACT_ST, CITIES, MARITAL, WORK_T, DOWN_T, TASK_T, COLORS,
  TI, TC, TB, TL, PAY_ST, uid, fmt, today, nowStr, emptyClient,
} from '../lib/constants'
import {
  Fl, Tag, StTag, SrTag, CrTag, Tgl, Prog, Inp, Sel, Btn,
} from '../components/ui'
import { CalcPage } from '../features/calc'
import { WAPage } from '../features/wa'
import { AdminPage, CalcSettingsPanel } from '../features/admin'
import { ClientDetail } from '../features/clients'

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
      const res = await api.sendWaMessage(chatId, phone, text, user?.name)
      await loadWaMessages(chatId)
      // Предупреждение о приближении к дневному лимиту (защита от бана WhatsApp)
      if (res?.warn) toast$(res.warn, 'err')
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
    // head видит только настройки калькулятора, без управления пользователями
    ...(isHead && !isAdmin ? [{ id:'calcadmin', l:'Настройки калькулятора', i:'ti-adjustments' }] : []),
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
            {page==='calcadmin' && isHead && !isAdmin && (
              <div style={{maxWidth:900,margin:'0 auto',padding:'0 4px'}}>
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:20,fontWeight:700,color:'#0f172a'}}>⚙️ Настройки калькулятора</div>
                  <div style={{fontSize:12,color:'#64748b'}}>Программы, ставки, коэффициенты, расходы</div>
                </div>
                <CalcSettingsPanel/>
              </div>
            )}
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
// ─── CLIENT DETAIL (full card) ────────────────────────────────────
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

