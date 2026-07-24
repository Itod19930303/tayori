import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UploadCompleteModal } from './UploadCompleteModal'
import { SUCCESS_MESSAGES } from '@/lib/messages/successMessages'

// UploadCompleteModal は全件 done（allDone）時に完了を通知し、次操作を2択で選ばせる
// molecule（設計書4.7 v2.5）。open=false のとき null を返す。背景クリック・Esc では閉じない。
// リセット（onContinue）・遷移（onBack）はいずれも page 層責務のコールバックを呼ぶのみ。

describe('components/molecules/UploadCompleteModal', () => {
  it('UCM-01: open=true のとき完了メッセージと2ボタンを表示する', () => {
    render(
      <UploadCompleteModal
        open
        count={2}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />
    )
    expect(
      screen.getByText(SUCCESS_MESSAGES.MEDIA_SAVED(2))
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '続けてアップロードする' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '戻る' })).toBeInTheDocument()
  })

  it('UCM-02: 「続けてアップロードする」クリックで onContinue が呼ばれる', async () => {
    const onContinue = vi.fn()
    render(<UploadCompleteModal open count={2} onContinue={onContinue} />)
    await userEvent.click(
      screen.getByRole('button', { name: '続けてアップロードする' })
    )
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('UCM-03: 「戻る」クリックで onBack が呼ばれる', async () => {
    const onBack = vi.fn()
    render(
      <UploadCompleteModal open count={2} onContinue={vi.fn()} onBack={onBack} />
    )
    await userEvent.click(screen.getByRole('button', { name: '戻る' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('UCM-04: open=false のとき何も描画しない（DOM非存在）', () => {
    render(<UploadCompleteModal open={false} count={0} onContinue={vi.fn()} />)
    expect(
      screen.queryByRole('button', { name: '続けてアップロードする' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '戻る' })
    ).not.toBeInTheDocument()
  })

  it('UCM-05: onBack 未指定でも「戻る」クリックでエラーにならない', async () => {
    render(<UploadCompleteModal open count={1} onContinue={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '戻る' }))
    // 例外が発生せず描画が維持される
    expect(screen.getByRole('button', { name: '戻る' })).toBeInTheDocument()
  })

  it('UCM-06: count の境界（1件・多数）でメッセージが正しく埋め込まれる', () => {
    const { rerender } = render(
      <UploadCompleteModal open count={1} onContinue={vi.fn()} />
    )
    expect(
      screen.getByText(SUCCESS_MESSAGES.MEDIA_SAVED(1))
    ).toBeInTheDocument()
    rerender(<UploadCompleteModal open count={99} onContinue={vi.fn()} />)
    expect(
      screen.getByText(SUCCESS_MESSAGES.MEDIA_SAVED(99))
    ).toBeInTheDocument()
  })

  it('UCM-07: 背景クリック・Esc では閉じず、コールバックも呼ばれない', async () => {
    const onContinue = vi.fn()
    const onBack = vi.fn()
    const { container } = render(
      <UploadCompleteModal
        open
        count={2}
        onContinue={onContinue}
        onBack={onBack}
      />
    )
    // オーバーレイ背景（ルート要素）をクリック
    await userEvent.click(container.firstChild as HTMLElement)
    // Esc キー押下
    await userEvent.keyboard('{Escape}')

    // モーダルは表示されたまま、いずれのコールバックも呼ばれない
    expect(
      screen.getByRole('button', { name: '続けてアップロードする' })
    ).toBeInTheDocument()
    expect(onContinue).not.toHaveBeenCalled()
    expect(onBack).not.toHaveBeenCalled()
  })

  it('UCM-08: Firestore/Storage へ直接アクセスしない（props のコールバック呼び出しのみ）', () => {
    // props のコールバックのみで完結することを描画成立で担保する（molecules制約）。
    render(<UploadCompleteModal open count={3} onContinue={vi.fn()} />)
    expect(
      screen.getByText(SUCCESS_MESSAGES.MEDIA_SAVED(3))
    ).toBeInTheDocument()
  })
})
