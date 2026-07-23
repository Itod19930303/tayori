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
})
