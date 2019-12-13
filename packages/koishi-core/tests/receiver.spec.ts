import { SERVER_URL, CLIENT_PORT, createServer, postMeta, createMeta } from 'koishi-test-utils'
import { App, Meta } from '../src'
import { Server } from 'http'

let app: App
let server: Server

jest.setTimeout(1000)

const shared: Meta = {
  postType: 'message',
  userId: 10000,
  selfId: 514,
}

beforeAll(() => {
  server = createServer()

  app = new App({
    type: 'http',
    port: CLIENT_PORT,
    server: SERVER_URL,
    selfId: 514,
  })

  app.start()
})

afterAll(() => {
  server.close()
  app.stop()
})

describe('meta.$path', () => {
  test('user/*/message/friend', async () => {
    const meta = createMeta('message', 'private', 'friend', { userId: 10000 })
    await app.dispatchMeta(meta, false)
    expect(meta.$path).toBe('/user/10000/message/friend')
  })

  test('user/*/friend_add', async () => {
    const meta = createMeta('notice', 'friend_add', null, { userId: 10000 })
    await app.dispatchMeta(meta, false)
    expect(meta.$path).toBe('/user/10000/friend_add')
  })

  test('user/*/request', async () => {
    const meta = createMeta('request', 'friend', null, { userId: 10000 })
    await app.dispatchMeta(meta, false)
    expect(meta.$path).toBe('/user/10000/request')
  })

  test('group/*/message/normal', async () => {
    const meta = createMeta('message', 'group', 'normal', { groupId: 20000 })
    await app.dispatchMeta(meta, false)
    expect(meta.$path).toBe('/group/20000/message/normal')
  })

  test('group/*/group_upload', async () => {
    const meta = createMeta('notice', 'group_upload', null, { groupId: 20000 })
    await app.dispatchMeta(meta, false)
    expect(meta.$path).toBe('/group/20000/group_upload')
  })

  test('group/*/group_admin/unset', async () => {
    const meta = createMeta('notice', 'group_admin', 'unset', { groupId: 20000 })
    await app.dispatchMeta(meta, false)
    expect(meta.$path).toBe('/group/20000/group_admin/unset')
  })

  test('group/*/group_decrease/kick', async () => {
    const meta = createMeta('notice', 'group_decrease', 'kick', { groupId: 20000 })
    await app.dispatchMeta(meta, false)
    expect(meta.$path).toBe('/group/20000/group_decrease/kick')
  })

  test('group/*/group_increase/invite', async () => {
    const meta = createMeta('notice', 'group_increase', 'invite', { groupId: 20000 })
    await app.dispatchMeta(meta, false)
    expect(meta.$path).toBe('/group/20000/group_increase/invite')
  })

  test('group/*/group_ban/ban', async () => {
    const meta = createMeta('notice', 'group_ban', 'ban', { groupId: 20000 })
    await app.dispatchMeta(meta, false)
    expect(meta.$path).toBe('/group/20000/group_ban/ban')
  })

  test('group/*/request/invite', async () => {
    const meta = createMeta('request', 'group', 'invite', { groupId: 20000 })
    await app.dispatchMeta(meta, false)
    expect(meta.$path).toBe('/group/20000/request/invite')
  })

  test('discuss/*/message', async () => {
    const meta = createMeta('message', 'discuss', null, { discussId: 30000 })
    await app.dispatchMeta(meta, false)
    expect(meta.$path).toBe('/discuss/30000/message')
  })

  test('meta_event/lifecycle/enable', async () => {
    const meta = createMeta('meta_event', 'lifecycle', 'enable')
    await app.dispatchMeta(meta, false)
    expect(meta.$path).toBe('/meta_event/lifecycle/enable')
  })

  test('meta_event/heartbeat', async () => {
    const meta = createMeta('meta_event', 'heartbeat', null)
    await app.dispatchMeta(meta, false)
    expect(meta.$path).toBe('/meta_event/heartbeat')
  })
})

describe('receiver', () => {
  const mocks: jest.Mock[] = []
  for (let index = 0; index < 11; ++index) {
    mocks.push(jest.fn())
  }

  beforeAll(() => {
    app.receiver.on('message', mocks[0])
    app.receiver.on('message/friend', mocks[1])
    app.receiver.on('message/normal', mocks[2])
    app.users.receiver.on('message', mocks[3])
    app.users.receiver.on('message/friend', mocks[4])
    app.user(10000).receiver.on('message', mocks[5])
    app.user(10000).receiver.on('message/friend', mocks[6])
    app.groups.receiver.on('message', mocks[7])
    app.groups.receiver.on('message/normal', mocks[8])
    app.group(10000).receiver.on('message', mocks[9])
    app.group(10000).receiver.on('message/normal', mocks[10])
  })

  test('friend', async () => {
    await postMeta({
      ...shared,
      messageType: 'private',
      subType: 'friend',
      message: 'Hello',
    })

    mocks.slice(0, 2).forEach(func => expect(func).toBeCalledTimes(1))
    mocks.slice(2, 3).forEach(func => expect(func).toBeCalledTimes(0))
    mocks.slice(3, 7).forEach(func => expect(func).toBeCalledTimes(1))
    mocks.slice(7, 11).forEach(func => expect(func).toBeCalledTimes(0))
  })

  test('group', async () => {
    await postMeta({
      ...shared,
      messageType: 'group',
      subType: 'normal',
      message: 'World',
      groupId: 10000,
    })

    mocks.slice(0, 1).forEach(func => expect(func).toBeCalledTimes(2))
    mocks.slice(1, 3).forEach(func => expect(func).toBeCalledTimes(1))
    mocks.slice(3, 11).forEach(func => expect(func).toBeCalledTimes(1))
  })
})
