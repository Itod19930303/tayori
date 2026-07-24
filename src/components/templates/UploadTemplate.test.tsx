import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UploadTemplate } from './UploadTemplate'
import type { UploadItemState } from '@/components/molecules/UploadItem'
import { ERROR_MESSAGES } from '@/lib/messages/errorMessages'
import { SUCCESS_MESSAGES } from '@/lib/messages/successMessages'

// UploadTemplate はアップロード画面のレイアウト骨格（templates 層、実データ非保持）。
// ヘッダー（戻るリンク＋見出し）・ファイル選択UI・UploadList・「保存」ボタン・完了モーダルを配置する。
// v2.5: 暗号化バナーを廃止し、全件 done 時に UploadCompleteModal を表示する。

function makeFile(name: string): File {
  const file = new File(['x'], name, { type: 'image/jpeg' })
  Object.defineProperty(file, 'size', { value: 1024 })
  return file
}

function makeUpload(
  mediaId: string,
  overrides: Partial<UploadItemState> = {}
): UploadItemState {
  return {
    file: makeFile(`${mediaId}.jpg`),
    mediaId,
    status: 'uploading',
    progress: 10,
    ...overrides,
  }
}

// ヘッダー戻るリンク（arrow_back + 「[アルバム名]」に戻る）を取得する。
const getBackLink = () => screen.getByRole('button', { name: /に戻る/ })

describe('components/templates/UploadTemplate', () => {
  it('UT-01: ヘッダー「思い出を保存中」とファイル選択UIを表示する', () => {
    render(
      <UploadTemplate
        uploads={[]}
        onSelectFiles={vi.fn()}
        onSave={vi.fn()}
        canSave={false}
      />
    )
    expect(screen.getByText('思い出を保存中')).toBeInTheDocument()
    expect(screen.getByLabelText(/ファイルを選択/)).toBeInTheDocument()
  })

  it('UT-02: ファイル選択で onSelectFiles が選択ファイルで呼ばれる', async () => {
    const onSelectFiles = vi.fn()
    render(
      <UploadTemplate
        uploads={[]}
        onSelectFiles={onSelectFiles}
        onSave={vi.fn()}
        canSave={false}
      />
    )
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
        onSave={vi.fn()}
        canSave={false}
      />
    )
    expect(screen.getByText('a.jpg')).toBeInTheDocument()
    expect(screen.getByText('b.jpg')).toBeInTheDocument()
    expect(screen.getByText('c.jpg')).toBeInTheDocument()
  })

  it('UT-04: プライバシー案内（暗号化）バナーを表示しない（v2.5廃止）', () => {
    render(
      <UploadTemplate
        uploads={[]}
        onSelectFiles={vi.fn()}
        onSave={vi.fn()}
        canSave={false}
      />
    )
    expect(
      screen.queryByText(/すべてのアップロードは暗号化され、安全に保存されます。/)
    ).not.toBeInTheDocument()
  })

  it('UT-05: 背景に bg-background を用いる', () => {
    const { container } = render(
      <UploadTemplate
        uploads={[]}
        onSelectFiles={vi.fn()}
        onSave={vi.fn()}
        canSave={false}
      />
    )
    expect(container.firstChild).toHaveClass('bg-background')
  })

  it('UT-06: canSave=true のとき「保存」ボタンが活性で押下すると onSave が呼ばれる', async () => {
    const onSave = vi.fn()
    render(
      <UploadTemplate
        uploads={[makeUpload('a', { status: 'pending' })]}
        onSelectFiles={vi.fn()}
        onSave={onSave}
        canSave={true}
      />
    )
    const saveButton = screen.getByRole('button', { name: '保存' })
    expect(saveButton).toBeEnabled()
    await userEvent.click(saveButton)
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('UT-07: canSave=false のとき「保存」ボタンが非活性（disabled）になる', async () => {
    const onSave = vi.fn()
    render(
      <UploadTemplate
        uploads={[]}
        onSelectFiles={vi.fn()}
        onSave={onSave}
        canSave={false}
      />
    )
    const saveButton = screen.getByRole('button', { name: '保存' })
    expect(saveButton).toBeDisabled()
    await userEvent.click(saveButton)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('UT-08: onToggleSelect / onDeleteSelected を UploadList へ透過的に渡す', async () => {
    const onToggleSelect = vi.fn()
    const onDeleteSelected = vi.fn()
    render(
      <UploadTemplate
        uploads={[makeUpload('a', { status: 'pending', selected: true })]}
        onSelectFiles={vi.fn()}
        onSave={vi.fn()}
        canSave={true}
        onToggleSelect={onToggleSelect}
        onDeleteSelected={onDeleteSelected}
      />
    )
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onToggleSelect).toHaveBeenCalledWith('a')
    await userEvent.click(
      screen.getByRole('button', { name: /選択項目を削除/ })
    )
    expect(onDeleteSelected).toHaveBeenCalledTimes(1)
  })

  it('UT-09: ヘッダー戻るリンク「「[アルバム名]」に戻る」を常時表示する（uploads空の初期表示時も）', () => {
    render(
      <UploadTemplate
        uploads={[]}
        onSelectFiles={vi.fn()}
        onSave={vi.fn()}
        canSave={false}
        albumName="家族旅行"
        onBack={vi.fn()}
      />
    )
    const back = getBackLink()
    expect(back).toHaveTextContent('「家族旅行」に戻る')
    expect(back).toHaveTextContent('arrow_back')
  })

  it('UT-10: uploads が空のときヘッダー戻るリンクは活性で押下すると onBack が呼ばれる', async () => {
    const onBack = vi.fn()
    render(
      <UploadTemplate
        uploads={[]}
        onSelectFiles={vi.fn()}
        onSave={vi.fn()}
        canSave={false}
        albumName="家族旅行"
        onBack={onBack}
      />
    )
    const back = getBackLink()
    expect(back).toHaveAttribute('aria-disabled', 'false')
    await userEvent.click(back)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it.each([['uploading'], ['waiting'], ['retrying']] as const)(
    'UT-11: %s が1件残る状態でヘッダー戻るリンクが非活性になる',
    async (status) => {
      const onBack = vi.fn()
      render(
        <UploadTemplate
          uploads={[makeUpload('a', { status })]}
          onSelectFiles={vi.fn()}
          onSave={vi.fn()}
          canSave={false}
          albumName="家族旅行"
          onBack={onBack}
        />
      )
      const back = getBackLink()
      expect(back).toHaveAttribute('aria-disabled', 'true')
      await userEvent.click(back)
      expect(onBack).not.toHaveBeenCalled()
    }
  )

  it.each([['pending'], ['error']] as const)(
    'UT-12: 全件 %s のみのときヘッダー戻るリンクは活性のまま',
    async (status) => {
      const onBack = vi.fn()
      render(
        <UploadTemplate
          uploads={[makeUpload('a', { status, errorMessage: 'x' })]}
          onSelectFiles={vi.fn()}
          onSave={vi.fn()}
          canSave={status === 'pending'}
          albumName="家族旅行"
          onBack={onBack}
        />
      )
      const back = getBackLink()
      expect(back).toHaveAttribute('aria-disabled', 'false')
      await userEvent.click(back)
      expect(onBack).toHaveBeenCalledTimes(1)
    }
  )

  it('UT-13: 全件 done（完了モーダル表示時）はヘッダー戻るリンクが活性に戻る', async () => {
    const onBack = vi.fn()
    render(
      <UploadTemplate
        uploads={[makeUpload('a', { status: 'done', progress: 100 })]}
        onSelectFiles={vi.fn()}
        onSave={vi.fn()}
        canSave={false}
        albumName="家族旅行"
        onBack={onBack}
      />
    )
    const back = getBackLink()
    expect(back).toHaveAttribute('aria-disabled', 'false')
    await userEvent.click(back)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('UT-14: onBack 未指定でヘッダー戻るリンクをクリックしてもエラーにならない', async () => {
    render(
      <UploadTemplate
        uploads={[]}
        onSelectFiles={vi.fn()}
        onSave={vi.fn()}
        canSave={false}
        albumName="家族旅行"
      />
    )
    await userEvent.click(getBackLink())
    expect(getBackLink()).toBeInTheDocument()
  })

  it('UT-15: 全件 done のとき完了モーダルを表示し MEDIA_SAVED(count) を出す', () => {
    render(
      <UploadTemplate
        uploads={[
          makeUpload('a', { status: 'done', progress: 100 }),
          makeUpload('b', { status: 'done', progress: 100 }),
        ]}
        onSelectFiles={vi.fn()}
        onSave={vi.fn()}
        canSave={false}
        onResetUploads={vi.fn()}
        onBack={vi.fn()}
      />
    )
    expect(
      screen.getByText(SUCCESS_MESSAGES.MEDIA_SAVED(2))
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '続けてアップロードする' })
    ).toBeInTheDocument()
  })

  it('UT-16: 完了モーダル化・暗号化バナー廃止後も保存活性・進捗行・戻るリンクが退行しない', () => {
    render(
      <UploadTemplate
        uploads={[makeUpload('a', { status: 'pending' }), makeUpload('b')]}
        onSelectFiles={vi.fn()}
        onSave={vi.fn()}
        canSave={true}
        albumName="家族旅行"
        onBack={vi.fn()}
      />
    )
    // 保存活性・進捗行・戻るリンクが揃う
    expect(screen.getByRole('button', { name: '保存' })).toBeEnabled()
    expect(screen.getByText('a.jpg')).toBeInTheDocument()
    expect(getBackLink()).toBeInTheDocument()
    // pending 混在では allDone=false のため完了モーダルは出ない
    expect(
      screen.queryByRole('button', { name: '続けてアップロードする' })
    ).not.toBeInTheDocument()
  })

  it('UT-17: 全件 done ではない（uploading 含む）とき完了モーダルを表示しない', () => {
    render(
      <UploadTemplate
        uploads={[
          makeUpload('a', { status: 'done', progress: 100 }),
          makeUpload('b', { status: 'uploading' }),
        ]}
        onSelectFiles={vi.fn()}
        onSave={vi.fn()}
        canSave={false}
        onResetUploads={vi.fn()}
        onBack={vi.fn()}
      />
    )
    expect(
      screen.queryByRole('button', { name: '続けてアップロードする' })
    ).not.toBeInTheDocument()
  })

  it('UT-18: 完了モーダル「続けてアップロードする」を onResetUploads に接続する', async () => {
    const onResetUploads = vi.fn()
    render(
      <UploadTemplate
        uploads={[makeUpload('a', { status: 'done', progress: 100 })]}
        onSelectFiles={vi.fn()}
        onSave={vi.fn()}
        canSave={false}
        onResetUploads={onResetUploads}
        onBack={vi.fn()}
      />
    )
    await userEvent.click(
      screen.getByRole('button', { name: '続けてアップロードする' })
    )
    expect(onResetUploads).toHaveBeenCalledTimes(1)
  })

  it('UT-19: 完了モーダル「戻る」を onBack に接続する（ヘッダーと同一 onBack 共有）', async () => {
    const onBack = vi.fn()
    render(
      <UploadTemplate
        uploads={[makeUpload('a', { status: 'done', progress: 100 })]}
        onSelectFiles={vi.fn()}
        onSave={vi.fn()}
        canSave={false}
        onResetUploads={vi.fn()}
        onBack={onBack}
      />
    )
    // 完了モーダル内「戻る」ボタン（ヘッダー戻るリンクとは別要素）をクリックする
    const backButtons = screen.getAllByRole('button', { name: '戻る' })
    await userEvent.click(backButtons[backButtons.length - 1])
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('UT-20: fileErrors を渡すとインラインエラーを表示する（page層からのバリデーション結果）', () => {
    render(
      <UploadTemplate
        uploads={[]}
        onSelectFiles={vi.fn()}
        onSave={vi.fn()}
        canSave={false}
        fileErrors={[
          {
            fileName: 'a.pdf',
            message: ERROR_MESSAGES.UNSUPPORTED_FILE_TYPE,
          },
        ]}
      />
    )
    expect(
      screen.getByText(/対応していないファイル形式です/)
    ).toBeInTheDocument()
  })

  it('UT-21: albumName を UploadList/UploadItem へ透過し done 行に「保存済み · アルバム名」を表示する', () => {
    render(
      <UploadTemplate
        uploads={[makeUpload('a', { status: 'done', progress: 100 })]}
        onSelectFiles={vi.fn()}
        onSave={vi.fn()}
        canSave={false}
        albumName="湖畔で過ごした夏休み"
        onResetUploads={vi.fn()}
        onBack={vi.fn()}
      />
    )
    expect(
      screen.getByText('保存済み · 湖畔で過ごした夏休み')
    ).toBeInTheDocument()
  })

  it('UT-22: ファイル未選択（空の change）では onSelectFiles を呼ばない（未選択分岐）', () => {
    const onSelectFiles = vi.fn()
    render(
      <UploadTemplate
        uploads={[]}
        onSelectFiles={onSelectFiles}
        onSave={vi.fn()}
        canSave={false}
      />
    )
    const input = screen.getByLabelText(/ファイルを選択/) as HTMLInputElement
    fireEvent.change(input, { target: { files: [] } })
    expect(onSelectFiles).not.toHaveBeenCalled()
  })
})
