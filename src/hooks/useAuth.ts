'use client'

// AuthContext を安全に読み取るためのフック。Provider 外での使用は設定漏れのバグであり、
// 早期に検知できるよう例外を投げる（デフォルト値を返すと未ログイン扱いになり不具合が潜在化するため）。
import { useContext } from 'react'
import { AuthContext, type AuthContextType } from '@/contexts/AuthContext'

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth は AuthProvider 内で使用してください')
  }
  return context
}
