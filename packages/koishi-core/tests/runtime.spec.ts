import { httpServer } from 'koishi-test-utils'
import { errors, messages } from '../src/messages'
import { App } from '../src'
import { format } from 'util'

const { createApp, createServer, ServerSession, createMeta } = httpServer

const app = createApp()
const server = createServer()

jest.setTimeout(1000)

beforeAll(() => app.start())

afterAll(() => {
  app.stop()
  server.close()
})

app.command('foo <text>', { checkArgCount: true })
  // make coverage happy
  .userFields(['name', 'flag', 'authority', 'usage'])
  .shortcut('bar1', { args: ['bar'] })
  .shortcut('bar4', { oneArg: true, fuzzy: true })
  .action(({ meta }, bar) => {
    return meta.$send('foo' + bar)
  })

app.command('fooo', { checkUnknown: true, checkRequired: true })
  .shortcut('bar2', { options: { text: 'bar' } })
  .shortcut('bar3', { prefix: true, fuzzy: true })
  .option('-t, --text <bar>')
  .action(({ meta, options }) => {
    return meta.$send('fooo' + options.text)
  })

app.command('err')
  .action(() => {
    throw new Error('command error')
  })

const session1 = new ServerSession('private', 456)
const session2 = new ServerSession('private', 789)
const session3 = new ServerSession('group', 456, { groupId: 321 })

describe('configurations', () => {
  test('server', () => {
    expect(() => new App({ type: 123 as any })).toThrow(errors.UNSUPPORTED_SERVER_TYPE)
    expect(() => new App({ type: 'foo' as any })).toThrow(errors.UNSUPPORTED_SERVER_TYPE)
    expect(() => new App({ type: 'http' })).toThrow(format(errors.MISSING_CONFIGURATION, 'port'))
    expect(() => new App({ type: 'ws' })).toThrow(format(errors.MISSING_CONFIGURATION, 'server'))
  })
})

describe('command prefix', () => {
  beforeAll(() => {
    app.options.similarityCoefficient = 0
  })

  afterAll(() => {
    app.options.commandPrefix = null
    app.options.similarityCoefficient = 0.4
    app.prepare()
  })

  test('no prefix', async () => {
    app.options.commandPrefix = null
    app.prepare()

    await session2.shouldHaveResponse('foo bar', 'foobar')
    await session3.shouldHaveResponse('foo bar', 'foobar')
    await session2.shouldHaveNoResponse('!foo bar')
    await session3.shouldHaveNoResponse('!foo bar')
    await session2.shouldHaveNoResponse('.foo bar')
    await session3.shouldHaveNoResponse('.foo bar')
  })

  test('single prefix', async () => {
    app.options.commandPrefix = '!'
    app.prepare()

    await session2.shouldHaveResponse('foo bar', 'foobar')
    await session3.shouldHaveNoResponse('foo bar')
    await session2.shouldHaveResponse('!foo bar', 'foobar')
    await session3.shouldHaveResponse('!foo bar', 'foobar')
    await session2.shouldHaveNoResponse('.foo bar')
    await session3.shouldHaveNoResponse('.foo bar')
  })

  test('multiple prefixes', async () => {
    app.options.commandPrefix = ['!', '.']
    app.prepare()

    await session2.shouldHaveResponse('foo bar', 'foobar')
    await session3.shouldHaveNoResponse('foo bar')
    await session2.shouldHaveResponse('!foo bar', 'foobar')
    await session3.shouldHaveResponse('!foo bar', 'foobar')
    await session2.shouldHaveResponse('.foo bar', 'foobar')
    await session3.shouldHaveResponse('.foo bar', 'foobar')
  })

  test('optional prefix', async () => {
    app.options.commandPrefix = ['.', '']
    app.prepare()

    await session2.shouldHaveResponse('foo bar', 'foobar')
    await session3.shouldHaveResponse('foo bar', 'foobar')
    await session2.shouldHaveNoResponse('!foo bar')
    await session3.shouldHaveNoResponse('!foo bar')
    await session2.shouldHaveResponse('.foo bar', 'foobar')
    await session3.shouldHaveResponse('.foo bar', 'foobar')
  })
})

describe('nickname prefix', () => {
  beforeAll(() => {
    app.options.similarityCoefficient = 0
    app.options.commandPrefix = '-'
    app.prepare()
  })

  afterAll(() => {
    app.options.similarityCoefficient = 0.4
    app.options.commandPrefix = null
    app.prepare()
  })

  test('no nickname', async () => {
    await session2.shouldHaveResponse('foo bar', 'foobar')
    await session3.shouldHaveNoResponse('foo bar')
    await session2.shouldHaveResponse('-foo bar', 'foobar')
    await session3.shouldHaveResponse('-foo bar', 'foobar')
    await session3.shouldHaveResponse(`[CQ:at,qq=${app.selfId}] foo bar`, 'foobar')
  })

  test('single nickname', async () => {
    app.options.nickname = 'koishi'
    app.prepare()

    await session2.shouldHaveResponse('koishi, foo bar', 'foobar')
    await session3.shouldHaveResponse('koishi, foo bar', 'foobar')
    await session2.shouldHaveResponse('koishi\n foo bar', 'foobar')
    await session3.shouldHaveResponse('koishi\n foo bar', 'foobar')
    await session2.shouldHaveResponse('@koishi foo bar', 'foobar')
    await session3.shouldHaveResponse('@koishi foo bar', 'foobar')
    await session2.shouldHaveNoResponse('komeiji, foo bar')
    await session3.shouldHaveNoResponse('komeiji, foo bar')
  })

  test('multiple nicknames', async () => {
    app.options.nickname = ['komeiji', 'koishi']
    app.prepare()

    await session2.shouldHaveResponse('foo bar', 'foobar')
    await session3.shouldHaveNoResponse('foo bar')
    await session2.shouldHaveResponse('-foo bar', 'foobar')
    await session3.shouldHaveResponse('-foo bar', 'foobar')
    await session2.shouldHaveResponse('koishi, foo bar', 'foobar')
    await session3.shouldHaveResponse('koishi, foo bar', 'foobar')
    await session2.shouldHaveResponse('komeiji foo bar', 'foobar')
    await session3.shouldHaveResponse('komeiji foo bar', 'foobar')
  })
})

describe('command execution', () => {
  const mock = jest.fn()
  const meta = createMeta('message', 'group', 'normal', { $ctxId: 321, $ctxType: 'group', groupId: 456, userId: 123, $send: mock })

  beforeEach(() => mock.mockClear())

  test('get command', () => {
    expect(app.getCommand('foo', meta)).toBe(app.command('foo'))
    expect(app.getCommand('fo', meta)).toBeUndefined()
  })

  test('excute command', () => {
    app.executeCommandLine('foo bar', meta)
    expect(mock).toBeCalledTimes(1)
    expect(mock).toBeCalledWith('foobar')
  })

  test('command error', () => {
    const mock1 = jest.fn()
    const mock2 = jest.fn()
    app.receiver.on('error', mock1)
    app.receiver.on('error/command', mock2)
    app.executeCommandLine('err', meta)
    expect(mock1).toBeCalledTimes(1)
    expect(mock1.mock.calls[0][0]).toHaveProperty('message', 'command error')
    expect(mock2).toBeCalledTimes(1)
    expect(mock2.mock.calls[0][0]).toHaveProperty('message', 'command error')
  })

  test('command not found', () => {
    app.runCommand('bar', meta, ['foo'])
    expect(mock).toBeCalledTimes(1)
    expect(mock).toBeCalledWith(messages.COMMAND_NOT_FOUND)
    app.executeCommandLine('bar', meta, mock)
    expect(mock).toBeCalledTimes(2)
  })

  test('insufficient arguments', () => {
    app.executeCommandLine('foo', meta)
    expect(mock).toBeCalledTimes(1)
    expect(mock).toBeCalledWith(messages.INSUFFICIENT_ARGUMENTS)
  })

  test('redunant arguments', () => {
    app.executeCommandLine('foo bar baz', meta)
    expect(mock).toBeCalledTimes(1)
    expect(mock).toBeCalledWith(messages.REDUNANT_ARGUMENTS)
  })

  test('unknown options', () => {
    app.runCommand('fooo', meta, [], { text: 'bar', test: 'baz' })
    expect(mock).toBeCalledTimes(1)
    expect(mock).toBeCalledWith(format(messages.UNKNOWN_OPTIONS, 'test'))
  })

  test('required options', () => {
    app.runCommand('fooo', meta)
    expect(mock).toBeCalledTimes(1)
    expect(mock).toBeCalledWith(format(messages.REQUIRED_OPTIONS, '-t, --text <bar>'))
  })
})

describe('shortcuts', () => {
  beforeAll(() => {
    app.options.commandPrefix = '#'
    app.prepare()
  })

  afterAll(() => {
    app.options.commandPrefix = null
    app.prepare()
  })

  test('single shortcut', async () => {
    await session3.shouldHaveResponse(' bar1 ', 'foobar')
    await session3.shouldHaveResponse(' bar2 ', 'fooobar')
    await session3.shouldHaveNoResponse('bar1 bar')
    await session3.shouldHaveNoResponse('bar2 -t bar')
  })

  test('no command prefix', async () => {
    await session3.shouldHaveNoResponse('#bar1')
    await session3.shouldHaveNoResponse('#bar2')
    await session3.shouldHaveNoResponse('#bar3')
    await session3.shouldHaveNoResponse('#baz')
  })

  test('nickname prefix & fuzzy', async () => {
    await session3.shouldHaveNoResponse('bar3 -t baz')
    await session3.shouldHaveResponse(`[CQ:at,qq=${app.selfId}] bar3 -t baz`, 'fooobaz')
  })

  test('one argument & fuzzy', async () => {
    await session3.shouldHaveResponse('bar4 bar baz', 'foobar baz')
    await session3.shouldHaveNoResponse('bar4bar baz')
    await session3.shouldHaveResponse(`[CQ:at,qq=${app.selfId}] bar4bar baz`, 'foobar baz')
  })
})

describe('suggestions', () => {
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
    await session1.shouldHaveResponse('foo bar', 'foobar')
    await session1.shouldHaveNoResponse(' ')
  })

  test('no suggestions found', async () => {
    await session1.shouldHaveNoResponse('bar foo')
  })

  test('apply suggestions 1', async () => {
    await session1.shouldHaveResponse('fo bar', expectedSuggestionText)
    await session2.waitForResponse('fooo -t bar')
    await session1.shouldHaveResponse(' ', 'foobar')
    await session1.shouldHaveNoResponse(' ')
  })

  test('apply suggestions 2', async () => {
    await session1.shouldHaveResponse('foooo -t bar', expectedSuggestionText2)
    await session2.waitForResponse('foo bar')
    await session1.shouldHaveResponse(' ', 'fooobar')
    await session1.shouldHaveNoResponse(' ')
  })

  test('ignore suggestions 1', async () => {
    await session1.shouldHaveResponse('fo bar', expectedSuggestionText)
    await session1.shouldHaveNoResponse('bar foo')
    await session1.shouldHaveNoResponse(' ')
  })

  test('ignore suggestions 2', async () => {
    await session1.shouldHaveResponse('fo bar', expectedSuggestionText)
    await session1.waitForResponse('foo bar')
    await session1.shouldHaveNoResponse(' ')
  })

  test('multiple suggestions', async () => {
    await session1.shouldHaveResponse('fool bar', [
      messages.COMMAND_SUGGESTION_PREFIX,
      format(messages.SUGGESTION_TEXT, '“foo”或“fooo”'),
    ].join(''))
    await session1.shouldHaveNoResponse(' ')
  })
})
