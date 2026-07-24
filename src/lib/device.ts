// src/lib/device.ts
// 何を: 実行中の端末がモバイルかどうかをUA文字列から判定する。
// なぜ: モバイルでは signInWithPopup が失敗しやすいため signInWithRedirect へ
//       切り替える必要があり、その分岐条件（端末判定）をここに集約して
//       auth.ts・画面がUAの詳細に依存しないようにする（基本設計書 6.1.1）。

/**
 * 実行端末がモバイル（Android / iPhone / iPad / iPod）かどうかを返す。
 *
 * 判定に失敗する状況（SSRで navigator 未定義・UA取得不可）は false（PC扱い）を
 * 返し、呼び出し元は安全側のポップアップへフォールバックする。
 * @param userAgent 判定対象のUA文字列。省略時は navigator.userAgent を参照。
 * @returns モバイルなら true、それ以外・判定不能なら false
 */
export function isMobileDevice(userAgent?: string): boolean {
  // 明示引数が無い場合のみ navigator を参照する。SSR等で未定義なら PC 扱い。
  const ua =
    userAgent ??
    (typeof navigator !== 'undefined' ? navigator.userAgent : undefined)
  if (!ua) return false
  return /Android|iPhone|iPad|iPod/.test(ua)
}
