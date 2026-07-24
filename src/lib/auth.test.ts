import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ERROR_MESSAGES } from './messages/errorMessages'

// auth.ts は Firebase Auth SDK の薄いラッパー。実ポップアップ/通信を避けるため
// firebase/auth を完全モックし、成功/失敗の伝播とエラーコード→メッセージ変換を検証する。
// 第9フェーズ（signInWithRedirect対応）では isMobileDevice の分岐を検証するため
// @/lib/device をモックし、モバイル判定を明示的に切り替える（設計書 6.1.1）。

const signInWithPopup = vi.fn()
const signInWithRedirect = vi.fn()
const signOut = vi.fn()
const GoogleAuthProvider = vi.fn()
const isMobileDevice = vi.fn()

vi.mock('firebase/auth', () => ({
  signInWithPopup: (...args: unknown[]) => signInWithPopup(...args),
  signInWithRedirect: (...args: unknown[]) => signInWithRedirect(...args),
  signOut: (...args: unknown[]) => signOut(...args),
  GoogleAuthProvider: class {
    constructor() {
      GoogleAuthProvider()
    }
  },
}))

vi.mock('@/lib/device', () => ({
  isMobileDevice: (...args: unknown[]) => isMobileDevice(...args),
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
    // 既定はPC判定（ポップアップ経路）。各テストで必要に応じて true へ上書きする
    isMobileDevice.mockReturnValue(false)
  })

  describe('signInWithGoogle', () => {
    it('AU-01: PC判定時は signInWithPopup が auth と provider で呼ばれ User を返す', async () => {
      isMobileDevice.mockReturnValue(false)
      signInWithPopup.mockResolvedValue({ user: mockUser })
      const { signInWithGoogle } = await import('./auth')
      const user = await signInWithGoogle()
      expect(signInWithPopup).toHaveBeenCalledTimes(1)
      expect(signInWithRedirect).not.toHaveBeenCalled()
      expect(GoogleAuthProvider).toHaveBeenCalledTimes(1)
      const [authArg, providerArg] = signInWithPopup.mock.calls[0]
      expect(authArg).toEqual({ type: 'auth-stub' })
      expect(providerArg).toBeDefined()
      expect(user).toEqual(mockUser)
    })

    it('AU-02: PC判定時、SDK エラーはそのまま呼び出し元へ throw される', async () => {
      isMobileDevice.mockReturnValue(false)
      signInWithPopup.mockRejectedValue({ code: 'auth/cancelled-popup-request' })
      const { signInWithGoogle } = await import('./auth')
      await expect(signInWithGoogle()).rejects.toMatchObject({
        code: 'auth/cancelled-popup-request',
      })
    })

    it('AU-10: モバイル判定時は signInWithRedirect が auth と provider で呼ばれ null を返す', async () => {
      isMobileDevice.mockReturnValue(true)
      signInWithRedirect.mockResolvedValue(undefined)
      const { signInWithGoogle } = await import('./auth')
      const result = await signInWithGoogle()
      expect(signInWithRedirect).toHaveBeenCalledTimes(1)
      expect(signInWithPopup).not.toHaveBeenCalled()
      expect(GoogleAuthProvider).toHaveBeenCalledTimes(1)
      const [authArg, providerArg] = signInWithRedirect.mock.calls[0]
      expect(authArg).toEqual({ type: 'auth-stub' })
      expect(providerArg).toBeDefined()
      expect(result).toBeNull()
    })

    it('AU-11: モバイル判定時は User を返さず null（型 User|null の境界）', async () => {
      isMobileDevice.mockReturnValue(true)
      signInWithRedirect.mockResolvedValue(undefined)
      const { signInWithGoogle } = await import('./auth')
      const r = await signInWithGoogle()
      expect(r).toBeNull()
    })

    it('AU-12: モバイル判定時、signInWithRedirect の reject が呼び出し元へ伝播する', async () => {
      isMobileDevice.mockReturnValue(true)
      signInWithRedirect.mockRejectedValue({ code: 'auth/network-request-failed' })
      const { signInWithGoogle } = await import('./auth')
      await expect(signInWithGoogle()).rejects.toMatchObject({
        code: 'auth/network-request-failed',
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
        ERROR_MESSAGES.AUTH_NETWORK_FAILED
      )
    })

    it('AU-07: too-many-requests のメッセージ', async () => {
      const { getAuthErrorMessage } = await import('./auth')
      expect(getAuthErrorMessage('auth/too-many-requests')).toBe(
        ERROR_MESSAGES.AUTH_TOO_MANY_REQUESTS
      )
    })

    it('AU-08: 未知コードはデフォルトメッセージ', async () => {
      const { getAuthErrorMessage } = await import('./auth')
      expect(getAuthErrorMessage('auth/internal-error')).toBe(
        ERROR_MESSAGES.AUTH_SIGNIN_FAILED
      )
    })

    it('AU-09: 空文字/undefined でもデフォルトへフォールバックし例外を投げない', async () => {
      const { getAuthErrorMessage } = await import('./auth')
      const expected = ERROR_MESSAGES.AUTH_SIGNIN_FAILED
      expect(getAuthErrorMessage('')).toBe(expected)
      expect(getAuthErrorMessage(undefined as unknown as string)).toBe(expected)
    })
  })
})
