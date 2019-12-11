import { App, Command } from '../src'
import { ParsedLine } from '../src/parser'

let app: App, cmd1: Command, cmd2: Command, result: ParsedLine

jest.setTimeout(1000)

beforeAll(() => {
  app = new App()

  cmd1 = app
    .command('cmd1 <foo> [bar]')
    .option('-a, --alpha')
    .option('-b, --beta <beta>')

  cmd2 = app
    .command('cmd2 [foo] [bar...]')
    .option('-a [alpha]', '', { isString: true })
    .option('-b [beta]', '', { default: 1000 })
    .option('-C, --no-gamma')
    .option('-D, --no-delta')
})

describe('arguments', () => {
  test('sufficient arguments', () => {
    result = cmd1.parse('foo bar 123')
    expect(result.args).toMatchObject(['foo', 'bar', '123'])
  })

  test('insufficient arguments', () => {
    result = cmd1.parse('-a')
    expect(result.args).toMatchObject([])
  })

  test('hyphen-prefixed arguments', () => {
    result = cmd1.parse('-a "-a"')
    expect(result.args).toMatchObject(['-a'])
  })

  test('skip rest part', () => {
    result = cmd1.parse('foo bar baz -- 123 456')
    expect(result.rest).toBe('123 456')
    expect(result.args).toMatchObject(['foo', 'bar', 'baz'])
  })

  test('long argument', () => {
    result = cmd2.parse('foo bar baz -- 123 456')
    expect(result.rest).toBe('')
    expect(result.args).toMatchObject(['foo', 'bar baz -- 123 456'])
  })
})

describe('options', () => {
  test('option without parameter', () => {
    result = cmd1.parse('--alpha a')
    expect(result.args).toMatchObject(['a'])
    expect(result.options).toMatchObject({ a: true, alpha: true })
  })

  test('option with parameter', () => {
    result = cmd1.parse('--beta 10')
    expect(result.options).toMatchObject({ b: 10, beta: 10 })
  })

  test('quoted parameter', () => {
    result = cmd1.parse('-c "" -d')
    expect(result.options).toMatchObject({ c: '', d: true })
  })

  test('unknown options', () => {
    result = cmd1.parse('--unknown-gamma c -de 10')
    expect(result.unknown).toMatchObject(['unknown-gamma', 'd', 'e'])
    expect(result.options).toMatchObject({ unknownGamma: 'c', d: true, e: 10 })
  })

  test('negated options', () => {
    result = cmd2.parse('-C --no-delta -E --no-epsilon')
    expect(result.options).toMatchObject({ C: true, gamma: false, D: true, delta: false, E: true, epsilon: false })
  })

  test('option configuration', () => {
    result = cmd2.parse('-a 123 -d 456')
    expect(result.options).toMatchObject({ a: '123', b: 1000, d: 456 })
  })
})

describe('edge cases', () => {
  let cmd3: Command

  beforeAll(() => {
    cmd3 = app
      .command('cmd3')
      .option('-a, --alpha-beta')
      .option('-b, --no-alpha-beta')
      .option('-c, --no-gamma', '', { noNegated: true })
  })

  test('no negated options', () => {
    result = cmd3.parse('-abc')
    expect(result.options).toMatchObject({ a: true, alphaBeta: true, b: true, noAlphaBeta: true, c: true, noGamma: true })
  })
})
