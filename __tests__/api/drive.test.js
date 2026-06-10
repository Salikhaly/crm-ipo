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

// Mock googleapis
jest.mock('googleapis', () => ({
  google: {
    auth: {
      GoogleAuth: jest.fn().mockImplementation(() => ({
        getClient: jest.fn(),
      })),
    },
    drive: jest.fn().mockReturnValue({
      files: {
        list:   jest.fn().mockResolvedValue({ data: { files: [] } }),
        create: jest.fn().mockResolvedValue({ data: { id: 'file1', name: 'test.pdf', webViewLink: 'https://drive.google.com/file/1', webContentLink: 'https://drive.google.com/dl/1' } }),
        delete: jest.fn().mockResolvedValue({}),
      },
    }),
  },
}))

jest.mock('formidable', () => () => ({
  parse: jest.fn().mockResolvedValue([
    { folderName: ['Иванов'] },
    { file: [{ originalFilename: 'doc.pdf', mimetype: 'application/pdf', filepath: '/tmp/test', size: 1024 }] },
  ]),
}))

jest.mock('fs', () => ({
  createReadStream: jest.fn().mockReturnValue({}),
  unlink: jest.fn((p, cb) => cb && cb()),
}))

const mockUpdate = jest.fn().mockReturnThis()
const mockEq     = jest.fn().mockResolvedValue({ data: {}, error: null })
const mockFrom   = jest.fn(() => ({ update: mockUpdate, eq: mockEq }))

jest.mock('../../lib/supabase', () => ({ getSupabase: () => ({ from: mockFrom }) }))

const handler   = require('../../pages/api/drive/[clientId]').default
const makeToken = (role = 'admin') =>
  `Bearer ${signToken({ id: 'u1', name: 'Test', role, manager_id: null, login: 'test' })}`
const makeRes   = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() })

beforeEach(() => jest.clearAllMocks())

describe('Drive endpoint when not configured', () => {
  test('503 если GOOGLE_SERVICE_ACCOUNT_JSON = placeholder', async () => {
    const orig = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = 'placeholder'
    const res = makeRes()
    await handler({
      method: 'GET',
      headers: { authorization: makeToken() },
      query: { clientId: 'c1' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(503)
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = orig
  })

  test('503 если GOOGLE_DRIVE_ROOT_FOLDER_ID = placeholder', async () => {
    const orig = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = 'placeholder'
    const res = makeRes()
    await handler({
      method: 'GET',
      headers: { authorization: makeToken() },
      query: { clientId: 'c1' },
    }, res)
    expect(res.status).toHaveBeenCalledWith(503)
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID = orig
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
