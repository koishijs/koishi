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

  test('valued options', () => {
    cmd = app.command('cmd2 <foo> [bar...]')
    cmd.option('alpha', '-A, --no-alpha', { value: false })
    cmd.option('gamma', '-C', { value: 1 })
    expect(cmd.parse('-A')).toMatchObject({ options: { alpha: false } })
    expect(cmd.parse('-a')).toMatchObject({ options: { alpha: true } })
    expect(cmd.parse('--alpha')).toMatchObject({ options: { alpha: true } })
    expect(cmd.parse('--no-alpha')).toMatchObject({ options: { alpha: false } })
    expect(cmd.parse('-C')).toMatchObject({ options: { gamma: 1 } })
    expect(cmd.parse('')).toEqual({
      options: { gamma: 0 },
      args: [],
      rest: '',
      source: expect.anything(),
    })
  })
})

describe('advanced', () => {
  test('symbol alias', () => {
    cmd = app.command('cmd3')
    cmd.option('sharp', '# <id>')
    expect(cmd.parse('# 1')).toMatchObject({ args: [], options: { sharp: 1 } })
  })

  test('duplicate option', () => {
    expect(() => cmd.option('flat', '#')).toThrowError()
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

  test('terminator 1', () => {
    expect(cmd.parse('foo bar baz', ';')).toMatchObject({ args: ['foo', 'bar', 'baz'], rest: '' })
    expect(cmd.parse('"foo bar" baz', ';')).toMatchObject({ args: ['foo bar', 'baz'], rest: '' })
    expect(cmd.parse('"foo bar "baz', ';')).toMatchObject({ args: ['"foo', 'bar', '"baz'], rest: '' })
    expect(cmd.parse('foo" bar" baz', ';')).toMatchObject({ args: ['foo"', 'bar"', 'baz'], rest: '' })
    expect(cmd.parse('foo;bar baz', ';')).toMatchObject({ args: ['foo'], rest: ';bar baz' })
    expect(cmd.parse('"foo;bar";baz', ';')).toMatchObject({ args: ['foo;bar'], rest: ';baz' })
  })

  test('terminator 2', () => {
    expect(cmd.parse('-- foo bar baz', ';')).toMatchObject({ options: { rest: 'foo bar baz' }, rest: '' })
    expect(cmd.parse('-- "foo bar" baz', ';')).toMatchObject({ options: { rest: '"foo bar" baz' }, rest: '' })
    expect(cmd.parse('-- "foo bar baz"', ';')).toMatchObject({ options: { rest: 'foo bar baz' }, rest: '' })
    expect(cmd.parse('-- foo;bar baz', ';')).toMatchObject({ options: { rest: 'foo' }, rest: ';bar baz' })
    expect(cmd.parse('-- "foo;bar" baz', ';')).toMatchObject({ options: { rest: '"foo' }, rest: ';bar" baz' })
    expect(cmd.parse('-- "foo;bar";baz', ';')).toMatchObject({ options: { rest: 'foo;bar' }, rest: ';baz' })
  })
})

describe('stringify', () => {
  test('basic support', () => {
    cmd = app.command('cmd4')
    cmd.option('alpha', '-a <val>')
    cmd.option('beta', '-b')
    expect(cmd.stringify(['foo', 'bar'], {})).toBe('cmd4 foo bar')
    expect(cmd.stringify([], { alpha: 2 })).toBe('cmd4 --alpha 2')
    expect(cmd.stringify([], { alpha: ' ' })).toBe('cmd4 --alpha " "')
    expect(cmd.stringify([], { beta: true })).toBe('cmd4 --beta')
    expect(cmd.stringify([], { beta: false })).toBe('cmd4 --no-beta')
  })
})
