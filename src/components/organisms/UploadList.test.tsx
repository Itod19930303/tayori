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

  it('UL-06: 選択中の pending 行があると選択件数と「選択項目を削除」を表示する', () => {
    render(
      <UploadList
        uploads={[
          makeUpload('a', 'pending', { selected: true }),
          makeUpload('b', 'pending', { selected: true }),
          makeUpload('c', 'pending', { selected: false }),
        ]}
      />
    )
    expect(screen.getByText(/2件を選択中/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /選択項目を削除/ })
    ).toBeInTheDocument()
  })

  it('UL-07: 選択0件のとき選択操作バー・削除ボタンを表示しない', () => {
    render(
      <UploadList
        uploads={[
          makeUpload('a', 'pending', { selected: false }),
          makeUpload('b', 'pending', { selected: false }),
        ]}
      />
    )
    expect(screen.queryByText(/選択中/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /選択項目を削除/ })
    ).not.toBeInTheDocument()
  })

  it('UL-08: 「選択項目を削除」押下で onDeleteSelected が呼ばれる', async () => {
    const onDeleteSelected = vi.fn()
    render(
      <UploadList
        uploads={[makeUpload('a', 'pending', { selected: true })]}
        onDeleteSelected={onDeleteSelected}
      />
    )
    await userEvent.click(
      screen.getByRole('button', { name: /選択項目を削除/ })
    )
    expect(onDeleteSelected).toHaveBeenCalledTimes(1)
  })

  it('UL-09: pending 行のチェックボックス操作で onToggleSelect が該当mediaIdで呼ばれる', async () => {
    const onToggleSelect = vi.fn()
    render(
      <UploadList
        uploads={[makeUpload('a', 'pending', { selected: false })]}
        onToggleSelect={onToggleSelect}
      />
    )
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onToggleSelect).toHaveBeenCalledWith('a')
  })

  it('UL-14: albumName を UploadItem へ透過し done 行に「保存済み · アルバム名」を表示する', () => {
    render(
      <UploadList
        uploads={[makeUpload('a', 'done')]}
        albumName="湖畔で過ごした夏休み"
      />
    )
    expect(
      screen.getByText('保存済み · 湖畔で過ごした夏休み')
    ).toBeInTheDocument()
  })

  it('UL-11: 全件 done でも完了バナー・「アルバムに戻る」導線を描画しない（v2.5で完了モーダルへ移設）', () => {
    render(
      <UploadList uploads={[makeUpload('a', 'done'), makeUpload('b', 'done')]} />
    )
    // 完了バナー文言（MEDIA_SAVED）と「アルバムに戻る」導線が UploadList 内に無い
    expect(screen.queryByText(/思い出を保存しました/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /に戻る/ })
    ).not.toBeInTheDocument()
  })

  it('UL-12: 全件 done のとき全体進捗「N個中N個完了」を表示しない', () => {
    render(
      <UploadList
        uploads={[
          makeUpload('a', 'done'),
          makeUpload('b', 'done'),
          makeUpload('c', 'done'),
        ]}
      />
    )
    expect(screen.queryByText(/個完了/)).not.toBeInTheDocument()
  })

  it('UL-13: onBack prop 廃止後も従来 props のみで正常描画する', () => {
    // onBack を渡さず（型からも除去済み）、各status混在で例外なく描画される
    render(
      <UploadList
        uploads={[
          makeUpload('a', 'pending', { selected: false }),
          makeUpload('b', 'uploading'),
          makeUpload('c', 'done'),
          makeUpload('d', 'error', { errorMessage: 'x' }),
        ]}
        onRetry={vi.fn()}
        onToggleSelect={vi.fn()}
        onDeleteSelected={vi.fn()}
        albumName="家族旅行"
      />
    )
    expect(screen.getByText('a.jpg')).toBeInTheDocument()
    expect(screen.getByText('b.jpg')).toBeInTheDocument()
    expect(screen.getByText('c.jpg')).toBeInTheDocument()
    expect(screen.getByText('d.jpg')).toBeInTheDocument()
  })

  it('UL-10: 全件が pending 以外（保存後）のとき選択操作バーを出さない', () => {
    render(
      <UploadList
        uploads={[
          makeUpload('a', 'uploading'),
          makeUpload('b', 'done'),
        ]}
      />
    )
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /選択項目を削除/ })
    ).not.toBeInTheDocument()
  })
})
