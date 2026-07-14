import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// firebase.ts はモジュール読み込み時（import時）に Firebase App を初期化する副作用を持つ。
// そのため各ケースで vi.resetModules() + 動的 import を用い、モック状態と環境変数を
// ケースごとに独立させて検証する。実際のネットワーク接続は発生させない。

const initializeApp = vi.fn((..._args: unknown[]) => ({ name: 'app-stub' }))
const getApps = vi.fn(() => [] as unknown[])
const getApp = vi.fn(() => ({ name: 'existing-app-stub' }))
const getAuth = vi.fn((..._args: unknown[]) => ({ type: 'auth' }))
const getFirestore = vi.fn((..._args: unknown[]) => ({ type: 'firestore' }))
const getStorage = vi.fn((..._args: unknown[]) => ({ type: 'storage' }))

vi.mock('firebase/app', () => ({
  initializeApp: (...args: unknown[]) => initializeApp(...args),
  getApps: () => getApps(),
  getApp: () => getApp(),
}))
vi.mock('firebase/auth', () => ({
  getAuth: (...args: unknown[]) => getAuth(...args),
}))
vi.mock('firebase/firestore', () => ({
  getFirestore: (...args: unknown[]) => getFirestore(...args),
}))
vi.mock('firebase/storage', () => ({
  getStorage: (...args: unknown[]) => getStorage(...args),
}))

const ENV = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'test-api-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'test-project',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'test.appspot.com',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '1234567890',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:1234567890:web:abcdef',
}

describe('lib/firebase', () => {
  beforeEach(() => {
    vi.resetModules()
    getApps.mockReturnValue([])
    for (const [k, v] of Object.entries(ENV)) {
      vi.stubEnv(k, v)
    }
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('FB-01: NEXT_PUBLIC_FIREBASE_* から config を組み立てて initializeApp を1回呼ぶ', async () => {
    await import('./firebase')
    expect(initializeApp).toHaveBeenCalledTimes(1)
    expect(initializeApp).toHaveBeenCalledWith({
      apiKey: ENV.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: ENV.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: ENV.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: ENV.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: ENV.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: ENV.NEXT_PUBLIC_FIREBASE_APP_ID,
    })
  })

  it('FB-02: auth / db / storage がエクスポートされ、各 getter が1回ずつ呼ばれる', async () => {
    const mod = await import('./firebase')
    expect(mod.auth).toBeDefined()
    expect(mod.db).toBeDefined()
    expect(mod.storage).toBeDefined()
    expect(getAuth).toHaveBeenCalledTimes(1)
    expect(getFirestore).toHaveBeenCalledTimes(1)
    expect(getStorage).toHaveBeenCalledTimes(1)
  })

  it('FB-03: 既存 app がある場合は initializeApp を呼ばず getApp を再利用する', async () => {
    getApps.mockReturnValue([{ name: 'existing-app-stub' }])
    await import('./firebase')
    expect(initializeApp).not.toHaveBeenCalled()
    expect(getApp).toHaveBeenCalledTimes(1)
  })
})
