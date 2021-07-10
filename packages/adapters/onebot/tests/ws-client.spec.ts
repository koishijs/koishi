import { createWsServer, WsServer, BASE_SELF_ID } from '@koishijs/test-utils'
import { App, Meta } from 'koishi-core'

let server: WsServer
let app1: App, app2: App

beforeAll(async () => {
  server = await createWsServer()
  app1 = server.createBoundApp({
    retryTimes: 1,
    retryInterval: 100,
  })
  app2 = server.createBoundApp({
    selfId: BASE_SELF_ID + 1,
  })
})

afterAll(() => server.close())

describe('WebSocket Server', () => {
  const app1MessageCallback = jest.fn()
  const app2MessageCallback = jest.fn()

  beforeAll(() => {
    app1.on('message', app1MessageCallback)
    app2.on('message', app2MessageCallback)
  })

  test('authorization', async () => {
    server.token = 'token'
    await expect(app1.start()).rejects.toHaveProperty('message', 'authorization failed')
    app1.options.token = 'nekot'
    await expect(app1.start()).rejects.toHaveProperty('message', 'authorization failed')
    app1.options.token = 'token'
    await expect(app1.start()).resolves.toBeUndefined()
    await server.close()
    await expect(app1.start()).rejects.toHaveProperty('message')
    server.token = null
    server.open()
    await expect(app1.start()).resolves.toBeUndefined()
  })

  const meta: Meta = {
    postType: 'message',
    userId: 10000,
    messageType: 'private',
    subtype: 'friend',
    message: 'Hello',
  }

  test('app binding', async () => {
    await server.post({ ...meta, selfId: BASE_SELF_ID })
    expect(app1MessageCallback).toBeCalledTimes(1)
    expect(app2MessageCallback).toBeCalledTimes(0)

    await server.post({ ...meta, selfId: BASE_SELF_ID + 1 })
    expect(app1MessageCallback).toBeCalledTimes(1)
    expect(app2MessageCallback).toBeCalledTimes(1)

    await server.post({ ...meta, selfId: BASE_SELF_ID + 2 })
    expect(app1MessageCallback).toBeCalledTimes(1)
    expect(app2MessageCallback).toBeCalledTimes(1)
  })

  test('make polyfills', async () => {
    await server.post({ postType: 'message', groupId: 123, message: [{ type: 'text', data: { text: 'foo' } }] as any })
    await server.post({ postType: 'message', groupId: 123, message: '', anonymous: 'foo' as any, ['anonymousFlag' as any]: 'bar' })
    await server.post({ postType: 'request', userId: 123, requestType: 'friend', message: 'baz' })
    await server.post({ postType: 'event' as any, userId: 123, ['event' as any]: 'frient_add' })
  })
})

describe('Quick Operations', () => {
  const mock = jest.fn()

  const messageMeta: Meta = {
    postType: 'message',
    userId: 10000,
    groupId: 20000,
    messageType: 'group',
    subtype: 'normal',
    message: 'Hello',
    messageId: 99999,
  }

  const anonymousMeta: Meta = {
    ...messageMeta,
    anonymous: {
      flag: 'flag',
      name: 'name',
    },
  }

  const frientRequestMeta: Meta = {
    postType: 'request',
    requestType: 'friend',
    userId: 30000,
    flag: 'foo',
  }

  const groupRequestMeta: Meta = {
    ...frientRequestMeta,
    requestType: 'group',
    subtype: 'add',
    groupId: 40000,
    flag: 'bar',
  }

  test('message event', async () => {
    mock.mockClear()
    app1.once('message', meta => meta.send('foo'))
    await server.post(messageMeta)
    await server.nextTick()
    server.shouldHaveLastRequest('send_group_msg_async', { groupId: 20000, message: 'foo' })

    mock.mockClear()
    app1.groups.once('message', meta => meta.$ban())
    await server.post(messageMeta)
    await server.nextTick()
    server.shouldHaveLastRequest('set_group_ban_async', { groupId: 20000, userId: 10000 })

    mock.mockClear()
    app1.groups.once('message', meta => meta.$delete())
    await server.post(messageMeta)
    await server.nextTick()
    server.shouldHaveLastRequest('delete_msg_async', { messageId: 99999 })

    mock.mockClear()
    app1.groups.once('message', meta => meta.$kick())
    await server.post(messageMeta)
    await server.nextTick()
    server.shouldHaveLastRequest('set_group_kick_async', { groupId: 20000, userId: 10000 })

    mock.mockClear()
    app1.groups.once('message', meta => meta.$ban())
    await server.post(anonymousMeta)
    await server.nextTick()
    server.shouldHaveLastRequest('set_group_anonymous_ban_async', { groupId: 20000, flag: 'flag' })

    mock.mockClear()
    app1.groups.once('message', meta => meta.$kick())
    await server.post(anonymousMeta)
    // should have no response, just make coverage happy
  })

  test('request event', async () => {
    mock.mockClear()
    app1.once('request/friend', meta => meta.$approve('foo'))
    await server.post(frientRequestMeta)
    await server.nextTick()
    server.shouldHaveLastRequest('set_friend_add_request_async', { flag: 'foo', remark: 'foo', approve: true })

    mock.mockClear()
    app1.once('request/friend', meta => meta.$reject())
    await server.post(frientRequestMeta)
    await server.nextTick()
    server.shouldHaveLastRequest('set_friend_add_request_async', { flag: 'foo', approve: false })

    mock.mockClear()
    app1.once('request/group/add', meta => meta.$approve())
    await server.post(groupRequestMeta)
    await server.nextTick()
    server.shouldHaveLastRequest('set_group_add_request_async', { flag: 'bar', approve: true })

    mock.mockClear()
    app1.once('request/group/add', meta => meta.$reject('bar'))
    await server.post(groupRequestMeta)
    await server.nextTick()
    server.shouldHaveLastRequest('set_group_add_request_async', { flag: 'bar', reason: 'bar', approve: false })
  })
})
