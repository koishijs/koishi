import { MockedApp } from 'koishi-test-utils'
import { Meta } from 'koishi-core'
import { format } from 'util'
import { messages } from '../src/messages'

const app = new MockedApp()
const session1 = app.createSession('user', 789)
const session2 = app.createSession('group', 456, 321)

app.command('foo <text>', { checkArgCount: true })
  .shortcut('bar1', { args: ['bar'] })
  .shortcut('bar4', { oneArg: true, fuzzy: true })
  .action(({ session }, bar) => {
    return session.$send('foo' + bar)
  })

app.command('fooo', { checkUnknown: true })
  .shortcut('bar2', { options: { text: 'bar' } })
  .shortcut('bar3', { prefix: true, fuzzy: true })
  .option('-t, --text <bar>')
  .action(({ session, options }) => {
    return session.$send('fooo' + options.text)
  })


describe('Command Execution', () => {
  const session: Meta<'message'> = {
    userId: 789,
    selfId: app.selfId,
    postType: 'message',
    messageType: 'private',
  }

  // make coverage happy
  // equal to: app.server.parseMeta(session)
  app.executeCommandLine('', session)
  const send = session.$send = jest.fn()

  beforeEach(() => send.mockClear())

  test('app.executeCommandLine (nonexistent)', async () => {
    const next = jest.fn()
    await app.executeCommandLine('no-such-command', session, next)
    expect(send).toBeCalledTimes(0)
    expect(next).toBeCalledTimes(1)
  })

  test('context.runCommand (nonexistent)', async () => {
    await app.runCommand('no-such-command', session)
    expect(send).toBeCalledWith(messages.COMMAND_NOT_FOUND)
  })

  test('command error', async () => {
    const error = new Error('command error')
    app.command('error-command').action(() => { throw error })
    const errorCallback = jest.fn()
    const errorCommandCallback = jest.fn()
    app.on('error', errorCallback)
    app.on('error/command', errorCommandCallback)
    await app.executeCommandLine('error-command', session)
    expect(errorCallback).toBeCalledTimes(1)
    expect(errorCallback).toBeCalledWith(error)
    expect(errorCommandCallback).toBeCalledTimes(1)
    expect(errorCommandCallback).toBeCalledWith(error)
  })

  test('command events', async () => {
    app.command('skipped-command').action(({ next }) => next())
    const beforeCommandCallback = jest.fn()
    const afterCommandCallback = jest.fn()
    app.on('before-command', beforeCommandCallback)
    app.on('after-command', afterCommandCallback)
    await app.executeCommandLine('skipped-command', session)
    expect(beforeCommandCallback).toBeCalledTimes(1)
    expect(afterCommandCallback).toBeCalledTimes(0)
  })

  test('insufficient arguments', async () => {
    await app.runCommand('foo', session)
    expect(send).toBeCalledWith(messages.INSUFFICIENT_ARGUMENTS)
  })

  test('redundant arguments', async () => {
    await app.runCommand('foo', session, ['bar', 'baz'])
    expect(send).toBeCalledWith(messages.REDUNANT_ARGUMENTS)
  })

  test('required options', async () => {
    await app.runCommand('fooo', session)
    expect(send).toBeCalledWith(format(messages.REQUIRED_OPTIONS, '-t, --text <bar>'))
  })

  test('unknown options', async () => {
    await app.runCommand('fooo', session, [], { text: 'bar', test: 'baz' })
    expect(send).toBeCalledWith(format(messages.UNKNOWN_OPTIONS, 'test'))
  })
})

describe('shortcuts', () => {
  before(() => {
    app.options.prefix = '#'
  })

  after(() => {
    app.options.prefix = null
  })

  test('single shortcut', async () => {
    await session2.shouldHaveReply(' bar1 ', 'foobar')
    await session2.shouldHaveReply(' bar2 ', 'fooobar')
    await session2.shouldHaveNoReply('bar1 bar')
    await session2.shouldHaveNoReply('bar2 -t bar')
  })

  test('no command prefix', async () => {
    await session2.shouldHaveNoReply('#bar1')
    await session2.shouldHaveNoReply('#bar2')
    await session2.shouldHaveNoReply('#bar3')
    await session2.shouldHaveNoReply('#baz')
  })

  test('nickname prefix & fuzzy', async () => {
    await session2.shouldHaveNoReply('bar3 -t baz')
    await session2.shouldHaveReply(`[CQ:at,qq=${app.selfId}] bar3 -t baz`, 'fooobaz')
  })

  test('one argument & fuzzy', async () => {
    await session2.shouldHaveReply('bar4 bar baz', 'foobar baz')
    await session2.shouldHaveNoReply('bar4bar baz')
    await session2.shouldHaveReply(`[CQ:at,qq=${app.selfId}] bar4bar baz`, 'foobar baz')
  })
})
