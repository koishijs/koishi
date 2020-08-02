import { onStart, onStop, startAll, stopAll, App, getSelfIds } from 'koishi-core'
import { HttpServer, createHttpServer } from 'koishi-test-utils'
import { errors } from '../src/messages'
import { format } from 'util'

let app1: App, app2: App
let server: HttpServer

beforeAll(async () => {
  server = await createHttpServer()
})

afterAll(() => server.close())

describe('Server Types', () => {
  test('server', () => {
    expect(() => new App({ type: 123 as any })).toThrow(errors.UNSUPPORTED_SERVER_TYPE)
    expect(() => new App({ type: 'foo' as any })).toThrow(errors.UNSUPPORTED_SERVER_TYPE)
    expect(() => new App({ type: 'http' })).toThrow(format(errors.MISSING_CONFIGURATION, 'port'))
    expect(() => new App({ type: 'ws' })).toThrow(format(errors.MISSING_CONFIGURATION, 'server'))
  })
})

describe('Lifecycle', () => {
  beforeAll(() => {
    app1 = new App()
    app2 = new App()
  })

  afterAll(() => {
    app1.destroy()
    app2.destroy()
  })

  test('app.version', () => {
    expect(app1.version).toBeFalsy()
  })

  test('onStart', async () => {
    const mock = jest.fn()
    onStart(mock)
    await startAll()
    expect(mock).toBeCalledTimes(1)
  })

  test('onStop', async () => {
    const mock = jest.fn()
    onStop(mock)
    await stopAll()
    expect(mock).toBeCalledTimes(1)
  })
})

describe('Startup Checks', () => {
  beforeAll(() => app1 = server.createBoundApp())
  afterEach(() => app1.stop())
  afterAll(() => app1.destroy())

  test('< 3.0: unsupported cqhttp version', async () => {
    server.setResponse('get_version_info', { pluginVersion: '2.9' })
    await expect(app1.start()).rejects.toHaveProperty('message', errors.UNSUPPORTED_CQHTTP_VERSION)
  })

  test('< 3.4: automatically get selfId', async () => {
    const app2 = server.createBoundApp({ selfId: undefined })
    server.setResponse('get_version_info', { pluginVersion: '3.3' })
    server.setResponse('get_login_info', { userId: 415 })
    expect(app2.version).toBeFalsy()
    await expect(app1.start()).resolves.toBeUndefined()
    expect(app2.version.pluginVersion).toBe('3.3')
    expect(app2.selfId).toBe(415)
    app2.destroy()
    // make coverage happy
    app2.destroy()
  })

  test('< 3.4: multiple anonymous bots', async () => {
    server.setResponse('get_version_info', { pluginVersion: '3.3' })
    const app2 = server.createBoundApp({ selfId: undefined })
    const app3 = server.createBoundApp({ selfId: undefined })
    await expect(app1.start()).rejects.toHaveProperty('message', errors.MULTIPLE_ANONYMOUS_BOTS)
    app2.destroy()
    app3.destroy()
  })

  test('= 4.0: get selfIds manually', async () => {
    const readyCallback = jest.fn()
    const app2 = server.createBoundApp({ selfId: undefined })
    app2.on('ready', readyCallback)
    server.setResponse('get_version_info', { pluginVersion: '4.0' })
    server.setResponse('get_login_info', { userId: 415 })
    await expect(app2.start()).resolves.toBeUndefined()
    expect(readyCallback).toBeCalledTimes(0)
    await expect(getSelfIds()).resolves.toMatchObject([514, 415])
    expect(readyCallback).toBeCalledTimes(1)
    await expect(getSelfIds()).resolves.toMatchObject([514, 415])
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
