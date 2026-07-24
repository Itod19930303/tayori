import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NoticeScreen } from './NoticeScreen'

// 403/404 相当の中央メッセージ表示（molecules 層・propsのみで完結）。
// アルバム詳細/メディアプレビュー/権限管理の3ページで完全一致していたローカル NoticeScreen を
// 共通コンポーネント化したもの。AuthedShell（TopHeader）の下段配置を前提に残余領域を占める。

describe('NoticeScreen (通知メッセージ)', () => {
  it('NS-01: 渡された message を表示する', () => {
    render(<NoticeScreen message="このアルバムは存在しません" />)
    expect(
      screen.getByText('このアルバムは存在しません')
    ).toBeInTheDocument()
  })

  it('NS-02: 別の message でも内容が反映される', () => {
    render(<NoticeScreen message="アクセス権限がありません" />)
    expect(screen.getByText('アクセス権限がありません')).toBeInTheDocument()
  })
})
