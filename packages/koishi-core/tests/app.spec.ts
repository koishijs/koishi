import { onStart, onStop, startAll, stopAll, App, getSelfIds } from '../src'
import { createApp, createServer, emitter, setResponse } from 'koishi-test-utils/src/http-server'
import { errors } from '../src/messages'

let app1: App, app2: App
const server = createServer()

afterAll(() => {
  server.close()
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
    expect(app1.version).toBeUndefined()
  })

  test('onStart', async () => {
    const mock = jest.fn()
    onStart(mock)
    await startAll()
    expect(mock).toBeCalledTimes(1)
    expect(mock).toBeCalledWith(app1, app2)
  })

  test('onStop', async () => {
    const mock = jest.fn()
    onStop(mock)
    await stopAll()
    expect(mock).toBeCalledTimes(1)
  })
})

describe('Startup Checks', () => {
  // @ts-ignore
  beforeAll(() => app1 = createApp())
  afterEach(() => app1.stop())
  afterAll(() => app1.destroy())

  test('< 3.0', async () => {
    emitter.once('get_version_info', () => setResponse({ plugin_version: '2.9' }))
    await expect(app1.start()).rejects.toHaveProperty('message', errors.UNSUPPORTED_CQHTTP_VERSION)
  })

  test('< 3.4', async () => {
    const app2 = createApp({ selfId: undefined })
    emitter.once('get_version_info', () => setResponse({ plugin_version: '3.3' }))
    emitter.once('get_login_info', () => setResponse({ user_id: 415 }))
    await expect(app1.start()).resolves.toBeUndefined()
    expect(app2.version.pluginVersion).toBe('3.3')
    expect(app2.selfId).toBe(415)
    app2.destroy()
    // make coverage happy
    app2.destroy()
  })

  test('multiple anonymous bots', async () => {
    const app2 = createApp({ selfId: undefined })
    const app3 = createApp({ selfId: undefined })
    emitter.once('get_version_info', () => setResponse({ plugin_version: '3.3' }))
    await expect(app1.start()).rejects.toHaveProperty('message', errors.MULTIPLE_ANONYMOUS_BOTS)
    app2.destroy()
    app3.destroy()
  })

  test('get selfIds manually', async () => {
    const mock = jest.fn()
    const app2 = createApp({ selfId: undefined })
    app2.receiver.on('ready', mock)
    emitter.once('get_version_info', () => setResponse({ plugin_version: '4.0' }))
    emitter.once('get_login_info', () => setResponse({ user_id: 415 }))
    await expect(app2.start()).resolves.toBeUndefined()
    expect(mock).toBeCalledTimes(0)
    await expect(getSelfIds()).resolves.toMatchObject([514, 415])
    expect(mock).toBeCalledTimes(1)
    await expect(getSelfIds()).resolves.toMatchObject([514, 415])
    expect(mock).toBeCalledTimes(1)
    await app2.stop()
    // make coverage happy
    app2.prepare(415)
    expect(mock).toBeCalledTimes(1)
    app2.destroy()
  })

  test('authorization failed', async () => {
    emitter.once('get_version_info', () => setResponse({}, 401))
    await expect(app1.start()).rejects.toHaveProperty('message', 'authorization failed')
  })
})
