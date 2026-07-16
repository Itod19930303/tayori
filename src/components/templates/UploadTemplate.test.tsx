import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UploadTemplate } from './UploadTemplate'
import type { UploadItemState } from '@/components/molecules/UploadItem'

// UploadTemplate はアップロード画面のレイアウト骨格（templates 層、実データ非保持）。
// ヘッダー・ファイル選択UI・UploadList・プライバシー案内バナーを配置する。

function makeFile(name: string): File {
  const file = new File(['x'], name, { type: 'image/jpeg' })
  Object.defineProperty(file, 'size', { value: 1024 })
  return file
}

function makeUpload(mediaId: string): UploadItemState {
  return {
    file: makeFile(`${mediaId}.jpg`),
    mediaId,
    status: 'uploading',
    progress: 10,
  }
}

describe('components/templates/UploadTemplate', () => {
  it('UT-01: ヘッダー「思い出を保存中」とファイル選択UIを表示する', () => {
    render(<UploadTemplate uploads={[]} onSelectFiles={vi.fn()} />)
    expect(screen.getByText('思い出を保存中')).toBeInTheDocument()
    expect(screen.getByLabelText(/ファイルを選択/)).toBeInTheDocument()
  })

  it('UT-02: ファイル選択で onSelectFiles が選択ファイルで呼ばれる', async () => {
    const onSelectFiles = vi.fn()
    render(<UploadTemplate uploads={[]} onSelectFiles={onSelectFiles} />)
    const input = screen.getByLabelText(/ファイルを選択/) as HTMLInputElement
    await userEvent.upload(input, [makeFile('a.jpg'), makeFile('b.jpg')])
    expect(onSelectFiles).toHaveBeenCalledTimes(1)
    const files = onSelectFiles.mock.calls[0][0] as FileList
    expect(files).toHaveLength(2)
  })

  it('UT-03: uploads を UploadList へ透過的に渡す', () => {
    render(
      <UploadTemplate
        uploads={[makeUpload('a'), makeUpload('b'), makeUpload('c')]}
        onSelectFiles={vi.fn()}
      />
    )
    expect(screen.getByText('a.jpg')).toBeInTheDocument()
    expect(screen.getByText('b.jpg')).toBeInTheDocument()
    expect(screen.getByText('c.jpg')).toBeInTheDocument()
  })

  it('UT-04: プライバシー案内バナーを表示する', () => {
    render(<UploadTemplate uploads={[]} onSelectFiles={vi.fn()} />)
    expect(
      screen.getByText(/すべてのアップロードは暗号化され、安全に保存されます。/)
    ).toBeInTheDocument()
  })

  it('UT-05: 背景に bg-background を用いる', () => {
    const { container } = render(
      <UploadTemplate uploads={[]} onSelectFiles={vi.fn()} />
    )
    expect(container.firstChild).toHaveClass('bg-background')
  })

  it('UT-06: fileErrors を渡すとインラインエラーを表示する（page層からのバリデーション結果）', () => {
    render(
      <UploadTemplate
        uploads={[]}
        onSelectFiles={vi.fn()}
        fileErrors={[
          {
            fileName: 'a.pdf',
            message:
              '対応していないファイル形式です（対応: JPG, PNG, WebP, GIF, MP4, MOV）。',
          },
        ]}
      />
    )
    expect(
      screen.getByText(/対応していないファイル形式です/)
    ).toBeInTheDocument()
  })
})
