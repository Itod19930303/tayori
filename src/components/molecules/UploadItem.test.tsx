import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UploadItem, type UploadItemState } from './UploadItem'

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

  it('UIT-03: done 状態で完了アイコン（check_circle）と保存済み表示', () => {
    render(<UploadItem upload={makeUpload({ status: 'done', progress: 100 })} />)
    expect(screen.getByText('check_circle')).toBeInTheDocument()
    expect(screen.getByText(/保存済み/)).toBeInTheDocument()
  })

  it('UIT-04: error 状態でエラーメッセージ・再試行導線・error背景を表示', () => {
    render(
      <UploadItem
        upload={makeUpload({
          status: 'error',
          errorMessage: 'ネットワークが切断されました。タップして再試行してください。',
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
})
