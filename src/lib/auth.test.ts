import { describe, it, expect, vi, beforeEach } from 'vitest'

// auth.ts は Firebase Auth SDK の薄いラッパー。実ポップアップ/通信を避けるため
// firebase/auth を完全モックし、成功/失敗の伝播とエラーコード→メッセージ変換を検証する。

const signInWithPopup = vi.fn()
const signOut = vi.fn()
const GoogleAuthProvider = vi.fn()

vi.mock('firebase/auth', () => ({
  signInWithPopup: (...args: unknown[]) => signInWithPopup(...args),
  signOut: (...args: unknown[]) => signOut(...args),
  GoogleAuthProvider: class {
    constructor() {
      GoogleAuthProvider()
    }
  },
}))

// firebase.ts の副作用初期化を避けるため auth インスタンスをスタブ化する
vi.mock('./firebase', () => ({
  auth: { type: 'auth-stub' },
  db: {},
  storage: {},
}))

const mockUser = {
  uid: 'test-uid',
  displayName: 'テスト太郎',
  email: 'test@example.com',
  photoURL: 'https://example.com/photo.png',
}

describe('lib/auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('signInWithGoogle', () => {
    it('AU-01: 成功時に signInWithPopup が auth と provider で呼ばれ User を返す', async () => {
      signInWithPopup.mockResolvedValue({ user: mockUser })
      const { signInWithGoogle } = await import('./auth')
      const user = await signInWithGoogle()
      expect(signInWithPopup).toHaveBeenCalledTimes(1)
      expect(GoogleAuthProvider).toHaveBeenCalledTimes(1)
      const [authArg, providerArg] = signInWithPopup.mock.calls[0]
      expect(authArg).toEqual({ type: 'auth-stub' })
      expect(providerArg).toBeDefined()
      expect(user).toEqual(mockUser)
    })

    it('AU-02: SDK エラーはそのまま呼び出し元へ throw される', async () => {
      signInWithPopup.mockRejectedValue({ code: 'auth/cancelled-popup-request' })
      const { signInWithGoogle } = await import('./auth')
      await expect(signInWithGoogle()).rejects.toMatchObject({
        code: 'auth/cancelled-popup-request',
      })
    })
  })

  describe('signOutUser', () => {
    it('AU-03: signOut が auth を引数に1回呼ばれる', async () => {
      signOut.mockResolvedValue(undefined)
      const { signOutUser } = await import('./auth')
      await signOutUser()
      expect(signOut).toHaveBeenCalledTimes(1)
      expect(signOut).toHaveBeenCalledWith({ type: 'auth-stub' })
    })

    it('AU-04: signOut 失敗時はエラーが伝播する', async () => {
      signOut.mockRejectedValue(new Error('signout failed'))
      const { signOutUser } = await import('./auth')
      await expect(signOutUser()).rejects.toThrow('signout failed')
    })
  })

  describe('getAuthErrorMessage', () => {
    it('AU-05: popup-closed-by-user は空文字を返す', async () => {
      const { getAuthErrorMessage } = await import('./auth')
      expect(getAuthErrorMessage('auth/popup-closed-by-user')).toBe('')
    })

    it('AU-06: network-request-failed のメッセージ', async () => {
      const { getAuthErrorMessage } = await import('./auth')
      expect(getAuthErrorMessage('auth/network-request-failed')).toBe(
        'ネットワーク接続を確認してください。'
      )
    })

    it('AU-07: too-many-requests のメッセージ', async () => {
      const { getAuthErrorMessage } = await import('./auth')
      expect(getAuthErrorMessage('auth/too-many-requests')).toBe(
        'しばらく時間をおいてから再試行してください。'
      )
    })

    it('AU-08: 未知コードはデフォルトメッセージ', async () => {
      const { getAuthErrorMessage } = await import('./auth')
      expect(getAuthErrorMessage('auth/internal-error')).toBe(
        'Googleログインに失敗しました。もう一度お試しください。'
      )
    })

    it('AU-09: 空文字/undefined でもデフォルトへフォールバックし例外を投げない', async () => {
      const { getAuthErrorMessage } = await import('./auth')
      const expected = 'Googleログインに失敗しました。もう一度お試しください。'
      expect(getAuthErrorMessage('')).toBe(expected)
      expect(getAuthErrorMessage(undefined as unknown as string)).toBe(expected)
    })
  })
})
