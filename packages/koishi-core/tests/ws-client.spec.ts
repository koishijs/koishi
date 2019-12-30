import { createApp, createServer, postMeta, SERVER_PORT } from 'koishi-test-utils/src/ws-client'
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

  test('send messages', async () => {
    await expect(app1.sender.sendPrivateMsg(20000, 'foo')).resolves.toBeUndefined()
    await expect(app2.sender.sendPrivateMsg(20000, 'bar')).resolves.toBeUndefined()
  })
})
