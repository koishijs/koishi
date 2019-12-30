import { createApp, createServer, ServerSession } from 'koishi-test-utils/src/http-server'
import { Server } from 'http'
import help from '../src/help'

let server: Server
const app = createApp()

jest.setTimeout(1000)

beforeAll(() => {
  server = createServer()
  return app.start()
})

afterAll(() => {
  server.close()
  return app.stop()
})

app.plugin(help)
app.command('help.foo', 'FOO')
app.command('help/bar', 'BAR')
  .usage('usage text')
  .example('example 1')
  .example('example 2')
app.command('bar.baz', 'BAZ')

const session = new ServerSession('private', 456)

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
