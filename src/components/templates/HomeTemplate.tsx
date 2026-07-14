// ホーム画面のレイアウト骨格（templates 層、実データ非保持）。
// 簡易ページヘッダー（見出し「アルバム」+「新しいアルバム」ボタン）と AlbumGrid を配置し、
// 受け取った props をそのまま AlbumGrid へ渡す。データ取得・遷移は page 層の責務とする。
// 共通ナビ（SideNav 等）は本フェーズ対象外（テスト仕様書 §1.4）。
import type { Album } from '@/types'
import { Button } from '@/components/atoms/button'
import { AlbumGrid } from '@/components/organisms/AlbumGrid'

export interface HomeTemplateProps {
  albums: Album[]
  loading: boolean
  onCreateClick: () => void
}

export function HomeTemplate({ albums, loading, onCreateClick }: HomeTemplateProps) {
  // 0件確定時（loading完了かつalbums空）はヘッダーの作成ボタンを隠す。
  // 空状態内に同じ導線のボタンがあるため、両方出すと重複になる。
  // loading中は件数未確定のため、確定後に急にボタンが現れるちらつきを避けて表示しておく。
  const showHeaderCreateButton = loading || albums.length > 0

  return (
    <div className="flex min-h-screen flex-1 flex-col gap-stack-lg bg-background px-margin-mobile py-stack-lg md:px-margin-desktop">
      <header className="flex items-center justify-between">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">
          アルバム
        </h1>
        {showHeaderCreateButton && (
          <Button
            type="button"
            onClick={onCreateClick}
            className="h-12 rounded-lg bg-primary px-6 text-on-primary hover:opacity-90"
          >
            + 新しいアルバム
          </Button>
        )}
      </header>

      <AlbumGrid albums={albums} loading={loading} onCreateClick={onCreateClick} />
    </div>
  )
}
