'use client'

// 権限管理画面のレイアウト骨格（templates 層、実データ非保持・基本設計書 4.8）。
// ページヘッダー（戻るリンク・見出し・「家族を招待」ボタン）・PermissionTable・ActionRow・
// InviteModal を配置し、受け取った props を透過的に渡す。データ取得・書き込みは page 層の責務とし、
// この層は構造（配置）のみに関心を持つ。完了/失敗フィードバックは既存アップロード画面と同系統の
// インラインメッセージで表示し、汎用 Toast 基盤は設けない（設計書4.8 スコープ外）。
import { PermissionTable } from '@/components/organisms/PermissionTable'
import { ActionRow } from '@/components/organisms/ActionRow'
import { InviteModal } from '@/components/molecules/InviteModal'
import type { PermissionField } from '@/components/molecules/MemberRow'
import type { InvitePreset } from '@/lib/firestorePermissions'
import type { AlbumMember } from '@/types'

// インラインメッセージ。tone で成功（primary）/失敗（error）の配色を切り替える。
export interface InlineMessage {
  text: string
  tone: 'success' | 'error'
}

export interface PermissionsTemplateProps {
  albumTitle: string
  albumId: string
  members: AlbumMember[]
  onToggle: (member: AlbumMember, field: PermissionField) => void
  onChangePreset: (member: AlbumMember, field: PermissionField) => void
  onCancelInvite: (email: string) => void
  onSave: () => void
  isDirty: boolean
  isSaving: boolean
  isInviteOpen: boolean
  onInviteOpen: () => void
  onInviteClose: () => void
  onInvite: (email: string, preset: InvitePreset) => void
  message: InlineMessage | null
  onBack?: () => void
}

export function PermissionsTemplate({
  albumTitle,
  albumId,
  members,
  onToggle,
  onChangePreset,
  onCancelInvite,
  onSave,
  isDirty,
  isSaving,
  isInviteOpen,
  onInviteOpen,
  onInviteClose,
  onInvite,
  message,
  onBack,
}: PermissionsTemplateProps) {
  return (
    <div className="flex min-h-screen flex-1 flex-col gap-stack-lg bg-background px-margin-mobile py-stack-lg md:px-margin-desktop">
      <header className="flex flex-col gap-stack-md">
        {/* 戻るリンク:「「[アルバム名]」に戻る」（設計書4.8）。onBack 未指定でも表示崩れしないよう button で表現。 */}
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-stack-sm self-start font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            arrow_back
          </span>
          「{albumTitle}」に戻る
        </button>

        <div className="flex flex-col gap-stack-md md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-stack-sm">
            <h1 className="font-headline-lg text-headline-lg text-on-surface">
              アルバムの閲覧権限
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              家族メンバーごとに閲覧・投稿・管理の権限を設定できます。
            </p>
          </div>
          <button
            type="button"
            onClick={onInviteOpen}
            className="inline-flex h-10 items-center gap-stack-sm self-start rounded-lg bg-primary px-4 font-label-md text-label-md text-on-primary hover:opacity-90"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              person_add
            </span>
            家族を招待
          </button>
        </div>
      </header>

      {/* 成功/失敗のインラインメッセージ（既存アップロード画面と同系統） */}
      {message && (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={
            message.tone === 'error'
              ? 'font-body-md text-body-md text-error'
              : 'font-body-md text-body-md text-primary'
          }
        >
          {message.text}
        </p>
      )}

      <PermissionTable
        members={members}
        onToggle={onToggle}
        onChangePreset={onChangePreset}
        onCancelInvite={onCancelInvite}
      />

      <ActionRow isDirty={isDirty} isSaving={isSaving} onSave={onSave} />

      <InviteModal
        open={isInviteOpen}
        albumId={albumId}
        onInvite={onInvite}
        onClose={onInviteClose}
      />
    </div>
  )
}
