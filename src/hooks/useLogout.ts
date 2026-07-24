'use client'

// ログアウトハンドラ共通フック（基本設計書 4.10 手順1〜4）。認証後6画面の各 page.tsx が TopHeader へ
// 渡す onLogoutClick は「signOutUser() を await → 成功で /login へ遷移 → 失敗で LOGOUT_FAILED を表示し
// 遷移しない」という同一の認証処理を持つ。認証系の重要処理が6画面で重複するため、development.md の
// 共通化基準（認証系は2箇所目で共通化検討／入出力・エラー処理方針・変更トリガー・業務ルールがすべて同一）
// に照らして本フックへ集約し、各画面での実装差異・修正漏れを防ぐ。
import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOutUser } from '@/lib/auth'
import { ERROR_MESSAGES } from '@/lib/messages/errorMessages'

export interface UseLogoutResult {
  // TopHeader の onLogoutClick に渡すログアウトハンドラ。
  handleLogout: () => Promise<void>
  // ログアウト失敗時の表示メッセージ。成功・未実行時は null。各 page が aria-live 領域へ描画する。
  logoutError: string | null
}

export function useLogout(): UseLogoutResult {
  const router = useRouter()
  const [logoutError, setLogoutError] = useState<string | null>(null)

  // 依存は router のみ。多重生成を避けるため useCallback で安定化する。
  const handleLogout = useCallback(async () => {
    // 再試行時に前回のエラー表示をクリアしてから実行する。
    setLogoutError(null)
    try {
      await signOutUser()
      // 成功時のみ /login へ遷移する（設計書 4.10 手順3）。
      router.push('/login')
    } catch (error) {
      // 失敗時は遷移せず画面に留まり、再試行できるようにする（設計書 4.10 手順4 / 8.1 #9）。
      // 実際の原因は本番切り分け用にログへ残し、利用者へは共通メッセージのみ表示する。
      console.error('ログアウトに失敗しました', error)
      setLogoutError(ERROR_MESSAGES.LOGOUT_FAILED)
    }
  }, [router])

  return { handleLogout, logoutError }
}
