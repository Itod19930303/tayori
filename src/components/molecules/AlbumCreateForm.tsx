'use client'

// アルバム作成フォームの molecule（基本設計書 4.5）。タイトル/説明の入力・文字数カウンター・
// クライアントバリデーション（validators.ts）・二重送信防止・サーバーエラー表示を担う。
// Atomic Design のルールに従い入力状態はローカルに保持しつつ、送信は onSubmit（props）へ委ね、
// Firestore への書き込み・遷移は page 層の責務とする（データ直アクセスはしない）。
import { useState } from 'react'
import { Button } from '@/components/atoms/button'
import { validateAlbumTitle, validateAlbumDescription } from '@/lib/validators'

const TITLE_MAX = 50
const DESCRIPTION_MAX = 200

export interface AlbumCreateFormValues {
  title: string
  description: string
}

export interface AlbumCreateFormProps {
  onSubmit: (values: AlbumCreateFormValues) => void
  isSubmitting: boolean
  error: string | null
  // キャンセル押下時のハンドラ（遷移先 / はページ層で指定）。任意。
  onCancel?: () => void
}

export function AlbumCreateForm({
  onSubmit,
  isSubmitting,
  error,
  onCancel,
}: AlbumCreateFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [clientError, setClientError] = useState<string | null>(null)

  // 送信時にクライアントバリデーションを実施し、問題があれば onSubmit を呼ばずエラー表示する。
  // サーバーエラー（error prop）とは別に自前の検証結果を保持し、優先して表示する。
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    const titleError = validateAlbumTitle(title)
    const descriptionError = validateAlbumDescription(description)
    const nextError = titleError ?? descriptionError
    if (nextError) {
      setClientError(nextError)
      return
    }
    setClientError(null)
    onSubmit({ title, description })
  }

  // 表示するエラーはクライアント検証を優先し、無ければ親から渡るサーバーエラーを出す。
  const displayError = clientError ?? error

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-stack-md" noValidate>
      <div className="flex flex-col gap-stack-sm">
        <label
          htmlFor="album-title"
          className="font-label-md text-label-md text-on-surface-variant"
        >
          アルバム名
        </label>
        <input
          id="album-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="湖畔で過ごした夏休み"
          className="rounded-lg border-2 border-outline-variant bg-surface-container-lowest px-4 py-3 focus:border-primary focus:outline-none"
        />
        <span className="text-right font-caption text-caption text-on-surface-variant">
          {title.length}/{TITLE_MAX}
        </span>
      </div>

      <div className="flex flex-col gap-stack-sm">
        <label
          htmlFor="album-description"
          className="font-label-md text-label-md text-on-surface-variant"
        >
          説明
        </label>
        <textarea
          id="album-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="rounded-lg border-2 border-outline-variant bg-surface-container-lowest px-4 py-3 focus:border-primary focus:outline-none"
        />
        <span className="text-right font-caption text-caption text-on-surface-variant">
          {description.length}/{DESCRIPTION_MAX}
        </span>
      </div>

      {displayError && (
        // クライアント/サーバーいずれのエラーもスクリーンリーダーへ通知する（基本設計書 9.3 / 8.1 #6）
        <p
          role="alert"
          aria-live="polite"
          className="font-body-md text-body-md text-error"
        >
          {displayError}
        </p>
      )}

      <div className="flex justify-end gap-stack-md">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          className="h-12 rounded-lg px-6 text-on-surface hover:bg-surface-variant"
        >
          キャンセル
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-12 rounded-lg bg-primary px-6 text-on-primary hover:opacity-90"
        >
          {isSubmitting ? (
            <span
              role="status"
              aria-label="保存処理中"
              className="size-5 animate-spin rounded-full border-2 border-on-primary/40 border-t-on-primary"
            />
          ) : (
            'アルバムを保存'
          )}
        </Button>
      </div>
    </form>
  )
}
