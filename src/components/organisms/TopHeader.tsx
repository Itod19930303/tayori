// 共通ヘッダー（organisms 層、基本設計書 4.10）。本番環境にログアウト手段が無い緊急課題への対応として、
// 認証後の全画面最上部に常時表示し、ログイン中ユーザーの視認と1タップでのログアウト導線を提供する。
// organisms 層の制約（atomic-design.md）に従い Firebase SDK は直接呼ばず、ログアウトは onLogoutClick を
// 呼ぶだけに留める純粋表示コンポーネントとする（実処理・遷移は page.tsx 側の責務）。
import type { User } from 'firebase/auth'

export interface TopHeaderProps {
  // Firebase Auth の User。表示（displayName / photoURL / email）にのみ使用する。
  currentUser: User | null
  // ログアウトボタン押下時に呼ぶコールバック。実処理（signOutUser・遷移）は page.tsx が担う。
  onLogoutClick: () => void
}

export function TopHeader({ currentUser, onLogoutClick }: TopHeaderProps) {
  // 表示名のフォールバック順（設計書 4.10）: displayName → email → 「ゲスト」。
  // photoURL 欠損時のアバター代替に用いる頭文字も、この確定表示名の先頭1文字から生成する。
  const displayName = currentUser?.displayName || currentUser?.email || 'ゲスト'
  const initial = displayName.charAt(0)

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-surface-variant bg-background px-margin-mobile md:px-margin-desktop">
      {/* ロゴ/アプリ名。認証状態に関わらず常に表示し、認証確認中のちらつき時も画面が空にならないようにする。 */}
      <span className="font-headline-md text-headline-md font-bold text-primary">
        たより
      </span>

      {/* currentUser が null（認証確認中・ログアウト直後）のときは操作対象が無いため、
          アバター・ユーザー名・ログアウトボタンを一切描画しない（設計書 4.10）。 */}
      {currentUser && (
        <div className="flex items-center gap-stack-md">
          {currentUser.photoURL ? (
            // Google アカウントのアバターURLを直接表示する。provider 非依存の外部URLのため next/image は使わない。
            // eslint-disable-next-line @next/next/no-img-element -- 外部の署名不要アバターURLを直接表示するため
            <img
              src={currentUser.photoURL}
              alt={displayName}
              className="size-8 rounded-full object-cover"
            />
          ) : (
            // photoURL 欠損時は壊れた <img> を出さず、頭文字を既定アバターとして表示する（設計書 4.10）。
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-full bg-secondary-container font-label-md text-label-md text-on-secondary-container"
            >
              {initial}
            </span>
          )}

          <span className="font-body-md text-body-md text-on-surface">
            {displayName}
          </span>

          {/* Ghost 風のログアウトボタン。押下時は onLogoutClick を呼ぶだけに留める（organisms 層制約）。
              確認ダイアログは設けず即時ログアウトとする（緊急対応方針・設計書 4.10）。 */}
          <button
            type="button"
            onClick={onLogoutClick}
            className="inline-flex h-9 items-center gap-1 rounded-lg px-3 font-label-md text-label-md text-on-surface-variant hover:bg-surface-variant active:scale-95"
          >
            <span
              className="material-symbols-outlined text-xl"
              aria-hidden="true"
            >
              logout
            </span>
            ログアウト
          </button>
        </div>
      )}
    </header>
  )
}
