import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UploadItem, type UploadItemState } from './UploadItem'
import { ERROR_MESSAGES } from '@/lib/messages/errorMessages'

// UploadItem はアップロード進捗行の molecule（基本設計書 4.7）。
// waiting/uploading/done/error/retrying の5状態のUI切り替えと、error行クリックでの
// 再試行導線を検証する。props のみで完結する。

function makeFile(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function makeUpload(overrides: Partial<UploadItemState> = {}): UploadItemState {
  return {
    file: makeFile('photo.jpg', 'image/jpeg', 4.2 * 1024 * 1024),
    mediaId: 'item-1',
    status: 'waiting',
    progress: 0,
    ...overrides,
  }
}

describe('components/molecules/UploadItem', () => {
  it('UIT-01: waiting 状態でファイル名・サイズを表示する', () => {
    render(<UploadItem upload={makeUpload({ status: 'waiting' })} />)
    expect(screen.getByText('photo.jpg')).toBeInTheDocument()
    // ファイルサイズ（MB表記）が表示される
    expect(screen.getByText(/MB/)).toBeInTheDocument()
  })

  it('UIT-02: uploading 状態で進捗％を表示する', () => {
    render(<UploadItem upload={makeUpload({ status: 'uploading', progress: 42 })} />)
    expect(screen.getByText(/42%/)).toBeInTheDocument()
    expect(screen.getByText('photo.jpg')).toBeInTheDocument()
  })

  it('UIT-03: done 状態で完了アイコン（check_circle）と「保存済み · アルバム名」・成功トーン背景を表示', () => {
    const { container } = render(
      <UploadItem
        upload={makeUpload({ status: 'done', progress: 100 })}
        albumName="湖畔で過ごした夏休み"
      />
    )
    expect(screen.getByText('check_circle')).toBeInTheDocument()
    // キャプションはアルバム名を含めて完全一致で検証（設計書4.7「保存済み · [アルバム名]」）
    expect(
      screen.getByText('保存済み · 湖畔で過ごした夏休み')
    ).toBeInTheDocument()
    // 成功フィードバック改善: 行背景に成功トーン bg-primary-fixed を用いる（設計書4.7）
    expect(container.firstChild).toHaveClass('bg-primary-fixed')
  })

  it('UIT-03b: albumName 未指定の done 行はアルバム名なしで「保存済み」のみ表示する', () => {
    render(<UploadItem upload={makeUpload({ status: 'done', progress: 100 })} />)
    expect(screen.getByText('保存済み')).toBeInTheDocument()
  })

  it('UIT-04: error 状態でエラーメッセージ・再試行導線・error背景を表示', () => {
    render(
      <UploadItem
        upload={makeUpload({
          status: 'error',
          errorMessage: ERROR_MESSAGES.UPLOAD_NETWORK_FAILED,
        })}
      />
    )
    expect(screen.getByText('warning')).toBeInTheDocument()
    expect(
      screen.getByText(/ネットワークが切断されました/)
    ).toBeInTheDocument()
    expect(screen.getByText(/タップして再試行/)).toBeInTheDocument()
    const row = screen.getByRole('button')
    expect(row.className).toContain('bg-error-container')
  })

  it('UIT-05: error 状態の行クリックで onRetry(mediaId) が呼ばれる', async () => {
    const onRetry = vi.fn()
    render(
      <UploadItem
        upload={makeUpload({ status: 'error', errorMessage: 'x' })}
        onRetry={onRetry}
      />
    )
    await userEvent.click(screen.getByRole('button'))
    expect(onRetry).toHaveBeenCalledWith('item-1')
  })

  it('UIT-06: retrying 状態は uploading と同じ進捗UIを表示する', () => {
    render(<UploadItem upload={makeUpload({ status: 'retrying', progress: 10 })} />)
    expect(screen.getByText(/10%/)).toBeInTheDocument()
  })

  it('UIT-07: done/waiting 状態ではクリックしても onRetry を呼ばない', async () => {
    const onRetry = vi.fn()
    render(
      <UploadItem upload={makeUpload({ status: 'done', progress: 100 })} onRetry={onRetry} />
    )
    // done 状態は button ロールを持たない（クリック対象にならない）
    await userEvent.click(screen.getByText('photo.jpg'))
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('UIT-08: progress の0%・100%が破綻なく表示される', () => {
    const { rerender } = render(
      <UploadItem upload={makeUpload({ status: 'uploading', progress: 0 })} />
    )
    expect(screen.getByText(/0%/)).toBeInTheDocument()
    rerender(<UploadItem upload={makeUpload({ status: 'uploading', progress: 100 })} />)
    expect(screen.getByText(/100%/)).toBeInTheDocument()
  })

  it('UIT-09: pending 状態でチェックボックスとファイル名・サイズを表示する', () => {
    render(
      <UploadItem
        upload={makeUpload({ status: 'pending', progress: 0, selected: false })}
      />
    )
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
    expect(screen.getByText('photo.jpg')).toBeInTheDocument()
    expect(screen.getByText(/MB/)).toBeInTheDocument()
    // 進捗％・完了・エラー表示は出ない
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
    expect(screen.queryByText(/保存済み/)).not.toBeInTheDocument()
  })

  it('UIT-10: pending の画像ファイルはサムネイル <img>（previewUrl）を表示する', () => {
    render(
      <UploadItem
        upload={makeUpload({
          status: 'pending',
          file: makeFile('photo.jpg', 'image/jpeg', 1024),
          previewUrl: 'blob:preview-image',
        })}
      />
    )
    const img = screen.getByRole('img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('blob:preview-image')
  })

  it('UIT-11: pending の動画ファイルは再生アイコン付きサムネイルを表示する', () => {
    render(
      <UploadItem
        upload={makeUpload({
          status: 'pending',
          file: makeFile('clip.mp4', 'video/mp4', 1024),
          previewUrl: 'blob:preview-video',
        })}
      />
    )
    expect(screen.getByText('play_circle')).toBeInTheDocument()
  })

  it('UIT-12: pending 行のチェックボックス操作で onToggleSelect(mediaId) が呼ばれる', async () => {
    const onToggleSelect = vi.fn()
    render(
      <UploadItem
        upload={makeUpload({ status: 'pending', selected: false })}
        onToggleSelect={onToggleSelect}
      />
    )
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onToggleSelect).toHaveBeenCalledWith('item-1')
  })

  it('UIT-13: selected=true の pending 行はチェック済み表示になる', () => {
    render(
      <UploadItem upload={makeUpload({ status: 'pending', selected: true })} />
    )
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('UIT-15: 1KB未満のファイルはバイト単位（B）でサイズ表示する（formatSize 分岐）', () => {
    render(
      <UploadItem
        upload={makeUpload({
          status: 'waiting',
          file: makeFile('tiny.jpg', 'image/jpeg', 512),
        })}
      />
    )
    expect(screen.getByText('512B')).toBeInTheDocument()
  })

  it('UIT-16: 1KB以上1MB未満のファイルはKB単位でサイズ表示する（formatSize 分岐）', () => {
    render(
      <UploadItem
        upload={makeUpload({
          status: 'waiting',
          file: makeFile('mid.jpg', 'image/jpeg', 2048),
        })}
      />
    )
    expect(screen.getByText('2.0KB')).toBeInTheDocument()
  })

  it('UIT-14: pending 以外の状態ではチェックボックスを表示しない（保存後は削除UI不可）', () => {
    const { rerender } = render(
      <UploadItem upload={makeUpload({ status: 'uploading', progress: 10 })} />
    )
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    rerender(<UploadItem upload={makeUpload({ status: 'done', progress: 100 })} />)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    rerender(
      <UploadItem upload={makeUpload({ status: 'error', errorMessage: 'x' })} />
    )
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
