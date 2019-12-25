import { CLIENT_PORT, createServer, SERVER_URL, ServerSession } from 'koishi-test-utils'
import { App } from 'koishi-core/src'

const app = new App({
  type: 'http',
  port: CLIENT_PORT,
  server: SERVER_URL,
})

const server = createServer()

jest.setTimeout(1000)

beforeAll(() => app.start())

afterAll(() => {
  app.stop()
  server.close()
})

app.command('foo [text]')
  .action(({ meta }, bar) => {
    return meta.$send('' + bar)
  })

const session = new ServerSession('private', 'friend', { selfId: 123, userId: 456 })

describe('apply suggestions', () => {
  test('show command help', async () => {
    await session.testSnapshot('fo bar')
    await session.testSnapshot(' ')
  })
})
