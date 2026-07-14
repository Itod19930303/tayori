// アルバム作成フォームの入力値バリデーション（基本設計書 4.5）。
// フォーム（molecule）とページ（page 層）の双方から同一ルールで検証できるよう、
// Firebase 非依存の純粋関数としてここに集約する。戻り値は「問題なければ null /
// エラーがあれば利用者向けの日本語メッセージ」で統一し、呼び出し側は非null判定で扱える。
// 文字数はサニタイズ方針（基本設計書 7.5）に合わせ trim 後の長さで判定する。

const TITLE_MAX = 50
const DESCRIPTION_MAX = 200

// アルバム名: 必須・trim 後 1〜50 文字。空（空白のみ含む）は必須エラー、超過は上限エラー。
export function validateAlbumTitle(title: string): string | null {
  const trimmed = (title ?? '').trim()
  if (trimmed.length === 0) {
    return 'アルバム名を入力してください'
  }
  if (trimmed.length > TITLE_MAX) {
    return `アルバム名は${TITLE_MAX}文字以内で入力してください`
  }
  return null
}

// 説明: 任意・trim 後 0〜200 文字。未入力は許容し、超過のみ上限エラーとする。
export function validateAlbumDescription(description: string): string | null {
  const trimmed = (description ?? '').trim()
  if (trimmed.length > DESCRIPTION_MAX) {
    return `説明は${DESCRIPTION_MAX}文字以内で入力してください`
  }
  return null
}
