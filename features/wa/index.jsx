// features/wa/index.jsx
// WhatsApp — вынесен из pages/index.js. Экспортирует WAPage.

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { api } from '../../lib/api'
import { emptyClient, fmt, fmtN, MAX_FILE_SIZE_BYTES,
  CR, CR_ST, CITIES, CONTACT_ST } from '../../lib/constants'
import { Inp, Sel, Fl } from '../../components/ui'


// Подпись разделителя дат в переписке: Сегодня / Вчера / «14 июля»
function waDayLabel(d) {
  if (!d) return ''
  const today = new Date(); today.setHours(0,0,0,0)
  const day = new Date(d); day.setHours(0,0,0,0)
  const diff = Math.round((today - day) / 86400000)
  if (diff === 0) return 'Сегодня'
  if (diff === 1) return 'Вчера'
  return day.toLocaleDateString('ru', { day: 'numeric', month: 'long' })
}

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

const WA_STATUSES = [
  { id: 'all',        l: 'Все',       color: '#64748b' },
  { id: 'new',        l: 'Новые',     color: '#f59e0b' },
  { id: 'in_work',    l: 'В работе',  color: '#3b82f6' },
  { id: 'done',       l: 'Закрытые',  color: '#10b981' },
]



export function WAPage({ waConfigured = true, chats, messages, managers, clients, selChat, onSelChat, onSend, onSendMedia, onImport, onAssign, onUpdateStatus, user, onOpenClient, mgrById, toast$ }) {
  const [msgText,         setMsgText]         = useState('')
  const [showChatView,    setShowChatView]     = useState(false)
  const [showTemplates,   setShowTemplates]    = useState(false)
  const [tmplCat,         setTmplCat]          = useState(0)
  const [tmplSearch,      setTmplSearch]       = useState('')
  const [showNewLead,     setShowNewLead]       = useState(false)
  const [showClientPanel, setShowClientPanel]  = useState(false)
  const [showAssignDlg,   setShowAssignDlg]    = useState(false)
  const [waSearch,        setWaSearch]         = useState('')
  const [quickReplies,    setQuickReplies]     = useState([])
  const [showQuickMenu,   setShowQuickMenu]    = useState(false)
  const [calcBusy,        setCalcBusy]         = useState(false)
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
    // Единая подстановка переменных (applyTemplate): раньше здесь читались
    // contract_amount/contract_type (snake_case), а клиент в camelCase — сумма и
    // программа не подставлялись. Теперь общий движок, как в панели «Шаблоны».
    setMsgText(applyTemplate(r.body))
    setShowQuickMenu(false)
    setQuickFilter('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const filteredQuickReplies = quickReplies.filter(r => {
    if (!quickFilter) return true
    return r.trigger.toLowerCase().includes(quickFilter) ||
           r.title.toLowerCase().includes(quickFilter)
  })

  // Единый список шаблонов для панели «Шаблоны»: сначала настроенные техником
  // в админке (те же, что и по «/»), затем встроенные заготовки. Раньше панель
  // показывала ТОЛЬКО встроенные — техник правил один набор, а менеджер видел другой.
  const templateCats = [
    ...(quickReplies.length
      ? [{ cat: '⭐ Ваши шаблоны', items: quickReplies.map(r => ({ id: r.id, label: r.title, text: r.body })) }]
      : []),
    ...MSG_TEMPLATES,
  ]

  // Запрашиваем уведомления при первом открытии
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Автопрокрутка вниз — только если менеджер уже внизу (иначе не мешаем читать
  // историю: раньше каждый поллинг рывком тянул вниз). Смена чата — сразу вниз.
  const prevChatId = useRef(null)
  useEffect(() => {
    const box = msgsEndRef.current?.parentElement
    const chatChanged = prevChatId.current !== selChat?.id
    prevChatId.current = selChat?.id
    if (!box) return
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 140
    if (chatChanged) msgsEndRef.current?.scrollIntoView({ behavior: 'auto' })
    else if (nearBottom) msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, selChat])

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
  // Без useMemo: мемоизация тут ловила баги (кнопка «Шаблоны» не работала —
  // showTemplates не был в зависимостях). Рендер дешёвый, фильтрация уже мемоизирована.
  const ChatList = (
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
                  {lc
                    ? <span style={{fontSize:10,color:'#25d366',display:'flex',alignItems:'center',gap:2}}><i className="ti ti-link" style={{fontSize:9}}/>{lc.fio}</span>
                    : <span style={{fontSize:10,color:'#d97706',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:6,padding:'0 5px',fontWeight:700}}>не в базе</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  // ── Chat view — useMemo чтобы не перестраивать при изменении списка чатов
  const ChatView = (
    <div className={"wa-main" + (!showChatView ? " slide-out" : "")}>
      {!selChat ? (
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#64748b',gap:14,background:'#f0f0f0',padding:'0 30px',textAlign:'center'}}>
          <i className="ti ti-brand-whatsapp" style={{fontSize:56,color:'#25d366',opacity:.25}}/>
          <div style={{fontWeight:700,fontSize:16}}>Выберите чат слева</div>
          <div style={{fontSize:12.5,lineHeight:1.6,maxWidth:300,color:'#64748b'}}>
            Все сообщения клиентов приходят сюда автоматически. Если чат связан с карточкой клиента — справа появится его профиль и кнопка быстрого расчёта ипотеки.
            <br/><br/>
            Кнопкой <b style={{color:'#075e54'}}>+ Лид</b> сверху можно добавить нового клиента вручную.
          </div>
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

            {/* Действия — понятные кнопки с подписями */}
            <button onClick={()=>setShowAssignDlg(!showAssignDlg)} title="Назначить менеджера и сменить статус чата"
              style={{border:'none',background:showAssignDlg?'#fff':'rgba(255,255,255,.18)',color:showAssignDlg?'#075e54':'#fff',borderRadius:9,padding:'7px 11px',cursor:'pointer',fontSize:12.5,fontWeight:700,fontFamily:'inherit',display:'flex',alignItems:'center',gap:5,flexShrink:0}}>
              <i className="ti ti-user-cog" style={{fontSize:15}}/><span className="wa-btn-label">Менеджер</span>
            </button>

            {linkedClient
              ? <button onClick={()=>setShowClientPanel(!showClientPanel)} title="Открыть карточку клиента"
                  style={{border:'none',background:showClientPanel?'#fff':'rgba(255,255,255,.18)',color:showClientPanel?'#075e54':'#fff',borderRadius:9,padding:'7px 11px',cursor:'pointer',fontSize:12.5,fontWeight:700,fontFamily:'inherit',display:'flex',alignItems:'center',gap:5,flexShrink:0}}>
                  <i className="ti ti-id" style={{fontSize:15}}/><span className="wa-btn-label">Карточка</span>
                </button>
              : <button onClick={()=>{
                    setNLead(x=>({
                      ...x,
                      phone: selChat.phone || '',
                      fio:   selChat.name && !selChat.name.startsWith('+') ? selChat.name : '',
                      msg:   messages.slice(-3).map(m=>m.body).filter(Boolean).join(' / ') || '',
                    }))
                    setShowNewLead(true)
                  }}
                  title="Завести этого клиента в базе CRM"
                  style={{border:'none',background:'#25d366',color:'#fff',borderRadius:9,padding:'7px 12px',cursor:'pointer',fontSize:12.5,fontWeight:800,fontFamily:'inherit',display:'flex',alignItems:'center',gap:6,flexShrink:0,boxShadow:'0 2px 8px rgba(37,211,102,.35)'}}>
                  <i className="ti ti-database-plus" style={{fontSize:15}}/>В CRM базу
                </button>}
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

          {/* Чат не в базе — предложение перевести */}
          {!linkedClient && (
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 13px',background:'#fffbeb',borderBottom:'1px solid #fde68a',flexShrink:0}}>
              <i className="ti ti-info-circle" style={{fontSize:16,color:'#d97706',flexShrink:0}}/>
              <div style={{flex:1,fontSize:12,color:'#92400e',lineHeight:1.4}}>Чат ещё не в базе CRM. Если это реальный клиент — переведите его кнопкой «В CRM базу» вверху.</div>
            </div>
          )}

          {/* Messages */}
          <div className="wa-msgs">
            {messages.length === 0 && (
              <div style={{textAlign:'center',color:'#64748b',fontSize:13,padding:'26px 22px',background:'rgba(255,255,255,.85)',borderRadius:14,margin:'20px auto',maxWidth:260,boxShadow:'0 2px 12px rgba(0,0,0,.06)'}}>
                <i className="ti ti-message-2 " style={{fontSize:30,color:'#25d366',opacity:.4,display:'block',marginBottom:8}}/>
                Здесь появится переписка.<br/>Напишите первым или дождитесь сообщения клиента.
              </div>
            )}
            {(() => {
              // Разделитель дат между днями — как в настоящем WhatsApp
              const out = []
              let lastDay = ''
              for (const msg of messages) {
                const d = msg.sent_at ? new Date(msg.sent_at) : null
                const key = d ? d.toDateString() : ''
                if (key && key !== lastDay) {
                  lastDay = key
                  out.push(
                    <div key={'sep_'+key} style={{textAlign:'center',margin:'8px 0'}}>
                      <span style={{display:'inline-block',background:'rgba(255,255,255,.85)',color:'#54656f',fontSize:11.5,fontWeight:600,padding:'4px 12px',borderRadius:20,boxShadow:'0 1px 2px rgba(0,0,0,.08)'}}>{waDayLabel(d)}</span>
                    </div>
                  )
                }
                out.push(renderMessage(msg))
              }
              return out
            })()}
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
                  {templateCats.map((cat,i) => (
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
                    ? templateCats.flatMap(c=>c.items).filter(t=>t.label.toLowerCase().includes(tmplSearch.toLowerCase())||t.text.toLowerCase().includes(tmplSearch.toLowerCase()))
                    : templateCats[tmplCat]?.items || []
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
                Переменные подставляются автоматически: {'{{имя}}, {{банк}}, {{сумма}}, {{дата}}'}
              </div>
            </div>
          )}

          {/* Input bar */}
          <div className="wa-input">
            {/* Шаблоны сообщений (та же кнопка и «/» в поле — единый список) */}
            <button onClick={()=>{setShowTemplates(!showTemplates)}} title="Шаблоны сообщений (или введите / в поле)"
              style={{width:38,height:38,borderRadius:'50%',border:'none',background:showTemplates?'#3b82f6':'#e9e9e9',color:showTemplates?'#fff':'#555',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,transition:'all .15s'}}>
              <i className="ti ti-template" style={{fontSize:18}}/>
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
              onChange={e=>{
                handleMsgChange(e.target.value)
                // Авто-рост до ~5 строк: длинное сообщение видно целиком перед отправкой
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px'
              }}
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
  )

  // ── Client panel ──────────────────────────────────────────────
  // Быстрый расчёт ипотеки по данным связанного клиента → в поле ввода
  async function quickCalc() {
    const lc = linkedClient
    if (!lc) return
    // Ошибки — только тостом: текст в поле ввода менеджер рефлекторно отправит клиенту
    const notify = m => (toast$ ? toast$(m, 'err') : alert(m))
    const income = (+(lc.officialIncome)||0) + (+(lc.extraIncomeConfirmed ? lc.extraIncome : 0)||0)
    const price  = lc.contractAmount > 0 ? lc.contractAmount : 0
    if (!income && !price) { notify('⚠️ У клиента не заполнен доход или сумма договора'); return }
    setCalcBusy(true)
    // Программа клиента (13 новых) -> ключ расчётного движка (6 API-программ);
    // нет соответствия — считаем по Наурыз 20%, как раньше
    const ENGINE_BY_PROGRAM = {
      n20:['nauryz20','Наурыз 20%'], n10:['nauryz10','Наурыз 10%'], jsyl:['jasyl','Жасыл'],
      ask:['askeri','Аскери'], '5050p':['5050','Ипотека 50/50'], '5050zh':['5050','Ипотека 50/50'],
    }
    const [progKey, progName] = ENGINE_BY_PROGRAM[lc.program] || ['nauryz20', 'Наурыз 20%']
    try {
      const name = lc.fio?.split(' ')[0] || 'Уважаемый клиент'
      let msg = ''
      if (price > 0) {
        const res = await api.calc('mortgage_by_price', {
          program: progKey, price,
          members: 1,
          orgs: [{ income, oldCredit: +(lc.monthlyLoad)||0 }],
        })
        const v = res?.variantsByPrice?.[0]
        if (v) {
          msg = `Здравствуйте, ${name}! 🏠\n\nРасчёт по квартире ${fmtN(price)} ₸\nПрограмма: ${progName}\n\n💵 Первоначальный взнос: ${fmtN(v.downPayment)} ₸\n🏦 Сумма займа: ${fmtN(v.loanAmount)} ₸\n📅 Платёж: ${fmtN(v.monthly)} ₸/мес`
          if (!res.calc?.approved && v.requiredSalary) msg += `\n📊 Нужный доход: ${fmtN(v.requiredSalary)} ₸`
        }
      } else {
        const res = await api.calc('mortgage_by_salary', {
          program: progKey, salary: income, members: 1, oldCredit: +(lc.monthlyLoad)||0,
        })
        if (res?.approved) {
          msg = `Здравствуйте, ${name}! 🏠\n\nПо доходу ${fmtN(income)} ₸ (${progName}):\n\n🏠 Макс. цена квартиры: ${fmtN(res.maxPrice)} ₸\n🏦 Сумма займа: ${fmtN(res.maxLoan)} ₸\n💰 Первый взнос: ${fmtN(res.down)} ₸\n📅 Платёж: ${fmtN(res.payment)} ₸/мес`
        } else {
          msg = `${name}, по текущему доходу ${fmtN(income)} ₸ одобрение маловероятно. Давайте обсудим варианты 🙏`
        }
      }
      if (msg) setMsgText(msg)
    } catch(e) {
      notify('❌ Ошибка расчёта: ' + e.message)
    } finally {
      setCalcBusy(false)
    }
  }

  // Быстрая задача-напоминание на клиента прямо из чата (amoCRM-стиль)
  async function reminderTomorrow() {
    const lc = linkedClient
    if (!lc) return
    const due = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const task = { id: 'task_' + Date.now(), type: 'Перезвонить', text: 'из WhatsApp',
      due, done: false, created: new Date().toISOString().slice(0, 10) }
    try {
      await api.updateClient(lc.id, { ...lc, tasks: [...(lc.tasks || []), task] })
      toast$ && toast$('⏰ Задача создана: перезвонить завтра')
    } catch (e) { toast$ ? toast$('❌ ' + e.message, 'err') : alert(e.message) }
  }

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

        {/* Быстрый расчёт ипотеки прямо в чате */}
        <button onClick={quickCalc} disabled={calcBusy}
          style={{width:'100%',marginTop:8,padding:'11px',borderRadius:11,background:calcBusy?'#94a3b8':'#10b981',color:'#fff',border:'none',cursor:calcBusy?'default':'pointer',fontWeight:700,fontSize:14,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:7}}>
          {calcBusy
            ? <><i className="ti ti-loader-2 spin"/>Считаю...</>
            : <><i className="ti ti-calculator"/>Рассчитать → в сообщение</>}
        </button>
        <div style={{fontSize:11,color:'#94a3b8',textAlign:'center',marginTop:6}}>
          Считает по программе клиента из карточки (без неё — Наурыз 20%)
        </div>

        {/* Быстрое напоминание */}
        <button onClick={reminderTomorrow}
          style={{width:'100%',marginTop:8,padding:'11px',borderRadius:11,background:'#fff',color:'#d97706',border:'1.5px solid #fde68a',cursor:'pointer',fontWeight:700,fontSize:14,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:7}}>
          <i className="ti ti-clock-plus"/>Напомнить перезвонить завтра
        </button>
      </div>
    </div>
  )

  // WhatsApp (Green API) не подключён — честная инструкция вместо мёртвого раздела
  if (!waConfigured && !(chats || []).length) {
    return (
      <div style={{maxWidth:640,margin:'40px auto',textAlign:'center',padding:'0 16px'}}>
        <div style={{width:72,height:72,borderRadius:22,background:'#f0fdf4',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
          <i className="ti ti-brand-whatsapp" style={{fontSize:38,color:'#25d366'}}/>
        </div>
        <div style={{fontSize:19,fontWeight:900,marginBottom:8}}>WhatsApp ещё не подключён</div>
        <div style={{fontSize:13.5,color:'#64748b',lineHeight:1.65,marginBottom:18}}>
          Когда подключите — входящие сообщения будут сами создавать лидов, менеджеры смогут
          переписываться прямо из CRM, работать автоответ и утренние напоминания о задачах.
        </div>
        <div style={{textAlign:'left',background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:14,padding:'16px 18px',fontSize:13,lineHeight:1.7,color:'#334155'}}>
          <div style={{fontWeight:800,marginBottom:8}}>Как подключить (10–15 минут):</div>
          1. Зарегистрируйтесь на <b>green-api.com</b> и создайте инстанс (тариф Developer подходит для старта).<br/>
          2. Привяжите рабочий номер WhatsApp по QR-коду в кабинете Green API.<br/>
          3. В Vercel → Settings → Environment Variables добавьте <b>GREEN_API_ID</b> и <b>GREEN_API_TOKEN</b> → Redeploy.<br/>
          4. В кабинете Green API укажите webhook: <b>{(typeof window !== 'undefined' ? window.location.origin : '') + '/api/wa/webhook'}</b>.<br/>
          5. Готово: напишите на номер с другого телефона — лид появится в CRM.
        </div>
        <div style={{fontSize:11.5,color:'#94a3b8',marginTop:12}}>Эта инструкция видна, пока переменные Green API не настроены.</div>
      </div>
    )
  }

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
