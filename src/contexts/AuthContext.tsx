'use client'

// アプリ全体で認証状態を共有する Context。onAuthStateChanged を購読し、
// { currentUser, loading } を提供する。初期は loading=true とし、認証状態が確定するまで
// 各画面がちらつき（未ログイン画面の一瞬の表示）を起こさないようにする（基本設計書 7.4）。
import { createContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase'

export interface AuthContextType {
  currentUser: User | null
  loading: boolean
}

// 既定値は undefined とし、Provider 未装着（誤用）を useAuth 側で検知できるようにする。
// Provider 配下では必ず { currentUser, loading } が供給されるため、undefined になるのは
// Provider 外で useContext した場合のみである。
export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 認証状態の変化（ログイン/ログアウト/セッション切れ）を購読し、状態を更新する。
    // 初回発火時に loading を false にして状態確定を通知する。
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
      setLoading(false)
    })
    // アンマウント時に購読解除してメモリリークを防ぐ。
    return unsubscribe
  }, [])

  return (
    <AuthContext.Provider value={{ currentUser, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
