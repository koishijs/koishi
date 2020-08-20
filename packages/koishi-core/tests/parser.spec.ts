import { Command } from 'koishi-core'
import { App } from 'koishi-test-utils'
import { inspect } from 'util'
import { expect } from 'chai'
import '@shigma/chai-extended'

const app = new App()

let cmd: Command

describe('Parser API', () => {
  describe('basic support', () => {
    it('register', () => {
      // there is a built-in help command
      expect(app._commands).to.have.length(1)

      cmd = app.command('cmd1 <foo> [...bar]')
      expect(app._commands).to.have.length(2)
    })

    it('inspect', () => {
      expect(inspect(cmd)).to.equal('Command <cmd1>')
    })

    it('parse arguments', () => {
      expect(cmd.parse('')).to.have.shape({ args: [] })
      expect(cmd.parse('a')).to.have.shape({ args: ['a'] })
      expect(cmd.parse('a b')).to.have.shape({ args: ['a', 'b'] })
      expect(cmd.parse('a b c')).to.have.shape({ args: ['a', 'b', 'c'] })
    })

    it('dispose', () => {
      cmd.dispose()
      expect(app._commands).to.have.length(1)
    })
  })

  describe('option', () => {
    it('register', () => {
      cmd = app.command('cmd2 <foo> [bar...]')
      cmd.option('alpha', '-a')
      cmd.option('beta', '-b <beta>')
      cmd.option('gamma', '-c <gamma>', { fallback: 0 })
      cmd.option('delta', '-d <gamma>', { type: 'string' })
    })

    it('option parser', () => {
      expect(cmd.parse('--alpha')).to.have.shape({ options: { alpha: true } })
      expect(cmd.parse('--beta')).to.have.shape({ options: { beta: true } })
      expect(cmd.parse('--no-alpha')).to.have.shape({ options: { alpha: false } })
      expect(cmd.parse('--no-beta')).to.have.shape({ options: { beta: false } })
      expect(cmd.parse('--alpha 1')).to.have.shape({ options: { alpha: true } })
      expect(cmd.parse('--beta 1')).to.have.shape({ options: { beta: 1 } })
      expect(cmd.parse('--beta "1"')).to.have.shape({ options: { beta: 1 } })
      expect(cmd.parse('--beta -1')).to.have.shape({ options: { beta: true } })
    })

    it('typed options', () => {
      expect(cmd.parse('')).to.have.shape({ options: { gamma: 0 } })
      expect(cmd.parse('--gamma')).to.have.shape({ options: { gamma: 0 } })
      expect(cmd.parse('--gamma 1')).to.have.shape({ options: { gamma: 1 } })
      expect(cmd.parse('--gamma -1')).to.have.shape({ options: { gamma: -1 } })
      expect(cmd.parse('--gamma a')).to.have.shape({ options: { gamma: NaN } })
      expect(cmd.parse('--delta')).to.have.shape({ options: { delta: '' } })
      expect(cmd.parse('--delta 1')).to.have.shape({ options: { delta: '1' } })
      expect(cmd.parse('--delta -1')).to.have.shape({ options: { delta: '-1' } })
    })

    it('short alias', () => {
      expect(cmd.parse('-ab ""')).to.have.shape({ options: { alpha: true, beta: '' } })
      expect(cmd.parse('-ab=')).to.have.shape({ options: { alpha: true, beta: true } })
      expect(cmd.parse('-ab 1')).to.have.shape({ options: { alpha: true, beta: 1 } })
      expect(cmd.parse('-ab=1')).to.have.shape({ options: { alpha: true, beta: 1 } })
      expect(cmd.parse('-ab -1')).to.have.shape({ options: { alpha: true, beta: true } })
      expect(cmd.parse('-ab=-1')).to.have.shape({ options: { alpha: true, beta: -1 } })
    })

    it('greedy arguments', () => {
      expect(cmd.parse('')).to.have.shape({ args: [] })
      expect(cmd.parse('a')).to.have.shape({ args: ['a'] })
      expect(cmd.parse('a b')).to.have.shape({ args: ['a', 'b'] })
      expect(cmd.parse('a b c')).to.have.shape({ args: ['a', 'b c'] })
      expect(cmd.parse('-a b c')).to.have.shape({ args: ['b', 'c'] })
      expect(cmd.parse('a -b c')).to.have.shape({ args: ['a'] })
      expect(cmd.parse('a b -c')).to.have.shape({ args: ['a', 'b -c'] })
    })

    it('valued options', () => {
      cmd = app.command('cmd2 <foo> [bar...]')
      cmd.option('alpha', '-A, --no-alpha', { value: false })
      cmd.option('gamma', '-C', { value: 1 })
      expect(cmd.parse('-A')).to.have.shape({ options: { alpha: false } })
      expect(cmd.parse('-a')).to.have.shape({ options: { alpha: true } })
      expect(cmd.parse('--alpha')).to.have.shape({ options: { alpha: true } })
      expect(cmd.parse('--no-alpha')).to.have.shape({ options: { alpha: false } })
      expect(cmd.parse('-C')).to.have.shape({ options: { gamma: 1 } })
      expect(cmd.parse('')).to.have.shape({ options: { gamma: 0 }, args: [], rest: '' })
    })
  })

  describe('advanced', () => {
    it('symbol alias', () => {
      cmd = app.command('cmd3')
      cmd.option('sharp', '# <id>')
      expect(cmd.parse('# 1')).to.have.shape({ args: [], options: { sharp: 1 } })
    })

    it('duplicate option', () => {
      expect(() => cmd.option('flat', '#')).to.throw()
    })

    it('remove option', () => {
      expect(cmd.removeOption('sharp' as never)).to.equal(true)
      expect(cmd.parse('# 1')).to.have.shape({ args: ['#', '1'], options: {} })
      expect(cmd.removeOption('sharp' as never)).to.equal(false)
    })

    it('rest option', () => {
      cmd.option('rest', '-- <rest...>')
      expect(cmd.parse('a b -- c d')).to.have.shape({ args: ['a', 'b'], options: { rest: 'c d' }, rest: '' })
      expect(cmd.parse('a "b -- c" d')).to.have.shape({ args: ['a', 'b -- c', 'd'], options: {}, rest: '' })
      expect(cmd.parse('a b -- "c d"')).to.have.shape({ args: ['a', 'b'], options: { rest: 'c d' }, rest: '' })
    })

    it('terminator 1', () => {
      expect(cmd.parse('foo bar baz', ';')).to.have.shape({ args: ['foo', 'bar', 'baz'], rest: '' })
      expect(cmd.parse('"foo bar" baz', ';')).to.have.shape({ args: ['foo bar', 'baz'], rest: '' })
      expect(cmd.parse('"foo bar "baz', ';')).to.have.shape({ args: ['"foo', 'bar', '"baz'], rest: '' })
      expect(cmd.parse('foo" bar" baz', ';')).to.have.shape({ args: ['foo"', 'bar"', 'baz'], rest: '' })
      expect(cmd.parse('foo;bar baz', ';')).to.have.shape({ args: ['foo'], rest: ';bar baz' })
      expect(cmd.parse('"foo;bar";baz', ';')).to.have.shape({ args: ['foo;bar'], rest: ';baz' })
    })

    it('terminator 2', () => {
      expect(cmd.parse('-- foo bar baz', ';')).to.have.shape({ options: { rest: 'foo bar baz' }, rest: '' })
      expect(cmd.parse('-- "foo bar" baz', ';')).to.have.shape({ options: { rest: '"foo bar" baz' }, rest: '' })
      expect(cmd.parse('-- "foo bar baz"', ';')).to.have.shape({ options: { rest: 'foo bar baz' }, rest: '' })
      expect(cmd.parse('-- foo;bar baz', ';')).to.have.shape({ options: { rest: 'foo' }, rest: ';bar baz' })
      expect(cmd.parse('-- "foo;bar" baz', ';')).to.have.shape({ options: { rest: '"foo' }, rest: ';bar" baz' })
      expect(cmd.parse('-- "foo;bar";baz', ';')).to.have.shape({ options: { rest: 'foo;bar' }, rest: ';baz' })
    })
  })

  describe('stringify argv', () => {
    it('basic support', () => {
      cmd = app.command('cmd4')
      cmd.option('alpha', '-a <val>')
      cmd.option('beta', '-b')
      expect(cmd.stringify(['foo', 'bar'], {})).to.equal('cmd4 foo bar')
      expect(cmd.stringify([], { alpha: 2 })).to.equal('cmd4 --alpha 2')
      expect(cmd.stringify([], { alpha: ' ' })).to.equal('cmd4 --alpha " "')
      expect(cmd.stringify([], { beta: true })).to.equal('cmd4 --beta')
      expect(cmd.stringify([], { beta: false })).to.equal('cmd4 --no-beta')
    })
  })
})
