import { CLIENT_PORT, createServer, SERVER_URL, ServerSession } from 'koishi-test-utils'
import { App } from 'koishi-core'
import help from '../src/help'

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

app.plugin(help)
app.command('help.foo', 'FOO')
app.command('help/bar', 'BAR')
  .usage('usage text')
  .example('example 1')
  .example('example 2')
app.command('bar.baz', 'BAZ')

const session = new ServerSession('private', 'friend', { selfId: 123, userId: 456 })

describe('help command', () => {
  test('show command help', async () => {
    await session.testSnapshot('help -h')
    await session.testSnapshot('help help')
    await session.testSnapshot('bar -h')
    await session.testSnapshot('help bar')
  })

  test('global help message', async () => {
    await session.testSnapshot('help')
    await session.testSnapshot('help -e')
    await session.testSnapshot('help -s')
  })
})
