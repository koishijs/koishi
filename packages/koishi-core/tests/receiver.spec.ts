import { MockedApp, BASE_SELF_ID } from 'koishi-test-utils'
import { PostType, MetaTypeMap, SubTypeMap, Meta } from '../dist'
import { camelCase } from 'koishi-utils'

const app = new MockedApp()

function createMeta<T extends PostType>(postType: T, type: MetaTypeMap[T], subType: SubTypeMap[T], session: Meta<T> = {}) {
  if (!session.selfId) session.selfId = BASE_SELF_ID
  session.postType = postType
  session[camelCase(postType) + 'Type'] = type
  session.subType = subType
  return session
}

describe('Receiver API', () => {
  test('user/*/message/friend', async () => {
    const session = createMeta('message', 'private', 'friend', { userId: 10000 })
    expect(app.server.parseMeta(session)).to.have.shape(['message/friend', 'message'])
    expect(session.$ctxType).to.equal('user')
    expect(session.$ctxId).to.equal(10000)
  })

  test('user/*/friend_add', async () => {
    const session = createMeta('notice', 'friend_add', null, { userId: 10000 })
    expect(app.server.parseMeta(session)).to.have.shape(['friend_add'])
    expect(session.$ctxType).to.equal('user')
    expect(session.$ctxId).to.equal(10000)
  })

  test('user/*/request/friend', async () => {
    const session = createMeta('request', 'friend', null, { userId: 10000 })
    expect(app.server.parseMeta(session)).to.have.shape(['request/friend'])
    expect(session.$ctxType).to.equal('user')
    expect(session.$ctxId).to.equal(10000)
  })

  test('group/*/message/normal', async () => {
    const session = createMeta('message', 'group', 'normal', { groupId: 20000 })
    expect(app.server.parseMeta(session)).to.have.shape(['message/normal', 'message'])
    expect(session.$ctxType).to.equal('group')
    expect(session.$ctxId).to.equal(20000)
  })

  test('group/*/group_upload', async () => {
    const session = createMeta('notice', 'group_upload', null, { groupId: 20000 })
    expect(app.server.parseMeta(session)).to.have.shape(['group_upload'])
    expect(session.$ctxType).to.equal('group')
    expect(session.$ctxId).to.equal(20000)
  })

  test('group/*/group_admin/unset', async () => {
    const session = createMeta('notice', 'group_admin', 'unset', { groupId: 20000 })
    expect(app.server.parseMeta(session)).to.have.shape(['group_admin/unset', 'group_admin'])
    expect(session.$ctxType).to.equal('group')
    expect(session.$ctxId).to.equal(20000)
  })

  test('group/*/group_decrease/kick', async () => {
    const session = createMeta('notice', 'group_decrease', 'kick', { groupId: 20000 })
    expect(app.server.parseMeta(session)).to.have.shape(['group_decrease/kick', 'group_decrease'])
    expect(session.$ctxType).to.equal('group')
    expect(session.$ctxId).to.equal(20000)
  })

  test('group/*/group_increase/invite', async () => {
    const session = createMeta('notice', 'group_increase', 'invite', { groupId: 20000 })
    expect(app.server.parseMeta(session)).to.have.shape(['group_increase/invite', 'group_increase'])
    expect(session.$ctxType).to.equal('group')
    expect(session.$ctxId).to.equal(20000)
  })

  test('group/*/group_ban/ban', async () => {
    const session = createMeta('notice', 'group_ban', 'ban', { groupId: 20000 })
    expect(app.server.parseMeta(session)).to.have.shape(['group_ban/ban', 'group_ban'])
    expect(session.$ctxType).to.equal('group')
    expect(session.$ctxId).to.equal(20000)
  })

  test('group/*/request/group/invite', async () => {
    const session = createMeta('request', 'group', 'invite', { groupId: 20000 })
    expect(app.server.parseMeta(session)).to.have.shape(['request/group/invite', 'request/group'])
    expect(session.$ctxType).to.equal('group')
    expect(session.$ctxId).to.equal(20000)
  })

  test('discuss/*/message', async () => {
    const session = createMeta('message', 'discuss', null, { discussId: 30000 })
    expect(app.server.parseMeta(session)).to.have.shape(['message'])
    expect(session.$ctxType).to.equal('discuss')
    expect(session.$ctxId).to.equal(30000)
  })

  test('lifecycle/enable', async () => {
    const session = createMeta('meta_event', 'lifecycle', 'enable')
    expect(app.server.parseMeta(session)).to.have.shape(['lifecycle/enable', 'lifecycle'])
    expect(session.$ctxType).not.to.be.ok
    expect(session.$ctxId).not.to.be.ok
  })

  test('heartbeat', async () => {
    const session = createMeta('meta_event', 'heartbeat', null)
    expect(app.server.parseMeta(session)).to.have.shape(['heartbeat'])
    expect(session.$ctxType).not.to.be.ok
    expect(session.$ctxId).not.to.be.ok

    // make coverage happy
    expect(app.server.dispatchMeta(session))
  })
})
