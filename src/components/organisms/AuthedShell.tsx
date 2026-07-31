// ログイン済みユーザー向けの共通シェル（organisms 層、基本設計書 4.10）。
// アルバム詳細 / メディアプレビュー / 権限管理の3ページで、TopHeader + ログアウトエラー帯 + 本文という
// 完全に同一のレイアウトが各ページ内へローカル複製されていたため、単一の変更理由（共通ヘッダー/ログアウト
// 導線の仕様変更）で一括保守できるよう共通コンポーネントへ切り出す（development.md 共通化基準1〜4を充足）。
// 正常系だけでなく403/404通知画面もこのシェル内へ描画することで、「ログイン済みだがアクセスできない」状態でも
// 共通ヘッダーとログアウト導線を必ず提供する（CodeRabbit Major指摘: エラー画面でログアウト手段が失われる問題）。
// organisms 層の制約（atomic-design.md）に従い Firebase SDK は直接呼ばず、ログアウトは onLogoutClick を
// 呼ぶだけの純粋表示コンポーネントとする（実処理・遷移・エラー保持は page.tsx / hooks の責務）。
import type { ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { TopHeader } from '@/components/organisms/TopHeader'

export interface AuthedShellProps {
  // 表示中のログインユーザー。TopHeader へそのまま委譲し、ヘッダーのユーザー表示に用いる。
  currentUser: User
  // ホームボタン押下時に呼ぶコールバック（必須・設計書4.10.1）。内部の TopHeader へそのまま中継する。
  onHomeClick: () => void
  // ログアウトボタン押下時に呼ぶコールバック。実処理（signOutUser・遷移）は page.tsx が担う。
  onLogoutClick: () => void
  // ログアウト失敗時のメッセージ。null のときはエラー帯を描画しない。
  logoutError: string | null
  // シェル下段に配置する本文（正常系テンプレート、または403/404通知画面）。
  children: ReactNode
}

export function AuthedShell({
  currentUser,
  onHomeClick,
  onLogoutClick,
  logoutError,
  children,
}: AuthedShellProps) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <TopHeader
        currentUser={currentUser}
        onHomeClick={onHomeClick}
        onLogoutClick={onLogoutClick}
      />
      {logoutError && (
        <p
          role="alert"
          aria-live="assertive"
          className="bg-error-container px-margin-mobile py-stack-sm text-center font-body-md text-body-md text-error md:px-margin-desktop"
        >
          {logoutError}
        </p>
      )}
      {children}
    </div>
  )
}
