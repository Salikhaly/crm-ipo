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
  TI, TC, TB, TL, PAY_ST, uid, fmt, fmtN, today, nowStr, emptyClient,
  getAccompTemplate, getChecklist, CLOSE_REASONS, STAGE_AUTO_TASK, canMoveToStage,
} from '../lib/constants'
import {
  Fl, Tag, StTag, SrTag, CrTag, Tgl, Prog, Inp, Sel, Btn,
} from '../components/ui'
import { Logo } from '../components/logo'
import { clientFromAnketa, clientsFromList } from '../lib/importAnketa'
import { baseRows } from '../lib/exportAnketa'
import { CalcPage } from '../features/calc'
import { WAPage } from '../features/wa'
import { AdminPage, CalcSettingsPanel } from '../features/admin'
import { ClientDetail } from '../features/clients'

// ═══ MAIN APP ═════════════════════════════════════════════════════
export default function CRM() {
  // Auth
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  // №9: Глобальный перехват ошибок → /api/log-error → Supabase error_logs.
  // Больше не нужно дебажить по скриншотам консоли от менеджеров.
  useEffect(() => {
    const seen = new Set()  // дедуп одинаковых ошибок за сессию
    const report = (message, stack) => {
      const key = String(message).slice(0, 120)
      if (seen.has(key) || seen.size > 10) return
      seen.add(key)
      fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message, stack,
          url: window.location.href,
          userName: (() => { try { return JSON.parse(localStorage.getItem('crm_user')||'{}').name || '' } catch { return '' } })(),
        }),
      }).catch(() => {})
    }
    const onError = e => report(e.message || 'Unknown error', e.error?.stack || '')
    const onRejection = e => report('Unhandled: ' + (e.reason?.message || String(e.reason)), e.reason?.stack || '')
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

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

  // №7: Лёгкий URL-роутинг. Раздел отражается в ?p=, «назад» в браузере работает,
  // F5 возвращает на тот же раздел, ссылку можно скинуть коллеге.
  useEffect(() => {
    // При загрузке: читаем раздел из URL
    const params = new URLSearchParams(window.location.search)
    const p = params.get('p')
    if (p && p !== 'dashboard') setPage(p)
    // Кнопка «назад»/«вперёд»
    const onPop = () => {
      // Открытую карточку клиента системная «Назад» закрывает, а не выкидывает из CRM
      if (selClientHistRef.current) {
        selClientHistRef.current = null
        setHasChanges(false)
        setSelClient(null)
        return
      }
      const pp = new URLSearchParams(window.location.search).get('p') || 'dashboard'
      setPage(pp)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    // При смене раздела: пишем в URL (push только если реально сменился)
    const cur = new URLSearchParams(window.location.search).get('p') || 'dashboard'
    if (cur !== page) {
      const url = page === 'dashboard' ? window.location.pathname : `?p=${page}`
      window.history.pushState({}, '', url)
    }
  }, [page])
  const [selClient,   setSelClient]  = useState(null)
  // Карточка клиента — отдельная запись в истории браузера (см. onPop выше)
  const selClientHistRef = useRef(null)
  // Ссылка на save() открытой карточки — для «Сохранить и выйти» в диалоге выхода
  const detailSaveRef    = useRef(null)
  useEffect(() => {
    if (selClient && !selClientHistRef.current) window.history.pushState({ clientCard: true }, '')
    selClientHistRef.current = selClient
  }, [selClient])
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
  const [waConfigured, setWaConfigured] = useState(true)  // Green API подключён?
  const [syncing,     setSyncing]    = useState(false)
  const [hasChanges,  setHasChanges] = useState(false)
  const [exitDlg,     setExitDlg]    = useState(null)
  const [closeDlg,    setCloseDlg]   = useState(null)  // причина закрытия при переносе в canban «Закрыто»
  const toastRef = useRef(null)
  const waInputRef = useRef(null)

  // ─── ОНБОРДИНГ-ТУР первого входа ─────────────────────────
  const [showTour, setShowTour] = useState(false)
  useEffect(() => {
    // Флаг на пользователя: новый менеджер на общем компьютере тоже увидит тур
    if (user && !localStorage.getItem('crm_tour_done_' + (user.id || user.login || ''))) setShowTour(true)
  }, [user])
  function closeTour() { localStorage.setItem('crm_tour_done_' + (user?.id || user?.login || ''), '1'); setShowTour(false) }

  // ─── ЭКСПОРТ списка в формате база_анкет.xlsx (руководитель/техник) ──
  // Тот же формат, что у приложения ПКБ — файл читается обратно кнопкой «Импорт».
  // listArg — конкретный список (например, выбранные в таблице); иначе текущий вид
  async function exportCsv(listArg) {
    const list = Array.isArray(listArg) && listArg.length
      ? listArg
      : ((searchRes.length || search || fStage || fMgr) ? searchRes : myCl)
    if (!list.length) { toast$('⚠️ Нечего экспортировать', 'err'); return }
    try {
      const XLSX = await import('xlsx')
      // Свои маршруты из админки (если настроены) — названия этапов как в карточке
      let accompOv = null
      try {
        const r = await api.calc('accomp_templates', {})
        if (r?.templates && typeof r.templates === 'object') accompOv = r.templates
      } catch (e) { /* оффлайн/ошибка — дефолтные названия */ }
      const rows = baseRows(list, {
        mgrName:    id => mgrById[id]?.name || '',
        stageLabel: id => pipeline.find(p => p.id === id)?.l || id || '',
        // «Сопровождение»: 3/7 · Название текущего этапа маршрута
        accompLabel: c => {
          if (!c.contractType) return ''
          const t = getAccompTemplate(c.contractType, accompOv)
          const i = Math.min(c.accompStageIndex || 0, t.stages.length - 1)
          return `${i + 1}/${t.stages.length} · ${t.stages[i]}`
        },
      })
      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [16,12,16,26,14,6,12,12,20,14,12,14,22,16].map(wch => ({ wch }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'База')
      XLSX.writeFile(wb, 'база_клиентов_' + today() + '.xlsx')
      toast$('📥 Экспортировано клиентов: ' + list.length)
    } catch (e) { toast$('❌ ' + (e.message || e), 'err') }
  }

  // ─── ИМПОРТ клиентов из Excel (head/admin) ──
  // list — массив частичных клиентов из lib/importAnketa. Дедуп по телефону/ИИН.
  async function importClients(list) {
    if (!list.length) { toast$('⚠️ В файле не найдено клиентов', 'err'); return { created:0, skipped:0 } }
    setSyncing(true)
    let created = 0, skipped = 0
    const skippedList = []
    const seenP = new Set(clients.map(x => (x.phone||'').replace(/\D/g,'')).filter(Boolean))
    const seenI = new Set(clients.map(x => x.iin).filter(Boolean))
    for (const partial of list) {
      const pd = (partial.phone||'').replace(/\D/g,'')
      const who = partial.fio || partial.phone || partial.iin || 'без имени'
      if ((pd && seenP.has(pd)) || (partial.iin && seenI.has(partial.iin))) {
        skipped++; skippedList.push({ who, why: 'дубль по телефону/ИИН' }); continue
      }
      const full = { ...emptyClient(user.manager_id||''), ...partial, id: uid() }
      if (partial.__note) full.comments = [{ id:uid(), text:'📥 Импорт · '+partial.__note, author:user.name||'', date:nowStr(), createdAt:new Date().toISOString(), sys:true }]
      delete full.__note
      const saved = await saveClient(full, { quiet:true })
      if (saved) { created++; if (pd) seenP.add(pd); if (partial.iin) seenI.add(partial.iin) }
      else { skipped++; skippedList.push({ who, why: 'не сохранился (телефон/ИИН уже в базе или ошибка сети)' }) }
    }
    setSyncing(false)
    toast$(`📥 Импортировано: ${created}${skipped ? ` · пропущено (дубли): ${skipped}` : ''}`)
    return { created, skipped, skippedList }
  }

  // ─── СЛИЯНИЕ ДУБЛЕЙ (head/admin) ──────────────────────────
  async function doMerge(primaryId, secondaryId) {
    setSyncing(true)
    try {
      const res = await api.mergeClients(primaryId, secondaryId)
      if (res?.client) {
        setClients(cs => cs.filter(x => x.id !== secondaryId).map(x => x.id === primaryId ? res.client : x))
        toast$('🔗 Клиенты объединены — дубль в корзине')
      }
    } catch (e) { toast$('❌ ' + e.message, 'err') }
    setSyncing(false)
  }

  // ─── МАССОВЫЕ ДЕЙСТВИЯ из таблицы клиентов (head/admin) ──
  async function massUpdate(ids, patch) {
    if (!ids.length) return
    setSyncing(true)
    let ok = 0
    for (const id of ids) {
      const c = clients.find(x => x.id === id)
      if (!c) continue
      const updated = { ...c, ...patch }
      try {
        await api.updateClient(id, updated)
        setClients(cs => cs.map(x => x.id === id ? updated : x))
        ok++
      } catch (e) { /* пропускаем сбойного, продолжаем остальных */ }
    }
    setSyncing(false)
    toast$(ok === ids.length ? `✅ Обновлено: ${ok}` : `⚠️ Обновлено ${ok} из ${ids.length}`, ok === ids.length ? 'ok' : 'err')
  }

  // ─── TOAST ──────────────────────────────────────────────
  // action: { label, fn } — кнопка в тосте (например «Отменить» после переноса)
  function toast$(msg, type='ok', action=null) {
    setToast({ msg, type, action })
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), action ? 6500 : 4500)
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
      // №8: если клиентов больше страницы — догружаем остальные в фоне (до 5 страниц = 1000).
      // Канбан и фильтры видят всю базу, а не первые 200.
      if (cRes?.hasMore) {
        let all = cRes.clients, pg = 1
        while (pg <= 4) {
          const more = await api.getClients({ page: pg }).catch(() => null)
          if (!more?.clients?.length) break
          all = [...all, ...more.clients]
          setClients(all)
          if (!more.hasMore) break
          pg++
        }
        if (pg > 4) toast$('⚠️ В базе больше 1000 клиентов — старые ищите в «Списке клиентов» или через Ctrl+K.')
      }
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
      if (d && d.configured !== undefined) setWaConfigured(!!d.configured)
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
        // №9: звук при новом сообщении (и в активной вкладке тоже)
        if (newUnread > prevUnread) {
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)()
            const o = ctx.createOscillator(), g = ctx.createGain()
            o.connect(g); g.connect(ctx.destination)
            o.frequency.value = 880; g.gain.value = 0.08
            o.start(); o.frequency.setValueAtTime(660, ctx.currentTime + 0.09)
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
            o.stop(ctx.currentTime + 0.25)
          } catch(e) { /* браузер может блокировать звук до первого клика — не страшно */ }
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
      // Курсор — sent_at последнего сообщения: id у Green API не упорядочены,
      // и фильтр .gt(id) пропускал новые сообщения. Дубли отсеивает merge по id.
      setWaMessages(prev => {
        const lastMsg = prev.length ? prev[prev.length - 1] : null
        const qs      = lastMsg && lastMsg.sent_at ? `&after=${encodeURIComponent(lastMsg.sent_at)}` : ''
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
  // opts.quiet — тихий режим для автосохранения: без тостов успеха и закрытия
  // модалок. Но ПРИЧИНУ несохранения показываем и в тихом режиме (иначе
  // менеджер часами заполняет карточку, которая молча не сохраняется) —
  // с троттлингом, чтобы не спамить на каждую паузу в наборе.
  const quietErrRef = useRef({ msg: '', ts: 0 })
  function quietErr(msg) {
    const now = Date.now()
    if (quietErrRef.current.msg === msg && now - quietErrRef.current.ts < 30000) return
    quietErrRef.current = { msg, ts: now }
    toast$(msg, 'err')
  }
  async function saveClient(c, opts = {}) {
    const quiet = !!opts.quiet
    // Валидация ИИН
    if (c.iin && !/^\d{12}$/.test(c.iin)) {
      if (!quiet) toast$('❌ ИИН должен содержать ровно 12 цифр', 'err')
      else quietErr('⚠️ Не сохраняется: ИИН должен содержать ровно 12 цифр')
      return false
    }
    // Проверка дубля по ИИН
    if (c.iin) {
      const dup = clients.find(x => x.id !== c.id && x.iin === c.iin)
      if (dup) {
        if (!quiet) toast$(`⚠️ ИИН уже есть у клиента: ${dup.fio || dup.phone}`, 'err')
        else quietErr(`⚠️ Не сохраняется: ИИН уже есть у клиента ${dup.fio || dup.phone}`)
        return false
      }
    }
    // Проверка дубля по телефону (при создании и при обновлении)
    if (c.phone) {
      const phone = c.phone.replace(/\D/g, '')
      const dup = clients.find(x => x.id !== c.id && x.phone && x.phone.replace(/\D/g, '') === phone)
      if (dup) {
        if (!quiet) toast$(`⚠️ Телефон уже есть у клиента: ${dup.fio || dup.phone}`, 'err')
        else quietErr(`⚠️ Не сохраняется: телефон уже есть у клиента ${dup.fio || dup.phone}`)
        return false
      }
    }
    if (!quiet) setSyncing(true)
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
      if (!quiet) {
        toast$('✅ Сохранено')
        setModal(null)
        setSyncing(false)
      }
      return saved || c
    } catch (e) {
      if (!quiet) { toast$('❌ ' + e.message, 'err'); setSyncing(false) }
      else quietErr('⚠️ Не сохраняется: ' + e.message)
      return false
    }
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

  // №6: быстрый статус звонка из канбан-карточки одним тапом
  async function quickContactAction(c, action) {
    let updated
    if (action === 'noanswer') {
      updated = { ...c, contactStatus: 'Не отвечает' }
    } else if (action === 'callback') {
      const tmr = new Date(Date.now() + 24*3600*1000).toISOString().split('T')[0]
      updated = {
        ...c,
        contactStatus: 'Перезвонить',
        tasks: [...(c.tasks||[]), { id: uid(), type:'📞 Позвонить', text:'Перезвонить (быстрая отметка)', due: tmr, done:false, created: nowStr() }],
      }
    } else return
    setClients(cs => cs.map(x => x.id === c.id ? updated : x))
    try {
      await api.updateClient(c.id, updated)
      toast$(action === 'noanswer' ? '📵 Отмечено: не отвечает' : '⏰ Задача «перезвонить» на завтра создана')
    } catch(e) {
      setClients(cs => cs.map(x => x.id === c.id ? c : x))
      toast$('❌ ' + e.message, 'err')
    }
  }

  async function moveClient(id, stage, closeReason) {
    const c = clients.find(x => x.id === id)
    if (!c || c.stage === stage) return
    // Обязательные поля этапа (amoCRM-механика)
    const chk = canMoveToStage(c, stage)
    if (!chk.ok) { toast$('⚠️ ' + chk.msg, 'err'); return }
    // Перенос в «Закрыто» — сначала спрашиваем причину
    if (stage === 'closed' && !closeReason) { setCloseDlg({ id }); return }

    const prev    = c.stage
    const updated = { ...c, stage }
    if (closeReason) {
      updated.closeReason = closeReason
      updated.comments = [...(c.comments||[]), { id:uid(), text:'❌ Закрыто: '+closeReason, author:user?.name||'', date:nowStr() }]
    }
    // Авто-задача этапа: настройка из воронки (админка) → дефолт из кода
    const stg = pipeline.find(p => p.id === stage)
    const at  = stg?.at ? (stg.at.off ? null : stg.at) : STAGE_AUTO_TASK[stage]
    if (at && !(c.tasks||[]).some(t => !t.done && t.auto && t.type === at.type)) {
      updated.tasks = [...(c.tasks||[]), { id:uid(), type:at.type, text:at.text, due:today(), done:false, created:nowStr(), auto:true }]
    }
    // Оптимистичное обновление — сразу показываем новую позицию
    setClients(cs => cs.map(x => x.id === id ? updated : x))
    if (selClient?.id === id) setSelClient(updated)
    try {
      await api.updateClient(id, updated)
      // «Отменить» возвращает клиента целиком (этап + убирает авто-задачу и причину)
      const undo = async () => {
        setClients(cs => cs.map(x => x.id === id ? c : x))
        if (selClient?.id === id) setSelClient(c)
        try { await api.updateClient(id, c); toast$('↩️ Возвращено: ' + (pipeline.find(p => p.id === prev)?.l || prev)) }
        catch (e) { toast$('❌ ' + e.message, 'err') }
      }
      toast$(`📌 ${pipeline.find(p => p.id === stage)?.l || stage}${at ? ' · задача создана' : ''}`, 'ok', { label:'Отменить', fn: undo })
    } catch (e) {
      // Rollback при ошибке
      setClients(cs => cs.map(x => x.id === id ? c : x))
      if (selClient?.id === id) setSelClient(c)
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
    // Клиент с этим номером/ИИН уже есть? Тогда не плодим дубль (сервер вернёт 409),
    // а привязываем чат к существующему клиенту — частый случай: писал текущий клиент.
    const tail = String(c.phone||'').replace(/\D/g,'').replace(/^8/,'7').slice(-10)
    const dup = clients.find(x =>
      (tail.length===10 && (x.phone||'').replace(/\D/g,'').endsWith(tail)) ||
      (c.iin && x.iin === c.iin)
    )
    if (dup) {
      if (linkWaChatId) {
        await api.linkWaChat(linkWaChatId, dup.id).catch(() => {})
        setWaChats(cs => cs.map(ch => ch.id === linkWaChatId ? { ...ch, client_id: dup.id } : ch))
      }
      toast$(`🔗 Чат привязан к клиенту: ${dup.fio || dup.phone}`)
      return
    }
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
    if (hasChanges) { setExitDlg({ onConfirm: () => { setExitDlg(null); window.history.back() } }) }
    else window.history.back()
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
    // Менеджер выбрал в фильтре коллегу — показываем клиентов коллеги (общая команда)
    const base = (isMgr && fMgr && fMgr !== user?.manager_id) ? clients : myCl
    return base.filter(c => {
      if (q && !c.fio.toLowerCase().includes(q) && !c.phone.includes(q) && !(c.iin||'').includes(q)) return false
      if (fMgr   && c.manager !== fMgr)   return false
      if (fStage && c.stage   !== fStage) return false
      return true
    })
  }, [myCl, clients, isMgr, user, search, fMgr, fStage])

  // Единый проход по задачам вместо двух flatMap
  const { openTasks, overdueTasks, hotTasks } = useMemo(() => {
    const td = today()
    let open = 0, overdue = 0, hot = 0
    for (const c of myCl) {
      for (const t of c.tasks || []) {
        if (!t.done) {
          open++
          if (t.due && t.due < td) { overdue++; hot++ }
          else if (t.due === td) hot++
        }
      }
    }
    return { openTasks: open, overdueTasks: overdue, hotTasks: hot }
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
    { id:'search',    l:'Список клиентов', i:'ti-list-details' },
    { id:'wa',        l:'WhatsApp',           i:'ti-brand-whatsapp', cnt:waUnread, wa:true },
    { id:'calc',      l:'Калькулятор',        i:'ti-calculator' },
    // Бейдж — только горящее (просрочено+сегодня): все открытые были постоянным шумом
    { id:'tasks',     l:'Задачи',             i:'ti-checkbox', cnt:hotTasks, warn:overdueTasks>0 },
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
      onOpenWa={(cl) => {
        // №3: открыть внутренний WA-чат клиента; если чата нет — внешний wa.me
        const digits = (cl.phone||'').replace(/\D/g,'').replace(/^8/,'7')
        const chat = waChats.find(ch => (ch.phone||'').replace(/\D/g,'').endsWith(digits.slice(-10)))
        if (chat) {
          setHasChanges(false); setSelClient(null)
          selWaChatRef.current = chat; setSelWaChat(chat); setWaMessages([]); loadWaMessages(chat.id)
          setPage('wa')
        } else {
          window.open('https://wa.me/' + digits, '_blank')
        }
      }}
      onSave={saveClient} onDelete={delClient} onMove={moveClient}
      onBack={goBack} toast$={toast$} saveRef={detailSaveRef}
      setHasChanges={setHasChanges} syncing={syncing}
    />
  )

  return (
    <>
      <Head>
        <title>Ипотека CRM</title>
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
        <link rel="icon" href="/favicon.svg"/>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css"/>
      </Head>

      <div className="app-layout" style={{fontFamily:"'Inter',system-ui,sans-serif"}}>
        {/* ── SIDEBAR ── */}
        <div className="sidebar">
          <div style={{padding:'16px 15px 13px',borderBottom:'1px solid rgba(255,255,255,.07)'}}>
            <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:5}}>
              <Logo size={30} id="sb-logo"/>
              <div style={{fontSize:14,fontWeight:800,color:'#fff'}}>Ипотека CRM</div>
            </div>
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
            <button onClick={()=>setShowTour(true)} title="Пересмотреть обучение"
              style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',marginBottom:6,background:'transparent',border:'none',borderRadius:10,cursor:'pointer',width:'100%',color:'#94a3b8',fontFamily:'inherit',fontSize:12,fontWeight:600}}>
              <i className="ti ti-help-circle" style={{fontSize:16}}/>Обучение — как работать в CRM
            </button>
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
                {<Sel value={fMgr} onChange={e => setFMgr(e.target.value)} style={{width:140}}>
                  <option value="">Все менеджеры</option>
                  {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </Sel>}
                <Sel value={fStage} onChange={e => setFStage(e.target.value)} style={{width:150}}>
                  <option value="">Все этапы</option>
                  {pipeline.map(p => <option key={p.id} value={p.id}>{p.l}</option>)}
                </Sel>
              </div>
            </>}
            {page === 'search' && isSuperUser && (
              <Btn size="sm" onClick={() => setModal({ type:'import' })} title="Импорт клиентов из Excel">
                <i className="ti ti-upload"/><span className="btn-text-desktop">Импорт</span>
              </Btn>
            )}
            {page === 'search' && isSuperUser && (
              <Btn size="sm" onClick={() => exportCsv()} title="Выгрузить список в Excel">
                <i className="ti ti-download"/><span className="btn-text-desktop">Экспорт</span>
              </Btn>
            )}
            <NotifBell clients={myCl} waUnread={waUnread} onOpen={c => setSelClient(c)} goWa={() => navTo('wa')} goTasks={() => navTo('tasks')}/>
            <GlobalSearch clients={clients} pipeline={pipeline} onOpen={c => setSelClient(c)}/>
            <Btn variant="primary" size="sm" onClick={() => setModal({ type:'quick_client', c: emptyClient(user.manager_id||'') })}>
              <i className="ti ti-plus"/><span className="btn-text-desktop">Новый клиент</span>
            </Btn>
            <Btn size="sm" onClick={loadAll} disabled={syncing} title="Обновить данные с сервера">
              <i className={`ti ti-refresh${syncing?' spin':''}`}/>
            </Btn>
          </div>

          {/* Page content */}
          <div className="main-content" onTouchStart={onSwipeTouchStart} onTouchEnd={onSwipeTouchEnd}>
            {page==='dashboard' && <DashPage data={dashData} pipeline={pipeline} managers={managers} clients={myCl} onOpen={c => setSelClient(c)} onLoadDash={() => api.getDashboard().then(d => setDashData(d))}/>}
            {page==='clients' && (fStage || fMgr || search) && (
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:11,padding:'8px 13px',fontSize:12.5,fontWeight:700,color:'#1d4ed8',flexWrap:'wrap'}}>
                <i className="ti ti-filter" style={{fontSize:14}}/>
                Показаны не все клиенты — действует фильтр{fStage ? `: ${pipeline.find(p=>p.id===fStage)?.l || fStage}` : ''}{fMgr ? ` · менеджер: ${mgrById[fMgr]?.name || ''}` : ''}{search ? ` · поиск: «${search}»` : ''}
                <button onClick={()=>{setFStage('');setFMgr('');setSearch('')}}
                  style={{marginLeft:'auto',border:'none',background:'#1d4ed8',color:'#fff',borderRadius:7,padding:'4px 11px',fontSize:11.5,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                  Показать всех
                </button>
              </div>
            )}
            {page==='clients'   && <ClientsPage clients={filtered} managers={managers} pipeline={pipeline} onOpen={c => setSelClient(c)} drag={drag} setDrag={setDrag} dragOv={dragOv} setDragOv={setDragOv} onMove={moveClient} onQuick={quickContactAction}/>}
            {page==='search'    && <SearchPage clients={searchRes.length||search||fStage||fMgr?searchRes:clients} managers={managers} pipeline={pipeline} checklists={checklists} search={search} setSearch={setSearch} fStage={fStage} setFStage={setFStage} fMgr={fMgr} setFMgr={setFMgr} onOpen={c => setSelClient(c)} waNew={myCl.filter(c=>c.isWhatsApp&&c.stage==='new_lead')} canMass={isSuperUser} onMass={massUpdate} onExportSel={list=>exportCsv(list)} onMerge={doMerge} onImport={()=>setModal({type:'import'})} onExportAll={()=>exportCsv()}/>}
            {page==='wa'        && <WAPage toast$={toast$} waConfigured={waConfigured} chats={waChats} messages={waMessages} managers={managers} clients={myCl} selChat={selWaChat} onSelChat={c=>{selWaChatRef.current=c;setSelWaChat(c);setWaMessages([]);if(c)loadWaMessages(c.id)}} onSend={sendWaMsg} onSendMedia={sendWaMedia} onImport={importWaLead} onAssign={assignWaChat} onUpdateStatus={updateWaChatStatus} user={user} onOpenClient={c=>setSelClient(c)} mgrById={mgrById}/>}
            {page==='calc'      && <CalcPage user={user} clients={myCl} toast$={toast$}/>}
            {page==='tasks'     && <TasksPage clients={myCl} managers={managers} onOpen={c => setSelClient(c)} user={user} onSave={saveClient}/>}
            {page==='kpi'       && <KPIPage data={kpiData} period={kpiPeriod} setPeriod={setKpiPeriod} pipeline={pipeline}/>}
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

      {/* Онбординг-тур первого входа */}
      {showTour && <TourModal onDone={closeTour}/>}

      {/* Импорт клиентов из Excel */}
      {modal?.type==='import' && <ImportModal onImport={importClients} onClose={()=>setModal(null)} syncing={syncing} pipeline={pipeline}/>}

      {/* Modals */}
      {modal?.type==='quick_client'  && <QuickClientModal  base={modal.c} onSave={saveClient} onOpen={c=>setSelClient(c)} onClose={()=>setModal(null)}
        onFull={(f,p,s)=>setModal({ type:'new_client', c:{ ...modal.c, fio:f, phone:p, source:s } })} syncing={syncing}/>}
      {modal?.type==='new_client'    && <NewClientModal    client={modal.c} managers={managers} pipeline={pipeline} onSave={saveClient} onClose={()=>setModal(null)} syncing={syncing}/>}
      {modal?.type==='mgr_edit'      && <MgrModal          item={modal.item} onSave={saveMgr} onClose={()=>setModal(null)} syncing={syncing}/>}
      {modal?.type==='user_edit'     && <UserModal         item={modal.item} managers={managers} onSave={saveUser} onClose={()=>setModal(null)} syncing={syncing}/>}
      {modal?.type==='cl_edit'       && <CLModal           stage={modal.stage} items={modal.items} onSave={saveCL} onClose={()=>setModal(null)} syncing={syncing}/>}
      {modal?.type==='pl_edit'       && <PLModal           pipeline={pipeline} onSave={savePL} onClose={()=>setModal(null)} syncing={syncing}/>}

      {/* Причина закрытия — при переносе клиента в «Закрыто» из канбана */}
      {closeDlg && (
        <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.55)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(3px)',padding:16}}>
          <div style={{background:'#fff',borderRadius:18,width:'100%',maxWidth:420,padding:20,boxShadow:'0 20px 50px rgba(0,0,0,.25)'}}>
            <div style={{fontWeight:800,fontSize:16,marginBottom:4}}>Почему закрываем клиента?</div>
            <div style={{fontSize:12,color:'#64748b',marginBottom:14}}>Причина попадёт в KPI — увидим, где теряем клиентов.</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginBottom:12}}>
              {CLOSE_REASONS.map(r => (
                <button key={r} onClick={()=>{const id=closeDlg.id; setCloseDlg(null); moveClient(id,'closed',r)}}
                  style={{padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:10,background:'#f8fafc',cursor:'pointer',fontSize:12.5,fontWeight:600,color:'#334155',textAlign:'left',fontFamily:'inherit',transition:'all .14s'}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='#ef4444';e.currentTarget.style.background='#fef2f2'}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.background='#f8fafc'}}>
                  {r}
                </button>
              ))}
            </div>
            <Btn style={{width:'100%',justifyContent:'center'}} onClick={()=>setCloseDlg(null)}>Отмена</Btn>
          </div>
        </div>
      )}

      {/* Exit dialog */}
      {exitDlg && (
        <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.52)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)',padding:16}}>
          <div className="exit-dlg">
            <div style={{fontSize:40,marginBottom:12}}>⚠️</div>
            <div style={{fontSize:18,fontWeight:800,marginBottom:8}}>Несохранённые изменения</div>
            <div style={{fontSize:14,color:'#64748b',marginBottom:22}}>Выйти без сохранения? Все изменения будут потеряны.</div>
            <div style={{display:'flex',gap:9,justifyContent:'center',flexWrap:'wrap'}}>
              <Btn onClick={() => setExitDlg(null)}>Остаться</Btn>
              <Btn variant="primary" onClick={async () => {
                const ok = detailSaveRef.current ? await detailSaveRef.current() : false
                if (ok) { setExitDlg(null); window.history.back() }
              }}><i className="ti ti-device-floppy"/>Сохранить и выйти</Btn>
              <Btn variant="danger" onClick={() => exitDlg.onConfirm()}><i className="ti ti-arrow-left"/>Выйти</Btn>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="alert" aria-live="polite" className={`toast${toast.type==='err'?' err':''}`}>
          {toast.msg}
          {toast.action && (
            <button onClick={()=>{const fn=toast.action.fn; setToast(null); fn()}}
              style={{marginLeft:10,background:'rgba(255,255,255,.16)',border:'1px solid rgba(255,255,255,.3)',color:'#fff',borderRadius:8,padding:'4px 11px',fontSize:12,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
              {toast.action.label}
            </button>
          )}
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

// ─── ОНБОРДИНГ-ТУР (первый вход, 4 шага) ─────────────────────────
const TOUR_STEPS = [
  { i:'ti-layout-kanban', c:'#3b82f6', t:'Клиенты — это канбан',
    d:'Вся воронка на одном экране. Перетаскивайте карточки между этапами. Прямо с карточки можно позвонить, отметить «не дозвонился» или «перезвонить завтра» — в один клик.' },
  { i:'ti-user-circle', c:'#8b5cf6', t:'Карточка клиента',
    d:'Сверху — цепочка этапов (кликните, чтобы перевести). Справа — задачи и лента событий, всегда под рукой. Всё сохраняется само: просто заполняйте, индикатор «✓ сохранено» подтвердит.' },
  { i:'ti-brand-whatsapp', c:'#25d366', t:'WhatsApp внутри CRM',
    d:'Новые лиды из WhatsApp появляются сами. Отвечайте из CRM, используйте шаблоны через «/», кнопка «Рассчитать» готовит расчёт для клиента прямо в чат.' },
  { i:'ti-bolt', c:'#f59e0b', t:'Быстрые приёмы',
    d:'Ctrl+K — мгновенный поиск клиента с любого экрана (имя, телефон, ИИН или тег). Кнопка «+» — новый лид за 10 секунд. Калькулятор считает все госпрограммы РК и делает PDF для клиента.' },
  { i:'ti-list-details', c:'#0ea5e9', t:'Список клиентов',
    d:'Раздел «Список клиентов»: поиск по всей базе, фильтры, сохранённые виды (кнопка «Сохранить вид»), импорт и экспорт Excel, слияние дублей. С телефона — через «Ещё» внизу.' },
  { i:'ti-device-mobile', c:'#10b981', t:'С телефона — всё работает',
    d:'Свайп влево/вправо листает разделы. На карточке клиента в воронке кнопка «⇄» переносит на другой этап. В WhatsApp-чате иконка клиента открывает панель с расчётом. Пересмотреть этот тур: сайдбар → «Обучение».' },
]

function TourModal({ onDone }) {
  const [idx, setIdx] = useState(0)
  const s = TOUR_STEPS[idx]
  const last = idx === TOUR_STEPS.length - 1
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.6)',zIndex:900,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)',padding:16}}>
      <div style={{background:'#fff',borderRadius:20,width:'100%',maxWidth:420,padding:'28px 26px',boxShadow:'0 24px 70px rgba(0,0,0,.3)',textAlign:'center'}}>
        <div style={{width:64,height:64,borderRadius:18,background:s.c+'1a',color:s.c,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
          <i className={`ti ${s.i}`} style={{fontSize:32}}/>
        </div>
        <div style={{fontSize:11,fontWeight:800,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>Шаг {idx+1} из {TOUR_STEPS.length}</div>
        <div style={{fontSize:19,fontWeight:900,letterSpacing:'-.4px',marginBottom:10}}>{s.t}</div>
        <div style={{fontSize:13.5,color:'#475569',lineHeight:1.6,marginBottom:20}}>{s.d}</div>
        <div style={{display:'flex',justifyContent:'center',gap:6,marginBottom:20}}>
          {TOUR_STEPS.map((_,i)=>(
            <div key={i} onClick={()=>setIdx(i)} style={{width:i===idx?22:8,height:8,borderRadius:8,background:i===idx?s.c:'#e2e8f0',cursor:'pointer',transition:'all .2s'}}/>
          ))}
        </div>
        <div style={{display:'flex',gap:9}}>
          <Btn style={{flex:1,justifyContent:'center'}} onClick={onDone}>Пропустить</Btn>
          <Btn variant="primary" style={{flex:2,justifyContent:'center'}} onClick={()=>last?onDone():setIdx(i=>i+1)}>
            {last ? '🚀 Начать работу' : 'Далее'}<i className="ti ti-arrow-right"/>
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ─── ЦЕНТР УВЕДОМЛЕНИЙ (колокольчик в топбаре) ───────────────────
function NotifBell({ clients, waUnread, onOpen, goWa, goTasks }) {
  const [open, setOpen] = useState(false)
  const td = today()
  const { overdue, newLeads } = useMemo(() => {
    const overdue = [], newLeads = []
    for (const c of clients) {
      if ((c.tasks||[]).some(t => !t.done && t.due && t.due < td)) overdue.push(c)
      if (c.stage === 'new_lead') newLeads.push(c)
    }
    return { overdue, newLeads }
  }, [clients, td])
  const total = overdue.length + newLeads.length + (waUnread || 0)

  const Sec = ({ icon, color, title, items, onAll, allLabel }) => (
    <div style={{borderBottom:'1px solid #f1f5f9'}}>
      <div style={{padding:'8px 13px 4px',fontSize:10.5,fontWeight:800,color,textTransform:'uppercase',letterSpacing:'.05em'}}>{icon} {title} ({items.length})</div>
      {items.slice(0,5).map(c => (
        <div key={c.id} onClick={()=>{setOpen(false); onOpen(c)}}
          style={{padding:'7px 13px',fontSize:12.5,fontWeight:600,cursor:'pointer',display:'flex',justifyContent:'space-between',gap:8}}
          onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.fio||c.phone||'Без имени'}</span>
          <span style={{fontSize:10.5,color:'#94a3b8',flexShrink:0}}>{c.phone}</span>
        </div>
      ))}
      {items.length > 5 && onAll && (
        <button onClick={()=>{setOpen(false); onAll()}} style={{display:'block',width:'100%',textAlign:'left',padding:'5px 13px 9px',border:'none',background:'transparent',color:'#3b82f6',fontSize:11.5,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>{allLabel}</button>
      )}
    </div>
  )

  return (
    <div style={{position:'relative'}}>
      <button onClick={()=>setOpen(o=>!o)} title="Уведомления"
        style={{position:'relative',width:34,height:34,borderRadius:10,border:'1.5px solid #e2e8f0',background:open?'#eff6ff':'#f1f5f9',color:open?'#1d4ed8':'#64748b',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        <i className="ti ti-bell" style={{fontSize:16}}/>
        {total > 0 && <span style={{position:'absolute',top:-5,right:-5,background:'#ef4444',color:'#fff',borderRadius:20,fontSize:9,fontWeight:800,padding:'1px 5px',minWidth:16,textAlign:'center',lineHeight:1.5}}>{total>99?'99+':total}</span>}
      </button>
      {open && (
        <>
          <div onClick={()=>setOpen(false)} style={{position:'fixed',inset:0,zIndex:400}}/>
          <div style={{position:'absolute',top:'calc(100% + 8px)',right:0,width:310,maxWidth:'calc(100vw - 24px)',background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:14,boxShadow:'0 14px 44px rgba(15,23,42,.18)',zIndex:401,overflow:'hidden'}}>
            <div style={{padding:'10px 13px',borderBottom:'1.5px solid #e2e8f0',background:'#f8fafc',fontWeight:800,fontSize:13}}>🔔 Уведомления</div>
            {total === 0 && <div style={{padding:'20px 13px',fontSize:12.5,color:'#94a3b8',textAlign:'center'}}>Всё под контролем — уведомлений нет 👍</div>}
            {overdue.length  > 0 && <Sec icon="🔴" color="#ef4444" title="Просроченные задачи" items={overdue}  onAll={goTasks} allLabel="Все задачи →"/>}
            {newLeads.length > 0 && <Sec icon="🆕" color="#6366f1" title="Новые лиды"          items={newLeads}/>}
            {waUnread > 0 && (
              <div onClick={()=>{setOpen(false); goWa()}} style={{padding:'10px 13px',fontSize:12.5,fontWeight:700,color:'#16a34a',cursor:'pointer',display:'flex',alignItems:'center',gap:7}}
                onMouseEnter={e=>e.currentTarget.style.background='#f0fdf4'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <i className="ti ti-brand-whatsapp" style={{fontSize:15}}/>Непрочитанных в WhatsApp: {waUnread} →
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── ИМПОРТ КЛИЕНТОВ ИЗ EXCEL ────────────────────────────────────
// Читает файлы через SheetJS (грузится лениво при первом открытии).
// Формат «Анкета ПКБ» (лист «Анкета») → 1 клиент/файл; иначе список по заголовкам.
function ImportModal({ onImport, onClose, syncing, pipeline }) {
  const [parsed, setParsed] = useState(null)   // null=ещё не выбирали, []=пусто
  const [busy,   setBusy]   = useState(false)
  const [err,    setErr]    = useState('')
  const [done,   setDone]   = useState(null)    // {created, skipped}
  const fileRef = useRef(null)

  async function handleFiles(files) {
    const list = Array.from(files || [])
    if (!list.length) return
    setBusy(true); setErr(''); setDone(null)
    try {
      const XLSX = await import('xlsx')
      const all = []
      for (const file of list) {
        const buf = await file.arrayBuffer()
        const wb  = XLSX.read(buf, { type:'array' })
        if (wb.Sheets['Анкета']) {
          const getCell = (s, r) => {
            const ws = wb.Sheets[s]; if (!ws) return ''
            const cell = ws[r]; return cell ? (cell.w ?? cell.v ?? '') : ''
          }
          all.push(clientFromAnketa(getCell))
        } else {
          const ws   = wb.Sheets[wb.SheetNames[0]]
          const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' })
          all.push(...clientsFromList(rows, pipeline))
        }
      }
      setParsed(all)
      if (!all.length) setErr('Не удалось распознать клиентов. Проверьте, что это анкета ПКБ или список с заголовками (ФИО, Телефон, ИИН…).')
    } catch (e) {
      setErr('Ошибка чтения файла: ' + (e.message || e))
      setParsed([])
    } finally { setBusy(false) }
  }

  async function doImport() {
    setBusy(true)
    const res = await onImport(parsed || [])
    setBusy(false); setDone(res)
  }

  const th = { padding:'7px 9px', textAlign:'left', fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.04em', borderBottom:'1.5px solid #e2e8f0', whiteSpace:'nowrap' }
  const td = { padding:'6px 9px', fontSize:12, borderBottom:'1px solid #f1f5f9', whiteSpace:'nowrap' }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.55)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)',padding:16}}>
      <div style={{background:'#fff',borderRadius:18,width:'100%',maxWidth:680,maxHeight:'90vh',display:'flex',flexDirection:'column',padding:20,boxShadow:'0 20px 60px rgba(0,0,0,.28)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <div style={{fontWeight:800,fontSize:17}}>📥 Импорт клиентов из Excel</div>
          <button onClick={onClose} style={{border:'none',background:'transparent',color:'#94a3b8',cursor:'pointer',fontSize:20,lineHeight:1}}>×</button>
        </div>
        <div style={{fontSize:12.5,color:'#64748b',marginBottom:14,lineHeight:1.5}}>
          Поддерживаются <b>анкеты ПКБ</b> (лист «Анкета» — 1 клиент на файл, можно выбрать несколько)
          и <b>списки</b> с заголовками (ФИО, Телефон, ИИН, СРЗП, Нагрузка…). Дубли по телефону/ИИН пропускаются.
        </div>

        {done ? (
          <div style={{background:done.created?'#f0fdf4':'#fffbeb',border:`1.5px solid ${done.created?'#86efac':'#fcd34d'}`,borderRadius:12,padding:'16px 18px',textAlign:'center'}}>
            <div style={{fontSize:15,fontWeight:800,color:done.created?'#166534':'#92400e',marginBottom:4}}>{done.created ? '✓ Готово' : '⚠ Ничего не импортировано'}</div>
            <div style={{fontSize:13,color:done.created?'#15803d':'#b45309'}}>{done.created ? <>Создано: <b>{done.created}</b></> : 'Все записи оказались дублями или пустыми'}{done.skipped ? ` · пропущено (дубли): ${done.skipped}` : ''}</div>
            {done.skippedList?.length > 0 && (
              <div style={{textAlign:'left',maxHeight:150,overflowY:'auto',marginTop:10,background:'#fff',border:'1px solid #e2e8f0',borderRadius:9,padding:'8px 11px'}}>
                {done.skippedList.slice(0, 50).map((r, i) => (
                  <div key={i} style={{fontSize:11.5,color:'#64748b',padding:'2px 0'}}>
                    <b style={{color:'#334155'}}>{r.who}</b> — {r.why}
                  </div>
                ))}
              </div>
            )}
            <Btn variant="primary" style={{marginTop:14,justifyContent:'center'}} onClick={onClose}>Закрыть</Btn>
          </div>
        ) : (<>
          <div onClick={()=>!busy&&fileRef.current?.click()}
            style={{border:'2.5px dashed #cbd5e1',borderRadius:14,padding:'22px',textAlign:'center',cursor:busy?'wait':'pointer',background:'#f8fafc',marginBottom:12}}>
            <i className="ti ti-file-spreadsheet" style={{fontSize:30,color:'#3b82f6',display:'block',marginBottom:6}}/>
            <div style={{fontWeight:700,fontSize:13,color:'#334155'}}>{busy ? 'Читаю файлы…' : 'Выбрать Excel-файл(ы)'}</div>
            <div style={{fontSize:11,color:'#94a3b8',marginTop:2}}>.xlsx / .xls — анкета ПКБ или список клиентов</div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" multiple style={{display:'none'}}
              onChange={e=>handleFiles(e.target.files)}/>
          </div>

          {err && <div style={{background:'#fef2f2',border:'1.5px solid #fecaca',borderRadius:10,padding:'10px 13px',fontSize:12.5,color:'#991b1b',marginBottom:12}}>{err}</div>}

          {parsed && parsed.length > 0 && (
            <div style={{flex:1,overflow:'auto',border:'1.5px solid #e2e8f0',borderRadius:12,marginBottom:12}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr style={{background:'#f8fafc',position:'sticky',top:0}}>
                  <th style={th}>ФИО</th><th style={th}>Телефон</th><th style={th}>ИИН</th><th style={th}>Доход</th><th style={th}>Нагрузка</th>
                </tr></thead>
                <tbody>
                  {parsed.slice(0,100).map((c,i)=>(
                    <tr key={i}>
                      <td style={td}>{c.fio||<span style={{color:'#cbd5e1'}}>—</span>}</td>
                      <td style={td}>{c.phone||'—'}</td>
                      <td style={td}>{c.iin||'—'}</td>
                      <td style={td}>{c.officialIncome?fmtN(+c.officialIncome)+'₸':'—'}</td>
                      <td style={td}>{c.monthlyLoad?fmtN(+c.monthlyLoad)+'₸':'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <Btn variant="primary" style={{flex:1,justifyContent:'center'}}
              disabled={!parsed||!parsed.length||busy||syncing} onClick={doImport}>
              {busy ? <><i className="ti ti-loader spin"/>Импорт…</> : <><i className="ti ti-database-import"/>Импортировать{parsed&&parsed.length?` (${parsed.length})`:''}</>}
            </Btn>
            <Btn onClick={onClose}>Отмена</Btn>
          </div>
        </>)}
      </div>
    </div>
  )
}

// ─── GLOBAL SEARCH (Ctrl+K) ──────────────────────────────────────
function GlobalSearch({ clients, pipeline, onOpen }) {
  const [open, setOpen] = useState(false)
  const [q, setQ]       = useState('')
  const inputRef = useRef(null)
  const pl = pipeline || PIPELINE_DEFAULT

  useEffect(() => {
    const onKey = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true) }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) { setQ(''); setTimeout(() => inputRef.current?.focus(), 60) }
  }, [open])

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2) return []
    const digits = s.replace(/\D/g, '')
    return clients.filter(c =>
      (c.fio || '').toLowerCase().includes(s) ||
      (digits.length >= 3 && (c.phone || '').replace(/\D/g, '').includes(digits)) ||
      (c.iin || '').includes(s) ||
      (c.tags || []).some(t => String(t).toLowerCase().includes(s))
    ).slice(0, 8)
  }, [q, clients])

  function pick(c) { setOpen(false); onOpen(c) }

  return (
    <>
      <button onClick={() => setOpen(true)} title="Поиск клиента (Ctrl+K)"
        style={{display:'flex',alignItems:'center',gap:7,background:'#f1f5f9',border:'1.5px solid #e2e8f0',borderRadius:10,padding:'7px 11px',cursor:'pointer',color:'#64748b',fontFamily:'inherit',fontSize:12.5,fontWeight:600,minHeight:34}}>
        <i className="ti ti-search" style={{fontSize:14}}/>
        <span className="btn-text-desktop">Поиск</span>
        <span className="btn-text-desktop" style={{fontSize:10,background:'#fff',border:'1px solid #e2e8f0',borderRadius:5,padding:'1px 5px',color:'#94a3b8'}}>Ctrl K</span>
      </button>
      {open && (
        <div onClick={() => setOpen(false)}
          style={{position:'fixed',inset:0,background:'rgba(15,23,42,.45)',zIndex:800,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'12vh',backdropFilter:'blur(3px)',padding:'12vh 16px 16px'}}>
          <div onClick={e => e.stopPropagation()}
            style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:520,boxShadow:'0 24px 70px rgba(0,0,0,.3)',overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'13px 16px',borderBottom:'1.5px solid #e2e8f0'}}>
              <i className="ti ti-search" style={{color:'#94a3b8',fontSize:17,flexShrink:0}}/>
              <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && results[0]) pick(results[0]) }}
                placeholder="Имя, телефон, ИИН или тег..."
                style={{flex:1,border:'none',outline:'none',fontSize:15,color:'#0f172a',fontFamily:'inherit',background:'transparent'}}/>
              <span style={{fontSize:10,color:'#94a3b8',background:'#f1f5f9',borderRadius:5,padding:'2px 6px',flexShrink:0}}>Esc</span>
            </div>
            {q.trim().length >= 2 && results.length === 0 && (
              <div style={{padding:'18px 16px',fontSize:13,color:'#94a3b8',textAlign:'center'}}>Ничего не найдено по «{q}»</div>
            )}
            {results.map(c => {
              const p = pl.find(x => x.id === c.stage)
              return (
                <div key={c.id} onClick={() => pick(c)}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'11px 16px',borderBottom:'1px solid #f1f5f9',cursor:'pointer',transition:'background .1s'}}
                  onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <div style={{width:32,height:32,borderRadius:9,background:(p?.c||'#3b82f6')+'22',color:p?.c||'#3b82f6',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:13,flexShrink:0}}>{c.fio?c.fio[0]:'?'}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.fio||'Без имени'}</div>
                    <div style={{fontSize:11,color:'#94a3b8'}}>{c.phone||'—'}{c.iin?' · '+c.iin:''}</div>
                  </div>
                  {p && <Tag c={p.c} ch={p.l}/>}
                </div>
              )
            })}
            {q.trim().length < 2 && (
              <div style={{padding:'16px',fontSize:12,color:'#94a3b8',textAlign:'center'}}>
                Начните вводить имя, телефон, ИИН или тег — минимум 2 символа. Enter — открыть первого.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ─── QUICK ADD: лид за 10 секунд (имя + телефон + источник) ──────
function QuickClientModal({ base, onSave, onOpen, onClose, onFull, syncing }) {
  const [fio,    setFio]    = useState('')
  const [phone,  setPhone]  = useState('')
  const [source, setSource] = useState(base?.source || 'instagram')
  const [busy,   setBusy]   = useState(false)
  const phoneRef = useRef(null)

  async function add(openAfter) {
    if (!fio.trim() && !phone.trim()) return
    setBusy(true)
    const saved = await onSave({ ...base, fio: fio.trim(), phone: phone.trim(), source })
    setBusy(false)
    if (saved) { onClose(); if (openAfter) onOpen(saved) }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.55)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)',padding:16}}>
      <div style={{background:'#fff',borderRadius:18,width:'100%',maxWidth:400,padding:20,boxShadow:'0 20px 60px rgba(0,0,0,.25)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
          <div style={{fontWeight:800,fontSize:16}}>⚡ Новый лид</div>
          <button onClick={onClose} style={{border:'none',background:'transparent',color:'#94a3b8',cursor:'pointer',fontSize:20,lineHeight:1}}>×</button>
        </div>
        <div style={{fontSize:12,color:'#64748b',marginBottom:14}}>Достаточно имени и телефона — остальное заполните в карточке позже.</div>
        <Fl l="Имя" ch={<Inp value={fio} onChange={e=>setFio(e.target.value)} placeholder="Айгерим" autoFocus
          onKeyDown={e=>e.key==='Enter'&&phoneRef.current?.focus()}/>}/>
        <Fl l="Телефон" ch={<Inp ref={phoneRef} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+7 707 123 45 67" type="tel"
          onKeyDown={e=>e.key==='Enter'&&add(true)}/>}/>
        <Fl l="Источник" ch={
          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
            {SRCS.map(s => (
              <button key={s.id} onClick={()=>setSource(s.id)}
                style={{padding:'6px 11px',borderRadius:20,border:`1.5px solid ${source===s.id?s.c:'#e2e8f0'}`,background:source===s.id?s.c+'18':'#fff',color:source===s.id?s.c:'#64748b',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',transition:'all .13s'}}>
                {s.l}
              </button>
            ))}
          </div>
        }/>
        <div style={{display:'flex',gap:8,marginTop:16}}>
          <Btn variant="primary" style={{flex:1,justifyContent:'center'}} disabled={busy||syncing||(!fio.trim()&&!phone.trim())} onClick={()=>add(true)}>
            {busy ? <i className="ti ti-loader spin"/> : <><i className="ti ti-user-plus"/>Добавить и открыть</>}
          </Btn>
          <Btn style={{justifyContent:'center'}} disabled={busy||syncing||(!fio.trim()&&!phone.trim())} onClick={()=>add(false)}>Добавить</Btn>
        </div>
        <button onClick={()=>onFull(fio.trim(), phone.trim(), source)}
          style={{display:'block',width:'100%',textAlign:'center',marginTop:12,border:'none',background:'transparent',color:'#3b82f6',fontSize:12.5,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
          Нужна полная форма → открыть
        </button>
      </div>
    </div>
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
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
        <link rel="icon" href="/favicon.svg"/>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css"/>
      </Head>
      <div style={{background:'#fff',borderRadius:22,padding:'34px 30px',width:'100%',maxWidth:380,boxShadow:'0 24px 80px rgba(0,0,0,.3)'}}>
        <div style={{textAlign:'center',marginBottom:26}}>
          <div style={{display:'flex',justifyContent:'center',marginBottom:12}}><Logo size={52} id="login-logo"/></div>
          <div style={{fontSize:22,fontWeight:900,letterSpacing:'-.5px'}}>Ипотека CRM</div>
          <div style={{fontSize:13,color:'#64748b',marginTop:4}}>Система для ипотечных брокеров Казахстана</div>
        </div>
        <Fl l="Логин" ch={<Inp value={lg} onChange={e=>{setLg(e.target.value);setErr('')}} placeholder="Ваш логин" style={{fontSize:16,padding:'12px 14px',borderRadius:12}}/>}/>
        <Fl l="Пароль" ch={<Inp type="password" value={pw} onChange={e=>{setPw(e.target.value);setErr('')}} placeholder="Ваш пароль" style={{fontSize:16,padding:'12px 14px',borderRadius:12}} onKeyDown={e=>e.key==='Enter'&&go()}/>}/>
        {err && <div style={{background:'#fef2f2',color:'#ef4444',border:'1.5px solid #fecaca',borderRadius:10,padding:'10px 13px',fontSize:13,fontWeight:600,marginBottom:12,textAlign:'center'}}>{err}</div>}
        <Btn variant="primary" onClick={go} disabled={ld} style={{width:'100%',justifyContent:'center',padding:'13px',fontSize:15,borderRadius:14,marginBottom:18}}>
          {ld ? <><i className="ti ti-loader spin"/>Вход...</> : <><i className="ti ti-login"/>Войти</>}
        </Btn>
        {hints.length > 0 && (
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
        )}
        <a href="/promo" style={{display:'block',textAlign:'center',marginTop:16,fontSize:12.5,fontWeight:700,color:'#3b82f6',textDecoration:'none'}}>
          Что умеет система → узнать подробнее
        </a>
      </div>
    </div>
  )
}

LoginPage = React.memo(LoginPage)

// ─── BOTTOM NAV (mobile) ─────────────────────────────────────────
function BottomNav({ page, navTo, openTasks, overdueTasks, waUnread }) {
  // «Ещё»: Список клиентов и KPI раньше были недостижимы с телефона
  const [moreOpen, setMoreOpen] = useState(false)
  const items = [
    { id:'dashboard', l:'Главная',    i:'ti-home' },
    { id:'clients',   l:'Клиенты',    i:'ti-layout-kanban' },
    { id:'wa',        l:'WhatsApp',   i:'ti-brand-whatsapp', cnt:waUnread, wa:true },
    { id:'tasks',     l:'Задачи',     i:'ti-checkbox', cnt:openTasks, warn:overdueTasks>0 },
    { id:'more',      l:'Ещё',        i:'ti-dots', more:true, active:['search','kpi','calc'].includes(page) },
  ]
  const MORE = [
    { id:'calc',   l:'Калькулятор',     i:'ti-calculator',   d:'Расчёты ипотеки и налогов' },
    { id:'search', l:'Список клиентов', i:'ti-list-details', d:'Поиск, фильтры, импорт/экспорт' },
    { id:'kpi',    l:'KPI',             i:'ti-chart-bar',    d:'Отчёт по воронке и менеджерам' },
  ]
  return (
    <nav className="bot-nav" style={{background:'#fff',borderTop:'1.5px solid #e2e8f0',position:'fixed',bottom:0,left:0,right:0,zIndex:200}}>
      {moreOpen && (
        <div onClick={()=>setMoreOpen(false)} style={{position:'fixed',inset:0,background:'rgba(15,23,42,.35)',zIndex:-1}}/>
      )}
      {moreOpen && (
        <div style={{position:'absolute',bottom:'100%',left:8,right:8,marginBottom:8,background:'#fff',borderRadius:16,boxShadow:'0 -6px 40px rgba(0,0,0,.25)',border:'1.5px solid #e2e8f0',overflow:'hidden'}}>
          {MORE.map(mi => (
            <button key={mi.id} onClick={()=>{setMoreOpen(false); navTo(mi.id)}}
              style={{display:'flex',alignItems:'center',gap:12,width:'100%',padding:'14px 16px',border:'none',background:page===mi.id?'#eff6ff':'transparent',cursor:'pointer',fontFamily:'inherit',textAlign:'left',borderBottom:'1px solid #f1f5f9'}}>
              <i className={`ti ${mi.i}`} style={{fontSize:20,color:page===mi.id?'#3b82f6':'#64748b',flexShrink:0}}/>
              <span>
                <span style={{display:'block',fontSize:13.5,fontWeight:700,color:'#0f172a'}}>{mi.l}</span>
                <span style={{display:'block',fontSize:11,color:'#94a3b8'}}>{mi.d}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <div style={{display:'flex',paddingBottom:'env(safe-area-inset-bottom)'}}>
        {items.map(n => (
          <button key={n.id} onClick={() => n.more ? setMoreOpen(v=>!v) : (setMoreOpen(false), navTo(n.id))}
            style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'8px 4px 6px',cursor:'pointer',border:'none',background:'transparent',
              color:n.wa?'#25d366':(page===n.id||n.active)?'#3b82f6':'#94a3b8',
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
function DashPage({ data, pipeline, managers, clients, onOpen, onLoadDash }) {
  useEffect(() => { if (!data) onLoadDash() }, [data, onLoadDash])

  if (!data) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:300,color:'#64748b',gap:10}}>
      <i className="ti ti-loader spin" style={{fontSize:24}}/>Загрузка дашборда...
    </div>
  )

  const { metrics, funnel, managers: mgrStats, recent } = data
  const pl = pipeline || PIPELINE_DEFAULT

  // №2: «Сегодня горит» — три списка требующих действия ПРЯМО СЕЙЧАС
  const cl = clients || []
  const todayStr = new Date().toISOString().split('T')[0]
  const days3 = Date.now() - 3*24*3600*1000
  // Новые лиды без контакта
  const hotNew = cl.filter(c => c.stage === 'new_lead' && !c.contactStatus).slice(0, 8)
  // Активные, но не трогали 3+ дней (нет свежих комментов и создан давно)
  const forgotten = cl.filter(c => {
    if (['closed','issuance'].includes(c.stage)) return false
    if (c.stage === 'new_lead') return false
    const lastTouch = Math.max(
      new Date(c.createdAt||0).getTime(),
      ...(c.comments||[]).map(cm => new Date(cm.createdAt||0).getTime() || 0),
      // Задачи — тоже активность: created 'YYYY-MM-DD' парсится датой
      ...(c.tasks||[]).map(t => new Date(t.createdAt || t.created || 0).getTime() || 0)
    )
    return lastTouch < days3
  }).slice(0, 8)
  // Задачи «перезвонить» и все с дедлайном сегодня
  const callToday = cl.filter(c =>
    (c.tasks||[]).some(t => !t.done && t.due && t.due <= todayStr)
  ).slice(0, 8)

  const urgentBlocks = [
    { icon:'🔴', title:'Новые лиды без ответа', list:hotNew,    empty:'Все лиды обработаны 👍', hint:c=>SRC[c.source]?.l||'' },
    { icon:'🟡', title:'Не трогали 3+ дней',    list:forgotten, empty:'Никто не забыт 👍',      hint:c=>pl.find(p=>p.id===c.stage)?.l||'' },
    { icon:'📞', title:'Задачи на сегодня',     list:callToday, empty:'Задач на сегодня нет 👍', hint:c=>{const t=(c.tasks||[]).find(t=>!t.done&&t.due&&t.due<=todayStr);return t?(t.type||'')+' '+(t.text||''):''}},
  ]
  const hasUrgent = hotNew.length + forgotten.length + callToday.length > 0

  return (
    <div>
      {/* №2: Сегодня горит */}
      <div style={{marginBottom:16}}>
        <div className="section-title">
          {hasUrgent ? '🔥 Требует внимания сегодня' : '✅ Всё под контролем'}
        </div>
        {hasUrgent && (
          <div className="hint" style={{marginBottom:11}}>
            <span className="hint-icon">👋</span>
            <div>С этого начните день. Кликните на клиента — откроется карточка. Слева направо: кто написал и ждёт ответа, кого давно не трогали, кому запланирован звонок сегодня.</div>
          </div>
        )}
        <div className='mg3'>
          {urgentBlocks.map(b => (
            <div key={b.title} style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:13,padding:'12px 13px',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
              <div style={{fontSize:11.5,fontWeight:800,color:'#334155',marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
                {b.icon} {b.title}
                {b.list.length > 0 && <span style={{marginLeft:'auto',background:'#fef2f2',color:'#dc2626',borderRadius:20,fontSize:10,fontWeight:800,padding:'1px 7px'}}>{b.list.length}</span>}
              </div>
              {b.list.length === 0
                ? <div style={{fontSize:11.5,color:'#94a3b8',padding:'4px 0'}}>{b.empty}</div>
                : b.list.map(c => (
                    <div key={c.id} onClick={()=>onOpen(c)}
                      style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,padding:'6px 8px',borderRadius:8,cursor:'pointer',marginBottom:2}}
                      onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <span style={{fontSize:12,fontWeight:600,color:'#0f172a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.fio||c.phone||'Без имени'}</span>
                      <span style={{fontSize:10,color:'#94a3b8',flexShrink:0,maxWidth:'45%',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{b.hint(c)}</span>
                    </div>
                  ))
              }
            </div>
          ))}
        </div>
      </div>
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

// fmtN импортируется из lib/constants

DashPage = React.memo(DashPage)

// ─── CLIENTS KANBAN ──────────────────────────────────────────────
function ClientsPage({ clients, managers, pipeline, onOpen, drag, setDrag, dragOv, setDragOv, onMove, onQuick }) {
  // Перенос с телефона: drag-and-drop не работает на таче — кнопка «на этап…»
  const [movePick, setMovePick] = useState(null)
  const pl = pipeline || PIPELINE_DEFAULT
  // №10: пустое состояние — новичок не теряется
  if (!clients.length) return (
    <div className="empty-state">
      <div className="empty-state-icon">🗂️</div>
      <div className="empty-state-title">Пока нет клиентов</div>
      <div className="empty-state-text">
        Нажмите кнопку <b style={{color:'#3b82f6'}}>+</b> вверху справа, чтобы добавить первого клиента.
        Или дождитесь входящего сообщения в WhatsApp — лид создастся сам.
      </div>
    </div>
  )
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
                      {/* amoCRM-правило: у каждой сделки должна быть задача */}
                      {c.stage!=='closed' && !(c.tasks||[]).some(t=>!t.done) &&
                        <span style={{background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',borderRadius:5,padding:'1px 6px',fontSize:11,fontWeight:800}}>⚠ без задачи</span>}
                      {c.stage==='closed' && c.closeReason &&
                        <span style={{background:'#f1f5f9',color:'#64748b',border:'1px solid #e2e8f0',borderRadius:5,padding:'1px 6px',fontSize:10.5,fontWeight:700}}>{c.closeReason}</span>}
                    </div>
                    {c.contractAmount > 0 && <div style={{fontWeight:800,fontSize:12,color:p.c}}>{fmtN(c.contractAmount)}₸</div>}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:5}}>
                      <span style={{fontSize:10,color:'#94a3b8'}}>{c.dateIn}</span>
                      {m && <span style={{fontSize:10,color:'#64748b',fontWeight:600,display:'flex',alignItems:'center',gap:3}}><span style={{width:5,height:5,borderRadius:'50%',background:m.color,display:'inline-block'}}/>{m.name?.split(' ')[0]}</span>}
                    </div>
                    {/* №3+№6: быстрые действия — звонок, статус, перенос этапа одним тапом */}
                    <div style={{display:'flex',gap:4,marginTop:7,paddingTop:7,borderTop:'1px solid #f1f5f9'}} onClick={e=>e.stopPropagation()}>
                      {c.phone && <a href={`tel:${c.phone}`} title="Позвонить"
                        style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'9px 0',minHeight:36,borderRadius:7,background:'#f0fdf4',color:'#16a34a',textDecoration:'none',fontSize:14}}>
                        <i className="ti ti-phone"/>
                      </a>}
                      {c.phone && <button title="Не дозвонился" onClick={()=>onQuick && onQuick(c,'noanswer')}
                        style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'9px 0',minHeight:36,borderRadius:7,background:'#fef2f2',color:'#dc2626',border:'none',cursor:'pointer',fontSize:14}}>
                        <i className="ti ti-phone-off"/>
                      </button>}
                      {c.phone && <button title="Перезвонить завтра" onClick={()=>onQuick && onQuick(c,'callback')}
                        style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'9px 0',minHeight:36,borderRadius:7,background:'#fffbeb',color:'#d97706',border:'none',cursor:'pointer',fontSize:14}}>
                        <i className="ti ti-clock"/>
                      </button>}
                      <button title="Переместить на этап…" onClick={()=>setMovePick(c)}
                        style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'9px 0',minHeight:36,borderRadius:7,background:'#eff6ff',color:'#1d4ed8',border:'none',cursor:'pointer',fontSize:14}}>
                        <i className="ti ti-arrows-exchange"/>
                      </button>
                    </div>
                  </div>
                )
              })}
              {sc.length === 0 && <div style={{textAlign:'center',color:'#94a3b8',fontSize:11,padding:'16px 0',fontStyle:'italic'}}>Пусто</div>}
            </div>
          </div>
        )
      })}

      {/* Шторка «Переместить на этап» — перенос без drag-and-drop (тач) */}
      {movePick && (
        <div onClick={()=>setMovePick(null)}
          style={{position:'fixed',inset:0,background:'rgba(15,23,42,.5)',zIndex:700,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()}
            style={{background:'#fff',borderRadius:'18px 18px 0 0',width:'100%',maxWidth:480,maxHeight:'70vh',overflowY:'auto',padding:'16px 14px calc(14px + env(safe-area-inset-bottom))',boxShadow:'0 -12px 48px rgba(0,0,0,.3)'}}>
            <div style={{fontWeight:800,fontSize:14,marginBottom:10,padding:'0 4px'}}>
              «{movePick.fio||movePick.phone||'Клиент'}» — переместить на этап:
            </div>
            {(pipeline||PIPELINE_DEFAULT).map(p => p.id !== movePick.stage && (
              <button key={p.id} onClick={()=>{onMove(movePick.id, p.id); setMovePick(null)}}
                style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'13px 12px',border:'none',background:'transparent',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:13.5,fontWeight:600,color:'#0f172a',textAlign:'left'}}>
                <span style={{width:10,height:10,borderRadius:'50%',background:p.c,flexShrink:0}}/>{p.l}
              </button>
            ))}
          </div>
        </div>
      )}
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
  // Маршрут сопровождения по типу договора (7 групп программ)
  const accT   = getAccompTemplate(c.contractType)
  const accSt  = accT.stages
  const accCur = Math.min(c.accompStageIndex||0, accSt.length-1)
  const totalItems = accSt.reduce((s,st) => s+getChecklist(cls,st).length, 0)
  const totalDone  = accSt.reduce((s,st,i) => {
    const items = getChecklist(cls, st)
    return s + (((c.accompStages||{})[i]?.done)||[]).filter(id => items.some(it=>it.id===id)).length
  }, 0)
  const pct        = totalItems > 0 ? Math.round(totalDone/totalItems*100) : 0
  const paid       = (c.payments||[]).filter(x=>x.status==='paid').reduce((s,x)=>s+x.paidAmount,0)
  const partial    = (c.payments||[]).filter(x=>x.status==='partial').reduce((s,x)=>s+x.paidAmount,0)
  const payPct     = c.contractAmount > 0 ? Math.round((paid+partial)/c.contractAmount*100) : 0
  const openTasks  = (c.tasks||[]).filter(t=>!t.done)
  const overdue    = openTasks.filter(t=>t.due&&t.due<today())
  const lastCmt    = [...(c.comments||[])].sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0]
  const docsCount  = accSt.reduce((s,st,i)=>s+((c.accompStages||{})[i]?.docs||[]).length, 0)
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
              <span style={{color:'#047857',fontWeight:600}}>📍 {accSt[accCur]} · {accT.l}</span>
              <span style={{color:'#64748b'}}>{totalDone}/{totalItems}</span>
            </div>
            <div style={{display:'flex',gap:3,marginTop:8,flexWrap:'wrap'}}>
              {accSt.map((s,i) => {
                const sd = (c.accompStages||{})[i]||{}
                const items = getChecklist(cls, s)
                const done  = (sd.done||[]).filter(id=>items.some(it=>it.id===id)).length
                const allDone = items.length>0&&done===items.length
                const isCur = accCur===i
                return <div key={s} title={s} style={{width:isCur?26:18,height:18,borderRadius:5,background:allDone?'#10b981':isCur?'#3b82f6':'#e2e8f0',color:allDone||isCur?'#fff':'#94a3b8',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,flexShrink:0,transition:'all .2s'}}>{allDone?'✓':i+1}</div>
              })}
            </div>
          </div>
        )}

        {(() => {
          const prg = c.program ? PROGRAMS_FALLBACK.find(p => p.id === c.program) : null
          const ct  = c.contractType ? CT[c.contractType] : null
          if (!prg && !ct) return null
          const chip = { display:'inline-flex',alignItems:'center',gap:4,background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:20,padding:'2px 9px',fontSize:10.5,fontWeight:700,color:'#334155' }
          return (
            <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>
              {prg && <span style={chip}>{prg.icon} {prg.n}</span>}
              {ct  && <span style={{...chip,color:'#7c3aed',borderColor:'#ddd6fe',background:'#f5f3ff'}}>📄 {ct.l}</span>}
            </div>
          )
        })()}
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
function SearchPage({ clients, managers, pipeline, checklists, search, setSearch, fStage, setFStage, fMgr, setFMgr, onOpen, waNew, canMass, onMass, onExportSel, onMerge, onImport, onExportAll }) {
  const [mergeDlg, setMergeDlg] = useState(null)   // { a, b, primary } — диалог слияния дублей
  const pl = pipeline || PIPELINE_DEFAULT
  // Вид: карточки / таблица (запоминается)
  const [view, setView] = useState(() => {
    try { return localStorage.getItem('crm_list_view') || 'cards' } catch(e) { return 'cards' }
  })
  function switchView(v) { setView(v); try { localStorage.setItem('crm_list_view', v) } catch(e) {} }
  const [sortK, setSortK] = useState('dateIn')
  const [sortD, setSortD] = useState(-1)
  const [sel,   setSel]   = useState(() => new Set())
  const [fTag,  setFTag]  = useState('')
  const [massStage, setMassStage] = useState('')
  const [massMgr,   setMassMgr]   = useState('')

  const allTags = useMemo(() => {
    const s = new Set()
    for (const c of clients) for (const t of (c.tags||[])) s.add(t)
    return [...s].sort()
  }, [clients])

  // Пары возможных дублей (одинаковый хвост телефона или ИИН) — слияние было
  // спрятано в виде «Таблица» за выбором ровно двух строк, никто не находил
  const dupPairs = useMemo(() => {
    const byKey = new Map()
    const pairs = []
    for (const c of clients) {
      const keys = []
      const tail = (c.phone || '').replace(/\D/g, '').slice(-10)
      if (tail.length === 10) keys.push('p' + tail)
      if (c.iin) keys.push('i' + c.iin)
      for (const k of keys) {
        if (byKey.has(k) && byKey.get(k).id !== c.id) { pairs.push([byKey.get(k), c]); break }
        byKey.set(k, c)
      }
    }
    return pairs.slice(0, 10)
  }, [clients])

  const shown = useMemo(
    () => fTag ? clients.filter(c => (c.tags||[]).includes(fTag)) : clients,
    [clients, fTag]
  )

  const stageIdx = useMemo(() => Object.fromEntries(pl.map((p,i)=>[p.id,i])), [pl])
  const mgrName  = id => managers.find(m=>m.id===id)?.name || ''
  const sorted = useMemo(() => {
    const get = c => sortK==='stage' ? (stageIdx[c.stage] ?? 99)
      : sortK==='manager' ? mgrName(c.manager)
      : sortK==='contractAmount' ? (c.contractAmount||0)
      : (c[sortK] || '')
    return [...shown].sort((a,b) => {
      const x = get(a), y = get(b)
      return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'ru')) * sortD
    })
  }, [shown, sortK, sortD, stageIdx, managers])

  function toggleSort(k) { sortK === k ? setSortD(d=>-d) : (setSortK(k), setSortD(1)) }
  function toggleSel(id) { setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAll() { setSel(s => s.size === sorted.length ? new Set() : new Set(sorted.map(c=>c.id))) }
  async function applyMass() {
    const patch = {}
    if (massStage) patch.stage   = massStage
    if (massMgr)   patch.manager = massMgr
    if (!Object.keys(patch).length) return
    await onMass([...sel], patch)
    setSel(new Set()); setMassStage(''); setMassMgr('')
  }

  const COLS = [
    ['fio','Клиент'], ['phone','Телефон'], ['stage','Этап'], ['manager','Менеджер'],
    ['source','Источник'], ['contractAmount','Договор'], ['dateIn','Дата'],
  ]

  // Сохранённые виды: имя + набор фильтров (localStorage)
  const [views, setViews] = useState(() => {
    try { return JSON.parse(localStorage.getItem('crm_views') || '[]') } catch(e) { return [] }
  })
  function persistViews(v) { setViews(v); try { localStorage.setItem('crm_views', JSON.stringify(v)) } catch(e) {} }
  function addView() {
    const name = window.prompt('Название вида (например «Горячие Instagram»):')
    if (!name || !name.trim()) return
    persistViews([...views.filter(v => v.name !== name.trim()), { name: name.trim(), search, fStage, fMgr, fTag, view }])
  }
  function applyView(v) {
    setSearch(v.search || ''); setFStage(v.fStage || ''); setFMgr(v.fMgr || '')
    setFTag(v.fTag || ''); if (v.view) switchView(v.view)
  }
  function delView(name) { persistViews(views.filter(v => v.name !== name)) }

  return (
    <div>
      <div style={{background:'linear-gradient(135deg,#0f172a,#1e3a5f)',borderRadius:14,padding:'15px',marginBottom:14,color:'#fff'}}>
        <div style={{fontSize:16,fontWeight:900,marginBottom:3}}>📋 Список клиентов</div>
        <div style={{fontSize:12,color:'#94a3b8',marginBottom:12}}>Вся команда: поиск, фильтры, виды, импорт/экспорт, слияние дублей</div>
        <div style={{display:'flex',alignItems:'center',gap:10,background:'rgba(255,255,255,.1)',borderRadius:11,padding:'10px 13px',border:'1px solid rgba(255,255,255,.15)',marginBottom:9}}>
          <i className="ti ti-search" style={{color:'rgba(255,255,255,.6)',fontSize:18,flexShrink:0}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Начните вводить..."
            autoFocus={typeof window !== 'undefined' && window.matchMedia('(pointer:fine)').matches}
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

      {/* Сохранённые виды */}
      <div style={{display:'flex',gap:5,flexWrap:'wrap',alignItems:'center',marginBottom:12}}>
        {views.map(v => (
          <span key={v.name} style={{display:'inline-flex',alignItems:'center',gap:5,background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:20,padding:'4px 11px',fontSize:11.5,fontWeight:700,color:'#334155'}}>
            <span onClick={()=>applyView(v)} style={{cursor:'pointer'}}>⭐ {v.name}</span>
            <i className="ti ti-x" style={{fontSize:10,color:'#94a3b8',cursor:'pointer'}} onClick={()=>delView(v.name)}/>
          </span>
        ))}
        <button onClick={addView}
          style={{display:'inline-flex',alignItems:'center',gap:5,background:'transparent',border:'1.5px dashed #cbd5e1',borderRadius:20,padding:'4px 11px',fontSize:11.5,fontWeight:700,color:'#64748b',cursor:'pointer',fontFamily:'inherit'}}>
          <i className="ti ti-bookmark-plus" style={{fontSize:12}}/>Сохранить вид
        </button>
      </div>

      {/* Импорт / Экспорт — дублируют кнопки шапки, но с подписями (их искали и не находили) */}
      {canMass && (
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:12}}>
          <Btn size="sm" onClick={onImport}><i className="ti ti-upload"/>Импорт из Excel</Btn>
          <Btn size="sm" onClick={onExportAll}><i className="ti ti-download"/>Экспорт в Excel</Btn>
          <span style={{fontSize:11,color:'#94a3b8'}}>база_анкет.xlsx: с этапом и сопровождением, читается обратно импортом</span>
        </div>
      )}

      {/* Дубли теперь сами находятся и предлагают слияние */}
      {canMass && dupPairs.length > 0 && (
        <div style={{background:'#fffbeb',border:'2px solid #fde68a',borderRadius:13,padding:'11px 14px',marginBottom:12,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <i className="ti ti-copy" style={{fontSize:18,color:'#d97706',flexShrink:0}}/>
          <div style={{flex:1,minWidth:180,fontSize:12.5,color:'#92400e',lineHeight:1.45}}>
            <b>Возможные дубли: {dupPairs.length}</b> · первая пара: {dupPairs[0][0].fio||dupPairs[0][0].phone} ↔ {dupPairs[0][1].fio||dupPairs[0][1].phone}
          </div>
          <Btn size="sm" variant="primary" onClick={()=>setMergeDlg({ a: dupPairs[0][0], b: dupPairs[0][1], primary: dupPairs[0][0].id })}>
            <i className="ti ti-git-merge"/>Объединить
          </Btn>
        </div>
      )}

      {waNew?.length > 0 && !search && !fStage && !fMgr && (
        <div style={{background:'#f0fdf4',border:'2px solid #86efac',borderRadius:13,padding:'13px',marginBottom:14,display:'flex',gap:11,alignItems:'center'}}>
          <div style={{width:40,height:40,borderRadius:12,background:'#25d366',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><i className="ti ti-brand-whatsapp" style={{color:'#fff',fontSize:20}}/></div>
          <div style={{flex:1}}><div style={{fontWeight:800,fontSize:13,color:'#065f46'}}>🔔 {waNew.length} WhatsApp лидов ждут</div></div>
          {waNew.slice(0,3).map(c => <div key={c.id} onClick={()=>onOpen(c)} style={{background:'#fff',border:'1px solid #bbf7d0',borderRadius:7,padding:'4px 9px',fontSize:12,fontWeight:700,cursor:'pointer',color:'#065f46',flexShrink:0}}>{c.fio||c.phone}</div>)}
        </div>
      )}

      {clients.length > 0 && (
        <div style={{fontSize:13,color:'#64748b',fontWeight:600,marginBottom:10,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
          <i className="ti ti-list" style={{fontSize:14}}/>
          Найдено: <b style={{color:'#0f172a'}}>{shown.length}</b>
          {(fStage||fMgr||fTag) && <button onClick={()=>{setFStage('');setFMgr('');setFTag('')}} style={{background:'#fef2f2',color:'#ef4444',border:'none',borderRadius:6,padding:'2px 8px',fontSize:11,fontWeight:700,cursor:'pointer',marginLeft:4}}>Сбросить</button>}
          <div style={{marginLeft:'auto',display:'flex',gap:2,background:'#f1f5f9',borderRadius:9,padding:2}}>
            {[['cards','ti-layout-grid','Карточки'],['table','ti-table','Таблица']].map(([v,ic,l])=>(
              <button key={v} onClick={()=>switchView(v)} title={l}
                style={{display:'flex',alignItems:'center',gap:5,padding:'5px 11px',border:'none',borderRadius:7,cursor:'pointer',fontFamily:'inherit',fontSize:11.5,fontWeight:700,
                  background:view===v?'#fff':'transparent',color:view===v?'#1d4ed8':'#64748b',boxShadow:view===v?'0 1px 3px rgba(15,23,42,.12)':'none',transition:'all .13s'}}>
                <i className={`ti ${ic}`} style={{fontSize:13}}/>{l}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Фильтр по тегам */}
      {allTags.length > 0 && (
        <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:11,alignItems:'center'}}>
          <i className="ti ti-tags" style={{fontSize:13,color:'#94a3b8'}}/>
          {allTags.map(t => (
            <button key={t} onClick={()=>setFTag(fTag===t?'':t)}
              style={{padding:'3px 10px',borderRadius:20,border:`1.5px solid ${fTag===t?'#3b82f6':'#e2e8f0'}`,background:fTag===t?'#eff6ff':'#fff',color:fTag===t?'#1d4ed8':'#64748b',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              #{t}
            </button>
          ))}
        </div>
      )}

      {/* Панель массовых действий */}
      {canMass && view==='table' && sel.size > 0 && (
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:12,padding:'9px 13px',marginBottom:11}}>
          <span style={{fontSize:12.5,fontWeight:800,color:'#1d4ed8'}}>Выбрано: {sel.size}</span>
          <Sel value={massStage} onChange={e=>setMassStage(e.target.value)} style={{width:170,padding:'6px 9px',fontSize:12}}>
            <option value="">Этап — не менять</option>
            {pl.filter(p=>p.id!=='closed').map(p=><option key={p.id} value={p.id}>{p.l}</option>)}
          </Sel>
          <Sel value={massMgr} onChange={e=>setMassMgr(e.target.value)} style={{width:170,padding:'6px 9px',fontSize:12}}>
            <option value="">Менеджер — не менять</option>
            {managers.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
          </Sel>
          <Btn size="sm" variant="primary" onClick={applyMass} disabled={!massStage&&!massMgr}><i className="ti ti-bolt"/>Применить</Btn>
          <Btn size="sm" onClick={()=>onExportSel(sorted.filter(c=>sel.has(c.id)))}><i className="ti ti-download"/>Экспорт</Btn>
          {sel.size === 2 && onMerge && (
            <Btn size="sm" variant="warn" onClick={()=>{
              const [a, b] = sorted.filter(c => sel.has(c.id))
              setMergeDlg({ a, b, primary: a.id })
            }}><i className="ti ti-arrows-join"/>Объединить дубли</Btn>
          )}
          <button onClick={()=>setSel(new Set())} style={{marginLeft:'auto',border:'none',background:'transparent',color:'#64748b',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>✕ Снять</button>
        </div>
      )}

      {view === 'cards' && shown.map(c => <BigClientCard key={c.id} c={c} managers={managers} pipeline={pl} checklists={checklists} onOpen={()=>onOpen(c)}/>)}

      {view === 'table' && shown.length > 0 && (
        <div className="tbl-wrap" style={{background:'#fff'}}>
          <table style={{minWidth:760}}>
            <thead>
              <tr>
                {canMass && <th style={{width:34}}>
                  <input type="checkbox" checked={sel.size===sorted.length&&sorted.length>0} onChange={toggleAll} style={{cursor:'pointer'}}/>
                </th>}
                {COLS.map(([k,l]) => (
                  <th key={k} onClick={()=>toggleSort(k)} style={{cursor:'pointer',userSelect:'none'}}>
                    {l}{sortK===k && <i className={`ti ti-chevron-${sortD>0?'up':'down'}`} style={{fontSize:11,marginLeft:3}}/>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => {
                const p = pl.find(x=>x.id===c.stage)
                return (
                  <tr key={c.id} onClick={()=>onOpen(c)}>
                    {canMass && <td onClick={e=>e.stopPropagation()} style={{width:34}}>
                      <input type="checkbox" checked={sel.has(c.id)} onChange={()=>toggleSel(c.id)} style={{cursor:'pointer'}}/>
                    </td>}
                    <td>
                      <div style={{fontWeight:700}}>{c.fio||'—'}</div>
                      {(c.tags||[]).length>0 && <div style={{display:'flex',gap:3,flexWrap:'wrap',marginTop:2}}>{c.tags.map(t=><span key={t} style={{fontSize:9.5,fontWeight:700,color:'#1d4ed8',background:'#eff6ff',borderRadius:4,padding:'1px 5px'}}>#{t}</span>)}</div>}
                    </td>
                    <td style={{whiteSpace:'nowrap'}}>{c.phone||'—'}</td>
                    <td>{p ? <Tag c={p.c} ch={p.l}/> : c.stage}</td>
                    <td>{mgrName(c.manager)||'—'}</td>
                    <td><SrTag id={c.source}/></td>
                    <td style={{fontWeight:700,color:c.contractAmount>0?'#10b981':'#94a3b8',whiteSpace:'nowrap'}}>{c.contractAmount>0?fmtN(c.contractAmount)+'₸':'—'}</td>
                    <td style={{whiteSpace:'nowrap',color:'#64748b'}}>{c.dateIn}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {shown.length === 0 && <div style={{textAlign:'center',padding:'44px 20px',color:'#64748b'}}><i className="ti ti-search" style={{fontSize:40,display:'block',marginBottom:10,opacity:.2}}/><p style={{fontSize:15,fontWeight:500}}>Ничего не найдено</p></div>}

      {/* Диалог слияния дублей */}
      {mergeDlg && (
        <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.55)',zIndex:700,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)',padding:16}}>
          <div style={{background:'#fff',borderRadius:18,width:'100%',maxWidth:520,padding:20,boxShadow:'0 20px 60px rgba(0,0,0,.28)'}}>
            <div style={{fontWeight:800,fontSize:16,marginBottom:4}}>🔗 Объединить дубли</div>
            <div style={{fontSize:12,color:'#64748b',marginBottom:14,lineHeight:1.5}}>
              Выберите <b>главную карточку</b> — она останется. Задачи, лента, теги, платежи и кредиты
              второй перенесутся в неё, пустые поля заполнятся. Дубль уедет в корзину.
            </div>
            {[mergeDlg.a, mergeDlg.b].map(cl => {
              const p = pl.find(x => x.id === cl.stage)
              const isP = mergeDlg.primary === cl.id
              return (
                <div key={cl.id} onClick={()=>setMergeDlg(d=>({...d, primary: cl.id}))}
                  style={{display:'flex',alignItems:'center',gap:11,padding:'12px 14px',border:`2px solid ${isP?'#3b82f6':'#e2e8f0'}`,borderRadius:12,marginBottom:8,cursor:'pointer',background:isP?'#eff6ff':'#fff'}}>
                  <div style={{width:20,height:20,borderRadius:'50%',border:`2.5px solid ${isP?'#3b82f6':'#cbd5e1'}`,background:isP?'#3b82f6':'#fff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {isP && <i className="ti ti-check" style={{fontSize:11,color:'#fff'}}/>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:800,fontSize:14}}>{cl.fio || 'Без имени'}{isP && <span style={{fontSize:10,color:'#1d4ed8',marginLeft:7,fontWeight:700}}>ГЛАВНАЯ</span>}</div>
                    <div style={{fontSize:11.5,color:'#64748b',marginTop:2}}>
                      {cl.phone || '—'}{cl.iin ? ' · ИИН ' + cl.iin : ''} · {p?.l || cl.stage} · с {cl.dateIn || '—'}
                      {' · задач: ' + (cl.tasks||[]).filter(t=>!t.done).length}
                    </div>
                  </div>
                </div>
              )
            })}
            <div style={{display:'flex',gap:8,marginTop:14}}>
              <Btn variant="primary" style={{flex:1,justifyContent:'center'}} onClick={async()=>{
                const primary   = mergeDlg.primary
                const secondary = primary === mergeDlg.a.id ? mergeDlg.b.id : mergeDlg.a.id
                setMergeDlg(null); setSel(new Set())
                await onMerge(primary, secondary)
              }}>
                <i className="ti ti-arrows-join"/>Объединить
              </Btn>
              <Btn onClick={()=>setMergeDlg(null)}>Отмена</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

SearchPage = React.memo(SearchPage)

// ─── WHATSAPP PAGE ───────────────────────────────────────────────

// ─── КАЛЕНДАРЬ ЗАДАЧ (вид «Календарь» в разделе Задачи) ──────────
function TasksCalendar({ tasks, onOpen }) {
  const now = new Date()
  const [ym, setYm] = useState([now.getFullYear(), now.getMonth()])
  const [selDay, setSelDay] = useState(today())
  const [y, m] = ym
  const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
  const td = today()

  const byDate = useMemo(() => {
    const map = {}
    for (const t of tasks) {
      if (t.done || !t.due) continue
      ;(map[t.due] = map[t.due] || []).push(t)
    }
    return map
  }, [tasks])

  const first   = new Date(y, m, 1)
  const offset  = (first.getDay() + 6) % 7          // Пн-первый
  const daysIn  = new Date(y, m + 1, 0).getDate()
  const cells   = [...Array(offset).fill(null), ...Array.from({length: daysIn}, (_, i) => i + 1)]
  const dstr    = d => `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  const nav     = dir => { const dt = new Date(y, m + dir, 1); setYm([dt.getFullYear(), dt.getMonth()]) }
  const dayTasks = byDate[selDay] || []

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:11}}>
        <Btn size="sm" onClick={()=>nav(-1)}><i className="ti ti-chevron-left"/></Btn>
        <div style={{fontWeight:800,fontSize:15,minWidth:150,textAlign:'center'}}>{MONTHS[m]} {y}</div>
        <Btn size="sm" onClick={()=>nav(1)}><i className="ti ti-chevron-right"/></Btn>
        <Btn size="sm" onClick={()=>{const d=new Date(); setYm([d.getFullYear(),d.getMonth()]); setSelDay(td)}}>Сегодня</Btn>
      </div>
      <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:14,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:12}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',borderBottom:'1.5px solid #e2e8f0',background:'#f8fafc'}}>
          {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => (
            <div key={d} style={{padding:'7px 4px',textAlign:'center',fontSize:10.5,fontWeight:800,color:'#94a3b8',textTransform:'uppercase'}}>{d}</div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)'}}>
          {cells.map((d, i) => {
            if (d === null) return <div key={'e'+i} style={{minHeight:64,borderBottom:'1px solid #f1f5f9',borderRight:(i%7<6)?'1px solid #f1f5f9':'none'}}/>
            const ds      = dstr(d)
            const list    = byDate[ds] || []
            const isToday = ds === td
            const isSel   = ds === selDay
            const hasOver = ds < td && list.length > 0
            return (
              <div key={ds} onClick={()=>setSelDay(ds)}
                style={{minHeight:64,padding:'5px 6px',cursor:'pointer',borderBottom:'1px solid #f1f5f9',borderRight:(i%7<6)?'1px solid #f1f5f9':'none',
                  background:isSel?'#eff6ff':'transparent',transition:'background .12s'}}>
                <div style={{width:22,height:22,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11.5,fontWeight:isToday?800:600,
                  background:isToday?'#3b82f6':'transparent',color:isToday?'#fff':hasOver?'#ef4444':'#334155',marginBottom:3}}>{d}</div>
                {list.length > 0 && (
                  <div style={{display:'flex',gap:3,alignItems:'center',flexWrap:'wrap'}}>
                    <span style={{fontSize:9.5,fontWeight:800,color:'#fff',background:hasOver?'#ef4444':'#3b82f6',borderRadius:8,padding:'1px 6px'}}>{list.length}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:14,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
        <div style={{padding:'10px 14px',borderBottom:'1.5px solid #e2e8f0',background:'#f8fafc',fontWeight:800,fontSize:13}}>
          📅 {selDay}{selDay===td?' · сегодня':''} — задач: {dayTasks.length}
        </div>
        {dayTasks.length === 0 && <div style={{padding:'16px 14px',fontSize:12.5,color:'#94a3b8',fontStyle:'italic'}}>На этот день задач нет</div>}
        {dayTasks.map(t => (
          <div key={t.id} onClick={()=>onOpen(t.cl)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderBottom:'1px solid #f1f5f9',cursor:'pointer'}}
            onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <div style={{width:18,height:18,borderRadius:'50%',border:`2.5px solid ${selDay<td?'#ef4444':'#cbd5e1'}`,flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:13}}>{t.type||'Задача'}{t.text&&<span style={{color:'#64748b',fontWeight:400}}> — {t.text}</span>}</div>
            </div>
            <span style={{fontSize:12,color:'#64748b',fontWeight:600,flexShrink:0}}>{t.cFio}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── TASKS PAGE ──────────────────────────────────────────────────
function TasksPage({ clients, managers, onOpen, user, onSave }) {
  const todayStr  = today()
  const [showNew, setShowNew] = useState(false)
  const [tView,   setTView]   = useState('list')  // list | calendar
  const [fTMgr,   setFTMgr]   = useState('')      // фильтр по менеджеру клиента
  const [newTask, setNewTask] = useState({ text:'', due:'', clientId:'', note:'' })

  function createTask() {
    if (!newTask.text.trim()) return
    if (!newTask.clientId)    return
    const client = clients.find(c => c.id === newTask.clientId)
    if (!client) return
    const task = {
      id:         'task_' + Date.now(),
      type:       newTask.text.trim(),   // списки показывают type как заголовок
      text:       '',
      due:        newTask.due || '',
      note:       newTask.note || '',
      done:       false,
      // admin/head не привязаны к manager_id — задача создаётся без назначения,
      // менеджер клиента (client.manager) остаётся основным ответственным
      assignedTo: user?.role === 'manager' ? (user?.manager_id || '') : '',
      created:    new Date().toISOString().slice(0,10),
    }
    onSave && onSave({ ...client, tasks: [...(client.tasks||[]), task] })
    setShowNew(false)
    setNewTask({ text:'', due:'', clientId:'', note:'' })
  }

  // Memoize: 5 array passes on clients — only recompute when clients change
  const { all, open, overdue, todayT, rest, done } = useMemo(() => {
    const td  = todayStr
    const src = fTMgr ? clients.filter(c => c.manager === fTMgr) : clients
    const all = src.flatMap(c => (c.tasks||[]).map(t => ({ ...t, cFio:c.fio, cl:c })))
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
  }, [clients, fTMgr])

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

      {/* Переключатель Список / Календарь / Выполненные + создание задачи */}
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:13}}>
        <div style={{display:'flex',gap:2,background:'#f1f5f9',borderRadius:9,padding:2,width:'fit-content'}}>
          {[['list','ti-list','Список'],['calendar','ti-calendar','Календарь'],['done','ti-checks',`Выполненные (${done.length})`]].map(([v,ic,l])=>(
            <button key={v} onClick={()=>setTView(v)}
              style={{display:'flex',alignItems:'center',gap:5,padding:'5px 12px',border:'none',borderRadius:7,cursor:'pointer',fontFamily:'inherit',fontSize:11.5,fontWeight:700,
                background:tView===v?'#fff':'transparent',color:tView===v?'#1d4ed8':'#64748b',boxShadow:tView===v?'0 1px 3px rgba(15,23,42,.12)':'none',transition:'all .13s'}}>
              <i className={`ti ${ic}`} style={{fontSize:13}}/>{l}
            </button>
          ))}
        </div>
        <Btn size="sm" variant="primary" onClick={()=>setShowNew(v=>!v)}><i className="ti ti-plus"/>Задача</Btn>
        <Sel value={fTMgr} onChange={e=>setFTMgr(e.target.value)} style={{width:'auto',minWidth:150,padding:'6px 10px',fontSize:12}}>
          <option value="">Все менеджеры</option>
          {managers.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
        </Sel>
      </div>

      {showNew && (
        <div style={{...S,padding:16,marginBottom:13}}>
          <div style={{fontWeight:800,fontSize:13,marginBottom:10}}>Новая задача</div>
          <div className="mg2" style={{marginBottom:8}}>
            <Inp placeholder="Что сделать (например: Позвонить)" value={newTask.text} onChange={e=>setNewTask(t=>({...t,text:e.target.value}))} autoFocus/>
            <Inp type="date" value={newTask.due} onChange={e=>setNewTask(t=>({...t,due:e.target.value}))}/>
          </div>
          <div className="mg2" style={{marginBottom:10}}>
            <Sel value={newTask.clientId} onChange={e=>setNewTask(t=>({...t,clientId:e.target.value}))}>
              <option value="">— выберите клиента —</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.fio||c.phone||'Без имени'}</option>)}
            </Sel>
            <Inp placeholder="Комментарий (необязательно)" value={newTask.note} onChange={e=>setNewTask(t=>({...t,note:e.target.value}))}/>
          </div>
          <div style={{display:'flex',gap:8}}>
            <Btn variant="primary" size="sm" disabled={!newTask.text.trim()||!newTask.clientId} onClick={createTask}><i className="ti ti-check"/>Создать</Btn>
            <Btn size="sm" onClick={()=>setShowNew(false)}>Отмена</Btn>
          </div>
        </div>
      )}

      {tView === 'calendar' && <TasksCalendar tasks={all} onOpen={onOpen}/>}

      {/* Лог выполненных задач: кто, что, когда, по какому клиенту + комментарий */}
      {tView === 'done' && (
        <div>
          <div className="hint">
            <span className="hint-icon">📜</span>
            <div>История выполненных задач: видно, <b>что сделано, когда и по какому клиенту</b>. Клик по строке — открыть карточку. Снять отметку можно в самой карточке (вкладка Задачи) — тогда задача вернётся в открытые.</div>
          </div>
          {done.length === 0 && (
            <div style={{textAlign:'center',padding:'44px 20px',color:'#64748b'}}>
              <i className="ti ti-checkbox" style={{fontSize:40,display:'block',marginBottom:10,opacity:.2}}/>
              <p style={{fontSize:15,fontWeight:500}}>Выполненных задач пока нет</p>
            </div>
          )}
          {[...done].sort((a,b)=>String(b.doneAt||'').localeCompare(String(a.doneAt||''))).map(t => (
            <div key={t.id} onClick={()=>onOpen(t.cl)}
              style={{display:'flex',alignItems:'flex-start',gap:10,padding:'11px 13px',background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:11,marginBottom:7,cursor:'pointer',transition:'all .1s'}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='#86efac';e.currentTarget.style.background='#f0fdf4'}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.background='#fff'}}>
              <div style={{width:20,height:20,borderRadius:'50%',background:'#10b981',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>
                <i className="ti ti-check" style={{fontSize:11,color:'#fff'}}/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:13,color:'#334155'}}>
                  {t.type||'Задача'}{t.text&&<span style={{color:'#64748b',fontWeight:400}}> — {t.text}</span>}
                </div>
                {t.note && <div style={{fontSize:11.5,color:'#0d9488',marginTop:2,fontStyle:'italic'}}>💬 {t.note}</div>}
                <div style={{fontSize:10.5,color:'#94a3b8',marginTop:2}}>
                  {t.doneAt ? '✅ выполнена: ' + t.doneAt : '✅ выполнена'}{t.due ? ' · срок был: ' + t.due : ''}{t.created ? ' · создана: ' + t.created : ''}
                </div>
              </div>
              <span style={{fontSize:12,color:'#64748b',fontWeight:700,flexShrink:0}}>{t.cFio}</span>
            </div>
          ))}
        </div>
      )}

      {tView === 'list' && <>
      {overdue.length > 0 && (
        <div style={{background:'#fef2f2',border:'2px solid #fecaca',borderRadius:13,overflow:'hidden',marginBottom:13}}>
          <div style={{padding:'10px 13px',fontWeight:800,fontSize:13,color:'#ef4444',borderBottom:'1px solid #fecaca',background:'#fff5f5'}}>🔴 Просроченные ({overdue.length})</div>
          {overdue.map(t => (
            <div key={t.id} onClick={()=>onOpen(t.cl)} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 13px',borderBottom:'1px solid #fecaca',cursor:'pointer',background:'transparent',transition:'background .1s'}}
              onMouseEnter={e=>e.currentTarget.style.background='#fff5f5'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <div onClick={e=>{e.stopPropagation(); onSave && onSave({ ...t.cl, tasks:(t.cl.tasks||[]).map(x=>x.id===t.id?{...x,done:true,doneAt:new Date().toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}:x) })}}
                title="Отметить выполненной" className="task-tick"
                style={{width:24,height:24,borderRadius:'50%',border:'2.5px solid #ef4444',flexShrink:0,cursor:'pointer'}}/>
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
              <div onClick={e=>{e.stopPropagation(); onSave && onSave({ ...t.cl, tasks:(t.cl.tasks||[]).map(x=>x.id===t.id?{...x,done:true,doneAt:new Date().toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}:x) })}}
                title="Отметить выполненной" className="task-tick"
                style={{width:24,height:24,borderRadius:'50%',border:'2.5px solid #cbd5e1',flexShrink:0,cursor:'pointer'}}/>
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
      </>}
    </div>
  )
}

TasksPage = React.memo(TasksPage)

// ─── KPI PAGE ────────────────────────────────────────────────────
function KPIPage({ data, period, setPeriod, pipeline }) {
  if (!data) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:300,color:'#64748b',gap:10}}>
      <i className="ti ti-loader spin" style={{fontSize:24}}/>Загрузка KPI...
    </div>
  )

  const { stats, totals, funnel, sources, closeReasons } = data
  const maxReason = Math.max(...(closeReasons||[]).map(r=>r.count), 1)
  const totalClosed = (closeReasons||[]).reduce((s,r)=>s+r.count, 0)
  const maxRev = Math.max(...(stats||[]).map(s => s.rev), 1)
  // Названия этапов — из настроенной воронки (админка), хардкод только как запас
  const STAGE_FALLBACK = {new_lead:'Новый лид',in_work:'В работе',analysis:'Анализ',consultation:'Консультация',contract:'Договор',accompaniment:'Сопровождение',approval:'Одобрение',deal:'Сделка',issuance:'Выдача',closed:'Закрыто'}
  const STAGE_L = { ...STAGE_FALLBACK, ...Object.fromEntries((pipeline||[]).map(p=>[p.id,p.l])) }
  const SRC_L = {instagram:'Instagram',tiktok:'TikTok',whatsapp:'WhatsApp',recommendation:'Рекомендация',site:'Сайт',kaspi:'Kaspi',telegram:'Telegram',other:'Другое'}
  const maxReached = Math.max(...(funnel||[]).map(f=>f.reached), 1)

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

      {/* №4: Воронка конверсии */}
      {funnel?.length > 0 && (
        <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:15,padding:16,marginBottom:14,boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
          <div className="section-title" style={{marginBottom:6}}>
            <i className="ti ti-filter" style={{color:'#6366f1'}}/>Воронка конверсии
          </div>
          <div className="hint" style={{marginBottom:11}}>
            <span className="hint-icon">📊</span>
            <div>Сколько клиентов дошло до каждого этапа. <b>Красный процент</b> — там теряется больше половины: узкое место, куда смотреть в первую очередь.</div>
          </div>
          {funnel.map((f,i) => (
            <div key={f.stage} style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
              <div style={{width:110,fontSize:11.5,color:'#475569',fontWeight:600,flexShrink:0}}>{STAGE_L[f.stage]||f.stage}</div>
              <div style={{flex:1,height:22,background:'#f1f5f9',borderRadius:6,overflow:'hidden',position:'relative'}}>
                <div style={{height:'100%',width:`${Math.max(2,Math.round(f.reached/maxReached*100))}%`,
                  background:`hsl(${240-i*18},70%,${58+i*1.5}%)`,borderRadius:6,transition:'width .4s',
                  display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:7}}>
                  <span style={{fontSize:11,fontWeight:800,color:'#fff'}}>{f.reached}</span>
                </div>
              </div>
              <div style={{width:76,fontSize:10.5,color:i>0&&f.convFromPrev<50?'#dc2626':'#64748b',textAlign:'right',flexShrink:0}}>
                {i>0 ? `${f.convFromPrev}% с пред.` : '100%'}
              </div>
            </div>
          ))}
          <div style={{fontSize:10.5,color:'#94a3b8',marginTop:8}}>
            Красным — конверсия ниже 50% с предыдущего этапа: тут теряются клиенты.
          </div>
        </div>
      )}

      {/* Причины закрытия — где теряем клиентов */}
      {closeReasons?.length > 0 && (
        <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:15,padding:16,marginBottom:14,boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
          <div style={{fontWeight:800,fontSize:15,marginBottom:6,display:'flex',alignItems:'center',gap:8}}>
            <i className="ti ti-door-exit" style={{color:'#ef4444'}}/>Причины закрытия
          </div>
          <div className="hint" style={{marginBottom:11}}>
            <span className="hint-icon">🔍</span>
            <div>Почему клиенты закрываются без сделки. Частая причина — точка роста: «дорого» → пересмотреть питч цены, «не выходит на связь» → быстрее первый контакт.</div>
          </div>
          {closeReasons.map(r => (
            <div key={r.reason} style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
              <div style={{width:160,fontSize:11.5,color:'#475569',fontWeight:600,flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.reason}</div>
              <div style={{flex:1,height:20,background:'#f1f5f9',borderRadius:6,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${Math.max(3,Math.round(r.count/maxReason*100))}%`,background:'#f87171',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:7}}>
                  <span style={{fontSize:11,fontWeight:800,color:'#fff'}}>{r.count}</span>
                </div>
              </div>
              <div style={{width:44,fontSize:10.5,color:'#64748b',textAlign:'right',flexShrink:0}}>
                {totalClosed>0?Math.round(r.count/totalClosed*100):0}%
              </div>
            </div>
          ))}
          {closeReasons.some(r=>r.reason==='Не указана') && (
            <div style={{fontSize:10.5,color:'#94a3b8',marginTop:8}}>«Не указана» — клиенты, закрытые до включения причин. Новые закрытия всегда спрашивают причину.</div>
          )}
        </div>
      )}

      {/* №4: Источники лидов */}
      {sources?.length > 0 && (
        <div style={{background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:15,padding:16,marginBottom:14,boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
          <div style={{fontWeight:800,fontSize:15,marginBottom:12,display:'flex',alignItems:'center',gap:8}}>
            <i className="ti ti-chart-pie" style={{color:'#ec4899'}}/>Откуда приходят клиенты
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr auto auto auto auto',gap:'7px 14px',alignItems:'center',fontSize:12}}>
            <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase'}}>Источник</div>
            <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase'}}>Лиды</div>
            <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase'}}>Договоры</div>
            <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase'}}>Конв.</div>
            <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase'}}>Выручка</div>
            {sources.map(s => (
              <React.Fragment key={s.source}>
                <div style={{fontWeight:600,color:'#334155'}}>{SRC_L[s.source]||s.source}</div>
                <div style={{textAlign:'right',fontWeight:700}}>{s.leads}</div>
                <div style={{textAlign:'right'}}>{s.contracts}</div>
                <div style={{textAlign:'right',fontWeight:800,color:s.convToContract>=30?'#10b981':s.convToContract>=15?'#f59e0b':'#94a3b8'}}>{s.convToContract}%</div>
                <div style={{textAlign:'right',fontWeight:700,color:'#8b5cf6'}}>{fmtN(s.revenue)}₸</div>
              </React.Fragment>
            ))}
          </div>
          <div style={{fontSize:10.5,color:'#94a3b8',marginTop:10}}>
            Смотрите не на количество лидов, а на конверсию и выручку — туда и вкладывайте бюджет.
          </div>
        </div>
      )}

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

  // №4: проверка дубля телефона — чтобы два менеджера не вели одного клиента
  const [dup, setDup] = useState(null)
  useEffect(() => {
    const digits = (f.phone||'').replace(/\D/g,'')
    if (digits.length < 10) { setDup(null); return }
    const t = setTimeout(() => {
      fetch('/api/clients/check-phone?phone=' + encodeURIComponent(f.phone), {
        headers: { Authorization: 'Bearer ' + (localStorage.getItem('crm_token')||'') },
      })
        .then(r => r.json())
        .then(d => setDup(d.found || null))
        .catch(() => setDup(null))
    }, 500)
    return () => clearTimeout(t)
  }, [f.phone])

  return (
    <ModalWrap title="Новый клиент" onClose={onClose} size="md"
      footer={<><Btn onClick={onClose}>Отмена</Btn><Btn variant="primary" onClick={()=>onSave(f)} disabled={syncing}>{syncing?<><i className="ti ti-loader spin"/>Создаю...</>:<><i className="ti ti-device-floppy"/>Создать клиента</>}</Btn></>}>
      {dup && (
        <div style={{background:'#fef2f2',border:'1.5px solid #fecaca',borderRadius:11,padding:'10px 13px',marginBottom:13,display:'flex',gap:9,alignItems:'flex-start'}}>
          <span style={{fontSize:17}}>⚠️</span>
          <div style={{fontSize:12.5,color:'#991b1b',lineHeight:1.5}}>
            <b>Этот номер уже есть в базе:</b> {dup.fio} (менеджер: {dup.manager}).
            Проверьте в «Списке клиентов» (или Ctrl+K), прежде чем создавать дубль.
          </div>
        </div>
      )}
      {!dup && (
        <div className="hint">
          <span className="hint-icon">💡</span>
          <div>Заполните хотя бы <b>ФИО и телефон</b> — остальное можно добавить позже в карточке. Телефон в любом формате: система сама приведёт к нужному виду и проверит нет ли дубля.</div>
        </div>
      )}
      <div className="r3">
        <Fl l="ФИО *" req ch={<Inp value={f.fio} onChange={e=>set('fio',e.target.value)} placeholder="Фамилия Имя"/>}/>
        <Fl l="ИИН"      ch={<Inp value={f.iin} onChange={e=>set('iin',e.target.value)} placeholder="123456789012" maxLength={12}/>}/>
        <Fl l="Телефон *" req ch={<Inp value={f.phone} onChange={e=>set('phone',e.target.value)} placeholder="+7 701 ..."/>}/>
      </div>
      <div className="r3">
        <Fl l="Город"    ch={<Sel value={f.city}    onChange={e=>set('city',e.target.value)}>{CITIES.map(c=><option key={c}>{c}</option>)}</Sel>}/>
        <Fl l="Менеджер" ch={<Sel value={f.manager||''} onChange={e=>set('manager',e.target.value)}><option value="">—</option>{managers.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</Sel>}/>
        <Fl l="Источник" ch={<Sel value={f.source}  onChange={e=>set('source',e.target.value)}>{SRCS.map(s=><option key={s.id} value={s.id}>{s.l}</option>)}</Sel>}/>
      </div>
      <div className="r2">
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
      <div className="r2">
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
  // atType/atText — черновик авто-задачи этапа (конструктор, миграция 011).
  // Префилл: настроенное значение → дефолт из кода → пусто.
  const [stages, setStages] = useState(pipeline.map(p => ({
    ...JSON.parse(JSON.stringify(p)),
    atType: p.at?.type ?? STAGE_AUTO_TASK[p.id]?.type ?? TASK_T[0],
    atText: p.at?.off ? '' : (p.at?.text ?? STAGE_AUTO_TASK[p.id]?.text ?? ''),
  })))
  function upd(id, field, val) { setStages(s=>s.map(x=>x.id===id?{...x,[field]:val}:x)) }
  function add() { setStages(s=>[...s,{id:'stage_'+uid(),l:'Новый этап',c:'#64748b',atType:TASK_T[0],atText:''}]) }
  function packStages() {
    // пустой текст = авто-задача выключена ({off:true} перекрывает дефолт из кода)
    return stages.map(({ atType, atText, ...s }) => ({
      ...s,
      at: (atText||'').trim() ? { type: atType, text: atText.trim() } : { off: true },
    }))
  }
  function del(id) { setStages(s=>s.filter(x=>x.id!==id)) }
  function mv(id, dir) {
    const idx = stages.findIndex(x=>x.id===id)
    if (idx<0) return
    const arr = [...stages]; const t = arr[idx]; arr[idx] = arr[idx+dir]; arr[idx+dir] = t; setStages(arr)
  }
  return (
    <ModalWrap title="Редактировать воронку" sub="Порядок, названия, цвета и авто-задачи этапов" onClose={onClose} size="lg"
      footer={<><Btn onClick={onClose}>Отмена</Btn><Btn variant="primary" onClick={()=>onSave(packStages())} disabled={syncing}>{syncing?<><i className="ti ti-loader spin"/>...</>:<><i className="ti ti-device-floppy"/>Сохранить воронку</>}</Btn></>}>
      <div className="hint" style={{marginBottom:11}}>
        <span className="hint-icon">🤖</span>
        <div><b>Авто-задача</b> создаётся менеджеру, когда клиент попадает на этап. Очистите текст — авто-задачи на этапе не будет. Для сохранения нужна миграция 011.</div>
      </div>
      <Btn variant="primary" size="sm" onClick={add} style={{marginBottom:13}}><i className="ti ti-plus"/>Добавить этап</Btn>
      {stages.map((p, i) => (
        <div key={p.id} style={{background:'#f8fafc',borderRadius:11,border:'1.5px solid #e2e8f0',marginBottom:8,padding:'10px 12px'}}>
          <div style={{display:'flex',alignItems:'center',gap:9}}>
            <span style={{fontSize:12,fontWeight:700,color:'#64748b',width:20,flexShrink:0}}>{i+1}.</span>
            <Inp value={p.l} onChange={e=>upd(p.id,'l',e.target.value)} style={{flex:1,minWidth:0}}/>
            <div style={{display:'flex',gap:5}}>{COLORS.map(c=><div key={c} onClick={()=>upd(p.id,'c',c)} style={{width:20,height:20,borderRadius:5,background:c,cursor:'pointer',boxShadow:p.c===c?`0 0 0 2px #fff,0 0 0 4px #1a1a1a`:'none'}}/>)}</div>
            <div style={{display:'flex',gap:4}}>
              <Btn size="sm" onClick={()=>i>0&&mv(p.id,-1)} disabled={i===0} style={{width:28,height:28,padding:0,opacity:i===0?.3:1}}><i className="ti ti-arrow-up" style={{fontSize:11}}/></Btn>
              <Btn size="sm" onClick={()=>i<stages.length-1&&mv(p.id,1)} disabled={i===stages.length-1} style={{width:28,height:28,padding:0,opacity:i===stages.length-1?.3:1}}><i className="ti ti-arrow-down" style={{fontSize:11}}/></Btn>
              <Btn size="sm" variant="danger" onClick={()=>del(p.id)} style={{width:28,height:28,padding:0}}><i className="ti ti-trash" style={{fontSize:11}}/></Btn>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:7,marginTop:8,paddingLeft:29}}>
            <span style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',flexShrink:0}}>Авто-задача</span>
            <Sel value={p.atType} onChange={e=>upd(p.id,'atType',e.target.value)} style={{width:170,flexShrink:0,padding:'6px 8px',fontSize:12}}>
              {TASK_T.map(t=><option key={t}>{t}</option>)}
            </Sel>
            <Inp value={p.atText} onChange={e=>upd(p.id,'atText',e.target.value)} placeholder="Пусто — без авто-задачи" style={{flex:1,minWidth:0,padding:'6px 10px',fontSize:12}}/>
          </div>
        </div>
      ))}
    </ModalWrap>
  )
}

