import { describe, it, expect } from 'vitest'
import {
  validateAlbumTitle,
  validateAlbumDescription,
  validateMediaFile,
} from './validators'
import { ERROR_MESSAGES } from './messages/errorMessages'

// メディアファイルバリデーション（validateMediaFile）テストで用いる File スタブ生成ヘルパー
// （テスト仕様書 4.10）。実バイト列を確保せず size のみ上書きし、大容量ファイルを
// メモリ消費なく境界値として表現する。
function makeFile(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

// validators.ts は Firebase 非依存の純粋関数。アルバム作成フォームの入力ルール
// （title: 必須・1〜50文字 / description: 任意・0〜200文字、基本設計書 4.5）を検証する。
// 戻り値は「問題なければ null / エラー時は日本語メッセージ」で統一する。
//
// カバレッジ注記: 各関数冒頭の `(title ?? '').trim()` 等の `??` フォールバックは
// 意図的に未テスト。呼び出し元（AlbumCreateForm/page.tsx）は useState('') で初期化した
// string型のみを渡すため null/undefined は実際には来ないが、この関数はexportされた
// 独立ユーティリティとして型上は呼び出し元を限定できないため防御している。
// null/undefinedを明示的に渡すテストは型定義（string引数）と矛盾する入力の確認に
// なるだけで実バグ検出に繋がらないためスキップしている（レビュー2026-07-14で許容判断）。

describe('lib/validators - validateAlbumTitle', () => {
  it('VA-01: 標準的なタイトルは有効（null）', () => {
    expect(validateAlbumTitle('湖畔で過ごした夏休み')).toBeNull()
  })

  it('VA-02: 下限1文字は有効', () => {
    expect(validateAlbumTitle('A')).toBeNull()
  })

  it('VA-03: 上限50文字ちょうどは有効', () => {
    expect(validateAlbumTitle('あ'.repeat(50))).toBeNull()
  })

  it('VA-04: 51文字は上限超過エラー', () => {
    const result = validateAlbumTitle('あ'.repeat(51))
    expect(result).not.toBeNull()
    expect(result).toContain('50')
  })

  it('VA-05: 空文字は必須エラー', () => {
    const result = validateAlbumTitle('')
    expect(result).not.toBeNull()
    expect(result).toBe(ERROR_MESSAGES.TITLE_REQUIRED)
  })

  it('VA-06: 空白のみ（trim後0文字）は必須エラー', () => {
    const result = validateAlbumTitle('   ')
    expect(result).not.toBeNull()
    expect(result).toBe(ERROR_MESSAGES.TITLE_REQUIRED)
  })

  it('VA-07: 前後空白を含む文字列はtrim後の長さで判定され有効', () => {
    expect(validateAlbumTitle('  夏  ')).toBeNull()
  })
})

describe('lib/validators - validateAlbumDescription', () => {
  it('VA-08: 標準的な説明は有効（null）', () => {
    expect(validateAlbumDescription('家族旅行の記録')).toBeNull()
  })

  it('VA-09: 0文字（未入力）は任意項目のため有効', () => {
    expect(validateAlbumDescription('')).toBeNull()
  })

  it('VA-10: 上限200文字ちょうどは有効', () => {
    expect(validateAlbumDescription('あ'.repeat(200))).toBeNull()
  })

  it('VA-11: 201文字は上限超過エラー', () => {
    const result = validateAlbumDescription('あ'.repeat(201))
    expect(result).not.toBeNull()
    expect(result).toContain('200')
  })
})

// validateMediaFile はアップロード対象ファイルの形式・サイズを検証する純粋関数
// （基本設計書 4.7 / 8.1 #4・#5）。対応形式（JPG/PNG/WebP/GIF/MP4/MOV）と
// 上限（画像50MB・動画500MB）を境界値含めて検証する。
const TYPE_ERROR = ERROR_MESSAGES.UNSUPPORTED_FILE_TYPE
const SIZE_ERROR = ERROR_MESSAGES.FILE_SIZE_EXCEEDED
const MB = 1024 * 1024

describe('lib/validators - validateMediaFile', () => {
  it('VMF-01: 対応画像（JPEG）は有効', () => {
    expect(validateMediaFile(makeFile('a.jpg', 'image/jpeg', 1024))).toBeNull()
  })

  it('VMF-02: 対応動画（MP4）は有効', () => {
    expect(validateMediaFile(makeFile('a.mp4', 'video/mp4', 1024))).toBeNull()
  })

  it('VMF-03: PNG/WebP/GIF/MOV も対応形式として有効', () => {
    expect(validateMediaFile(makeFile('a.png', 'image/png', 1024))).toBeNull()
    expect(validateMediaFile(makeFile('a.webp', 'image/webp', 1024))).toBeNull()
    expect(validateMediaFile(makeFile('a.gif', 'image/gif', 1024))).toBeNull()
    expect(
      validateMediaFile(makeFile('a.mov', 'video/quicktime', 1024))
    ).toBeNull()
  })

  it('VMF-04: 非対応形式（PDF）はエラー', () => {
    expect(validateMediaFile(makeFile('a.pdf', 'application/pdf', 1024))).toBe(
      TYPE_ERROR
    )
  })

  it('VMF-05: 画像50MBちょうどは有効（境界を有効側に含む）', () => {
    expect(validateMediaFile(makeFile('a.jpg', 'image/jpeg', 50 * MB))).toBeNull()
  })

  it('VMF-06: 画像50MB+1バイトは超過エラー', () => {
    expect(
      validateMediaFile(makeFile('a.jpg', 'image/jpeg', 50 * MB + 1))
    ).toBe(SIZE_ERROR)
  })

  it('VMF-07: 動画500MBちょうどは有効', () => {
    expect(validateMediaFile(makeFile('a.mp4', 'video/mp4', 500 * MB))).toBeNull()
  })

  it('VMF-08: 動画500MB+1バイトは超過エラー', () => {
    expect(validateMediaFile(makeFile('a.mp4', 'video/mp4', 500 * MB + 1))).toBe(
      SIZE_ERROR
    )
  })

  it('VMF-09: 画像上限（50MB）と動画上限（500MB）が形式で切り替わる', () => {
    // 画像で100MBは、動画上限500MBではなく画像上限50MBが適用され超過エラーになる
    expect(validateMediaFile(makeFile('a.jpg', 'image/jpeg', 100 * MB))).toBe(
      SIZE_ERROR
    )
  })

  it('VMF-10: 空ファイル（0バイト）は形式が正しければ有効', () => {
    expect(validateMediaFile(makeFile('a.png', 'image/png', 0))).toBeNull()
  })
})
