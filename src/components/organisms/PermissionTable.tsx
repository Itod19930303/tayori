// メンバー行（MemberRow）を並べる organisms（基本設計書 4.8）。テーブルヘッダー（PCのみ）と
// 各メンバー行を描画し、確定メンバー・招待中メンバーを区別なく1つのリストとして表示する。
// Atomic Design のルールに従い props のみで完結し、Firestore/Storage へ直接アクセスしない。
// メンバー単位のハンドラ（どのメンバーの権限を変えたか）をこの層で束ね、page 層へ委譲する。
import {
  MemberRow,
  type PermissionField,
} from '@/components/molecules/MemberRow'
import type { AlbumMember } from '@/types'

export interface PermissionTableProps {
  members: AlbumMember[]
  onToggle: (member: AlbumMember, field: PermissionField) => void
  onChangePreset: (member: AlbumMember, field: PermissionField) => void
  onCancelInvite: (email: string) => void
}

export function PermissionTable({
  members,
  onToggle,
  onChangePreset,
  onCancelInvite,
}: PermissionTableProps) {
  return (
    <div className="flex flex-col">
      {/* テーブルヘッダー（PC のみ）。MemberRow の col-span 配置と揃える（設計書4.8）。 */}
      <div className="hidden grid-cols-12 gap-stack-md pb-stack-sm font-label-md text-label-md text-on-surface-variant md:grid">
        <span className="col-span-6">家族メンバー</span>
        <span className="col-span-1 text-center">閲覧</span>
        <span className="col-span-1 text-center">投稿</span>
        <span className="col-span-1 text-center">管理</span>
        <span className="col-span-3 text-right">操作</span>
      </div>

      <div className="divide-y divide-surface-variant">
        {members.map((member) => (
          <MemberRow
            // 招待中メンバーは uid が空のため email をキーに用いる。
            key={member.uid || member.email}
            member={member}
            onToggle={(field) => onToggle(member, field)}
            onChangePreset={(field) => onChangePreset(member, field)}
            onCancelInvite={onCancelInvite}
          />
        ))}
      </div>
    </div>
  )
}
