import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { ERROR_MESSAGES } from '@/lib/messages/errorMessages'

// ログアウト共通フック（基本設計書 4.10）。signOutUser と next/navigation をモックし、
// 成功時の /login 遷移・失敗時の LOGOUT_FAILED 設定と非遷移を検証する。

const push = vi.fn()
const signOutUser = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))
vi.mock('@/lib/auth', () => ({
  signOutUser: (...args: unknown[]) => signOutUser(...args),
}))

import { useLogout } from './useLogout'

describe('useLogout (ログアウト共通フック)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('成功時: signOutUser を呼び /login へ push し、logoutError は null のまま', async () => {
    signOutUser.mockResolvedValue(undefined)
    const { result } = renderHook(() => useLogout())

    await act(async () => {
      await result.current.handleLogout()
    })

    expect(signOutUser).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/login')
    expect(result.current.logoutError).toBeNull()
  })

  it('失敗時: push を呼ばず logoutError に LOGOUT_FAILED を設定する', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    signOutUser.mockRejectedValue(new Error('signout failed'))
    const { result } = renderHook(() => useLogout())

    await act(async () => {
      await result.current.handleLogout()
    })

    await waitFor(() =>
      expect(result.current.logoutError).toBe(ERROR_MESSAGES.LOGOUT_FAILED)
    )
    expect(push).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})
