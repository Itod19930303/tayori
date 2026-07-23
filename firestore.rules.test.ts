import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest'
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore'

// firestore.rules（基本設計書 7.1 / v1.9）のユニットテスト（テスト仕様書 5.41 RUL-01〜07）。
// SDKモックではなく @firebase/rules-unit-testing + Firestore エミュレータで検証する
// （Rules は実エミュレータでしか正確に評価できないため。テスト仕様書 4.13）。
// 検証観点: admin更新可 / 一般不可 / 招待受諾成功 / 権限昇格拒否 / メール不一致拒否 /
// 他人エントリ改変拒否 / pendingInvites の read・create・delete 境界。

const PROJECT_ID = 'tayori-rules-test'

// 各コンテキストの UID / メール。email クレームは normalizedEmail() の照合に用いる。
const ADMIN = { uid: 'admin-uid', email: 'admin@example.com' }
const EDITOR = { uid: 'editor-uid', email: 'editor@example.com' }
const INVITEE = { uid: 'invitee-uid', email: 'invitee@example.com' }
const STRANGER = { uid: 'stranger-uid', email: 'stranger@example.com' }

const ALBUM_ID = 'album-1'
const INVITE_EMAIL = 'invitee@example.com'

let testEnv: RulesTestEnvironment

// owner（admin）メンバー。canManage:true で isAlbumAdmin を成立させる。
// joinedAt は固定 Timestamp とし、受諾テストの append 等価比較（既存要素の再送）で
// 値が一致するようにする。
const ownerMember = {
  uid: ADMIN.uid,
  displayName: '管理者',
  email: ADMIN.email,
  photoURL: '',
  role: 'owner',
  canView: true,
  canPost: true,
  canManage: true,
  joinedAt: Timestamp.fromMillis(1000),
}

const editorMember = {
  uid: EDITOR.uid,
  displayName: '編集者',
  email: EDITOR.email,
  photoURL: '',
  role: 'editor',
  canView: true,
  canPost: true,
  canManage: false,
  joinedAt: Timestamp.fromMillis(1000),
}

// 招待ドキュメント（role viewer / canManage:false）。受諾時にこの権限値へ強制される。
const pendingInvite = {
  email: INVITE_EMAIL,
  role: 'viewer',
  canView: true,
  canPost: false,
  canManage: false,
  invitedBy: ADMIN.uid,
  invitedAt: Timestamp.fromMillis(2000),
}

// 招待どおり（viewer）に受諾する場合の新メンバー要素。
function inviteeMember(overrides: Record<string, unknown> = {}) {
  return {
    uid: INVITEE.uid,
    displayName: '',
    email: INVITE_EMAIL,
    photoURL: '',
    role: 'viewer',
    canView: true,
    canPost: false,
    canManage: false,
    joinedAt: Timestamp.fromMillis(3000),
    ...overrides,
  }
}

// 既存アルバム（owner + editor がメンバー）をシード投入する。
// adminUids は canManage:true メンバーの非正規化配列（設計書 5.1 / 7.1）。
// 既定は owner のみを管理者とし、adminUids 経由の admin 判定を検証するケースでは明示指定する。
async function seedAlbum(
  members: unknown[],
  memberUids: string[],
  adminUids: string[] = [ADMIN.uid]
) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'albums', ALBUM_ID), {
      albumId: ALBUM_ID,
      title: '湖畔で過ごした夏休み',
      description: '',
      ownerId: ADMIN.uid,
      memberUids,
      adminUids,
      members,
      mediaCount: 0,
      createdAt: Timestamp.fromMillis(0),
      updatedAt: Timestamp.fromMillis(0),
    })
  })
}

// 本フィールド追加前に作成された既存アルバムを再現する（adminUids フィールドを持たない）。
// get('adminUids', []) フォールバックが評価エラーを起こさないことの回帰ガードに用いる。
async function seedLegacyAlbum(members: unknown[], memberUids: string[]) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'albums', ALBUM_ID), {
      albumId: ALBUM_ID,
      title: '湖畔で過ごした夏休み',
      description: '',
      ownerId: ADMIN.uid,
      memberUids,
      members,
      mediaCount: 0,
      createdAt: Timestamp.fromMillis(0),
      updatedAt: Timestamp.fromMillis(0),
    })
  })
}

async function seedPendingInvite() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(
      doc(db, 'albums', ALBUM_ID, 'pendingInvites', INVITE_EMAIL),
      pendingInvite
    )
  })
}

function ctxDb(user: { uid: string; email: string }) {
  return testEnv.authenticatedContext(user.uid, { email: user.email }).firestore()
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

describe('firestore.rules - albums 更新（権限編集 / 受諾）', () => {
  it('RUL-01: admin（owner）は members を更新できる', async () => {
    await seedAlbum([ownerMember, editorMember], [ADMIN.uid, EDITOR.uid])
    const db = ctxDb(ADMIN)
    await assertSucceeds(
      updateDoc(doc(db, 'albums', ALBUM_ID), {
        members: [ownerMember, { ...editorMember, canManage: true }],
        updatedAt: Timestamp.fromMillis(10),
      })
    )
  })

  it('RUL-01b: canManage:true でも adminUids に含まれないメンバーの更新は拒否される（members だけでは管理者と認めない）', async () => {
    // isAlbumAdmin は adminUids 配列包含で判定するため、members 内で canManage:true を
    // 自称していても adminUids に載っていなければ admin と認めない（例外は投げずクリーンに拒否）。
    // adminUids はアプリ側（createAlbum / updateAlbumMembers / acceptPendingInvite）が
    // members の canManage:true から算出して同期する正規の経路でのみ更新される。
    const managerMember = {
      ...editorMember,
      uid: STRANGER.uid,
      email: STRANGER.email,
      role: 'admin',
      canManage: true,
    }
    // adminUids には owner のみ（STRANGER を含めない）
    await seedAlbum(
      [ownerMember, managerMember],
      [ADMIN.uid, STRANGER.uid],
      [ADMIN.uid]
    )
    const db = ctxDb(STRANGER)
    await assertFails(
      updateDoc(doc(db, 'albums', ALBUM_ID), {
        members: [ownerMember, managerMember],
        updatedAt: Timestamp.fromMillis(10),
      })
    )
  })

  it('RUL-01c: owner以外でも adminUids に含まれる admin は members/memberUids を更新できる', async () => {
    // 今回の要件の中核: canManage:true の admin ロール（owner 以外）が adminUids 経由で
    // 権限編集・メンバー更新を保存できること（in 演算子による配列包含チェック）。
    const managerMember = {
      ...editorMember,
      uid: STRANGER.uid,
      email: STRANGER.email,
      role: 'admin',
      canManage: true,
    }
    // adminUids に owner と STRANGER（admin）の両方を含める
    await seedAlbum(
      [ownerMember, managerMember],
      [ADMIN.uid, STRANGER.uid],
      [ADMIN.uid, STRANGER.uid]
    )
    const db = ctxDb(STRANGER)
    await assertSucceeds(
      updateDoc(doc(db, 'albums', ALBUM_ID), {
        members: [ownerMember, { ...managerMember, canManage: true }],
        memberUids: [ADMIN.uid, STRANGER.uid],
        adminUids: [ADMIN.uid, STRANGER.uid],
        updatedAt: Timestamp.fromMillis(10),
      })
    )
  })

  it('RUL-02: 一般メンバー（canManage:false）は members を更新できない', async () => {
    await seedAlbum([ownerMember, editorMember], [ADMIN.uid, EDITOR.uid])
    const db = ctxDb(EDITOR)
    await assertFails(
      updateDoc(doc(db, 'albums', ALBUM_ID), {
        members: [ownerMember, { ...editorMember, canManage: true }],
        updatedAt: Timestamp.fromMillis(10),
      })
    )
  })

  it('RUL-03: 招待済み本人は招待どおりの権限で自分を members へ追加（受諾）できる', async () => {
    await seedAlbum([ownerMember], [ADMIN.uid])
    await seedPendingInvite()
    const db = ctxDb(INVITEE)
    await assertSucceeds(
      updateDoc(doc(db, 'albums', ALBUM_ID), {
        members: [ownerMember, inviteeMember()],
        memberUids: [ADMIN.uid, INVITEE.uid],
      })
    )
  })

  it('RUL-04: 受諾時に招待より高い権限を自称すると拒否される（権限昇格拒否）', async () => {
    await seedAlbum([ownerMember], [ADMIN.uid])
    await seedPendingInvite()
    const db = ctxDb(INVITEE)
    await assertFails(
      updateDoc(doc(db, 'albums', ALBUM_ID), {
        members: [ownerMember, inviteeMember({ canManage: true, role: 'admin' })],
        memberUids: [ADMIN.uid, INVITEE.uid],
      })
    )
  })

  it('RUL-05: 招待メールと不一致のユーザーは受諾できない（メール不一致拒否）', async () => {
    await seedAlbum([ownerMember], [ADMIN.uid])
    await seedPendingInvite()
    const db = ctxDb(STRANGER)
    await assertFails(
      updateDoc(doc(db, 'albums', ALBUM_ID), {
        members: [
          ownerMember,
          inviteeMember({ uid: STRANGER.uid, email: STRANGER.email }),
        ],
        memberUids: [ADMIN.uid, STRANGER.uid],
      })
    )
  })

  it('RUL-06: 受諾のついでに title/ownerId を書き換えると拒否される（他人エントリ改変拒否）', async () => {
    await seedAlbum([ownerMember], [ADMIN.uid])
    await seedPendingInvite()
    const db = ctxDb(INVITEE)
    await assertFails(
      updateDoc(doc(db, 'albums', ALBUM_ID), {
        members: [ownerMember, inviteeMember()],
        memberUids: [ADMIN.uid, INVITEE.uid],
        title: '乗っ取られたアルバム',
      })
    )
  })

  it('RUL-06b: 受諾のついでに description/coverImageUrl/mediaCount を書き換えると拒否される（ホワイトリスト外フィールド改ざん拒否）', async () => {
    await seedAlbum([ownerMember], [ADMIN.uid])
    await seedPendingInvite()
    const db = ctxDb(INVITEE)
    await assertFails(
      updateDoc(doc(db, 'albums', ALBUM_ID), {
        members: [ownerMember, inviteeMember()],
        memberUids: [ADMIN.uid, INVITEE.uid],
        description: '改ざんされた説明文',
        coverImageUrl: 'https://evil.example.com/x.png',
        mediaCount: 99999,
      })
    )
  })

  it('RUL-06c: 受諾のついでに updatedAt を書き換えるだけでも拒否される（members/memberUids 以外は不変）', async () => {
    await seedAlbum([ownerMember], [ADMIN.uid])
    await seedPendingInvite()
    const db = ctxDb(INVITEE)
    await assertFails(
      updateDoc(doc(db, 'albums', ALBUM_ID), {
        members: [ownerMember, inviteeMember()],
        memberUids: [ADMIN.uid, INVITEE.uid],
        updatedAt: Timestamp.fromMillis(9999),
      })
    )
  })

  it('RUL-08: canManage:true の招待受諾時は adminUids へ自分を append すれば受諾できる', async () => {
    // admin 権限で招待された本人が、members/memberUids に加え adminUids へも自分を
    // append する（アプリの acceptPendingInvite の arrayUnion に対応）。
    await seedAlbum([ownerMember], [ADMIN.uid], [ADMIN.uid])
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'albums', ALBUM_ID, 'pendingInvites', INVITE_EMAIL),
        {
          ...pendingInvite,
          role: 'admin',
          canPost: true,
          canManage: true,
        }
      )
    })
    const db = ctxDb(INVITEE)
    const adminInvitee = inviteeMember({
      role: 'admin',
      canPost: true,
      canManage: true,
    })
    await assertSucceeds(
      updateDoc(doc(db, 'albums', ALBUM_ID), {
        members: [ownerMember, adminInvitee],
        memberUids: [ADMIN.uid, INVITEE.uid],
        adminUids: [ADMIN.uid, INVITEE.uid],
      })
    )
  })

  it('RUL-10a: adminUids 未設定の既存アルバムでも owner は更新でき、非owner は例外なく拒否される（後方互換）', async () => {
    // get('adminUids', []) フォールバックの回帰ガード。owner は || 短絡で成立、
    // 非owner（editor）は空配列包含が false となりクリーンに拒否される（評価エラーを投げない）。
    await seedLegacyAlbum([ownerMember, editorMember], [ADMIN.uid, EDITOR.uid])
    const ownerDb = ctxDb(ADMIN)
    await assertSucceeds(
      updateDoc(doc(ownerDb, 'albums', ALBUM_ID), {
        members: [ownerMember, { ...editorMember, canManage: true }],
        updatedAt: Timestamp.fromMillis(10),
      })
    )
    await seedLegacyAlbum([ownerMember, editorMember], [ADMIN.uid, EDITOR.uid])
    const editorDb = ctxDb(EDITOR)
    await assertFails(
      updateDoc(doc(editorDb, 'albums', ALBUM_ID), {
        members: [ownerMember, editorMember],
        updatedAt: Timestamp.fromMillis(10),
      })
    )
  })

  it('RUL-10b: adminUids 未設定の既存アルバムでも viewer 招待の受諾（adminUids 不変）が成功する（後方互換）', async () => {
    // 既存アルバムに対する受諾。canManage:false のため adminUids は書き込まず、
    // get('adminUids', []) 同士（[] == []）の比較が評価エラーなく成立する。
    await seedLegacyAlbum([ownerMember], [ADMIN.uid])
    await seedPendingInvite()
    const db = ctxDb(INVITEE)
    await assertSucceeds(
      updateDoc(doc(db, 'albums', ALBUM_ID), {
        members: [ownerMember, inviteeMember()],
        memberUids: [ADMIN.uid, INVITEE.uid],
      })
    )
  })

  it('RUL-09: viewer 招待（canManage:false）なのに adminUids へ自分を追加すると拒否される（管理者昇格の別経路防止）', async () => {
    // 招待の canManage が false の場合、adminUids は不変でなければならない。
    // members の権限値は招待どおり viewer のまま adminUids だけを膨らませる攻撃を拒否する。
    await seedAlbum([ownerMember], [ADMIN.uid], [ADMIN.uid])
    await seedPendingInvite()
    const db = ctxDb(INVITEE)
    await assertFails(
      updateDoc(doc(db, 'albums', ALBUM_ID), {
        members: [ownerMember, inviteeMember()],
        memberUids: [ADMIN.uid, INVITEE.uid],
        adminUids: [ADMIN.uid, INVITEE.uid],
      })
    )
  })
})

describe('firestore.rules - pendingInvites 境界（RUL-07）', () => {
  it('RUL-07a: admin は pendingInvites を create / delete できる', async () => {
    await seedAlbum([ownerMember], [ADMIN.uid])
    const db = ctxDb(ADMIN)
    const newEmail = 'new@example.com'
    await assertSucceeds(
      setDoc(doc(db, 'albums', ALBUM_ID, 'pendingInvites', newEmail), {
        email: newEmail,
        role: 'viewer',
        canView: true,
        canPost: false,
        canManage: false,
        invitedBy: ADMIN.uid,
        invitedAt: Timestamp.fromMillis(0),
      })
    )
    await assertSucceeds(
      deleteDoc(doc(db, 'albums', ALBUM_ID, 'pendingInvites', newEmail))
    )
  })

  it('RUL-07b: 非メンバーは pendingInvites を read できない', async () => {
    await seedAlbum([ownerMember], [ADMIN.uid])
    await seedPendingInvite()
    const db = ctxDb(STRANGER)
    await assertFails(
      getDoc(doc(db, 'albums', ALBUM_ID, 'pendingInvites', INVITE_EMAIL))
    )
  })

  it('RUL-07c: 招待対象者本人は自分の招待を read / delete できる', async () => {
    await seedAlbum([ownerMember], [ADMIN.uid])
    await seedPendingInvite()
    const db = ctxDb(INVITEE)
    await assertSucceeds(
      getDoc(doc(db, 'albums', ALBUM_ID, 'pendingInvites', INVITE_EMAIL))
    )
    await assertSucceeds(
      deleteDoc(doc(db, 'albums', ALBUM_ID, 'pendingInvites', INVITE_EMAIL))
    )
  })
})
