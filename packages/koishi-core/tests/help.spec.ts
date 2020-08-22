import { Session, MockedApp, utils } from 'koishi-test-utils'
import { noop } from 'koishi-utils'
import { help } from '../src'
import 'koishi-database-memory'

const MESSAGE_COMMAND_CALLED = 'command called'

function prepare(app: MockedApp) {
  app.plugin(help)
  app.command('foo', 'command with options', { maxUsage: 100, minInterval: 1000 })
    .option('-o [value]', 'option', { authority: 2, notUsage: true })
    .action(({ meta }) => meta.$send(MESSAGE_COMMAND_CALLED))
  app.command('help.foo', 'command without options', { authority: 2, noHelpOption: true })
    .action(noop)
  app.command('help/bar', 'command with usage and examples')
    .usage('usage text')
    .example('example 1')
    .example('example 2')
  app.command('bar.baz', 'command with alias and shortcut')
    .usage(() => 'usage text')
    .alias('baz-alias')
    .shortcut('baz-shortcut')
}

utils.getDateNumber.mockReturnValue(10000)

describe('help command', () => {
  let app: MockedApp, session1: Session, session2: Session

  beforeAll(async () => {
    app = new MockedApp({ database: { memory: {} } })
    prepare(app)
    await app.start()
    await app.database.getUser(123, 1)
    await app.database.getUser(456, 2)
    session1 = app.createSession('user', 123)
    session2 = app.createSession('user', 456)
  })

  afterAll(() => app.stop())

  test('show command help', async () => {
    await session1.shouldMatchSnapshot('help -h')
    await session1.shouldMatchSnapshot('help help')
    await session1.shouldMatchSnapshot('bar -h')
    await session1.shouldMatchSnapshot('foo -h')
    await session1.shouldMatchSnapshot('help help -e')
    await session2.shouldHaveNoReply('help.foo -h')
    await session2.shouldMatchSnapshot('help help.foo')
  })

  test('alias and shortcut', async () => {
    await session1.shouldMatchSnapshot('help baz-shortcut')
    await session1.shouldMatchSnapshot('help baz-alias')
    await session1.shouldMatchSnapshot('help baz')
  })

  test('global help message', async () => {
    await session1.shouldMatchSnapshot('help')
    await session1.shouldMatchSnapshot('help -e')
    await session1.shouldMatchSnapshot('help -s')
  })

  test('show help with usage', async () => {
    await session1.shouldHaveReply('foo', MESSAGE_COMMAND_CALLED)
    await session1.shouldMatchSnapshot('help foo')
  })
})

test('help without database', async () => {
  const app = new MockedApp()
  prepare(app)
  const session = app.createSession('user', 123)
  await app.start()
  await session.shouldMatchSnapshot('help foo')
  await app.stop()
})
