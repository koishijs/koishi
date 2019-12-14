import { CLIENT_PORT, createServer, postMeta, createMeta, waitFor, SERVER_URL } from 'koishi-test-utils'
import { App } from 'koishi-core'
import help, * as messages from '../src/help'

const app = new App({
  type: 'http',
  port: CLIENT_PORT,
  server: SERVER_URL,
}).plugin(help)

const server = createServer()

jest.setTimeout(1000)

beforeAll(() => app.start())

afterAll(() => {
  app.stop()
  server.close()
})

describe('help', () => {
  test('global help message', async () => {
    await postMeta(createMeta('message', 'private', 'friend', {
      message: 'help',
      selfId: 123,
      userId: 456,
    }))

    await expect(waitFor('send_private_msg')).resolves.toHaveProperty('message', [
      messages.GLOBAL_HELP_PROLOGUE,
      '    help (0)  显示帮助信息',
      messages.GLOBAL_HELP_EPILOGUE,
    ].join('\n'))
  })
})
