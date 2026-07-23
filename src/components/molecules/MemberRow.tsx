'use client'

// メンバー1行を描画する molecules（基本設計書 4.8）。確定メンバーは表示名 + 権限チェックボックス
// （閲覧/投稿/管理）を、招待中メンバー（invited:true）はメールアドレス + 「招待中」バッジ +
// 「招待を取り消す」メニューを表示する。owner 行は変更不可（lock アイコン・checkbox disabled）。
// Atomic Design のルールに従い props のみで完結し、Firestore/Storage へ直接アクセスしない。
// 権限変更は確定メンバーでは onToggle、招待中では onChangePreset へ委譲し、page 層が保存経路を分ける。
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { AlbumMember } from '@/types'

// 権限チェックボックスが操作するフィールド。owner を除く全メンバーで共通。
export type PermissionField = 'canView' | 'canPost' | 'canManage'

export interface MemberRowProps {
  member: AlbumMember
  onToggle: (field: PermissionField) => void
  onCancelInvite: (email: string) => void
  // 招待中メンバーの権限プリセット変更（確定メンバーの onToggle とは経路を分ける）。任意。
  onChangePreset?: (field: PermissionField) => void
}

// 表示ラベルとフィールドの対応。ヘッダー（閲覧/投稿/管理）と一致させる。
const PERMISSION_FIELDS: { field: PermissionField; label: string }[] = [
  { field: 'canView', label: '閲覧' },
  { field: 'canPost', label: '投稿' },
  { field: 'canManage', label: '管理' },
]

export function MemberRow({
  member,
  onToggle,
  onCancelInvite,
  onChangePreset,
}: MemberRowProps) {
  // 招待取り消しは more_vert メニュー内に隠し、誤操作を防ぐ（設計書4.8）。
  const [menuOpen, setMenuOpen] = useState(false)

  const isOwner = member.role === 'owner'
  const isInvited = member.invited === true

  // owner は権限固定のため checkbox を無効化する。変更は onToggle/onChangePreset を経路分岐する。
  const handleChange = (field: PermissionField) => {
    if (isOwner) return
    if (isInvited) onChangePreset?.(field)
    else onToggle(field)
  }

  return (
    <div className="flex flex-col gap-stack-sm py-stack-md md:grid md:grid-cols-12 md:items-center">
      {/* メンバー識別（アバター + 表示名/メール + ロール説明）。col-span-6 */}
      <div className="flex items-center gap-stack-md md:col-span-6">
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-container">
          {member.photoURL ? (
            <img src={member.photoURL} alt="" className="size-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-on-surface-variant" aria-hidden="true">
              person
            </span>
          )}
        </div>
        <div className="flex flex-col gap-stack-sm">
          <div className="flex items-center gap-stack-sm">
            <span className="font-body-lg text-body-lg font-semibold text-on-surface">
              {member.displayName}
            </span>
            {isInvited && (
              <span className="rounded-full bg-tertiary-container px-2 py-0.5 font-caption text-caption text-on-surface">
                招待中
              </span>
            )}
          </div>
          <span className="font-caption text-caption text-on-surface-variant">
            {isOwner
              ? 'オーナー（変更不可）'
              : isInvited
                ? '招待済み・受諾待ち'
                : member.email}
          </span>
        </div>
      </div>

      {/* 権限チェックボックス。モバイルではラベル併記、PC ではヘッダーと揃えて col-span-1 × 3。 */}
      {PERMISSION_FIELDS.map(({ field, label }) => (
        <label
          key={field}
          className="flex items-center gap-stack-sm md:col-span-1 md:justify-center"
        >
          <span className="font-caption text-caption text-on-surface-variant md:hidden">
            {label}
          </span>
          <input
            type="checkbox"
            checked={member[field]}
            disabled={isOwner}
            onChange={() => handleChange(field)}
            aria-label={`${member.displayName} の${label}権限`}
            className="size-5 rounded border-outline text-primary focus:ring-primary disabled:opacity-50"
          />
        </label>
      ))}

      {/* 操作列（col-span-3）: owner は lock、招待中は取り消しメニュー、確定一般メンバーは操作なし。 */}
      <div className="relative flex items-center md:col-span-3 md:justify-end">
        {isOwner && (
          <span className="material-symbols-outlined text-on-surface-variant" aria-hidden="true">
            lock
          </span>
        )}
        {isInvited && (
          <>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={`${member.email} の招待の操作メニュー`}
              className="flex size-8 items-center justify-center rounded-full hover:bg-surface-container"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                more_vert
              </span>
            </button>
            {menuOpen && (
              <div className={cn('absolute right-0 top-full z-10 rounded-lg bg-surface shadow-md')}>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onCancelInvite(member.email)
                  }}
                  className="whitespace-nowrap px-4 py-2 font-body-md text-body-md text-error hover:bg-error-container"
                >
                  招待を取り消す
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
