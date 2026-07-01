import '@testing-library/jest-dom'

// Пропускаем DB-верификацию в withAuth для всех API-тестов —
// роль берётся напрямую из JWT-payload (см. lib/auth.js getFreshUserData)
process.env.JEST_SKIP_AUTH_DB = '1'

// Mock next/router
jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn(), query: {} }) }))

// Mock localStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem:    key        => store[key] ?? null,
    setItem:    (key, val) => { store[key] = String(val) },
    removeItem: key        => { delete store[key] },
    clear:      ()         => { store = {} },
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })
