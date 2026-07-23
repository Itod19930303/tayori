import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { PendingInvite } from '@/types'

// usePendingInvites は albums/{albumId}/pendingInvites を onSnapshot で購読し、
// 表示用 AlbumMember（invited:true・uid空）配列へ変換して返すフック（基本設計書 4.8）。
// firebase/firestore（collection / onSnapshot）をモックし、変換・空・エラー・解除を検証する。

const collection = vi.fn((..._args: unknown[]) => ({ __type: 'collection' }))
const onSnapshot = vi.fn()

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: (...args: unknown[]) => collection(...args),
  onSnapshot: (...args: unknown[]) => onSnapshot(...args),
}))

vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: { __type: 'db-stub' },
  storage: {},
}))

import { usePendingInvites } from './usePendingInvites'

const mockPendingInvite = {
  email: 'invitee@example.com',
  role: 'viewer',
  canView: true,
  canPost: false,
  canManage: false,
  invitedBy: 'admin-uid',
  invitedAt: { toMillis: () => 0 },
} as unknown as PendingInvite

describe('hooks/usePendingInvites', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    onSnapshot.mockReturnValue(vi.fn())
  })

  it('UPI-01: 招待を invited:true の AlbumMember へ変換する', () => {
    let nextCb: (snap: unknown) => void = () => {}
    onSnapshot.mockImplementation((_q, next: (snap: unknown) => void) => {
      nextCb = next
      return vi.fn()
    })
    const { result } = renderHook(() => usePendingInvites('album-1'))
    act(() =>
      nextCb({
        docs: [{ id: 'invitee@example.com', data: () => mockPendingInvite }],
      })
    )
    expect(result.current.invites).toHaveLength(1)
    const invited = result.current.invites[0]
    expect(invited.invited).toBe(true)
    expect(invited.uid).toBe('')
    expect(invited.email).toBe('invitee@example.com')
    expect(invited.displayName).toBe('invitee@example.com')
    expect(invited.canManage).toBe(false)
    expect(result.current.loading).toBe(false)
  })

  it('UPI-02: 招待0件で空配列を返し loading:false', () => {
    let nextCb: (snap: unknown) => void = () => {}
    onSnapshot.mockImplementation((_q, next: (snap: unknown) => void) => {
      nextCb = next
      return vi.fn()
    })
    const { result } = renderHook(() => usePendingInvites('album-1'))
    act(() => nextCb({ docs: [] }))
    expect(result.current.invites).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('UPI-03: 購読エラー時に空フォールバックし例外を投げない', () => {
    let errCb: (e: unknown) => void = () => {}
    onSnapshot.mockImplementation(
      (_q, _next: unknown, error: (e: unknown) => void) => {
        errCb = error
        return vi.fn()
      }
    )
    const { result } = renderHook(() => usePendingInvites('album-1'))
    expect(() => act(() => errCb({ code: 'permission-denied' }))).not.toThrow()
    expect(result.current.invites).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('UPI-04: アンマウント時に unsubscribe が呼ばれる', () => {
    const unsub = vi.fn()
    onSnapshot.mockReturnValue(unsub)
    const { unmount } = renderHook(() => usePendingInvites('album-1'))
    unmount()
    expect(unsub).toHaveBeenCalledTimes(1)
  })
})
