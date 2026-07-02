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
  const safeName = (managerName || 'Без менеджера').trim()
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

// ── Handler ──────────────────────────────────────────────────────────────────
export default withAuth(async function handler(req, res) {
  const { clientId } = req.query
  const { role, manager_id: mid } = req.user

  // Проверяем наличие переменных окружения
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON === 'placeholder') {
    return res.status(503).json({ error: 'Google Drive не настроен. Добавьте GOOGLE_SERVICE_ACCOUNT_JSON в переменные окружения.' })
  }
  if (!process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID === 'placeholder') {
    return res.status(503).json({ error: 'Google Drive не настроен. Добавьте GOOGLE_DRIVE_ROOT_FOLDER_ID в переменные окружения.' })
  }

  // Проверяем доступ к клиенту для ролей с ограничениями
  if (role === 'manager' || role === 'specialist') {
    const sb = getSupabase()
    const { data: client } = await sb
      .from('clients')
      .select('manager, responsible_manager')
      .eq('id', clientId)
      .maybeSingle()

    if (!client) return res.status(404).json({ error: 'Клиент не найден' })

    const allowed = role === 'manager'
      ? client.manager === mid
      : client.responsible_manager === mid

    if (!allowed) return res.status(403).json({ error: 'Нет доступа к файлам этого клиента' })
  }

  // ── GET: список файлов клиента ─────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const drive  = getDrive()
      const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID

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
      console.error('[drive] GET error:', err.message)
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
      const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID

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
      console.error('[drive] POST error:', err.message)
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
      console.error('[drive] DELETE error:', err.message)
      return apiError(res, err)
    }
  }

  return res.status(405).json({ error: 'Метод не разрешён' })
})
