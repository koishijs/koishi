import { MockedApp, BASE_SELF_ID } from 'koishi-test-utils'
import { PostType, MetaTypeMap, SubTypeMap, Meta } from '../dist'
import { camelCase } from 'koishi-utils'

const app = new MockedApp()

function createMeta <T extends PostType> (postType: T, type: MetaTypeMap[T], subType: SubTypeMap[T], meta: Meta<T> = {}) {
  if (!meta.selfId) meta.selfId = BASE_SELF_ID
  meta.postType = postType
  meta[camelCase(postType) + 'Type'] = type
  meta.subType = subType
  return meta
}

describe('Receiver API', () => {
  test('user/*/message/friend', async () => {
    const meta = createMeta('message', 'private', 'friend', { userId: 10000 })
    expect(app.server.parseMeta(meta)).toMatchObject(['message/friend', 'message'])
    expect(meta.$ctxType).toBe('user')
    expect(meta.$ctxId).toBe(10000)
  })

  test('user/*/friend_add', async () => {
    const meta = createMeta('notice', 'friend_add', null, { userId: 10000 })
    expect(app.server.parseMeta(meta)).toMatchObject(['friend_add'])
    expect(meta.$ctxType).toBe('user')
    expect(meta.$ctxId).toBe(10000)
  })

  test('user/*/request/friend', async () => {
    const meta = createMeta('request', 'friend', null, { userId: 10000 })
    expect(app.server.parseMeta(meta)).toMatchObject(['request/friend'])
    expect(meta.$ctxType).toBe('user')
    expect(meta.$ctxId).toBe(10000)
  })

  test('group/*/message/normal', async () => {
    const meta = createMeta('message', 'group', 'normal', { groupId: 20000 })
    expect(app.server.parseMeta(meta)).toMatchObject(['message/normal', 'message'])
    expect(meta.$ctxType).toBe('group')
    expect(meta.$ctxId).toBe(20000)
  })

  test('group/*/group_upload', async () => {
    const meta = createMeta('notice', 'group_upload', null, { groupId: 20000 })
    expect(app.server.parseMeta(meta)).toMatchObject(['group_upload'])
    expect(meta.$ctxType).toBe('group')
    expect(meta.$ctxId).toBe(20000)
  })

  test('group/*/group_admin/unset', async () => {
    const meta = createMeta('notice', 'group_admin', 'unset', { groupId: 20000 })
    expect(app.server.parseMeta(meta)).toMatchObject(['group_admin/unset', 'group_admin'])
    expect(meta.$ctxType).toBe('group')
    expect(meta.$ctxId).toBe(20000)
  })

  test('group/*/group_decrease/kick', async () => {
    const meta = createMeta('notice', 'group_decrease', 'kick', { groupId: 20000 })
    expect(app.server.parseMeta(meta)).toMatchObject(['group_decrease/kick', 'group_decrease'])
    expect(meta.$ctxType).toBe('group')
    expect(meta.$ctxId).toBe(20000)
  })

  test('group/*/group_increase/invite', async () => {
    const meta = createMeta('notice', 'group_increase', 'invite', { groupId: 20000 })
    expect(app.server.parseMeta(meta)).toMatchObject(['group_increase/invite', 'group_increase'])
    expect(meta.$ctxType).toBe('group')
    expect(meta.$ctxId).toBe(20000)
  })

  test('group/*/group_ban/ban', async () => {
    const meta = createMeta('notice', 'group_ban', 'ban', { groupId: 20000 })
    expect(app.server.parseMeta(meta)).toMatchObject(['group_ban/ban', 'group_ban'])
    expect(meta.$ctxType).toBe('group')
    expect(meta.$ctxId).toBe(20000)
  })

  test('group/*/request/group/invite', async () => {
    const meta = createMeta('request', 'group', 'invite', { groupId: 20000 })
    expect(app.server.parseMeta(meta)).toMatchObject(['request/group/invite', 'request/group'])
    expect(meta.$ctxType).toBe('group')
    expect(meta.$ctxId).toBe(20000)
  })

  test('discuss/*/message', async () => {
    const meta = createMeta('message', 'discuss', null, { discussId: 30000 })
    expect(app.server.parseMeta(meta)).toMatchObject(['message'])
    expect(meta.$ctxType).toBe('discuss')
    expect(meta.$ctxId).toBe(30000)
  })

  test('lifecycle/enable', async () => {
    const meta = createMeta('meta_event', 'lifecycle', 'enable')
    expect(app.server.parseMeta(meta)).toMatchObject(['lifecycle/enable', 'lifecycle'])
    expect(meta.$ctxType).toBeFalsy()
    expect(meta.$ctxId).toBeFalsy()
  })

  test('heartbeat', async () => {
    const meta = createMeta('meta_event', 'heartbeat', null)
    expect(app.server.parseMeta(meta)).toMatchObject(['heartbeat'])
    expect(meta.$ctxType).toBeFalsy()
    expect(meta.$ctxId).toBeFalsy()
  })
})
