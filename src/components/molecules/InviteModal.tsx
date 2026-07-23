'use client'

// 招待モーダル（molecules、基本設計書 4.8）。2導線を提供する:
// ① URLコピー（既存維持）: アルバムURLを navigator.clipboard.writeText でコピー。
// ② メール招待（新規）: メール入力 + 権限プリセット選択で onInvite(正規化メール, preset) を委譲。
// Atomic Design のルールに従い Firestore へは直接アクセスせず、実書き込みは page 層が担う。
// 完了/エラーは既存アップロード画面と同系統のインラインメッセージで表示する（汎用Toast基盤は作らない）。
import { useState } from 'react'
import type { InvitePreset } from '@/lib/firestorePermissions'

export interface InviteModalProps {
  open: boolean
  albumId: string
  onInvite: (email: string, preset: InvitePreset) => void
  onClose: () => void
}

// 権限プリセット → チェックボックス値の対応（基本設計書 6.7 権限モデル）。owner は招待対象外。
const PRESET_PERMISSIONS: Record<InvitePreset['role'], InvitePreset> = {
  viewer: { role: 'viewer', canView: true, canPost: false, canManage: false },
  editor: { role: 'editor', canView: true, canPost: true, canManage: false },
  admin: { role: 'admin', canView: true, canPost: true, canManage: true },
}

// 簡易メール形式チェック。厳密な RFC 準拠ではなく、明白な不正入力（空・@なし）を弾く用途。
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function InviteModal({ open, albumId, onInvite, onClose }: InviteModalProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InvitePreset['role']>('viewer')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // open=false のときは DOM を持たない（モーダル未表示）。
  if (!open) return null

  // ① URLコピー: window.location.origin を基準にアルバムURLを組み立ててコピーする。
  const handleCopy = async () => {
    await navigator.clipboard.writeText(`${location.origin}/albums/${albumId}`)
    setCopied(true)
  }

  // ② メール招待: 正規化して形式検証し、通過時のみプリセットとともに onInvite へ委譲する。
  const handleInvite = () => {
    const normalized = email.trim().toLowerCase()
    if (normalized.length === 0) {
      setError('メールアドレスを入力してください')
      return
    }
    if (!EMAIL_PATTERN.test(normalized)) {
      setError('メールアドレスの形式が正しくありません')
      return
    }
    setError(null)
    onInvite(normalized, PRESET_PERMISSIONS[role])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-margin-mobile">
      <div className="flex w-full max-w-md flex-col gap-stack-lg rounded-lg bg-surface p-stack-lg shadow-md">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-md text-headline-md text-on-surface">家族を招待</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="flex size-8 items-center justify-center rounded-full hover:bg-surface-container"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        {/* ① URLコピー導線 */}
        <div className="flex flex-col gap-stack-sm">
          <p className="font-label-md text-label-md text-on-surface-variant">
            リンクを共有して招待
          </p>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-outline-variant px-4 font-label-md text-label-md text-on-surface hover:bg-surface-container"
          >
            リンクをコピー
          </button>
          {copied && (
            <p className="font-caption text-caption text-primary">リンクをコピーしました</p>
          )}
        </div>

        {/* ② メール招待導線 */}
        <div className="flex flex-col gap-stack-sm border-t border-outline-variant pt-stack-md">
          <label className="flex flex-col gap-stack-sm font-label-md text-label-md text-on-surface-variant">
            メールアドレス
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="family@example.com"
              className="h-10 rounded-lg border border-outline-variant px-3 font-body-md text-body-md text-on-surface"
            />
          </label>
          <label className="flex flex-col gap-stack-sm font-label-md text-label-md text-on-surface-variant">
            権限
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as InvitePreset['role'])}
              className="h-10 rounded-lg border border-outline-variant px-3 font-body-md text-body-md text-on-surface"
            >
              <option value="viewer">閲覧のみ</option>
              <option value="editor">閲覧・投稿</option>
              <option value="admin">管理（招待・権限変更）</option>
            </select>
          </label>

          {error && (
            <p role="alert" className="font-caption text-caption text-error">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleInvite}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 font-label-md text-label-md text-on-primary hover:opacity-90"
          >
            招待する
          </button>
        </div>
      </div>
    </div>
  )
}
