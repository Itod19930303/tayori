import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionRow } from './ActionRow'

// ActionRow は情報メモ + 「変更を保存」ボタンを持つ organisms（基本設計書 4.8）。
// 保存呼び出し・保存中/未変更時の非活性を検証する。

describe('components/organisms/ActionRow', () => {
  it('AR-01: 「変更を保存」ボタンで onSave を呼ぶ', async () => {
    const onSave = vi.fn()
    render(<ActionRow isDirty isSaving={false} onSave={onSave} />)
    await userEvent.click(screen.getByRole('button', { name: '変更を保存' }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('AR-02: isSaving 中はボタンを非活性にする', async () => {
    const onSave = vi.fn()
    render(<ActionRow isDirty isSaving onSave={onSave} />)
    const button = screen.getByRole('button', { name: /保存/ })
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('AR-03: 未変更（isDirty=false）でボタンを非活性にする', async () => {
    const onSave = vi.fn()
    render(<ActionRow isDirty={false} isSaving={false} onSave={onSave} />)
    const button = screen.getByRole('button', { name: '変更を保存' })
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(onSave).not.toHaveBeenCalled()
  })
})
