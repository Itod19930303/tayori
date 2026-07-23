import { describe, it, expect } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import type {
  Album,
  AlbumMember,
  Media,
  UserProfile,
  PendingInvite,
} from './index'

// 型定義は実行時の振る舞いを持たないため、型が設計書5.1のスキーマと一致することを
// コンパイル（tsc --noEmit）で担保する。ここでは型注釈付きオブジェクトを生成して
// 「型エラーなくコンパイルが通る」ことと、@ts-expect-error による制約違反検出を検証する。
// vitest（esbuild）実行時は型チェックされないため、`npm run test` に加え tsc でも検証する。

const ts = Timestamp.fromMillis(0)

describe('types/index', () => {
  it('TY-01: Album が設計書5.1の全フィールドを持つ', () => {
    const album: Album = {
      albumId: 'a1',
      title: 'テストアルバム',
      description: '説明（任意）',
      coverImageUrl: 'https://example.com/cover.jpg',
      ownerId: 'owner-uid',
      memberUids: ['owner-uid'],
      adminUids: ['owner-uid'],
      members: [],
      mediaCount: 0,
      createdAt: ts,
      updatedAt: ts,
    }
    // 任意フィールドを省いてもコンパイルが通る
    const minimal: Album = {
      albumId: 'a2',
      title: 'タイトルのみ',
      ownerId: 'owner-uid',
      memberUids: ['owner-uid'],
      adminUids: ['owner-uid'],
      members: [],
      mediaCount: 0,
      createdAt: ts,
      updatedAt: ts,
    }
    expect(album.title).toBe('テストアルバム')
    expect(minimal.description).toBeUndefined()
    // adminUids は canManage メンバーの UID を非正規化して保持する必須配列（設計書 5.1 / 7.1）
    expect(album.adminUids).toEqual(['owner-uid'])
  })

  it('TY-02: AlbumMember の role は限定 union、権限フラグは boolean', () => {
    const member: AlbumMember = {
      uid: 'u1',
      displayName: '太郎',
      email: 'taro@example.com',
      role: 'owner',
      canView: true,
      canPost: true,
      canManage: true,
      joinedAt: ts,
    }
    // @ts-expect-error role に未定義の値は代入できない
    const invalid: AlbumMember = { ...member, role: 'guest' }
    expect(typeof member.canView).toBe('boolean')
    expect(invalid).toBeDefined()
  })

  it('TY-03: Media は provider を必須で持つ', () => {
    const media: Media = {
      mediaId: 'm1',
      albumId: 'a1',
      fileName: 'photo.jpg',
      contentType: 'image/jpeg',
      size: 1024,
      storagePath: 'albums/a1/m1/photo.jpg',
      downloadUrl: 'https://example.com/photo.jpg',
      uploadedBy: 'u1',
      uploaderName: '太郎',
      createdAt: ts,
      provider: 'firebase',
    }
    // @ts-expect-error provider は必須のため省略できない
    const missing: Media = {
      mediaId: 'm2',
      albumId: 'a1',
      fileName: 'x.jpg',
      contentType: 'image/jpeg',
      size: 1,
      storagePath: 'p',
      downloadUrl: 'u',
      uploadedBy: 'u1',
      uploaderName: '太郎',
      createdAt: ts,
    }
    expect(media.provider).toBe('firebase')
    expect(missing).toBeDefined()
  })

  it('TY-04: UserProfile が本人プロファイル用フィールドを持つ', () => {
    const profile: UserProfile = {
      uid: 'u1',
      displayName: '太郎',
      email: 'taro@example.com',
      photoURL: 'https://example.com/p.png',
      createdAt: ts,
      updatedAt: ts,
    }
    expect(profile.uid).toBe('u1')
  })

  it('TY-05: createdAt は firebase/firestore の Timestamp 型を参照する', () => {
    const value: Album['createdAt'] = ts
    expect(value).toBeInstanceOf(Timestamp)
  })

  it('TY-06: AlbumMember の invited は任意の boolean（UI表示専用フラグ）', () => {
    // invited を省略しても、true を付与してもコンパイルが通る（基本設計書 5.1）。
    const confirmed: AlbumMember = {
      uid: 'u1',
      displayName: '太郎',
      email: 'taro@example.com',
      role: 'viewer',
      canView: true,
      canPost: false,
      canManage: false,
      joinedAt: ts,
    }
    const invited: AlbumMember = { ...confirmed, uid: '', invited: true }
    expect(confirmed.invited).toBeUndefined()
    expect(invited.invited).toBe(true)
  })

  it('TY-07: PendingInvite が招待レコードの全フィールドを持つ', () => {
    const invite: PendingInvite = {
      email: 'invitee@example.com',
      role: 'viewer',
      canView: true,
      canPost: false,
      canManage: false,
      invitedBy: 'admin-uid',
      invitedAt: ts,
    }
    // @ts-expect-error role に owner は招待対象外のため代入できない
    const invalid: PendingInvite = { ...invite, role: 'owner' }
    expect(invite.email).toBe('invitee@example.com')
    expect(invalid).toBeDefined()
  })
})
