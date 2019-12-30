import { createApp, createServer, postMeta, SERVER_PORT, emitter, nextTick } from 'koishi-test-utils/src/ws-client'
import { Meta } from '../src'

const server2 = createServer(SERVER_PORT + 1, true)
const server = createServer()

const app1 = createApp()
const app2 = createApp({ selfId: 515 })

jest.setTimeout(1000)

beforeAll(() => {
  return Promise.all([
    app1.start(),
    app2.start(),
  ])
})

afterAll(() => {
  server.close()
  server2.close()

  return Promise.all([
    app1.stop(),
    app2.stop(),
  ])
})

describe('WebSocket Server', () => {
  const mocks: jest.Mock[] = []
  for (let index = 0; index < 3; ++index) {
    mocks.push(jest.fn())
  }

  app1.receiver.on('message', mocks[0])
  app2.receiver.on('message', mocks[1])

  const meta: Meta = {
    postType: 'message',
    userId: 10000,
    messageType: 'private',
    subType: 'friend',
    message: 'Hello',
  }

  test('authorization failed', async () => {
    const app = createApp({ server: `ws://localhost:${SERVER_PORT + 1}` })
    await expect(app.start()).rejects.toBe('authorization failed')
    await app.stop()
  })

  test('app binding', async () => {
    await postMeta({ ...meta, selfId: 514 })
    expect(mocks[0]).toBeCalledTimes(1)
    expect(mocks[1]).toBeCalledTimes(0)

    await postMeta({ ...meta, selfId: 515 })
    expect(mocks[0]).toBeCalledTimes(1)
    expect(mocks[1]).toBeCalledTimes(1)

    await postMeta({ ...meta, selfId: 516 })
    expect(mocks[0]).toBeCalledTimes(1)
    expect(mocks[1]).toBeCalledTimes(1)
  })

  test('make polyfills', async () => {
    await postMeta({ postType: 'message', groupId: 123, message: '', anonymous: 'foo' as any, ['anonymousFlag' as any]: 'bar' })
    await postMeta({ postType: 'request', userId: 123, requestType: 'friend', message: 'baz' })
    await postMeta({ postType: 'event' as any, userId: 123, ['event' as any]: 'frient_add' })
  })
})

describe('Quick Operations', () => {
  const mock = jest.fn()

  const messageMeta: Meta = {
    postType: 'message',
    userId: 10000,
    groupId: 20000,
    messageType: 'group',
    subType: 'normal',
    message: 'Hello',
    messageId: 99999,
  }

  const anonymousMeta: Meta = {
    ...messageMeta,
    anonymous: {
      flag: 'flag',
      name: 'name',
    }
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
    subType: 'add',
    groupId: 40000,
    flag: 'bar',
  }

  test('message event', async () => {
    mock.mockClear()
    app1.receiver.once('message', meta => meta.$send('foo'))
    emitter.once('send_group_msg_async', mock)
    await postMeta(messageMeta)
    await nextTick()
    expect(mock).toBeCalledTimes(1)
    expect(mock.mock.calls[0][0]).toMatchObject({ group_id: 20000, message: 'foo' })

    mock.mockClear()
    app1.groups.receiver.once('message', meta => meta.$ban())
    emitter.once('set_group_ban_async', mock)
    await postMeta(messageMeta)
    await nextTick()
    expect(mock).toBeCalledTimes(1)
    expect(mock.mock.calls[0][0]).toMatchObject({ group_id: 20000, user_id: 10000 })

    mock.mockClear()
    app1.groups.receiver.once('message', meta => meta.$delete())
    emitter.once('delete_msg_async', mock)
    await postMeta(messageMeta)
    await nextTick()
    expect(mock).toBeCalledTimes(1)
    expect(mock.mock.calls[0][0]).toMatchObject({ message_id: 99999 })

    mock.mockClear()
    app1.groups.receiver.once('message', meta => meta.$kick())
    emitter.once('set_group_kick_async', mock)
    await postMeta(messageMeta)
    await nextTick()
    expect(mock).toBeCalledTimes(1)
    expect(mock.mock.calls[0][0]).toMatchObject({ group_id: 20000, user_id: 10000 })

    mock.mockClear()
    app1.groups.receiver.once('message', meta => meta.$ban())
    emitter.once('set_group_anonymous_ban_async', mock)
    await postMeta(anonymousMeta)
    await nextTick()
    expect(mock).toBeCalledTimes(1)
    expect(mock.mock.calls[0][0]).toMatchObject({ group_id: 20000, flag: 'flag' })

    mock.mockClear()
    app1.groups.receiver.once('message', meta => meta.$kick())
    await postMeta(anonymousMeta)
    await expect(nextTick()).rejects.toBeTruthy()
  })

  test('request event', async () => {
    mock.mockClear()
    app1.receiver.once('request/friend', meta => meta.$approve('foo'))
    emitter.once('set_friend_add_request_async', mock)
    await postMeta(frientRequestMeta)
    await nextTick()
    expect(mock).toBeCalledTimes(1)
    expect(mock.mock.calls[0][0]).toMatchObject({ flag: 'foo', remark: 'foo', approve: true })

    mock.mockClear()
    app1.receiver.once('request/friend', meta => meta.$reject())
    emitter.once('set_friend_add_request_async', mock)
    await postMeta(frientRequestMeta)
    await nextTick()
    expect(mock).toBeCalledTimes(1)
    expect(mock.mock.calls[0][0]).toMatchObject({ flag: 'foo', approve: false })

    mock.mockClear()
    app1.receiver.once('request/group/add', meta => meta.$approve())
    emitter.once('set_group_add_request_async', mock)
    await postMeta(groupRequestMeta)
    await nextTick()
    expect(mock).toBeCalledTimes(1)
    expect(mock.mock.calls[0][0]).toMatchObject({ flag: 'bar', approve: true })

    mock.mockClear()
    app1.receiver.once('request/group/add', meta => meta.$reject('bar'))
    emitter.once('set_group_add_request_async', mock)
    await postMeta(groupRequestMeta)
    await nextTick()
    expect(mock).toBeCalledTimes(1)
    expect(mock.mock.calls[0][0]).toMatchObject({ flag: 'bar', reason: 'bar', approve: false })
  })
})
