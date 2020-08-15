import { App } from 'koishi-core'

let app1: App, app2: App
let server: HttpServer

before(async () => {
  server = await createHttpServer()
})

afterAll(() => server.close())

describe('Server Types', () => {
  test('server', () => {
    expect(() => new App()).to.throw()
    expect(() => new App({ type: 'foo' as any })).to.throw()
    expect(() => new App({ server: 'http:// ' })).not.to.throw()
  })
})

describe('Startup Checks', () => {
  beforeAll(() => app1 = server.createBoundApp())
  afterEach(() => app1.stop())

  test('= 4.0: get selfIds manually', async () => {
    const readyCallback = jest.fn()
    const app2 = server.createBoundApp({ selfId: undefined })
    app2.on('ready', readyCallback)
    server.setResponse('get_version_info', { pluginVersion: '4.0' })
    server.setResponse('get_login_info', { userId: 415 })
    await expect(app2.start()).resolves.toBeUndefined()
    expect(readyCallback).toBeCalledTimes(0)
    await expect(getSelfIds()).resolves.to.have.shape([514, 415])
    expect(readyCallback).toBeCalledTimes(1)
    await expect(getSelfIds()).resolves.to.have.shape([514, 415])
    expect(readyCallback).toBeCalledTimes(1)
    await app2.stop()
    // make coverage happy
    app2.prepare(415)
    expect(readyCallback).toBeCalledTimes(1)
    app2.destroy()
  })

  test('authorization', async () => {
    server.token = 'token'
    await expect(app1.start()).rejects.toHaveProperty('message', 'authorization failed')
    app1.options.token = 'nekot'
    await expect(app1.start()).rejects.toHaveProperty('message', 'authorization failed')
    app1.options.token = 'token'
    await expect(app1.start()).resolves.toBeUndefined()
  })
})
