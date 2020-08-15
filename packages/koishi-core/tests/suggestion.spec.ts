import { MockedApp } from 'koishi-test-utils'
import { showSuggestions } from 'koishi-core'
import { format } from 'util'
import { messages } from '../src/messages'
import 'koishi-database-memory'

describe('Command Suggestions', () => {
  const app = new MockedApp()
  const session1 = app.createSession('user', 456)
  const session2 = app.createSession('group', 789, 987)

  app.command('foo <text>', { checkArgCount: true })
    .action(({ session }, bar) => {
      return session.$send('foo' + bar)
    })

  app.command('fooo', { checkUnknown: true, checkRequired: true })
    .alias('bool')
    .option('-t, --text <bar>')
    .action(({ session, options }) => {
      return session.$send('fooo' + options.text)
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
    await session1.shouldHaveNoReply(' ')
  })

  test('no suggestions found', async () => {
    await session1.shouldHaveNoReply('bar foo')
  })

  test('apply suggestions 1', async () => {
    await session1.shouldHaveReply('fo bar', expectedSuggestionText)
    await session2.shouldHaveReply('fooo -t bar')
    await session1.shouldHaveReply(' ', 'foobar')
    await session1.shouldHaveNoReply(' ')
  })

  test('apply suggestions 2', async () => {
    await session2.shouldHaveReply('foooo -t bar', expectedSuggestionText2)
    await session1.shouldHaveReply('foo bar')
    await session2.shouldHaveReply(' ', 'fooobar')
    await session2.shouldHaveNoReply(' ')
  })

  test('ignore suggestions 1', async () => {
    await session1.shouldHaveReply('fo bar', expectedSuggestionText)
    await session1.shouldHaveNoReply('bar foo')
    await session1.shouldHaveNoReply(' ')
  })

  test('ignore suggestions 2', async () => {
    await session2.shouldHaveReply('fo bar', expectedSuggestionText)
    await session2.shouldHaveReply('foo bar')
    await session2.shouldHaveNoReply(' ')
  })

  test('multiple suggestions', async () => {
    await session1.shouldHaveReply('fool bar', [
      messages.COMMAND_SUGGESTION_PREFIX,
      format(messages.SUGGESTION_TEXT, '“foo”或“fooo”或“bool”'),
    ].join(''))
    await session1.shouldHaveNoReply(' ')
  })
})

describe('Custom Suggestions with Arguments', () => {
  const app = new MockedApp({ database: { memory: {} } })
  const session = app.createSession('group', 123, 456)
  const command = app.command('echo [message]', { authority: 0 })
    .action(({ session }, message) => session.$send('text:' + message))

  app.middleware((session, next) => showSuggestions({
    target: session.message,
    items: ['foo', 'bar'],
    session,
    next,
    prefix: 'prefix',
    suffix: 'suffix',
    command,
    execute: (message, session) => command.execute({ args: [message], session }),
  }))

  before(async () => {
    await app.start()
    await app.database.getGroup(456, 514)
  })

  test('show suggestions', async () => {
    await session.shouldHaveNoReply(' ')
    await session.shouldHaveReply('for', `prefix${format(messages.SUGGESTION_TEXT, '“foo”')}suffix`)
    await session.shouldHaveReply(' ', 'text:foo')
  })
})

describe('Custom Suggestions with Options', () => {
  const app = new MockedApp({ database: { memory: {} } })
  const session = app.createSession('group', 123, 456)
  const command = app.command('echo', { authority: 0 })
    .option('-m, --message <message>')
    .action(({ session, options }) => session.$send('text:' + options.message))

  app.middleware((session, next) => showSuggestions({
    target: session.message,
    items: ['foo', 'bar'],
    session,
    next,
    prefix: 'prefix',
    suffix: 'suffix',
    command,
    execute: (message, session) => command.execute({ options: { message }, session }),
  }))

  before(async () => {
    await app.start()
    await app.database.getGroup(456, 514)
  })

  test('show suggestions', async () => {
    await session.shouldHaveNoReply(' ')
    await session.shouldHaveReply('for', `prefix${format(messages.SUGGESTION_TEXT, '“foo”')}suffix`)
    await session.shouldHaveReply(' ', 'text:foo')
  })
})
