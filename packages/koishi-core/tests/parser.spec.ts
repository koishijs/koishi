import { App, Command } from '../src'
import { errors } from '../src/messages'

const app = new App()

const cmd1 = app
  .command('cmd1 <foo> [...bar]')
  .option('-a, --alpha')
  .option('-b, --beta <beta>')

const cmd2 = app
  .command('cmd2 [foo] [bar...]')
  .option('-a [alpha]', '', { isString: true })
  .option('-b [beta]', '', { default: 1000 })
  .option('-C, --no-gamma')
  .option('-D, --no-delta')

describe('arguments', () => {
  test('sufficient arguments', () => {
    const result = cmd1.parse('foo bar 123')
    expect(result.args).toMatchObject(['foo', 'bar', '123'])
  })

  test('insufficient arguments', () => {
    const result = cmd1.parse('-a')
    expect(result.args).toMatchObject([])
  })

  test('hyphen-prefixed arguments', () => {
    const result = cmd1.parse('-a "-a"')
    expect(result.args).toMatchObject(['-a'])
  })

  test('skip rest part', () => {
    const result = cmd1.parse('foo bar baz -- 123 456')
    expect(result.rest).toBe('123 456')
    expect(result.args).toMatchObject(['foo', 'bar', 'baz'])
  })

  test('long argument', () => {
    const result = cmd2.parse('foo bar baz -- 123 456')
    expect(result.rest).toBe('')
    expect(result.args).toMatchObject(['foo', 'bar baz -- 123 456'])
  })
})

describe('options', () => {
  test('duplicate options', () => {
    expect(() => app
      .command('cmd-duplicate-options')
      .option('-a, --alpha')
      .option('-a, --aleph')
    ).toThrow(errors.DUPLICATE_OPTION)
  })

  test('option without parameter', () => {
    const result = cmd1.parse('--alpha a')
    expect(result.args).toMatchObject(['a'])
    expect(result.options).toMatchObject({ a: true, alpha: true })
  })

  test('option with parameter', () => {
    const result = cmd1.parse('--beta 10')
    expect(result.options).toMatchObject({ b: 10, beta: 10 })
  })

  test('quoted parameter', () => {
    const result = cmd1.parse('-c "" -d')
    expect(result.options).toMatchObject({ c: '', d: true })
  })

  test('unknown options', () => {
    const result = cmd1.parse('--unknown-gamma c -de 10')
    expect(result.unknown).toMatchObject(['unknown-gamma', 'd', 'e'])
    expect(result.options).toMatchObject({ unknownGamma: 'c', d: true, e: 10 })
  })

  test('negated options', () => {
    const result = cmd2.parse('-C --no-delta -E --no-epsilon')
    expect(result.options).toMatchObject({ C: true, gamma: false, D: true, delta: false, E: true, epsilon: false })
  })

  test('option configuration', () => {
    const result = cmd2.parse('-a 123 -d 456')
    expect(result.options).toMatchObject({ a: '123', b: 1000, d: 456 })
  })
})

describe('user fields', () => {
  const cmd = app.command('cmd-user-fields')
  expect(cmd._userFields).toHaveProperty('size', 0)
  cmd.userFields(['id', 'name'])
  expect(cmd._userFields).toHaveProperty('size', 2)
  cmd.userFields(new Set(['id', 'authority']))
  expect(cmd._userFields).toHaveProperty('size', 3)
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
    const result = cmd3.parse('-abc')
    expect(result.options).toMatchObject({ a: true, alphaBeta: true, b: true, noAlphaBeta: true, c: true, noGamma: true })
  })
})
