import { Command } from 'koishi-core'
import { App } from 'koishi-test-utils'
import { inspect } from 'util'

const app = new App()

let cmd: Command

describe('command', () => {
  test('register', () => {
    // there is a built-in help command
    expect(app._commands).toHaveLength(1)

    cmd = app.command('cmd1 <foo> [...bar]')
    expect(app._commands).toHaveLength(2)
  })

  test('inspect', () => {
    expect(inspect(cmd)).toBe('Command <cmd1>')
  })

  test('parse arguments', () => {
    expect(cmd.parse('')).toMatchObject({ args: [] })
    expect(cmd.parse('a')).toMatchObject({ args: ['a'] })
    expect(cmd.parse('a b')).toMatchObject({ args: ['a', 'b'] })
    expect(cmd.parse('a b c')).toMatchObject({ args: ['a', 'b', 'c'] })
  })

  test('dispose', () => {
    cmd.dispose()
    expect(app._commands).toHaveLength(1)
  })
})

describe('option', () => {
  test('register', () => {
    cmd = app.command('cmd2 <foo> [bar...]')
    cmd.option('alpha', '-a')
    cmd.option('beta', '-b <beta>')
    cmd.option('gamma', '-c <gamma>', { fallback: 0 })
    cmd.option('delta', '-d <gamma>', { type: 'string' })
  })

  test('option parser', () => {
    expect(cmd.parse('--alpha')).toMatchObject({ options: { alpha: true } })
    expect(cmd.parse('--beta')).toMatchObject({ options: { beta: true } })
    expect(cmd.parse('--no-alpha')).toMatchObject({ options: { alpha: false } })
    expect(cmd.parse('--no-beta')).toMatchObject({ options: { beta: false } })
    expect(cmd.parse('--alpha 1')).toMatchObject({ options: { alpha: true } })
    expect(cmd.parse('--beta 1')).toMatchObject({ options: { beta: 1 } })
    expect(cmd.parse('--beta "1"')).toMatchObject({ options: { beta: 1 } })
    expect(cmd.parse('--beta -1')).toMatchObject({ options: { beta: true } })
  })

  test('typed options', () => {
    expect(cmd.parse('')).toMatchObject({ options: { gamma: 0 } })
    expect(cmd.parse('--gamma')).toMatchObject({ options: { gamma: 0 } })
    expect(cmd.parse('--gamma 1')).toMatchObject({ options: { gamma: 1 } })
    expect(cmd.parse('--gamma -1')).toMatchObject({ options: { gamma: -1 } })
    expect(cmd.parse('--gamma a')).toMatchObject({ options: { gamma: NaN } })
    expect(cmd.parse('--delta')).toMatchObject({ options: { delta: '' } })
    expect(cmd.parse('--delta 1')).toMatchObject({ options: { delta: '1' } })
    expect(cmd.parse('--delta -1')).toMatchObject({ options: { delta: '-1' } })
  })

  test('short alias', () => {
    expect(cmd.parse('-ab ""')).toMatchObject({ options: { alpha: true, beta: '' } })
    expect(cmd.parse('-ab=')).toMatchObject({ options: { alpha: true, beta: true } })
    expect(cmd.parse('-ab 1')).toMatchObject({ options: { alpha: true, beta: 1 } })
    expect(cmd.parse('-ab=1')).toMatchObject({ options: { alpha: true, beta: 1 } })
    expect(cmd.parse('-ab -1')).toMatchObject({ options: { alpha: true, beta: true } })
    expect(cmd.parse('-ab=-1')).toMatchObject({ options: { alpha: true, beta: -1 } })
  })

  test('greedy arguments', () => {
    expect(cmd.parse('')).toMatchObject({ args: [] })
    expect(cmd.parse('a')).toMatchObject({ args: ['a'] })
    expect(cmd.parse('a b')).toMatchObject({ args: ['a', 'b'] })
    expect(cmd.parse('a b c')).toMatchObject({ args: ['a', 'b c'] })
    expect(cmd.parse('-a b c')).toMatchObject({ args: ['b', 'c'] })
    expect(cmd.parse('a -b c')).toMatchObject({ args: ['a'] })
    expect(cmd.parse('a b -c')).toMatchObject({ args: ['a', 'b -c'] })
  })
})

describe('advanced', () => {
  test('symbol alias', () => {
    cmd = app.command('cmd3')
    cmd.option('sharp', '# <id>')
    expect(cmd.parse('# 1')).toMatchObject({ args: [], options: { sharp: 1 } })
  })

  test('remove option', () => {
    expect(cmd.removeOption('sharp' as never)).toBe(true)
    expect(cmd.parse('# 1')).toMatchObject({ args: ['#', '1'], options: {} })
    expect(cmd.removeOption('sharp' as never)).toBe(false)
  })

  test('rest option', () => {
    cmd.option('rest', '-- <rest...>')
    expect(cmd.parse('a b -- c d')).toMatchObject({ args: ['a', 'b'], options: { rest: 'c d' }, rest: '' })
    expect(cmd.parse('a "b -- c" d')).toMatchObject({ args: ['a', 'b -- c', 'd'], options: {}, rest: '' })
    expect(cmd.parse('a b -- "c d"')).toMatchObject({ args: ['a', 'b'], options: { rest: 'c d' }, rest: '' })
  })
})

// describe('arguments', () => {
//   test('sufficient arguments', () => {
//     expect(1).toBe(1)
    // const result = cmd1.parse('foo bar 123')
    // expect(result.args).toMatchObject(['foo', 'bar', '123'])
  // })

//   test('insufficient arguments', () => {
//     const result = cmd1.parse('-a')
//     expect(result.args).toMatchObject([])
//   })

//   test('hyphen-prefixed arguments', () => {
//     const result = cmd1.parse('-a "-a"')
//     expect(result.args).toMatchObject(['-a'])
//   })

//   test('skip rest part', () => {
//     const result = cmd1.parse('foo bar baz -- 123 456')
//     expect(result.rest).toBe('123 456')
//     expect(result.args).toMatchObject(['foo', 'bar', 'baz'])
//   })

//   test('long argument', () => {
//     const result = cmd2.parse('foo bar baz -- 123 456')
//     expect(result.rest).toBe('')
//     expect(result.args).toMatchObject(['foo', 'bar baz -- 123 456'])
//   })
// })

// describe('options', () => {
//   let result: ParsedLine

//   test('duplicate options', () => {
//     expect(() => app
//       .command('cmd-duplicate-options')
//       .option('-a, --alpha')
//       .option('-a, --aleph')
//     ).toThrow()
//   })

//   test('option without parameter', () => {
//     result = cmd1.parse('--alpha a')
//     expect(result.args).toMatchObject(['a'])
//     expect(result.options).toMatchObject({ a: true, alpha: true })
//   })

//   test('option with parameter', () => {
//     result = cmd1.parse('--beta 10')
//     expect(result.options).toMatchObject({ b: 10, beta: 10 })
//     result = cmd1.parse('--beta=10')
//     expect(result.options).toMatchObject({ b: 10, beta: 10 })
//   })

//   test('quoted parameter', () => {
//     result = cmd1.parse('-c "" -d')
//     expect(result.options).toMatchObject({ c: '', d: true })
//   })

//   test('unknown options', () => {
//     result = cmd1.parse('--unknown-gamma b --unknown-gamma c -de 10')
//     expect(result.unknown).toMatchObject(['unknown-gamma', 'd', 'e'])
//     expect(result.options).toMatchObject({ unknownGamma: 'c', d: true, e: 10 })
//   })

//   test('negated options', () => {
//     result = cmd2.parse('-C --no-delta -E --no-epsilon')
//     expect(result.options).toMatchObject({ C: true, gamma: false, D: true, delta: false, E: true, epsilon: false })
//   })

//   test('option configuration', () => {
//     result = cmd2.parse('-ba 123')
//     expect(result.options).toMatchObject({ a: '123', b: 1000 })
//     result = cmd2.parse('-ad 456')
//     expect(result.options).toMatchObject({ a: '', b: 1000, d: 456 })
//   })
// })

// describe('edge cases', () => {
//   let cmd3: Command

//   beforeAll(() => {
//     cmd3 = app
//       .command('cmd3')
//       .option('-a, --alpha-beta')
//       .option('-b, --no-alpha-beta')
//       .option('-c, --no-gamma', '', { noNegated: true })
//   })

//   test('no negated options', () => {
//     const result = cmd3.parse('-abc')
//     expect(result.options).toMatchObject({ a: true, alphaBeta: true, b: true, noAlphaBeta: true, c: true, noGamma: true })
//   })
// })
