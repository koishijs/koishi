import { SERVER_URL, CLIENT_PORT, createServer, postMeta } from 'koishi-test-utils'
import { App, startAll, stopAll, Meta } from '../src'

const server = createServer()

const app1 = new App({
  port: CLIENT_PORT,
  server: SERVER_URL,
  selfId: 514,
})

const app2 = new App({
  port: CLIENT_PORT,
  server: SERVER_URL,
})

const app3 = new App({
  port: CLIENT_PORT + 1,
  server: SERVER_URL,
  selfId: 516,
  secret: 'secret',
})

const mocks: jest.Mock[] = []
for (let index = 0; index < 6; ++index) {
  mocks.push(jest.fn())
}

app1.receiver.on('message', mocks[0])
app2.receiver.on('message', mocks[1])
app1.receiver.on('connect', mocks[2])
app2.receiver.on('connect', mocks[3])
app1.receiver.on('ready', mocks[4])
app2.receiver.on('ready', mocks[5])

jest.setTimeout(1000)

beforeAll(() => {
  return startAll()
})

afterAll(() => {
  server.close()
  return stopAll()
})

const shared: Meta = {
  postType: 'message',
  userId: 10000,
  messageType: 'private',
  subType: 'friend',
  message: 'Hello',
}

describe('HTTP Server', () => {
  test('connect event', async () => {
    expect(mocks[2]).toBeCalledTimes(1)
    expect(mocks[3]).toBeCalledTimes(1)
    expect(mocks[4]).toBeCalledTimes(1)
    expect(mocks[5]).toBeCalledTimes(0)
  })

  test('request validation', async () => {
    await expect(postMeta({ ...shared, selfId: 516 }, CLIENT_PORT + 1)).rejects.toHaveProperty('response.status', 401)
    await expect(postMeta({ ...shared, selfId: 516 }, CLIENT_PORT + 1, 'foobar')).rejects.toHaveProperty('response.status', 403)
    await expect(postMeta({ ...shared, selfId: 513 }, CLIENT_PORT + 1, 'secret')).rejects.toHaveProperty('response.status', 403)
    await expect(postMeta({ ...shared, selfId: 516 }, CLIENT_PORT + 1, 'secret')).resolves.toHaveProperty('status', 200)
  })

  test('app binding', async () => {
    await postMeta(shared)
    expect(mocks[0]).toBeCalledTimes(1)
    expect(mocks[1]).toBeCalledTimes(0)

    expect(app2.selfId).toBeFalsy()
    await postMeta({ ...shared, selfId: 515 })
    expect(mocks[0]).toBeCalledTimes(1)
    expect(mocks[1]).toBeCalledTimes(1)
    expect(app2.selfId).toBe(515)
    expect(mocks[5]).toBeCalledTimes(1)
  })
})

describe('Quick Operations', () => {
  beforeAll(() => app1.options.quickOperationTimeout = 100)
  afterAll(() => app1.options.quickOperationTimeout = 0)

  test('message event', async () => {
    const meta: Meta = {
      postType: 'message',
      userId: 10000,
      groupId: 20000,
      messageType: 'group',
      subType: 'normal',
      message: 'Hello',
    }

    app1.receiver.once('message', meta => meta.$send('foo'))
    await expect(postMeta(meta)).resolves.toMatchObject({ data: { reply: 'foo' } })

    app1.groups.receiver.once('message', meta => meta.$ban())
    await expect(postMeta(meta)).resolves.toMatchObject({ data: { ban: true } })

    app1.groups.receiver.once('message', meta => meta.$delete())
    await expect(postMeta(meta)).resolves.toMatchObject({ data: { delete: true } })

    app1.groups.receiver.once('message', meta => meta.$kick())
    await expect(postMeta(meta)).resolves.toMatchObject({ data: { kick: true } })
  })

  test('request event', async () => {
    const meta: Meta = {
      postType: 'request',
      requestType: 'friend',
      userId: 30000,
    }

    app1.receiver.once('request/friend', meta => meta.$approve('foo'))
    await expect(postMeta(meta)).resolves.toMatchObject({ data: { approve: true, remark: 'foo' } })

    app1.receiver.once('request/friend', meta => meta.$reject('bar'))
    await expect(postMeta(meta)).resolves.toMatchObject({ data: { approve: false, reason: 'bar' } })

    meta.requestType = 'group'
    meta.subType = 'add'
    meta.groupId = 40000

    app1.receiver.once('request/group/add', meta => meta.$approve('foo'))
    await expect(postMeta(meta)).resolves.toMatchObject({ data: { approve: true, remark: 'foo' } })

    app1.receiver.once('request/group/add', meta => meta.$reject('bar'))
    await expect(postMeta(meta)).resolves.toMatchObject({ data: { approve: false, reason: 'bar' } })
  })

  test('operation timeout', async () => {
    await expect(postMeta({
      postType: 'request',
      requestType: 'friend',
      userId: 30000,
    })).resolves.toMatchObject({ data: {} })
  }, 200)
})
