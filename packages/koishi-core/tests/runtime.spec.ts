import { createApp, createServer, ServerSession, createMeta } from 'koishi-test-utils'
import { errors, messages } from '../src/messages'
import { App } from '../src'
import { format } from 'util'

const app = createApp()
const server = createServer()

jest.setTimeout(1000)

beforeAll(() => app.start())

afterAll(() => {
  app.stop()
  server.close()
})

app.command('foo <text>', { checkArgCount: true })
  .action(({ meta }, bar) => {
    return meta.$send('foo' + bar)
  })

app.command('fooo [text]', { checkUnknown: true, checkRequired: true })
  .option('-t, --text <bar>')
  .action(({ meta, options }) => {
    return meta.$send('fooo' + options.text)
  })

app.command('err')
  .action(() => {
    throw new Error('command error')
  })

const session1 = new ServerSession('private', 'friend', { userId: 456 })
const session2 = new ServerSession('private', 'friend', { userId: 789 })

describe('configurations', () => {
  test('server', () => {
    expect(() => new App({ type: 123 as any })).toThrow(errors.UNSUPPORTED_SERVER_TYPE)
    expect(() => new App({ type: 'foo' as any })).toThrow(errors.UNSUPPORTED_SERVER_TYPE)
    expect(() => new App({ type: 'http' })).toThrow(format(errors.MISSING_CONFIGURATION, 'port'))
    expect(() => new App({ type: 'ws' })).toThrow(format(errors.MISSING_CONFIGURATION, 'server'))
  })
})

describe('command execution', () => {
  const mock = jest.fn()
  const meta = createMeta('message', 'group', 'normal', { $ctxId: 321, $ctxType: 'group', groupId: 456, userId: 123, $send: mock })

  beforeEach(() => mock.mockClear())

  test('excute command', () => {
    app.runCommand('foo', meta, ['bar'])
    expect(mock).toBeCalledTimes(1)
    expect(mock).toBeCalledWith('foobar')
  })

  test('command not found', () => {
    app.runCommand('bar', meta, ['foo'])
    expect(mock).toBeCalledTimes(1)
    expect(mock).toBeCalledWith(messages.COMMAND_NOT_FOUND)
  })

  test('insufficient arguments', () => {
    app.runCommand('foo', meta)
    expect(mock).toBeCalledTimes(1)
    expect(mock).toBeCalledWith(messages.INSUFFICIENT_ARGUMENTS)
  })

  test('redunant arguments', () => {
    app.runCommand('foo', meta, ['bar', 'baz'])
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

describe('suggestions', () => {
  const expectedSuggestionText = [
    messages.COMMAND_SUGGESTION_PREFIX,
    format(messages.SUGGESTION_TEXT, '“foo”'),
    messages.COMMAND_SUGGESTION_SUFFIX,
  ].join('')

  test('execute command', async () => {
    await session1.shouldHaveResponse('foo bar', 'foobar')
    await session1.shouldHaveNoResponse(' ')
  })

  test('no suggestions found', async () => {
    await session1.shouldHaveNoResponse('bar foo')
  })

  test('apply suggestions', async () => {
    await session1.shouldHaveResponse('fo bar', expectedSuggestionText)
    await session2.waitForResponse('fooo -t bar')
    await session1.shouldHaveResponse(' ', 'foobar')
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
