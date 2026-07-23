// アルバム詳細画面のレイアウト骨格（templates 層、実データ非保持）。
// ヘッダー（アルバム名・メンバー数・更新日時・アップロードボタン）と MediaGrid を配置し、
// 受け取った props を透過的に渡す。データ取得・遷移は page 層の責務とする。
// 共通ナビ（SideNav 等）は本フェーズ対象外（テスト仕様書 §1.5）。
import type { Album, Media } from '@/types'
import { Button } from '@/components/atoms/button'
import { MediaGrid } from '@/components/organisms/MediaGrid'

export interface AlbumDetailTemplateProps {
  album: Album
  mediaItems: Media[]
  loading: boolean
  onUploadClick: () => void
  onSelectMedia?: (media: Media) => void
  // 「権限管理」リンクの表示条件（基本設計書 4.6）。ログインユーザー自身の canManage を
  // page 層が myMember?.canManage として算出して渡す。templates 層は真偽のみで表示を切り替え、
  // album.members の走査・権限判定は行わない（atomic-design.md のデータ非保持制約）。
  canManage: boolean
  // 権限管理リンク押下時のコールバック。実際の遷移は page 層の責務とする。
  onManagePermissionsClick?: () => void
}

// Firestore Timestamp を利用者向けの日付文字列へ整形する。
// モック/本番いずれの Timestamp も toMillis() を持つため、これを基準に Date へ変換する。
function formatUpdatedAt(album: Album): string {
  const millis = album.updatedAt?.toMillis?.() ?? 0
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(millis))
}

export function AlbumDetailTemplate({
  album,
  mediaItems,
  loading,
  onUploadClick,
  onSelectMedia,
  canManage,
  onManagePermissionsClick,
}: AlbumDetailTemplateProps) {
  const memberCount = album.members?.length ?? 0

  return (
    <div className="flex min-h-screen flex-1 flex-col gap-stack-lg bg-background px-margin-mobile py-stack-lg md:px-margin-desktop">
      <header className="flex items-start justify-between gap-stack-md">
        <div className="flex flex-col gap-stack-sm">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            {album.title}
          </h1>
          <p className="font-caption text-caption text-on-surface-variant">
            メンバー{memberCount}人 · 更新 {formatUpdatedAt(album)}
          </p>
        </div>
        <div className="flex items-center gap-stack-md">
          {/* 権限管理リンク: canManage メンバーのみ表示（基本設計書 4.6）。非表示時は遷移導線を持たない。
              歯車アイコン＋テキストラベルで、隣のアップロードボタンと視覚的に区別する。 */}
          {canManage && (
            <button
              type="button"
              onClick={onManagePermissionsClick}
              className="inline-flex h-12 items-center gap-stack-sm rounded-lg px-4 font-label-md text-label-md text-on-surface-variant hover:bg-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                settings
              </span>
              権限管理
            </button>
          )}
          <Button
            type="button"
            onClick={onUploadClick}
            className="h-12 rounded-lg bg-primary px-6 text-on-primary hover:opacity-90"
          >
            アップロード
          </Button>
        </div>
      </header>

      <MediaGrid
        mediaItems={mediaItems}
        loading={loading}
        onSelect={onSelectMedia}
        onAddClick={onUploadClick}
      />
    </div>
  )
}
