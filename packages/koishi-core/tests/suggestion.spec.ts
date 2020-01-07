import { Session, createApp, registerMemoryDatabase } from 'koishi-test-utils'
import { messages, showSuggestions } from 'koishi-core'
import { format } from 'util'

registerMemoryDatabase()

describe('Command Suggestions', () => {
  const app = createApp()
  const session1 = new Session(app, 'user', 456)
  const session2 = new Session(app, 'group', 789, 987)
  
  app.command('foo <text>', { checkArgCount: true })
    .action(({ meta }, bar) => {
      return meta.$send('foo' + bar)
    })
  
  app.command('fooo', { checkUnknown: true, checkRequired: true })
    .option('-t, --text <bar>')
    .action(({ meta, options }) => {
      return meta.$send('fooo' + options.text)
    })

  const expectedSuggestionText = [
    messages.COMMAND_SUGGESTION_PREFIX,
    format(messages.SUGGESTION_TEXT, '“foo”'),
    messages.COMMAND_SUGGESTION_SUFFIX,
  ].join('')

  const expectedSuggestionText2 = [
    messages.COMMAND_SUGGESTION_PREFIX,
    format(messages.SUGGESTION_TEXT, '“fooo”'),
    messages.COMMAND_SUGGESTION_SUFFIX,
  ].join('')

  test('execute command', async () => {
    await session1.shouldHaveReply('foo bar', 'foobar')
    await session1.shouldHaveNoResponse(' ')
  })

  test('no suggestions found', async () => {
    await session1.shouldHaveNoResponse('bar foo')
  })

  test('apply suggestions 1', async () => {
    await session1.shouldHaveReply('fo bar', expectedSuggestionText)
    await session2.shouldHaveReply('fooo -t bar')
    await session1.shouldHaveReply(' ', 'foobar')
    await session1.shouldHaveNoResponse(' ')
  })

  test('apply suggestions 2', async () => {
    await session2.shouldHaveReply('foooo -t bar', expectedSuggestionText2)
    await session1.shouldHaveReply('foo bar')
    await session2.shouldHaveReply(' ', 'fooobar')
    await session2.shouldHaveNoResponse(' ')
  })

  test('ignore suggestions 1', async () => {
    await session1.shouldHaveReply('fo bar', expectedSuggestionText)
    await session1.shouldHaveNoResponse('bar foo')
    await session1.shouldHaveNoResponse(' ')
  })

  test('ignore suggestions 2', async () => {
    await session2.shouldHaveReply('fo bar', expectedSuggestionText)
    await session2.shouldHaveReply('foo bar')
    await session2.shouldHaveNoResponse(' ')
  })

  test('multiple suggestions', async () => {
    await session1.shouldHaveReply('fool bar', [
      messages.COMMAND_SUGGESTION_PREFIX,
      format(messages.SUGGESTION_TEXT, '“foo”或“fooo”'),
    ].join(''))
    await session1.shouldHaveNoResponse(' ')
  })
})

describe('Custom Suggestions', () => {
  const app = createApp({ database: { memory: {} } })
  const session = new Session(app, 'group', 123, 456)
  const command = app.command('echo [message]', { authority: 0 })
    .action(({ meta }, message) => meta.$send('text:' + message))

  app.middleware((meta, next) => showSuggestions({
    target: meta.message,
    items: ['foo', 'bar'],
    meta,
    next,
    prefix: 'prefix',
    suffix: 'suffix',
    command,
    execute: (suggestion, meta) => command.execute({ args: [suggestion], meta }),
  }))

  beforeEach(() => app.database.getGroup(456, 514))

  test('show suggestions', async () => {
    await session.shouldHaveNoResponse(' ')
    await session.shouldHaveReply('for', `prefix${format(messages.SUGGESTION_TEXT, '“foo”')}suffix`)
    await session.shouldHaveReply(' ', 'text:foo')
  })
})
