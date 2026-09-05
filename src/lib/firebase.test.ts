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

// App Check（reCAPTCHA Enterprise）は実スクリプト読込・ネットワーク通信を伴うため、
// モジュール全体をモックし初期化引数と分岐のみを検証する（テスト仕様書 4.14）。
// initializeAppCheck 実行時点の debug token の状態を記録し、「初期化より前に
// 設定されているか」（設計書 5.3 の設定順序要件）を検証できるようにする。
let debugTokenAtInit: unknown
const initializeAppCheck = vi.fn((..._args: unknown[]) => {
  debugTokenAtInit = (globalThis as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: unknown })
    .FIREBASE_APPCHECK_DEBUG_TOKEN
  return { type: 'app-check' }
})
const ReCaptchaEnterpriseProvider = vi.fn(function (this: { siteKey?: string }, siteKey: string) {
  this.siteKey = siteKey
})

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
vi.mock('firebase/app-check', () => ({
  initializeAppCheck: (...args: unknown[]) => initializeAppCheck(...args),
  ReCaptchaEnterpriseProvider,
}))

const SITE_KEY_ENV = 'NEXT_PUBLIC_FIREBASE_RECAPTCHA_SITE_KEY'

// debug token は self（jsdom では globalThis）へ書き込まれケース間に残留するため、
// 各ケースの前後で undefined を再代入してリセットする（テスト仕様書 4.14）。
function resetDebugToken() {
  ;(globalThis as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: unknown }).FIREBASE_APPCHECK_DEBUG_TOKEN =
    undefined
  debugTokenAtInit = undefined
}

function readDebugToken(): unknown {
  return (globalThis as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: unknown })
    .FIREBASE_APPCHECK_DEBUG_TOKEN
}

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
    // .env.local 等の実値に影響されず「siteKey 未設定」を再現するため明示的に削除する。
    vi.stubEnv(SITE_KEY_ENV, undefined)
    resetDebugToken()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    resetDebugToken()
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

// App Check（reCAPTCHA Enterprise）初期化の検証（テスト仕様書 5.47 / App Check導入設計書 v1.1）。
// bot・クローラーによる Authentication への自動化リクエスト抑止が目的であり、
// 実トークン取得は Firebase Console のモニター指標でユーザーが確認する。
// ここでは「初期化引数」「siteKey 有無・NODE_ENV・例外・SSR の分岐」のみを検証する。
describe('lib/firebase App Check', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    getApps.mockReturnValue([])
    for (const [k, v] of Object.entries(ENV)) {
      vi.stubEnv(k, v)
    }
    resetDebugToken()
    // テスト出力を汚さないため実出力は抑止しつつ、呼び出し回数・引数のみ検証する。
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    resetDebugToken()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })

  // --- 正常系 ---

  it('APC-01: siteKey 設定時に reCAPTCHA Enterprise プロバイダで App Check を初期化する', async () => {
    vi.stubEnv(SITE_KEY_ENV, 'test-site-key')
    vi.stubEnv('NODE_ENV', 'production')

    const mod = await import('./firebase')

    expect(ReCaptchaEnterpriseProvider).toHaveBeenCalledTimes(1)
    expect(ReCaptchaEnterpriseProvider).toHaveBeenCalledWith('test-site-key')
    expect(initializeAppCheck).toHaveBeenCalledTimes(1)
    const [appArg, options] = initializeAppCheck.mock.calls[0] as [
      unknown,
      { provider: unknown; isTokenAutoRefreshEnabled: boolean },
    ]
    expect(appArg).toBe(mod.app)
    expect(options.provider).toBe(ReCaptchaEnterpriseProvider.mock.instances[0])
  })

  it('APC-02: isTokenAutoRefreshEnabled が true で渡される', async () => {
    vi.stubEnv(SITE_KEY_ENV, 'test-site-key')
    vi.stubEnv('NODE_ENV', 'production')

    await import('./firebase')

    const options = initializeAppCheck.mock.calls[0][1] as { isTokenAutoRefreshEnabled: boolean }
    expect(options.isTokenAutoRefreshEnabled).toBe(true)
  })

  it('APC-03: appCheck が named export され初期化結果を保持する', async () => {
    vi.stubEnv(SITE_KEY_ENV, 'test-site-key')
    vi.stubEnv('NODE_ENV', 'production')

    const mod = await import('./firebase')

    expect(mod.appCheck).toBeDefined()
    expect(mod.appCheck).toBe(initializeAppCheck.mock.results[0].value)
  })

  it('APC-04: App Check 初期化が auth / db / storage の生成を妨げない', async () => {
    vi.stubEnv(SITE_KEY_ENV, 'test-site-key')
    vi.stubEnv('NODE_ENV', 'production')

    const mod = await import('./firebase')

    expect(mod.auth).toBeDefined()
    expect(mod.db).toBeDefined()
    expect(mod.storage).toBeDefined()
    expect(getAuth).toHaveBeenCalledTimes(1)
    expect(getFirestore).toHaveBeenCalledTimes(1)
    expect(getStorage).toHaveBeenCalledTimes(1)
  })

  // --- 異常系 ---

  it('APC-05: siteKey 未設定でも例外を投げず App Check を初期化しない', async () => {
    vi.stubEnv(SITE_KEY_ENV, undefined)

    const mod = await import('./firebase')

    expect(initializeAppCheck).not.toHaveBeenCalled()
    expect(ReCaptchaEnterpriseProvider).not.toHaveBeenCalled()
    expect(mod.appCheck).toBeUndefined()
    expect(mod.auth).toBeDefined()
    expect(mod.db).toBeDefined()
    expect(mod.storage).toBeDefined()
  })

  it('APC-06: siteKey 未設定時は環境変数名を含む警告を1回だけ出す', async () => {
    vi.stubEnv(SITE_KEY_ENV, undefined)

    await import('./firebase')

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(String(warnSpy.mock.calls[0][0])).toContain(SITE_KEY_ENV)
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('APC-07: initializeAppCheck が例外を投げてもモジュール読み込みが成功する', async () => {
    vi.stubEnv(SITE_KEY_ENV, 'test-site-key')
    const failure = new Error('recaptcha load failed')
    initializeAppCheck.mockImplementationOnce(() => {
      throw failure
    })

    const mod = await import('./firebase')

    expect(mod.appCheck).toBeUndefined()
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy.mock.calls[0][1]).toBe(failure)
    expect(mod.auth).toBeDefined()
    expect(mod.db).toBeDefined()
    expect(mod.storage).toBeDefined()
  })

  it('APC-08: ReCaptchaEnterpriseProvider が例外を投げてもモジュール読み込みが成功する', async () => {
    vi.stubEnv(SITE_KEY_ENV, 'test-site-key')
    ReCaptchaEnterpriseProvider.mockImplementationOnce(() => {
      throw new Error('invalid site key')
    })

    const mod = await import('./firebase')

    expect(mod.appCheck).toBeUndefined()
    expect(initializeAppCheck).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(mod.auth).toBeDefined()
  })

  // --- 境界値 ---

  it('APC-09: siteKey が空文字の場合は未設定と同じ扱いになる', async () => {
    vi.stubEnv(SITE_KEY_ENV, '')

    const mod = await import('./firebase')

    expect(initializeAppCheck).not.toHaveBeenCalled()
    expect(mod.appCheck).toBeUndefined()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('APC-10: siteKey が1文字でも初期化する（値の妥当性検証は行わない）', async () => {
    vi.stubEnv(SITE_KEY_ENV, 'x')

    await import('./firebase')

    expect(ReCaptchaEnterpriseProvider).toHaveBeenCalledWith('x')
    expect(initializeAppCheck).toHaveBeenCalledTimes(1)
  })

  it('APC-11: NODE_ENV=development では初期化前に debug token を設定する', async () => {
    vi.stubEnv(SITE_KEY_ENV, 'test-site-key')
    vi.stubEnv('NODE_ENV', 'development')

    await import('./firebase')

    expect(debugTokenAtInit).toBe(true)
    expect(readDebugToken()).toBe(true)
  })

  it('APC-12: NODE_ENV=test でも debug token を設定する', async () => {
    vi.stubEnv(SITE_KEY_ENV, 'test-site-key')
    vi.stubEnv('NODE_ENV', 'test')

    await import('./firebase')

    expect(readDebugToken()).toBe(true)
  })

  it('APC-13: NODE_ENV=production では debug token を設定しない', async () => {
    vi.stubEnv(SITE_KEY_ENV, 'test-site-key')
    vi.stubEnv('NODE_ENV', 'production')

    await import('./firebase')

    expect(readDebugToken()).toBeUndefined()
    expect(debugTokenAtInit).toBeUndefined()
    expect(initializeAppCheck).toHaveBeenCalledTimes(1)
  })

  it('APC-14: NODE_ENV が想定外の値なら安全側で debug token を設定する', async () => {
    vi.stubEnv(SITE_KEY_ENV, 'test-site-key')
    vi.stubEnv('NODE_ENV', 'staging' as 'development')

    await import('./firebase')

    expect(readDebugToken()).toBe(true)
  })

  it('APC-15: SSR（window 未定義）では App Check を初期化せずログも出さない', async () => {
    vi.stubEnv(SITE_KEY_ENV, 'test-site-key')
    vi.stubGlobal('window', undefined)

    const mod = await import('./firebase')

    expect(initializeAppCheck).not.toHaveBeenCalled()
    expect(mod.appCheck).toBeUndefined()
    expect(warnSpy).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  // --- 権限 ---
  // App Check はアプリ正当性の検証（Attestation）であり認可ではないため、
  // viewer / editor / admin / owner によるロール差は生じない（設計書 9章）。
  // Security Rules 側の担保（APC-17）と App Check 無効時の権限不変（APC-18）は
  // Rules ユニットテスト（firestore.rules.test.ts）および既存テストスイート全体で担保する。

  it('APC-16: 未ログイン状態でも認証状態に依存せず App Check を初期化する', async () => {
    vi.stubEnv(SITE_KEY_ENV, 'test-site-key')

    await import('./firebase')

    // onAuthStateChanged 等の認証状態を購読せずに初期化される（分岐を持たない）。
    expect(initializeAppCheck).toHaveBeenCalledTimes(1)
  })

  // --- 回帰 ---

  it('APC-19: App Check 追加後も initializeApp の引数は既存6キーのみである', async () => {
    vi.stubEnv(SITE_KEY_ENV, 'test-site-key')

    await import('./firebase')

    expect(initializeApp).toHaveBeenCalledTimes(1)
    expect(initializeApp.mock.calls[0][0]).toEqual({
      apiKey: ENV.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: ENV.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: ENV.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: ENV.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: ENV.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: ENV.NEXT_PUBLIC_FIREBASE_APP_ID,
    })
  })

  it('APC-20: siteKey 未設定時は実 reCAPTCHA 読込を伴う初期化が発生しない', async () => {
    vi.stubEnv(SITE_KEY_ENV, undefined)
    getApps.mockReturnValue([{ name: 'existing-app-stub' }])

    const mod = await import('./firebase')

    expect(ReCaptchaEnterpriseProvider).not.toHaveBeenCalled()
    expect(initializeAppCheck).not.toHaveBeenCalled()
    expect(mod.auth).toBeDefined()
  })
})
