// pages/api/drive/[clientId].js
//
// GET    /api/drive/:clientId          → список файлов клиента
// POST   /api/drive/:clientId          → загрузить файл (multipart/form-data)
// DELETE /api/drive/:clientId?fileId=  → удалить файл
//
// Переменные окружения (.env.local / Vercel):
//   GOOGLE_SERVICE_ACCOUNT_JSON   — содержимое JSON-ключа сервис-аккаунта (одной строкой)
//   GOOGLE_DRIVE_ROOT_FOLDER_ID   — ID корневой папки "CRM — Клиенты"

import { google }   from 'googleapis'
import { apiError } from '../../../lib/apiError'
import formidable   from 'formidable'
import fs           from 'fs'
import { withAuth } from '../../../lib/auth'
import { getSupabase } from '../../../lib/supabase'

export const config = { api: { bodyParser: false } }

// ── Google Auth singleton ────────────────────────────────────────────────────
let _auth = null
function getDriveAuth() {
  if (_auth) return _auth
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON не задан')

  let creds
  try {
    creds = JSON.parse(raw)
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON содержит невалидный JSON')
  }

  _auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
  return _auth
}

function getDrive() {
  return google.drive({ version: 'v3', auth: getDriveAuth() })
}

// ── Получить имя менеджера клиента из Supabase + построить структуру папок ───
async function resolveFolders(drive, rootId, clientId, folderName) {
  if (!rootId) throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID не задан')

  const sb = getSupabase()
  const { data: client } = await sb
    .from('clients')
    .select('fio, manager')
    .eq('id', clientId)
    .maybeSingle()

  let managerName = 'Без менеджера'
  if (client?.manager) {
    const { data: mgr } = await sb
      .from('managers')
      .select('name')
      .eq('id', client.manager)
      .maybeSingle()
    if (mgr?.name) managerName = mgr.name
  }

  const managerFolder = await getOrCreateManagerFolder(drive, rootId, managerName)

  // Имя папки клиента: ФИО + короткий ID для уникальности (если ФИО совпадают)
  const fio = (folderName || client?.fio || '').trim()
  const shortId = clientId.slice(0, 6)
  const clientFolderName = fio
    ? `${fio}_${shortId}`
    : `Клиент_${shortId}`

  const folder = await getOrCreateClientFolder(drive, clientId, clientFolderName, managerFolder.id)

  return { managerFolder, folder }
}
async function getOrCreateManagerFolder(drive, rootId, managerName) {
  // Кавычки/бэкслеши ломают q-синтаксис Drive API (O'Brian → 500)
  const safeName = (managerName || 'Без менеджера').trim().replace(/['\\]/g, '') || 'Без менеджера'
  const marker   = `crm_manager_${safeName}`

  const search = await drive.files.list({
    q: `'${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and description='${marker}' and trashed=false`,
    fields: 'files(id, name, webViewLink)',
    spaces: 'drive',
  })

  if (search.data.files?.length > 0) return search.data.files[0]

  const created = await drive.files.create({
    requestBody: {
      name:        safeName,
      mimeType:    'application/vnd.google-apps.folder',
      parents:     [rootId],
      description: marker,
    },
    fields: 'id, name, webViewLink',
  })

  return created.data
}

// ── Получить или создать папку клиента внутри папки менеджера ────────────────
async function getOrCreateClientFolder(drive, clientId, folderName, managerFolderId) {
  // Ищем папку по clientId в описании (надёжнее чем по имени)
  const search = await drive.files.list({
    q: `'${managerFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and description='crm_client_${clientId}' and trashed=false`,
    fields: 'files(id, name, webViewLink)',
    spaces: 'drive',
  })

  if (search.data.files?.length > 0) {
    return search.data.files[0]
  }

  // Создаём новую папку: ФИО_клиента_xxxxxx (короткий ID для уникальности)
  const name = folderName || `Клиент_${clientId.slice(0, 8)}`
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType:    'application/vnd.google-apps.folder',
      parents:     [managerFolderId],
      description: `crm_client_${clientId}`,   // маркер для поиска
    },
    fields: 'id, name, webViewLink',
  })

  return created.data
}

// ── Fallback-хранилище: Supabase Storage ─────────────────────────────────────
// Если Google Drive не настроен (нет env) — файлы НЕ теряются, а складываются
// в приватный bucket Supabase (создаётся сам при первой загрузке). Ссылки —
// подписанные, сроком на 1 год; при каждом открытии вкладки生成уются свежие.
const BUCKET = 'client-docs'
const SIGN_TTL = 60 * 60 * 24 * 365   // 1 год
let _bucketReady = false

async function ensureBucket(sb) {
  if (_bucketReady) return
  try { await sb.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 20 * 1024 * 1024 }) } catch (e) { /* уже есть */ }
  _bucketReady = true
}

function safeStorageName(name) {
  return String(name || 'file').replace(/[^\w.\-а-яА-ЯёЁ ]/g, '_').replace(/\s+/g, '_').slice(0, 120)
}

async function storageGet(sb, clientId, res) {
  await ensureBucket(sb)
  const { data: list, error } = await sb.storage.from(BUCKET)
    .list(clientId, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
  if (error) return apiError(res, error)
  const files = (list || []).filter(f => f.name)
  const paths = files.map(f => `${clientId}/${f.name}`)
  let signed = []
  if (paths.length) {
    const { data } = await sb.storage.from(BUCKET).createSignedUrls(paths, SIGN_TTL)
    signed = data || []
  }
  return res.status(200).json({
    storage: true,
    folderId: null, folderLink: '', managerFolder: 'Хранилище CRM',
    files: files.map((f, i) => ({
      id:          `${clientId}/${f.name}`,
      name:        f.name.replace(/^\d{13}_/, ''),   // прячем тех-префикс времени
      mimeType:    f.metadata?.mimetype || '',
      size:        f.metadata?.size || 0,
      createdTime: f.created_at || '',
      webViewLink: signed[i]?.signedUrl || '',
      webContentLink: signed[i]?.signedUrl || '',
    })),
  })
}

async function storagePost(sb, clientId, req, res) {
  await ensureBucket(sb)
  const form = formidable({ maxFileSize: 20 * 1024 * 1024 })
  const [fields, files] = await form.parse(req)
  const file    = files.file?.[0]
  const docName = fields.docName?.[0] || ''
  if (!file) return res.status(400).json({ error: 'Файл не передан' })
  let uploadName = file.originalFilename || 'file'
  if (docName) {
    const ext = uploadName.includes('.') ? uploadName.slice(uploadName.lastIndexOf('.')) : ''
    uploadName = `${docName}${ext}`
  }
  const path = `${clientId}/${Date.now()}_${safeStorageName(uploadName)}`
  let buf
  try { buf = fs.readFileSync(file.filepath) } finally { fs.unlink(file.filepath, () => {}) }
  const { error } = await sb.storage.from(BUCKET).upload(path, buf, {
    contentType: file.mimetype || 'application/octet-stream', upsert: false,
  })
  if (error) return apiError(res, error)
  const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(path, SIGN_TTL)
  return res.status(200).json({
    storage: true,
    folderId: null, folderLink: '', managerFolder: 'Хранилище CRM',
    file: {
      id: path, name: safeStorageName(uploadName),
      mimeType: file.mimetype || '', size: file.size || 0,
      createdTime: new Date().toISOString(),
      webViewLink: signed?.signedUrl || '', webContentLink: signed?.signedUrl || '',
    },
  })
}

// ID корневой папки: принимает и чистый ID, и вставленную ссылку или ID
// с хвостом параметров («1abc…?dmr=1&ec=…» из адресной строки Drive)
function rootFolderId() {
  const raw  = String(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '')
  const tail = raw.includes('/folders/') ? raw.split('/folders/')[1] : raw
  // ID папки Drive состоит только из [A-Za-z0-9_-]. Вытаскиваем первый длинный
  // токен — переживает кавычки, пробелы, невидимые символы и любые хвосты URL.
  const m = tail.match(/[A-Za-z0-9_-]{20,}/)
  return m ? m[0] : tail.split(/[?&#/\s]/)[0].trim()
}

// Полная диагностика ошибки Google API: message + location (какой параметр)
function driveErrDetail(err) {
  const e = err?.response?.data?.error
  const parts = []
  if (e?.errors?.length) parts.push(JSON.stringify(e.errors))
  else if (e) parts.push(JSON.stringify(e).slice(0, 300))
  parts.push('root=' + JSON.stringify(rootFolderId()))
  return parts.join(' | ')
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default withAuth(async function handler(req, res) {
  const { clientId } = req.query
  const { role, manager_id: mid } = req.user

  // Google Drive настроен? Если нет — работаем через Supabase Storage (fallback),
  // файлы больше не теряются с 503.
  const driveConfigured =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_SERVICE_ACCOUNT_JSON !== 'placeholder' &&
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID && process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID !== 'placeholder'

  // qa — только просмотр (симметрично PUT/DELETE клиентов)
  if (role === 'qa' && req.method !== 'GET') {
    return res.status(403).json({ error: 'Роль qa — только просмотр' })
  }

  // Менеджеры — командный доступ (файлы всех клиентов, как и карточки, решение v13).
  // Специалист — только клиенты, где он ответственный.
  if (role === 'specialist') {
    const sb = getSupabase()
    const { data: client } = await sb
      .from('clients')
      .select('manager, responsible_manager')
      .eq('id', clientId)
      .maybeSingle()

    if (!client) return res.status(404).json({ error: 'Клиент не найден' })

    if (client.responsible_manager !== mid) {
      return res.status(403).json({ error: 'Нет доступа к файлам этого клиента' })
    }
  }

  // ── Drive не настроен → Supabase Storage (файлы не теряются) ────────────────
  if (!driveConfigured) {
    const sb = getSupabase()
    try {
      if (req.method === 'GET')  return await storageGet(sb, clientId, res)
      if (req.method === 'POST') return await storagePost(sb, clientId, req, res)
      if (req.method === 'DELETE') {
        const { fileId } = req.query
        if (!fileId) return res.status(400).json({ error: 'fileId обязателен' })
        if (role === 'manager' || role === 'specialist') {
          return res.status(403).json({ error: 'Нет доступа для удаления файлов' })
        }
        const { error } = await sb.storage.from(BUCKET).remove([fileId])
        if (error) return apiError(res, error)
        return res.status(200).json({ ok: true })
      }
      return res.status(405).json({ error: 'Метод не разрешён' })
    } catch (err) {
      console.error('[storage]', err.message)
      return apiError(res, err)
    }
  }

  // ── GET: список файлов клиента ─────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const drive  = getDrive()
      const rootId = rootFolderId()

      const { managerFolder, folder } = await resolveFolders(drive, rootId, clientId, req.query.folderName)

      const list = await drive.files.list({
        q:      `'${folder.id}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, size, createdTime, webViewLink, webContentLink)',
        orderBy: 'createdTime desc',
      })

      return res.status(200).json({
        folderId:      folder.id,
        folderLink:    folder.webViewLink,
        managerFolder: managerFolder.name,
        files:         list.data.files || [],
      })
    } catch (err) {
      console.error('[drive] GET error:', err.message, '|', driveErrDetail(err))
      return apiError(res, err)
    }
  }

  // ── POST: загрузить файл ───────────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const form = formidable({ maxFileSize: 20 * 1024 * 1024 }) // 20 МБ
      const [fields, files] = await form.parse(req)

      const file       = files.file?.[0]
      const folderName = fields.folderName?.[0] || ''
      const docName    = fields.docName?.[0] || ''  // тип документа (опционально)

      if (!file) return res.status(400).json({ error: 'Файл не передан' })

      const drive  = getDrive()
      const rootId = rootFolderId()

      const { managerFolder, folder } = await resolveFolders(drive, rootId, clientId, folderName)

      // Имя файла: если указан тип документа — добавляем его в начало
      let uploadName = file.originalFilename || 'file'
      if (docName) {
        const ext = uploadName.includes('.') ? uploadName.slice(uploadName.lastIndexOf('.')) : ''
        uploadName = `${docName}${ext}`
      }

      // Загружаем файл в папку клиента
      let uploaded
      try {
        uploaded = await drive.files.create({
          requestBody: {
            name:    uploadName,
            parents: [folder.id],
          },
          media: {
            mimeType: file.mimetype || 'application/octet-stream',
            body:     fs.createReadStream(file.filepath),
          },
          fields: 'id, name, mimeType, size, createdTime, webViewLink, webContentLink',
        })
      } finally {
        // Всегда удаляем временный файл после загрузки
        fs.unlink(file.filepath, () => {})
      }

      // Сохраняем ссылку на папку клиента в карточке
      const sb = getSupabase()
      await sb.from('clients')
        .update({
          drive_link:        folder.webViewLink,
          drive_folder_name: folder.name,
        })
        .eq('id', clientId)

      return res.status(200).json({
        file:          uploaded.data,
        folderId:      folder.id,
        folderLink:    folder.webViewLink,
        managerFolder: managerFolder.name,
      })
    } catch (err) {
      console.error('[drive] POST error:', err.message, '|', driveErrDetail(err))
      return apiError(res, err)
    }
  }

  // ── DELETE: удалить файл ───────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { fileId } = req.query
    if (!fileId) return res.status(400).json({ error: 'fileId обязателен' })

    // Только admin и head могут удалять файлы
    if (role === 'manager' || role === 'specialist') {
      return res.status(403).json({ error: 'Нет доступа для удаления файлов' })
    }

    try {
      const drive = getDrive()
      await drive.files.delete({ fileId })
      return res.status(200).json({ ok: true })
    } catch (err) {
      console.error('[drive] DELETE error:', err.message, '|', driveErrDetail(err))
      return apiError(res, err)
    }
  }

  return res.status(405).json({ error: 'Метод не разрешён' })
})
