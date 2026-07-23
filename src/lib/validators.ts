// アルバム作成フォームの入力値バリデーション（基本設計書 4.5）。
// フォーム（molecule）とページ（page 層）の双方から同一ルールで検証できるよう、
// Firebase 非依存の純粋関数としてここに集約する。戻り値は「問題なければ null /
// エラーがあれば利用者向けの日本語メッセージ」で統一し、呼び出し側は非null判定で扱える。
// 文字数はサニタイズ方針（基本設計書 7.5）に合わせ trim 後の長さで判定する。
// 表示文言は ERROR_MESSAGES へ集約し（メッセージ定数設計書）、検証ロジックのみ本ファイルに残す。
import { ERROR_MESSAGES } from './messages/errorMessages'

const TITLE_MAX = 50
const DESCRIPTION_MAX = 200

/**
 * アルバム名を検証する: 必須・trim 後 1〜50 文字。
 * 空（空白のみ含む）は必須エラー、超過は上限エラーを返す。
 * @param title 検証対象のアルバム名（未trim）
 * @returns 問題なければ null、あればエラーメッセージ
 */
export function validateAlbumTitle(title: string): string | null {
  const trimmed = (title ?? '').trim()
  if (trimmed.length === 0) {
    return ERROR_MESSAGES.TITLE_REQUIRED
  }
  if (trimmed.length > TITLE_MAX) {
    return ERROR_MESSAGES.TITLE_MAX_LENGTH(TITLE_MAX)
  }
  return null
}

/**
 * アルバム説明文を検証する: 任意・trim 後 0〜200 文字。
 * 未入力は許容し、超過のみ上限エラーとする。
 * @param description 検証対象の説明文（未trim）
 * @returns 問題なければ null、あればエラーメッセージ
 */
export function validateAlbumDescription(description: string): string | null {
  const trimmed = (description ?? '').trim()
  if (trimmed.length > DESCRIPTION_MAX) {
    return ERROR_MESSAGES.DESCRIPTION_MAX_LENGTH(DESCRIPTION_MAX)
  }
  return null
}

// アップロード対象メディアの形式・サイズ検証（基本設計書 4.7 / 8.1 #4・#5）。
// アップロード画面（page 層）とファイル選択処理から同一ルールで検証できるよう、
// Firebase 非依存の純粋関数としてここに集約する。上限は Firebase 無料枠を考慮し
// 画像50MB・動画500MB（基本設計書 1.4）とし、判定は type.startsWith('video/') で
// 画像/動画の上限を切り替える。境界値（上限ちょうど）は有効側に含める（file.size > limit）。
const ALLOWED_MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
]
const MAX_IMAGE_SIZE = 50 * 1024 * 1024 // 50MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024 // 500MB

/**
 * アップロード対象メディアの形式・サイズを検証する（基本設計書 4.7 / 8.1 #4・#5）。
 * 画像/動画で上限を切り替え、境界値（上限ちょうど）は有効側に含める。
 * @param file 検証対象のファイル
 * @returns 問題なければ null、あればエラーメッセージ
 */
export function validateMediaFile(file: File): string | null {
  if (!ALLOWED_MEDIA_TYPES.includes(file.type)) {
    return ERROR_MESSAGES.UNSUPPORTED_FILE_TYPE
  }
  const limit = file.type.startsWith('video/') ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
  if (file.size > limit) {
    return ERROR_MESSAGES.FILE_SIZE_EXCEEDED
  }
  return null
}
