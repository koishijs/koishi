import { httpServer } from 'koishi-test-utils'
import { resolve } from 'path'
import { App } from 'koishi-core'
import { sleep, noop } from 'koishi-utils'
import del from 'del'
import help from '../src/help'
import 'koishi-database-level'

const { createApp, createServer, ServerSession } = httpServer

const path = resolve(__dirname, '../temp')

const server = createServer()
let app: App

jest.setTimeout(1000)

afterAll(() => {
  server.close()
  return del(path)
})

const COMMAND_CALLED = 'command called'
const session1 = new ServerSession('private', 123)
const session2 = new ServerSession('private', 456)

function prepare (app: App) {
  app.plugin(help)
  app.command('foo', 'command with options', { maxUsage: 100, minInterval: 1000 })
    .option('-o [value]', 'option', { authority: 2, notUsage: true })
    .action(({ meta }) => meta.$send(COMMAND_CALLED))
  app.command('help.foo', 'command without options', { authority: 2, noHelpOption: true })
    .action(noop)
  app.command('help/bar', 'command with usage and examples')
    .usage('usage text')
    .example('example 1')
    .example('example 2')
  app.command('bar.baz', 'command with alias and shortcut')
    .alias('baz-alias')
    .shortcut('baz-shortcut')
}

describe('help command', () => {
  beforeAll(async () => {
    app = createApp({
      database: { level: { path } }
    })
    prepare(app)
    await app.start()
    await app.database.getUser(123, 1)
    await app.database.getUser(456, 2)
  })

  afterAll(async () => {
    await app.stop()
    app.destroy()
  })

  test('show command help', async () => {
    await session1.testSnapshot('help -h')
    await session1.testSnapshot('help help')
    await session1.testSnapshot('bar -h')
    await session1.testSnapshot('foo -h')
    await session1.testSnapshot('help help -e')
    await session2.shouldHaveNoResponse('help.foo -h')
    await session2.testSnapshot('help help.foo')
  })

  test('alias and shortcut', async () => {
    await session1.testSnapshot('help baz-shortcut')
    await session1.testSnapshot('help baz-alias')
    await session1.testSnapshot('help baz')
  })

  test('global help message', async () => {
    await session1.testSnapshot('help')
    await session1.testSnapshot('help -e')
    await session1.testSnapshot('help -s')
  })

  test('show help with usage', async () => {
    await session1.shouldHaveResponse('foo', COMMAND_CALLED)
    await session1.testSnapshot('help foo')
    await sleep(0)
  })
})

test('help without database', async () => {
  app = createApp()
  prepare(app)
  await app.start()
  await session1.testSnapshot('help foo')
  await app.stop()
  app.destroy()
})
