// lib/api.js
// Все вызовы к бэкенду из фронтенда
// Использует JWT токен из localStorage

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('crm_token') || ''
}

function headers(extra = {}) {
  return {
    'Content-Type': 'application/json',
    Authorization:  `Bearer ${getToken()}`,
    ...extra,
  }
}

async function request(url, options = {}, timeoutMs = 15_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res
  try {
    res = await fetch(url, {
      signal:  controller.signal,
      ...options,
      headers: { ...headers(), ...(options.headers || {}) },  // единый правильный merge
    })
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Превышено время ожидания сервера')
    throw err
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 401) {
    localStorage.removeItem('crm_token')
    localStorage.removeItem('crm_user')
    window.location.reload()
    return
  }

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }

  return data
}

// ─── AUTH ────────────────────────────────────────────────
export const api = {
  // POST /api/auth/login
  login: (login, pwd) =>
    request('/api/auth/login', {
      method: 'POST',
      body:   JSON.stringify({ login, pwd }),
    }),

  // ─── CLIENTS ───────────────────────────────────────────
  getClients: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/clients${qs ? '?' + qs : ''}`)
  },

  getClient: (id) => request(`/api/clients/${id}`),

  createClient: (client) =>
    request('/api/clients', {
      method: 'POST',
      body:   JSON.stringify(client),
    }),

  updateClient: (id, client) =>
    request(`/api/clients/${id}`, {
      method: 'PUT',
      body:   JSON.stringify(client),
    }),

  deleteClient: (id) =>
    request(`/api/clients/${id}`, { method: 'DELETE' }),

  // ─── MANAGERS ──────────────────────────────────────────
  getManagers: () => request('/api/managers'),

  createManager: (mgr) =>
    request('/api/managers', {
      method: 'POST',
      body:   JSON.stringify(mgr),
    }),

  updateManager: (id, mgr) =>
    request(`/api/managers/${id}`, {
      method: 'PUT',
      body:   JSON.stringify(mgr),
    }),

  deleteManager: (id) =>
    request(`/api/managers/${id}`, { method: 'DELETE' }),

  // ─── USERS ─────────────────────────────────────────────
  getUsers: () => request('/api/users'),

  createUser: (user) =>
    request('/api/users', {
      method: 'POST',
      body:   JSON.stringify(user),
    }),

  updateUser: (id, user) =>
    request(`/api/users/${id}`, {
      method: 'PUT',
      body:   JSON.stringify(user),
    }),

  deleteUser: (id) =>
    request(`/api/users/${id}`, { method: 'DELETE' }),

  // ─── PIPELINE ──────────────────────────────────────────
  getPipeline: () => request('/api/pipeline'),

  updatePipeline: (stages) =>
    request('/api/pipeline', {
      method: 'PUT',
      body:   JSON.stringify({ stages }),
    }),

  // ─── CHECKLISTS ────────────────────────────────────────
  getChecklists: () => request('/api/checklists'),

  updateChecklist: (stage_name, items) =>
    request('/api/checklists', {
      method: 'PUT',
      body:   JSON.stringify({ stage_name, items }),
    }),

  // ─── WHATSAPP ──────────────────────────────────────────
  getWaChats: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/wa/chats${qs ? '?' + qs : ''}`)
  },

  getWaMessages: (chatId, extraQs = '') =>
    request(`/api/wa/chats?id=${encodeURIComponent(chatId)}&mark_read=1${extraQs}`),

  sendWaMessage: (chatId, phone, text, author) =>
    request('/api/wa/send', {
      method: 'POST',
      body:   JSON.stringify({ chatId, phone, text, author }),
    }),

  sendWaMedia: (chatId, phone, file, caption, author) => {
    const fd = new FormData()
    fd.append('chatId', chatId || '')
    fd.append('phone', phone)
    fd.append('caption', caption || '')
    fd.append('author', author || 'CRM')
    fd.append('file', file)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 60_000) // 60s для больших файлов

    return fetch('/api/wa/sendMedia', {
      method:  'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      signal:  controller.signal,
      body:    fd,
    }).then(async r => {
      clearTimeout(timer)
      if (r.status === 401) {
        localStorage.removeItem('crm_token')
        localStorage.removeItem('crm_user')
        window.location.reload()
        return
      }
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
      return d
    }).catch(err => {
      clearTimeout(timer)
      if (err.name === 'AbortError') throw new Error('Превышено время ожидания загрузки файла')
      throw err
    })
  },

  assignWaChat: (chatId, managerId) =>
    request('/api/wa/chats', {
      method: 'PATCH',
      body:   JSON.stringify({ chatId, managerId }),
    }),

  updateWaChatStatus: (chatId, status) =>
    request('/api/wa/chats', {
      method: 'PATCH',
      body:   JSON.stringify({ chatId, status }),
    }),

  // ─── DASHBOARD ─────────────────────────────────────────
  getDashboard: () => request('/api/dashboard'),

  // ─── KPI ───────────────────────────────────────────────
  getKPI: (period = 'month') => request(`/api/kpi?period=${period}`),

  // ─── TASKS ─────────────────────────────────────────────
  getTasks: (status = 'open') => request(`/api/tasks?status=${status}`),

  // ─── SEARCH ────────────────────────────────────────────
  search: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/search?${qs}`)
  },
}
