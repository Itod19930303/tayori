'use client'

// 招待受諾フック（基本設計書 6.7）。アルバム詳細/権限管理ページの 403判定の「前」に呼び、
// 「招待済みだが未受諾」のユーザーを初回アクセスで自動的にメンバー化する。受諾ロジックの重複を
// 避けるため両ページで共有する。受諾の失敗は握りつぶし、後続の権限判定（403 or 表示）を妨げない。
import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { acceptPendingInvite } from '@/lib/firestorePermissions'

export function useAcceptInvite(albumId: string): void {
  const { currentUser } = useAuth()
  // 同一マウント内での多重受諾（多重バッチ書き込み）を防ぐためのガード。
  // 再レンダリングのたびに acceptPendingInvite を呼ばないよう、実行済みキーを保持する。
  const attemptedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!currentUser || !albumId) return
    // albumId + uid の組み合わせを1回だけ試行する。
    const key = `${albumId}:${currentUser.uid}`
    if (attemptedRef.current === key) return
    attemptedRef.current = key

    // 受諾は副作用として実行し、失敗しても例外を伝播させない（403判定を妨げないため）。
    acceptPendingInvite(albumId, currentUser).catch((error) => {
      // 原因切り分け用にログのみ残す。ユーザー向けメッセージは出さない（自動受諾のため）。
      console.error('招待の受諾に失敗しました', error)
    })
  }, [albumId, currentUser])
}
