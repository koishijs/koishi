import { Session, createMeta, createApp } from 'koishi-test-utils'
import { messages } from 'koishi-core'
import { format } from 'util'

const app = createApp()
const session2 = new Session(app, 'user', 789)
const session3 = new Session(app, 'group', 456, 321)

app.command('foo <text>', { checkArgCount: true })
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

    await session2.shouldHaveReply('foo bar', 'foobar')
    await session3.shouldHaveReply('foo bar', 'foobar')
    await session2.shouldHaveNoResponse('!foo bar')
    await session3.shouldHaveNoResponse('!foo bar')
    await session2.shouldHaveNoResponse('.foo bar')
    await session3.shouldHaveNoResponse('.foo bar')
  })

  test('single prefix', async () => {
    app.options.commandPrefix = '!'
    app.prepare()

    await session2.shouldHaveReply('foo bar', 'foobar')
    await session3.shouldHaveNoResponse('foo bar')
    await session2.shouldHaveReply('!foo bar', 'foobar')
    await session3.shouldHaveReply('!foo bar', 'foobar')
    await session2.shouldHaveNoResponse('.foo bar')
    await session3.shouldHaveNoResponse('.foo bar')
  })

  test('multiple prefixes', async () => {
    app.options.commandPrefix = ['!', '.']
    app.prepare()

    await session2.shouldHaveReply('foo bar', 'foobar')
    await session3.shouldHaveNoResponse('foo bar')
    await session2.shouldHaveReply('!foo bar', 'foobar')
    await session3.shouldHaveReply('!foo bar', 'foobar')
    await session2.shouldHaveReply('.foo bar', 'foobar')
    await session3.shouldHaveReply('.foo bar', 'foobar')
  })

  test('optional prefix', async () => {
    app.options.commandPrefix = ['.', '']
    app.prepare()

    await session2.shouldHaveReply('foo bar', 'foobar')
    await session3.shouldHaveReply('foo bar', 'foobar')
    await session2.shouldHaveNoResponse('!foo bar')
    await session3.shouldHaveNoResponse('!foo bar')
    await session2.shouldHaveReply('.foo bar', 'foobar')
    await session3.shouldHaveReply('.foo bar', 'foobar')
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
    await session2.shouldHaveReply('foo bar', 'foobar')
    await session3.shouldHaveNoResponse('foo bar')
    await session2.shouldHaveReply('-foo bar', 'foobar')
    await session3.shouldHaveReply('-foo bar', 'foobar')
    await session3.shouldHaveReply(`[CQ:at,qq=${app.selfId}] foo bar`, 'foobar')
  })

  test('single nickname', async () => {
    app.options.nickname = 'koishi'
    app.prepare()

    await session2.shouldHaveReply('koishi, foo bar', 'foobar')
    await session3.shouldHaveReply('koishi, foo bar', 'foobar')
    await session2.shouldHaveReply('koishi\n foo bar', 'foobar')
    await session3.shouldHaveReply('koishi\n foo bar', 'foobar')
    await session2.shouldHaveReply('@koishi foo bar', 'foobar')
    await session3.shouldHaveReply('@koishi foo bar', 'foobar')
    await session2.shouldHaveNoResponse('komeiji, foo bar')
    await session3.shouldHaveNoResponse('komeiji, foo bar')
  })

  test('multiple nicknames', async () => {
    app.options.nickname = ['komeiji', 'koishi']
    app.prepare()

    await session2.shouldHaveReply('foo bar', 'foobar')
    await session3.shouldHaveNoResponse('foo bar')
    await session2.shouldHaveReply('-foo bar', 'foobar')
    await session3.shouldHaveReply('-foo bar', 'foobar')
    await session2.shouldHaveReply('koishi, foo bar', 'foobar')
    await session3.shouldHaveReply('koishi, foo bar', 'foobar')
    await session2.shouldHaveReply('komeiji foo bar', 'foobar')
    await session3.shouldHaveReply('komeiji foo bar', 'foobar')
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

  test('excute command', async () => {
    await app.executeCommandLine('foo bar', meta)
    expect(mock).toBeCalledTimes(1)
    expect(mock).toBeCalledWith('foobar')
  })

  test('command error', async () => {
    const error = new Error('command error')
    app.command('error-command').action(() => { throw error })
    const errorCallback = jest.fn()
    const errorCommandCallback = jest.fn()
    app.receiver.on('error', errorCallback)
    app.receiver.on('error/command', errorCommandCallback)
    await app.executeCommandLine('error-command', meta)
    expect(errorCallback).toBeCalledTimes(1)
    expect(errorCallback).toBeCalledWith(error)
    expect(errorCommandCallback).toBeCalledTimes(1)
    expect(errorCommandCallback).toBeCalledWith(error)
  })

  test('command events', async () => {
    app.command('skipped-command').action(({ next }) => next())
    const beforeCommandCallback = jest.fn()
    const afterCommandCallback = jest.fn()
    app.receiver.on('before-command', beforeCommandCallback)
    app.receiver.on('after-command', afterCommandCallback)
    app.runCommand('skipped-command', meta)
    expect(beforeCommandCallback).toBeCalledTimes(1)
    expect(afterCommandCallback).toBeCalledTimes(0)
  })

  test('command not found', async () => {
    app.runCommand('bar', meta, ['foo'])
    expect(mock).toBeCalledTimes(1)
    expect(mock).toBeCalledWith(messages.COMMAND_NOT_FOUND)
    await app.executeCommandLine('bar', meta, mock)
    expect(mock).toBeCalledTimes(2)
  })

  test('insufficient arguments', async () => {
    await app.executeCommandLine('foo', meta)
    expect(mock).toBeCalledTimes(1)
    expect(mock).toBeCalledWith(messages.INSUFFICIENT_ARGUMENTS)
  })

  test('redunant arguments', async () => {
    await app.executeCommandLine('foo bar baz', meta)
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
    await session3.shouldHaveReply(' bar1 ', 'foobar')
    await session3.shouldHaveReply(' bar2 ', 'fooobar')
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
    await session3.shouldHaveReply(`[CQ:at,qq=${app.selfId}] bar3 -t baz`, 'fooobaz')
  })

  test('one argument & fuzzy', async () => {
    await session3.shouldHaveReply('bar4 bar baz', 'foobar baz')
    await session3.shouldHaveNoResponse('bar4bar baz')
    await session3.shouldHaveReply(`[CQ:at,qq=${app.selfId}] bar4bar baz`, 'foobar baz')
  })
})
