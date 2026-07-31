import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { LeaveConfirmModal } from './LeaveConfirmModal'
import { CONFIRM_MESSAGES } from '@/lib/messages/confirmMessages'

// LeaveConfirmModal は、アップロード画面で未保存の確定前プレビュー（pending）が残る状態での
// ホーム離脱時に確認を挟む molecule（設計書4.10.2）。open=false のとき null を返し、
// 背景クリック・Esc では閉じない。遷移（onConfirm）・キャンセル（onCancel）はいずれも
// page 層責務のコールバックを呼ぶのみで、Firestore/Storage へ直接アクセスしない。

describe('components/molecules/LeaveConfirmModal', () => {
  it('LCM-01: open=true のとき警告本文と2ボタン（移動する/キャンセル）を表示する', () => {
    render(
      <LeaveConfirmModal
        open
        pendingCount={2}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(
      screen.getByText(CONFIRM_MESSAGES.LEAVE_UPLOAD_WITH_PENDING)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '移動する' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'キャンセル' })
    ).toBeInTheDocument()
  })

  it('LCM-02: 「移動する」クリックで onConfirm が1回呼ばれ onCancel は呼ばれない', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <LeaveConfirmModal
        open
        pendingCount={1}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: '移動する' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('LCM-03: 「キャンセル」クリックで onCancel が1回呼ばれ onConfirm は呼ばれない', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <LeaveConfirmModal
        open
        pendingCount={1}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('LCM-04: open=false のとき何も描画しない（DOM非存在）', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <LeaveConfirmModal
        open={false}
        pendingCount={0}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
    expect(screen.queryByRole('button', { name: '移動する' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'キャンセル' })).toBeNull()
    expect(
      screen.queryByText(CONFIRM_MESSAGES.LEAVE_UPLOAD_WITH_PENDING)
    ).toBeNull()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('LCM-05: pendingCount の境界（1件・多数）でも表示が崩れず件数が反映される', () => {
    const { rerender } = render(
      <LeaveConfirmModal
        open
        pendingCount={1}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: '移動する' })).toBeInTheDocument()
    expect(screen.getByText(/1/)).toBeInTheDocument()

    rerender(
      <LeaveConfirmModal
        open
        pendingCount={99}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: '移動する' })).toBeInTheDocument()
    expect(screen.getByText(/99/)).toBeInTheDocument()
  })

  it('LCM-06: 背景クリック・Esc では閉じず、コールバックも呼ばれない', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const { container } = render(
      <LeaveConfirmModal
        open
        pendingCount={2}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
    // オーバーレイ背景（ルート要素）をクリック
    await userEvent.click(container.firstChild as HTMLElement)
    // Esc キー押下
    await userEvent.keyboard('{Escape}')

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('LCM-07: 権限判定を持たない純粋表示コンポーネントである', () => {
    // canPost/canManage 等の権限propを受け取らず、ロールに依らず同一表示になる。
    render(
      <LeaveConfirmModal
        open
        pendingCount={1}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: '移動する' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'キャンセル' })
    ).toBeInTheDocument()
  })

  it('LCM-08: Firestore/Storage へ直接アクセスしない（props コールバックのみ）', () => {
    const source = readFileSync(
      'src/components/molecules/LeaveConfirmModal.tsx',
      'utf-8'
    )
    expect(source).not.toMatch(
      /\bonSnapshot\s*\(|\buploadBytesResumable\s*\(|\bdeleteDoc\s*\(|\brevokeObjectURL\s*\(/
    )
  })
})
