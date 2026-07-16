import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UploadList } from './UploadList'
import type { UploadItemState } from '@/components/molecules/UploadItem'

// UploadList は UploadItem × N を並べ、全体進捗（完了数/総数）を表示する organism
// （基本設計書 4.7）。props のみで完結し Storage 直アクセスしない。

function makeFile(name: string): File {
  const file = new File(['x'], name, { type: 'image/jpeg' })
  Object.defineProperty(file, 'size', { value: 1024 })
  return file
}

function makeUpload(
  mediaId: string,
  status: UploadItemState['status'],
  overrides: Partial<UploadItemState> = {}
): UploadItemState {
  return {
    file: makeFile(`${mediaId}.jpg`),
    mediaId,
    status,
    progress: status === 'done' ? 100 : 0,
    ...overrides,
  }
}

describe('components/organisms/UploadList', () => {
  it('UL-01: uploads配列の件数だけ UploadItem を描画する', () => {
    render(
      <UploadList
        uploads={[
          makeUpload('a', 'done'),
          makeUpload('b', 'uploading'),
          makeUpload('c', 'waiting'),
        ]}
      />
    )
    expect(screen.getByText('a.jpg')).toBeInTheDocument()
    expect(screen.getByText('b.jpg')).toBeInTheDocument()
    expect(screen.getByText('c.jpg')).toBeInTheDocument()
  })

  it('UL-02: 全体進捗（完了数/総数）を表示する', () => {
    render(
      <UploadList
        uploads={[
          makeUpload('a', 'done'),
          makeUpload('b', 'done'),
          makeUpload('c', 'uploading'),
        ]}
      />
    )
    expect(screen.getByText(/3個中2個完了/)).toBeInTheDocument()
  })

  it('UL-03: error行の再試行で onRetry が該当mediaIdで呼ばれる', async () => {
    const onRetry = vi.fn()
    render(
      <UploadList
        uploads={[
          makeUpload('a', 'done'),
          makeUpload('b', 'error', { errorMessage: 'x' }),
        ]}
        onRetry={onRetry}
      />
    )
    await userEvent.click(screen.getByRole('button'))
    expect(onRetry).toHaveBeenCalledWith('b')
  })

  it('UL-04: uploads0件では進捗行を描画せず破綻しない', () => {
    render(<UploadList uploads={[]} />)
    expect(screen.queryByText(/個完了/)).not.toBeInTheDocument()
  })
})
