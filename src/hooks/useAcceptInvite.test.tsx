import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { act } from 'react'
import type { User } from 'firebase/auth'

// useAcceptInvite はアルバム詳細/権限管理ページ共通の受諾フック（基本設計書 6.7）。
// 403判定の前に acceptPendingInvite を1回だけ呼ぶ。useAuth と acceptPendingInvite をモックし、
// ログイン時の1回呼び出し・未ログイン時の抑止・二重呼び出し防止・reject 握りつぶしを検証する。

let authState: { currentUser: User | null; loading: boolean } = {
  currentUser: null,
  loading: false,
}
const acceptPendingInvite = vi.fn()

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => authState }))
vi.mock('@/lib/firestorePermissions', () => ({
  acceptPendingInvite: (...args: unknown[]) => acceptPendingInvite(...args),
}))

import { useAcceptInvite } from './useAcceptInvite'

const mockUser = { uid: 'test-uid', email: 'invitee@example.com' } as unknown as User

describe('hooks/useAcceptInvite', () => {
  beforeEach(() => {
    authState = { currentUser: null, loading: false }
    vi.clearAllMocks()
    acceptPendingInvite.mockResolvedValue(true)
  })

  it('UAI-01: ログイン済みかつ albumId 確定時に acceptPendingInvite を1回呼ぶ', async () => {
    authState = { currentUser: mockUser, loading: false }
    await act(async () => {
      renderHook(() => useAcceptInvite('album-1'))
    })
    expect(acceptPendingInvite).toHaveBeenCalledTimes(1)
    expect(acceptPendingInvite).toHaveBeenCalledWith('album-1', mockUser)
  })

  it('UAI-02: 未ログイン時は受諾処理を呼ばない', async () => {
    authState = { currentUser: null, loading: false }
    await act(async () => {
      renderHook(() => useAcceptInvite('album-1'))
    })
    expect(acceptPendingInvite).not.toHaveBeenCalled()
  })

  it('UAI-03: 同一マウント内で再レンダリングしても受諾は1回', async () => {
    authState = { currentUser: mockUser, loading: false }
    let rerender: () => void = () => {}
    await act(async () => {
      const r = renderHook(() => useAcceptInvite('album-1'))
      rerender = () => r.rerender()
    })
    await act(async () => {
      rerender()
      rerender()
    })
    expect(acceptPendingInvite).toHaveBeenCalledTimes(1)
  })

  it('UAI-04: 受諾処理が reject しても例外を投げず握りつぶす', async () => {
    authState = { currentUser: mockUser, loading: false }
    acceptPendingInvite.mockRejectedValue(new Error('accept failed'))
    await expect(
      act(async () => {
        renderHook(() => useAcceptInvite('album-1'))
      })
    ).resolves.not.toThrow()
  })
})
