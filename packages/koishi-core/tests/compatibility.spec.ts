import { createApp, createServer, emitter, setResponse } from 'koishi-test-utils'
import { errors } from '../src/messages'

const app = createApp()
const server = createServer()

afterAll(() => {
  server.close()
})

describe('Startup Checks', () => {
  afterEach(() => app.stop())

  test('< 3.0', async () => {
    emitter.once('get_version_info', () => setResponse({ plugin_version: '2.9' }))
    await expect(app.start()).rejects.toHaveProperty('message', errors.UNSUPPORTED_CQHTTP_VERSION)
  })

  test('< 3.4', async () => {
    const app2 = createApp({ selfId: undefined })
    emitter.once('get_version_info', () => setResponse({ plugin_version: '3.3' }))
    emitter.once('get_login_info', () => setResponse({ user_id: 415 }))
    await expect(app.start()).resolves.toBeUndefined()
    expect(app2.selfId).toBe(415)
  })

  test('authorization failed', async () => {
    emitter.once('get_version_info', () => setResponse({}, 401))
    await expect(app.start()).rejects.toHaveProperty('message', 'authorization failed')
  })
})
