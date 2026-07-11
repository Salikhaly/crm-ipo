// __tests__/api/drive.test.js
process.env.JWT_SECRET           = 'test-secret-32chars!!'
process.env.SUPABASE_URL         = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_KEY = 'test-key'
process.env.GOOGLE_SERVICE_ACCOUNT_JSON  = JSON.stringify({
  type: 'service_account', project_id: 'test',
  private_key_id: 'key1',
  private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvAIBAD\n-----END PRIVATE KEY-----\n',
  client_email: 'test@test.iam.gserviceaccount.com',
  client_id: '123', auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
})
process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'root-folder-id'

const { signToken } = require('../../lib/auth')

// ── Mock googleapis ──────────────────────────────────────────────────────────
const driveFilesList   = jest.fn().mockResolvedValue({ data: { files: [] } })
const driveFilesCreate = jest.fn().mockImplementation(({ requestBody }) => {
  if (requestBody.mimeType === 'application/vnd.google-apps.folder') {
    return Promise.resolve({ data: { id: 'folder_' + requestBody.name, name: requestBody.name, webViewLink: `https://drive.google.com/folder/${requestBody.name}` } })
  }
  return Promise.resolve({ data: { id: 'file1', name: requestBody.name, mimeType: 'application/pdf', webViewLink: 'https://drive.google.com/file/1', webContentLink: 'https://drive.google.com/dl/1' } })
})
const driveFilesDelete = jest.fn().mockResolvedValue({})

jest.mock('googleapis', () => ({
  google: {
    auth: {
      GoogleAuth: jest.fn().mockImplementation(() => ({ getClient: jest.fn() })),
    },
    drive: jest.fn().mockReturnValue({
      files: { list: driveFilesList, create: driveFilesCreate, delete: driveFilesDelete },
    }),
  },
}))

jest.mock('formidable', () => () => ({
  parse: jest.fn().mockResolvedValue([
    { folderName: ['Иванов_Петр'], docName: [] },
    { file: [{ originalFilename: 'doc.pdf', mimetype: 'application/pdf', filepath: '/tmp/test', size: 1024 }] },
  ]),
}))

jest.mock('fs', () => ({
  createReadStream: jest.fn().mockReturnValue({}),
  unlink: jest.fn((p, cb) => cb && cb()),
}))

// ── Mock Supabase ─────────────────────────────────────────────────────────────
const mockClientMaybe  = jest.fn().mockResolvedValue({ data: { fio: 'Иванов Петр', manager: 'mgr1' }, error: null })
const mockManagerMaybe = jest.fn().mockResolvedValue({ data: { name: 'Айгерим Байсейтова' }, error: null })
const mockUpdateEq     = jest.fn().mockResolvedValue({ data: {}, error: null })

const baseChain = {}
baseChain.select      = jest.fn().mockReturnValue(baseChain)
baseChain.eq          = jest.fn().mockReturnValue(baseChain)

const mockFrom = jest.fn((table) => {
  if (table === 'clients') {
    return {
      select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ maybeSingle: mockClientMaybe }) }),
      update: jest.fn().mockReturnValue({ eq: mockUpdateEq }),
    }
  }
  if (table === 'managers') {
    return {
      select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ maybeSingle: mockManagerMaybe }) }),
    }
  }
  return baseChain
})

// Мок Supabase Storage — fallback-хранилище, когда Drive не настроен
const storageList      = jest.fn().mockResolvedValue({ data: [], error: null })
const storageUpload    = jest.fn().mockResolvedValue({ data: { path: 'c1/x' }, error: null })
const storageRemove    = jest.fn().mockResolvedValue({ data: [], error: null })
const storageSignedMany= jest.fn().mockResolvedValue({ data: [], error: null })
const storageSignedOne = jest.fn().mockResolvedValue({ data: { signedUrl: 'https://signed/x' }, error: null })
const mockStorage = {
  createBucket: jest.fn().mockResolvedValue({ data: {}, error: null }),
  from: jest.fn().mockReturnValue({
    list: storageList, upload: storageUpload, remove: storageRemove,
    createSignedUrls: storageSignedMany, createSignedUrl: storageSignedOne,
  }),
}

jest.mock('../../lib/supabase', () => ({ getSupabase: () => ({ from: mockFrom, storage: mockStorage }) }))

const handler   = require('../../pages/api/drive/[clientId]').default
const makeToken = (role = 'admin') =>
  `Bearer ${signToken({ id: 'u1', name: 'Test', role, manager_id: null, login: 'test' })}`
const makeRes   = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() })

beforeEach(() => {
  jest.clearAllMocks()
  driveFilesList.mockResolvedValue({ data: { files: [] } })
  mockClientMaybe.mockResolvedValue({ data: { fio: 'Иванов Петр', manager: 'mgr1' }, error: null })
  mockManagerMaybe.mockResolvedValue({ data: { name: 'Айгерим Байсейтова' }, error: null })
  mockUpdateEq.mockResolvedValue({ data: {}, error: null })
})

describe('Drive не настроен → fallback в Supabase Storage (файлы не теряются)', () => {
  test('GET при placeholder JSON → 200 из хранилища, storage:true', async () => {
    const orig = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = 'placeholder'
    try {
      const res = makeRes()
      await handler({
        method: 'GET',
        headers: { authorization: makeToken() },
        query: { clientId: 'c1' },
      }, res)
      expect(res.status).toHaveBeenCalledWith(200)
      const data = res.json.mock.calls[0][0]
      expect(data.storage).toBe(true)
      expect(Array.isArray(data.files)).toBe(true)
    } finally {
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON = orig
    }
  })

  test('POST при placeholder ROOT_FOLDER → файл уходит в Storage (200)', async () => {
    const orig = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'placeholder'
    try {
      // POST читает файл с диска — мокаем readFileSync
      const fs = require('fs')
      fs.readFileSync = jest.fn().mockReturnValue(Buffer.from('test'))
      const res = makeRes()
      await handler({
        method: 'POST',
        headers: { authorization: makeToken() },
        query: { clientId: 'c1' },
      }, res)
      expect(res.status).toHaveBeenCalledWith(200)
      const data = res.json.mock.calls[0][0]
      expect(data.storage).toBe(true)
      expect(data.file.webViewLink).toContain('signed')
      expect(storageUpload).toHaveBeenCalled()
    } finally {
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = orig
    }
  })
})

describe('GET /api/drive/:clientId — двухуровневая структура', () => {
  test('200 создаёт папку менеджера и клиента, возвращает managerFolder', async () => {
    const res = makeRes()
    await handler({
      method: 'GET',
      headers: { authorization: makeToken() },
      query: { clientId: 'c1' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const data = res.json.mock.calls[0][0]
    expect(data.managerFolder).toBe('Айгерим Байсейтова')
    expect(Array.isArray(data.files)).toBe(true)
  })

  test('папка менеджера создаётся с маркером crm_manager_ внутри корня', async () => {
    await handler({
      method: 'GET',
      headers: { authorization: makeToken() },
      query: { clientId: 'c1' },
    }, makeRes())
    const folderCalls = driveFilesCreate.mock.calls.filter(
      c => c[0].requestBody.mimeType === 'application/vnd.google-apps.folder'
    )
    const managerCall = folderCalls.find(c => c[0].requestBody.description?.startsWith('crm_manager_'))
    expect(managerCall).toBeDefined()
    expect(managerCall[0].requestBody.name).toBe('Айгерим Байсейтова')
    expect(managerCall[0].requestBody.parents).toEqual(['root-folder-id'])
  })

  test('папка клиента создаётся ВНУТРИ папки менеджера, не в корне', async () => {
    await handler({
      method: 'GET',
      headers: { authorization: makeToken() },
      query: { clientId: 'c1' },
    }, makeRes())
    const folderCalls = driveFilesCreate.mock.calls.filter(
      c => c[0].requestBody.mimeType === 'application/vnd.google-apps.folder'
    )
    const clientCall = folderCalls.find(c => c[0].requestBody.description?.startsWith('crm_client_'))
    expect(clientCall).toBeDefined()
    expect(clientCall[0].requestBody.name).toMatch(/Иванов Петр/)
    expect(clientCall[0].requestBody.parents[0]).not.toBe('root-folder-id')
    expect(clientCall[0].requestBody.parents[0]).toMatch(/^folder_/)
  })

  test('без менеджера → папка "Без менеджера"', async () => {
    mockClientMaybe.mockResolvedValueOnce({ data: { fio: 'Без Менеджера Клиент', manager: null }, error: null })
    const res = makeRes()
    await handler({
      method: 'GET',
      headers: { authorization: makeToken() },
      query: { clientId: 'c2' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const data = res.json.mock.calls[0][0]
    expect(data.managerFolder).toBe('Без менеджера')
  })

  test('существующая папка менеджера — не создаётся повторно', async () => {
    driveFilesList.mockImplementation(({ q }) => {
      if (q.includes('crm_manager_')) {
        return Promise.resolve({ data: { files: [{ id: 'existing_mgr_folder', name: 'Айгерим Байсейтова', webViewLink: 'https://drive.google.com/folder/existing' }] } })
      }
      return Promise.resolve({ data: { files: [] } })
    })
    await handler({
      method: 'GET',
      headers: { authorization: makeToken() },
      query: { clientId: 'c1' },
    }, makeRes())
    const managerFolderCreations = driveFilesCreate.mock.calls.filter(
      c => c[0].requestBody.description?.startsWith('crm_manager_')
    )
    expect(managerFolderCreations.length).toBe(0)
  })
})

describe('POST /api/drive/:clientId — загрузка файла', () => {
  test('200 загружает файл в папку клиента (внутри папки менеджера)', async () => {
    const res = makeRes()
    await handler({
      method: 'POST',
      headers: { authorization: makeToken() },
      query: { clientId: 'c1' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    const data = res.json.mock.calls[0][0]
    expect(data.file).toBeDefined()
    expect(data.managerFolder).toBe('Айгерим Байсейтова')
  })

  test('временный файл удаляется после загрузки', async () => {
    const fs = require('fs')
    await handler({
      method: 'POST',
      headers: { authorization: makeToken() },
      query: { clientId: 'c1' },
    }, makeRes())
    expect(fs.unlink).toHaveBeenCalledWith('/tmp/test', expect.any(Function))
  })

  test('сохраняет drive_link и drive_folder_name в карточке клиента', async () => {
    await handler({
      method: 'POST',
      headers: { authorization: makeToken() },
      query: { clientId: 'c1' },
    }, makeRes())
    expect(mockUpdateEq).toHaveBeenCalled()
    const updateArg = mockUpdateEq.mock.calls[0]
    expect(updateArg[0]).toBe('id')
    expect(updateArg[1]).toBe('c1')
  })
})

describe('DELETE /api/drive/:clientId', () => {
  test('403 для manager', async () => {
    const res = makeRes()
    await handler({
      method: 'DELETE',
      headers: { authorization: makeToken('manager') },
      query: { clientId: 'c1', fileId: 'file1' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(403)
  })

  test('400 если fileId не передан', async () => {
    const res = makeRes()
    await handler({
      method: 'DELETE',
      headers: { authorization: makeToken('admin') },
      query: { clientId: 'c1' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  test('200 удаляет файл через Drive API', async () => {
    const res = makeRes()
    await handler({
      method: 'DELETE',
      headers: { authorization: makeToken('admin') },
      query: { clientId: 'c1', fileId: 'file1' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(driveFilesDelete).toHaveBeenCalledWith({ fileId: 'file1' })
  })
})

describe('405 для неподдерживаемых методов', () => {
  test('PATCH → 405', async () => {
    const res = makeRes()
    await handler({
      method: 'PATCH',
      headers: { authorization: makeToken() },
      query: { clientId: 'c1' },
      body: {},
    }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })
})
