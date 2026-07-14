import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { User } from 'firebase/auth'
import type { ReactNode } from 'react'

// useAuth は AuthContext を読むフック。Provider 配下で正しい値を返すこと、
// Provider 外の誤用を検知して例外を投げることを検証する。
// 実 Firebase を避けるため firebase/auth と lib/firebase をモックする。

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(() => vi.fn()),
}))
vi.mock('@/lib/firebase', () => ({
  auth: { type: 'auth-stub' },
  db: {},
  storage: {},
}))

import { AuthContext } from '@/contexts/AuthContext'
import { useAuth } from './useAuth'

const mockUser = {
  uid: 'test-uid',
  displayName: 'テスト太郎',
} as unknown as User

describe('hooks/useAuth', () => {
  it('UA-01: Provider 配下で現在の認証状態を返す', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthContext.Provider value={{ currentUser: mockUser, loading: false }}>
        {children}
      </AuthContext.Provider>
    )
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.currentUser).toBe(mockUser)
    expect(result.current.loading).toBe(false)
  })

  it('UA-02: Provider 外で使用すると例外を投げる', () => {
    expect(() => renderHook(() => useAuth())).toThrow()
  })
})
