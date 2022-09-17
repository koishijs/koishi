import { Command, Context } from 'koishi'
import { expect, use } from 'chai'
import shape from 'chai-shape'

use(shape)

const app = new Context()

let cmd: Command

describe('Parser API', () => {
  describe('Basic Support', () => {
    it('parse arguments', () => {
      cmd = app.command('cmd1 <foo> [...bar]')
      expect(cmd.parse('')).to.have.shape({ args: [] })
      expect(cmd.parse('a')).to.have.shape({ args: ['a'] })
      expect(cmd.parse('a b')).to.have.shape({ args: ['a', 'b'] })
      expect(cmd.parse('a b c')).to.have.shape({ args: ['a', 'b', 'c'] })
    })

    it('stringify arguments', () => {
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

  describe('Register Options', () => {
    it('register', () => {
      cmd = app.command('cmd2 <foo> [bar:text]')
      cmd.option('alpha', '-a')
      cmd.option('beta', '-b <beta>')
      // infer argument type from fallback
      cmd.option('gamma', '-c <gamma>', { fallback: 0 })
      // define argument type by definition
      cmd.option('delta', '-d <delta:string>')
      // define argument type directly (should not be overrode by default)
      cmd.option('epsilon', '-e <epsilon:posint>', { fallback: 1 })
    })

    it('option parser', () => {
      expect(cmd.parse('--alpha')).to.have.shape({ options: { alpha: true } })
      expect(cmd.parse('--beta')).to.have.shape({ options: { beta: true } })
      expect(cmd.parse('--no-alpha')).to.have.shape({ options: { alpha: false } })
      expect(cmd.parse('--no-beta')).to.have.shape({ options: { beta: false } })
      expect(cmd.parse('--alpha 1')).to.have.shape({ options: { alpha: true } })
      expect(cmd.parse('--beta 1')).to.have.shape({ options: { beta: 1 } })
      expect(cmd.parse('--beta "1"')).to.have.shape({ options: { beta: '1' } })
      expect(cmd.parse('--beta -1')).to.have.shape({ options: { beta: -1 } })
    })

    it('typed options', () => {
      expect(cmd.parse('')).to.have.shape({ error: '', options: { gamma: 0 } })
      expect(cmd.parse('--gamma')).to.have.shape({ error: '', options: { gamma: 0 } })
      expect(cmd.parse('--gamma 1')).to.have.shape({ error: '', options: { gamma: 1 } })
      expect(cmd.parse('--gamma -1')).to.have.shape({ error: '', options: { gamma: -1 } })
      expect(cmd.parse('--gamma a').error).to.be.ok
      expect(cmd.parse('--delta')).to.have.shape({ error: '', options: { delta: '' } })
      expect(cmd.parse('--delta 1')).to.have.shape({ error: '', options: { delta: '1' } })
      expect(cmd.parse('--delta -1')).to.have.shape({ error: '', options: { delta: '-1' } })
      expect(cmd.parse('--epsilon awee').error).to.be.ok
      expect(cmd.parse('--epsilon 1.2').error).to.be.ok
    })

    it('short alias', () => {
      expect(cmd.parse('-ab ""')).to.have.shape({ options: { alpha: true, beta: '' } })
      expect(cmd.parse('-ab=')).to.have.shape({ options: { alpha: true, beta: true } })
      expect(cmd.parse('-ab 1')).to.have.shape({ options: { alpha: true, beta: 1 } })
      expect(cmd.parse('-ab=1')).to.have.shape({ options: { alpha: true, beta: 1 } })
      expect(cmd.parse('-ab -1')).to.have.shape({ options: { alpha: true, beta: -1 } })
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
      cmd = app.command('cmd2 <foo> [bar:text]')
      cmd.option('alpha', '-A, --no-alpha', { value: false })
      cmd.option('gamma', '-C', { value: 1 })
      expect(cmd.parse('-A')).to.have.shape({ options: { alpha: false } })
      expect(cmd.parse('-a')).to.have.shape({ options: { alpha: true } })
      expect(cmd.parse('--alpha')).to.have.shape({ options: { alpha: true } })
      expect(cmd.parse('--no-alpha')).to.have.shape({ options: { alpha: false } })
      expect(cmd.parse('-C')).to.have.shape({ options: { gamma: 1 } })
      expect(cmd.parse('')).to.have.shape({ options: { gamma: 0 }, args: [] })
    })
  })

  describe('Advanced Features', () => {
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
      cmd.option('rest', '-- <rest:text>')
      expect(cmd.parse('a b -- c d')).to.have.shape({ args: ['a', 'b'], options: { rest: 'c d' } })
      expect(cmd.parse('a "b -- c" d')).to.have.shape({ args: ['a', 'b -- c', 'd'], options: {} })
      expect(cmd.parse('a b -- "c d"')).to.have.shape({ args: ['a', 'b'], options: { rest: '"c d"' } })
    })

    it('terminator 1', () => {
      expect(cmd.parse('foo bar baz', ';')).to.have.shape({ args: ['foo', 'bar', 'baz'] })
      expect(cmd.parse('"foo bar" baz', ';')).to.have.shape({ args: ['foo bar', 'baz'] })
      expect(cmd.parse('"foo bar "baz', ';')).to.have.shape({ args: ['"foo bar "baz'] })
      expect(cmd.parse('foo" bar" baz', ';')).to.have.shape({ args: ['foo"', 'bar"', 'baz'] })
      expect(cmd.parse('foo;bar baz', ';')).to.have.shape({ args: ['foo'], rest: 'bar baz' })
      expect(cmd.parse('"foo;bar";baz', ';')).to.have.shape({ args: ['foo;bar'], rest: 'baz' })
    })

    it('terminator 2', () => {
      expect(cmd.parse('-- foo bar baz', ';')).to.have.shape({ options: { rest: 'foo bar baz' } })
      expect(cmd.parse('-- "foo bar" baz', ';')).to.have.shape({ options: { rest: '"foo bar" baz' } })
      expect(cmd.parse('-- "foo bar baz"', ';')).to.have.shape({ options: { rest: '"foo bar baz"' } })
      expect(cmd.parse('-- foo;bar baz', ';')).to.have.shape({ options: { rest: 'foo' }, rest: 'bar baz' })
      expect(cmd.parse('-- "foo;bar" baz', ';')).to.have.shape({ options: { rest: '"foo;bar" baz' } })
      expect(cmd.parse('-- "foo;bar";baz', ';')).to.have.shape({ options: { rest: '"foo;bar"' }, rest: 'baz' })
    })
  })
})
