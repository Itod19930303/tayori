// メディアのプレビュー用URLを解決する単一の分岐点（基本設計書 4.9 / 5.3）。
// CLAUDE.md の「provider フィールドを必ず持たせ、将来の Cloudinary/Mux 移行時に画面側の影響を
// 最小化する」方針に従い、URL生成ロジックをここへ集約する。プレビュー画面（MediaPreviewPage）は
// media.downloadUrl を直接参照せず本関数を経由することで、provider 追加時の変更点を1箇所に閉じ込める。
import type { Media } from '@/types'

// provider ごとにプレビュー表示に用いるURLを返す。MVP では全 provider が Firebase Storage の
// downloadUrl をそのまま用いるが、将来 Cloudinary の変換URL・Mux の再生URLへ差し替える拡張点を
// switch として明示しておく（分岐の器を先に用意し、移行時に画面側を触らない設計）。
export function getPreviewUrl(media: Media): string {
  switch (media.provider) {
    case 'firebase':
      return media.downloadUrl
    case 'cloudinary':
      // 将来実装: Cloudinary URL変換。現時点は元URLを返す。
      return media.downloadUrl
    case 'mux':
      // 将来実装: Mux playback URL生成。現時点は元URLを返す。
      return media.downloadUrl
    default:
      // 想定外 provider でも画面を壊さないよう downloadUrl へフォールバックする。
      return media.downloadUrl
  }
}
