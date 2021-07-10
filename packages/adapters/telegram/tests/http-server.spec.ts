import { HttpServer, createHttpServer, BASE_SELF_ID } from '@koishijs/test-utils'
import { App, startAll, Meta } from 'koishi-core'
import getPort from 'get-port'

let server: HttpServer
let app1: App, app2: App
let port1: number, port2: number

const app1MessageCallback = jest.fn()
const app2MessageCallback = jest.fn()
const app1ConnectCallback = jest.fn()
const app2ConnectCallback = jest.fn()
const app1ReadyCallback = jest.fn()
const app2ReadyCallback = jest.fn()

beforeAll(async () => {
  server = await createHttpServer()
  port1 = server.koishiPort
  port2 = await getPort({ port: port1 + 1 })

  app1 = server.createBoundApp()
  app2 = server.createBoundApp({ selfId: undefined })
  server.createBoundApp({
    port: port2,
    selfId: BASE_SELF_ID + 2,
    secret: 'secret',
  })

  app1.on('message', app1MessageCallback)
  app2.on('message', app2MessageCallback)
  app1.on('connect', app1ConnectCallback)
  app2.on('connect', app2ConnectCallback)
  app1.on('ready', app1ReadyCallback)
  app2.on('ready', app2ReadyCallback)

  await startAll()
})

afterAll(() => server.close())

const shared: Meta = {
  postType: 'message',
  userId: 10000,
  messageType: 'private',
  subtype: 'friend',
  message: 'Hello',
}

describe('HTTP Server', () => {
  test('connect event', async () => {
    expect(app1ConnectCallback).toBeCalledTimes(1)
    expect(app2ConnectCallback).toBeCalledTimes(1)
    expect(app1ReadyCallback).toBeCalledTimes(1)
    expect(app2ReadyCallback).toBeCalledTimes(0)
  })

  test('request validation', async () => {
    await expect(server.post({ ...shared, selfId: BASE_SELF_ID + 2 }, port2)).rejects.toHaveProperty('response.status', 401)
    await expect(server.post({ ...shared, selfId: BASE_SELF_ID + 2 }, port2, 'foobar')).rejects.toHaveProperty('response.status', 403)
    await expect(server.post({ ...shared, selfId: BASE_SELF_ID - 1 }, port2, 'secret')).rejects.toHaveProperty('response.status', 403)
    await expect(server.post({ ...shared, selfId: BASE_SELF_ID + 2 }, port2, 'secret')).resolves.toHaveProperty('status', 200)
  })

  test('app binding', async () => {
    await server.post(shared)
    expect(app1MessageCallback).toBeCalledTimes(1)
    expect(app2MessageCallback).toBeCalledTimes(0)

    expect(app2.selfId).not.to.be.ok
    await server.post({ ...shared, selfId: BASE_SELF_ID + 1 })
    expect(app1MessageCallback).toBeCalledTimes(1)
    expect(app2MessageCallback).toBeCalledTimes(1)
    expect(app2.selfId).to.equal(BASE_SELF_ID + 1)
    expect(app2ReadyCallback).toBeCalledTimes(1)
  })
})

describe('Quick Operations', () => {
  beforeAll(() => app1.options.quickOperationTimeout = 50)
  afterAll(() => app1.options.quickOperationTimeout = 0)

  const messageMeta: Meta = {
    postType: 'message',
    userId: 10000,
    groupId: 20000,
    messageType: 'group',
    subtype: 'normal',
    message: 'Hello',
  }

  const frientRequestMeta: Meta = {
    postType: 'request',
    requestType: 'friend',
    userId: 30000,
  }

  const groupRequestMeta: Meta = {
    ...frientRequestMeta,
    requestType: 'group',
    subtype: 'add',
    groupId: 40000,
  }

  test('message event', async () => {
    app1.once('message', meta => meta.send('foo'))
    await expect(server.post(messageMeta)).resolves.to.have.shape({ data: { reply: 'foo' } })

    app1.groups.once('message', meta => meta.$ban())
    await expect(server.post(messageMeta)).resolves.to.have.shape({ data: { ban: true } })

    app1.groups.once('message', meta => meta.$delete())
    await expect(server.post(messageMeta)).resolves.to.have.shape({ data: { delete: true } })

    app1.groups.once('message', meta => meta.$kick())
    await expect(server.post(messageMeta)).resolves.to.have.shape({ data: { kick: true } })
  })

  test('request event', async () => {
    app1.once('request/friend', meta => meta.$approve('foo'))
    await expect(server.post(frientRequestMeta)).resolves.to.have.shape({ data: { approve: true, remark: 'foo' } })

    app1.once('request/friend', meta => meta.$reject())
    await expect(server.post(frientRequestMeta)).resolves.to.have.shape({ data: { approve: false } })

    app1.once('request/group/add', meta => meta.$approve())
    await expect(server.post(groupRequestMeta)).resolves.to.have.shape({ data: { approve: true } })

    app1.once('request/group/add', meta => meta.$reject('bar'))
    await expect(server.post(groupRequestMeta)).resolves.to.have.shape({ data: { approve: false, reason: 'bar' } })
  })

  test('operation timeout', async () => {
    await expect(server.post(frientRequestMeta)).resolves.to.have.shape({ data: {} })
  }, 100)
})
