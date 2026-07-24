import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { ERROR_MESSAGES } from '@/lib/messages/errorMessages'

// ログインページ（pages 層）の振る舞いを検証する。
// useAuth / next/navigation / signInWithGoogle をモックし、
// 認証状態に応じた表示・リダイレクト・エラーメッセージ変換・二重送信防止を確認する。
// getAuthErrorMessage は実装（importActual）を用い、コード→メッセージ変換の統合も担保する。

const mockUser = {
  uid: 'test-uid',
  displayName: 'テスト太郎',
} as unknown as User

let authState: { currentUser: User | null; loading: boolean } = {
  currentUser: null,
  loading: false,
}
const replace = vi.fn()
const push = vi.fn()
let searchParamsValue = new URLSearchParams('')
const signInWithGoogle = vi.fn()
// 第9フェーズ（signInWithRedirect対応）で追加するモック（設計書 6.1.1(3)(4)）
const getRedirectResult = vi.fn()
const isMobileDevice = vi.fn()
const RETURN_URL_STORAGE_KEY = 'tayori:returnUrl'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authState,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => searchParamsValue,
}))
vi.mock('@/lib/firebase', () => ({ auth: {}, db: {}, storage: {} }))
vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: class {},
  getRedirectResult: (...args: unknown[]) => getRedirectResult(...args),
}))
vi.mock('@/lib/device', () => ({
  isMobileDevice: (...args: unknown[]) => isMobileDevice(...args),
}))
vi.mock('@/lib/auth', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/auth')>()
  return {
    ...actual,
    signInWithGoogle: (...args: unknown[]) => signInWithGoogle(...args),
  }
})

import LoginPage from './page'

const clickSignIn = () =>
  userEvent.click(screen.getByRole('button', { name: /Googleでログイン/ }))

describe('app/(auth)/login/page', () => {
  beforeEach(() => {
    authState = { currentUser: null, loading: false }
    searchParamsValue = new URLSearchParams('')
    vi.clearAllMocks()
    // 既定はリダイレクト由来でない通常表示（null）・PC判定。各テストで上書きする
    getRedirectResult.mockResolvedValue(null)
    isMobileDevice.mockReturnValue(false)
    sessionStorage.clear()
  })

  it('LP-01: 未ログイン時にログイン UI を表示し遷移しない', () => {
    render(<LoginPage />)
    expect(screen.getByText('たより')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Googleでログイン/ })
    ).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it('LP-02: ログイン成功→認証状態更新でホームへ遷移', async () => {
    signInWithGoogle.mockResolvedValue(mockUser)
    const { rerender } = render(<LoginPage />)
    await clickSignIn()
    expect(signInWithGoogle).toHaveBeenCalledTimes(1)
    // onAuthStateChanged 相当の更新
    authState = { currentUser: mockUser, loading: false }
    rerender(<LoginPage />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
  })

  it('LP-03: ログイン済みで /login にアクセスすると / へリダイレクトしUIを出さない', async () => {
    authState = { currentUser: mockUser, loading: false }
    render(<LoginPage />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(
      screen.queryByRole('button', { name: /Googleでログイン/ })
    ).not.toBeInTheDocument()
  })

  it('LP-04: returnUrl があればログイン後その宛先へ遷移', async () => {
    searchParamsValue = new URLSearchParams('returnUrl=/albums/abc123')
    signInWithGoogle.mockResolvedValue(mockUser)
    const { rerender } = render(<LoginPage />)
    await clickSignIn()
    authState = { currentUser: mockUser, loading: false }
    rerender(<LoginPage />)
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/albums/abc123')
    )
  })

  it('LP-05: loading 中はローディング表示でボタンを出さず遷移しない', () => {
    authState = { currentUser: null, loading: true }
    render(<LoginPage />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Googleでログイン/ })
    ).not.toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('LP-06: popup-closed-by-user はエラー非表示・遷移しない', async () => {
    signInWithGoogle.mockRejectedValue({ code: 'auth/popup-closed-by-user' })
    render(<LoginPage />)
    await clickSignIn()
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('LP-07: network-request-failed でネットワークエラーを表示', async () => {
    signInWithGoogle.mockRejectedValue({ code: 'auth/network-request-failed' })
    render(<LoginPage />)
    await clickSignIn()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        ERROR_MESSAGES.AUTH_NETWORK_FAILED
      )
    )
    expect(replace).not.toHaveBeenCalled()
  })

  it('LP-08: too-many-requests で対応メッセージを表示', async () => {
    signInWithGoogle.mockRejectedValue({ code: 'auth/too-many-requests' })
    render(<LoginPage />)
    await clickSignIn()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        ERROR_MESSAGES.AUTH_TOO_MANY_REQUESTS
      )
    )
  })

  it('LP-09: 未知コードでデフォルトメッセージを表示', async () => {
    signInWithGoogle.mockRejectedValue({ code: 'auth/internal-error' })
    render(<LoginPage />)
    await clickSignIn()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        ERROR_MESSAGES.AUTH_SIGNIN_FAILED
      )
    )
  })

  it('LP-10: ログイン処理中は二重送信を防ぐ', async () => {
    // 解決しない Promise でローディング状態を維持する
    signInWithGoogle.mockReturnValue(new Promise(() => {}))
    render(<LoginPage />)
    const button = screen.getByRole('button', { name: /Googleでログイン/ })
    await userEvent.click(button)
    await waitFor(() => expect(button).toBeDisabled())
    await userEvent.click(button)
    expect(signInWithGoogle).toHaveBeenCalledTimes(1)
  })

  it('LP-11: ログイン失敗後に再度押下できる', async () => {
    signInWithGoogle
      .mockRejectedValueOnce({ code: 'auth/network-request-failed' })
      .mockResolvedValueOnce(mockUser)
    render(<LoginPage />)
    const button = screen.getByRole('button', { name: /Googleでログイン/ })
    await userEvent.click(button)
    await waitFor(() => expect(button).toBeEnabled())
    await userEvent.click(button)
    expect(signInWithGoogle).toHaveBeenCalledTimes(2)
  })

  // 第9フェーズ（signInWithRedirect対応）: getRedirectResult のマウント時処理と
  // returnUrl の sessionStorage 保存/復元/削除を検証する（設計書 6.1.1(3)(4)）。

  it('LP-12: getRedirectResult 成功時に sessionStorage の returnUrl を復元して遷移', async () => {
    sessionStorage.setItem(RETURN_URL_STORAGE_KEY, '/albums/abc123')
    getRedirectResult.mockResolvedValue({ user: mockUser })
    const { rerender } = render(<LoginPage />)
    await waitFor(() => expect(getRedirectResult).toHaveBeenCalledTimes(1))
    // onAuthStateChanged 相当で currentUser が更新される
    authState = { currentUser: mockUser, loading: false }
    rerender(<LoginPage />)
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/albums/abc123')
    )
    // 遷移経路は二重化しない（replace は1回のみ）
    expect(replace).toHaveBeenCalledTimes(1)
  })

  it('LP-13: getRedirectResult が null なら従来どおりUI表示・遷移しない（回帰）', async () => {
    getRedirectResult.mockResolvedValue(null)
    render(<LoginPage />)
    await waitFor(() => expect(getRedirectResult).toHaveBeenCalled())
    expect(
      screen.getByRole('button', { name: /Googleでログイン/ })
    ).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('LP-14: getRedirectResult reject 時に AUTH_SIGNIN_FAILED を表示・遷移しない', async () => {
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem')
    getRedirectResult.mockRejectedValue({ code: 'auth/no-auth-event' })
    render(<LoginPage />)
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        ERROR_MESSAGES.AUTH_SIGNIN_FAILED
      )
    )
    expect(replace).not.toHaveBeenCalled()
    // 失敗時もキーの後始末を行う
    expect(removeItem).toHaveBeenCalledWith(RETURN_URL_STORAGE_KEY)
    removeItem.mockRestore()
  })

  it('LP-15: モバイル判定時、redirect 直前に returnUrl を sessionStorage へ保存', async () => {
    isMobileDevice.mockReturnValue(true)
    searchParamsValue = new URLSearchParams('returnUrl=/albums/xyz')
    signInWithGoogle.mockResolvedValue(null)
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    render(<LoginPage />)
    await clickSignIn()
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalled())
    // 保存→redirect の順序を担保する
    const setItemOrder = setItem.mock.invocationCallOrder[
      setItem.mock.calls.findIndex(
        ([k]) => k === RETURN_URL_STORAGE_KEY
      )
    ]
    const signInOrder = signInWithGoogle.mock.invocationCallOrder[0]
    expect(setItem).toHaveBeenCalledWith(RETURN_URL_STORAGE_KEY, '/albums/xyz')
    expect(setItemOrder).toBeLessThan(signInOrder)
    setItem.mockRestore()
  })

  it('LP-16: returnUrl 不在時は / へフォールバックし復元後にキー削除', async () => {
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem')
    // sessionStorage にキー無し
    getRedirectResult.mockResolvedValue({ user: mockUser })
    const { rerender } = render(<LoginPage />)
    await waitFor(() => expect(getRedirectResult).toHaveBeenCalledTimes(1))
    authState = { currentUser: mockUser, loading: false }
    rerender(<LoginPage />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(removeItem).toHaveBeenCalledWith(RETURN_URL_STORAGE_KEY)
    removeItem.mockRestore()
  })
})
