// ログイン画面の中核となる表示コンポーネント（molecules）。
// アプリロゴ・サブテキスト・Googleログインボタン・エラーメッセージを組み合わせる。
// Atomic Design のルールに従い props のみで完結させ、Firebase/Storage へ直接アクセスしない
// （ログイン処理・状態管理は page 層の責務）。既存の Button atom を再利用する。
import { Button } from '@/components/atoms/button'

export interface LoginCardProps {
  onSignIn: () => void
  isLoading: boolean
  error: string | null
}

// Google ブランドの G アイコン。装飾目的のため aria-hidden とし、ボタン名はテキストで担保する。
function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true" focusable="false">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  )
}

export function LoginCard({ onSignIn, isLoading, error }: LoginCardProps) {
  // error が null または空文字のときはエラー領域自体を描画しない。
  // popup-closed-by-user のようにキャンセル時は空文字が渡るため、この判定で非表示にする。
  const hasError = Boolean(error)

  return (
    <div className="w-full max-w-md rounded-xl bg-surface-container-lowest p-stack-lg custom-shadow">
      <div className="flex flex-col items-center gap-stack-md text-center">
        <h1 className="font-display-lg text-display-lg text-primary">たより</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          LINEで流れてしまう画像・動画を、一元管理。
        </p>

        <Button
          type="button"
          onClick={onSignIn}
          disabled={isLoading}
          className="mt-stack-md h-12 w-full gap-stack-sm rounded-lg bg-primary px-6 text-on-primary hover:opacity-90"
        >
          {isLoading ? (
            // 二重送信防止中であることを視覚的に示すスピナー
            <span
              role="status"
              aria-label="ログイン処理中"
              className="size-5 animate-spin rounded-full border-2 border-on-primary/40 border-t-on-primary"
            />
          ) : (
            <GoogleIcon />
          )}
          Googleでログイン
        </Button>

        {hasError && (
          // スクリーンリーダーへエラーを通知する（基本設計書 9.3 / 8.1 #1）
          <p
            role="alert"
            aria-live="polite"
            className="font-body-md text-body-md text-error"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
