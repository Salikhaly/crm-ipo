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

// ── Получить или создать папку клиента внутри корневой ───────────────────────
async function getOrCreateClientFolder(drive, clientId, folderName) {
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
  if (!rootId) throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID не задан')

  // Ищем папку по clientId в описании (надёжнее чем по имени)
  const search = await drive.files.list({
    q: `'${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and description='crm_client_${clientId}' and trashed=false`,
    fields: 'files(id, name, webViewLink)',
    spaces: 'drive',
  })

  if (search.data.files?.length > 0) {
    return search.data.files[0]
  }

  // Создаём новую папку
  const name = folderName || `Клиент_${clientId.slice(0, 8)}`
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType:    'application/vnd.google-apps.folder',
      parents:     [rootId],
      description: `crm_client_${clientId}`,   // маркер для поиска
    },
    fields: 'id, name, webViewLink',
  })

  return created.data
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default withAuth(async function handler(req, res) {
  const { clientId } = req.query

  // Проверяем наличие переменных окружения
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON === 'placeholder') {
    return res.status(503).json({ error: 'Google Drive не настроен. Добавьте GOOGLE_SERVICE_ACCOUNT_JSON в переменные окружения.' })
  }
  if (!process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID === 'placeholder') {
    return res.status(503).json({ error: 'Google Drive не настроен. Добавьте GOOGLE_DRIVE_ROOT_FOLDER_ID в переменные окружения.' })
  }

  // ── GET: список файлов клиента ─────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const drive  = getDrive()
      const folder = await getOrCreateClientFolder(drive, clientId, req.query.folderName)

      const list = await drive.files.list({
        q:      `'${folder.id}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, size, createdTime, webViewLink, webContentLink)',
        orderBy: 'createdTime desc',
      })

      return res.status(200).json({
        folderId:      folder.id,
        folderLink:    folder.webViewLink,
        files:         list.data.files || [],
      })
    } catch (err) {
      console.error('Drive GET error:', err.message)
      return res.status(500).json({ error: err.message })
    }
  }

  // ── POST: загрузить файл ───────────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const form = formidable({ maxFileSize: 50 * 1024 * 1024 }) // 50 МБ
      const [fields, files] = await form.parse(req)

      const file       = files.file?.[0]
      const folderName = fields.folderName?.[0] || ''

      if (!file) return res.status(400).json({ error: 'Файл не передан' })

      const drive  = getDrive()
      const folder = await getOrCreateClientFolder(drive, clientId, folderName)

      // Загружаем файл в папку клиента
      let uploaded
      try {
        uploaded = await drive.files.create({
          requestBody: {
            name:    file.originalFilename || 'file',
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

      // Единый upsert: сохраняем ссылку на папку в карточке клиента
      const sb = getSupabase()
      await sb.from('clients')
        .update({
          drive_link:        folder.webViewLink,
          drive_folder_name: folderName || folder.name,
        })
        .eq('id', clientId)

      return res.status(200).json({
        file:       uploaded.data,
        folderId:   folder.id,
        folderLink: folder.webViewLink,
      })
    } catch (err) {
      console.error('Drive POST error:', err.message)
      return res.status(500).json({ error: err.message })
    }
  }

  // ── DELETE: удалить файл ───────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { fileId } = req.query
    if (!fileId) return res.status(400).json({ error: 'fileId обязателен' })

    // Только admin и head могут удалять
    if (req.user.role === 'manager') {
      return res.status(403).json({ error: 'Нет доступа для удаления файлов' })
    }

    try {
      const drive = getDrive()
      await drive.files.delete({ fileId })
      return res.status(200).json({ ok: true })
    } catch (err) {
      console.error('Drive DELETE error:', err.message)
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Метод не разрешён' })
})
