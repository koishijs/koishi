/* eslint-disable @typescript-eslint/no-unused-vars */

import { App } from '@koishijs/test-utils'
import { Session, Logger, noop } from 'koishi'
import { inspect } from 'util'
import { expect } from 'chai'
import jest from 'jest-mock'

describe('Command API', () => {
  describe('Register Commands', () => {
    const app = new App()

    it('constructor checks', () => {
      expect(() => app.command('')).to.throw()
    })

    it('context.prototype.command', () => {
      const ctx1 = app.user('10000')
      const ctx2 = app.guild('10000')
      app.command('a')
      ctx1.command('b')
      ctx2.command('c')

      // a, b, c, help
      expect(app._commandList).to.have.length(4)
      expect(app._commands.get('a').context).to.equal(app)
      expect(app._commands.get('b').context).to.equal(ctx1)
      expect(app._commands.get('c').context).to.equal(ctx2)
    })

    it('custom inspect', () => {
      expect(inspect(app.command('a'))).to.equal('Command <a>')
    })

    it('modify commands', () => {
      const d1 = app.command('d', 'foo', { authority: 1 })
      expect(app._commands.get('d').description).to.equal('foo')
      expect(app._commands.get('d').config.authority).to.equal(1)

      const d2 = app.command('d', 'bar', { authority: 2 })
      expect(app._commands.get('d').description).to.equal('bar')
      expect(app._commands.get('d').config.authority).to.equal(2)

      expect(d1).to.equal(d2)
    })

    it('name conflicts', () => {
      expect(() => {
        app.command('e')
        app.user('10000').command('e')
      }).not.to.throw()

      expect(() => {
        const x1 = app.command('e').alias('x')
        const x2 = app.user('10000').command('x')
        expect(x1).to.equal(x2)
      }).not.to.throw()

      expect(() => {
        app.command('g').alias('y')
        app.command('h').alias('y')
      }).to.throw()

      expect(() => {
        app.command('i').alias('z')
        app.command('i').alias('z')
      }).not.to.throw()
    })
  })

  describe('Register Subcommands', () => {
    let app: App
    beforeEach(() => app = new App())

    it('command.prototype.subcommand', () => {
      const a = app.command('a')
      const b = a.subcommand('b')
      const c = b.subcommand('.c')
      expect(a.children).to.have.shape([b])
      expect(b.name).to.equal('b')
      expect(b.parent).to.equal(a)
      expect(b.children).to.have.shape([c])
      expect(c.name).to.equal('b.c')
      expect(c.parent).to.equal(b)
    })

    it('implicit subcommands', () => {
      const a = app.command('a')
      const d = app.command('a.d')
      expect(d.name).to.equal('a.d')
      expect(d.parent).to.equal(a)

      const b = app.command('b')
      const e = app.command('b/e')
      expect(e.name).to.equal('e')
      expect(e.parent).to.equal(b)

      const f = a.subcommand('.b/f')
      expect(f.name).to.equal('f')
      expect(f.parent.name).to.equal('a.b')
      expect(f.parent.parent).to.equal(a)

      const g = b.subcommand('c.g')
      expect(g.name).to.equal('c.g')
      expect(g.parent.name).to.equal('c')
      expect(g.parent.parent).to.equal(b)

      const h = app.command('h')
      b.subcommand('h')
      expect(h.name).to.equal('h')
      expect(h.parent).to.equal(b)
    })

    it('check subcommand', () => {
      const a = app.command('a')
      const b = a.subcommand('b')
      const c = b.subcommand('c')
      const d = app.command('d')

      // register explicit subcommand
      expect(() => a.subcommand('a')).to.throw()
      expect(() => a.subcommand('b')).not.to.throw()
      expect(() => a.subcommand('c')).to.throw()
      expect(() => a.subcommand('d')).not.to.throw()

      // register implicit subcommand
      expect(() => app.command('b/c')).not.to.throw()
      expect(() => app.command('a/c')).to.throw()
      expect(() => app.command('c/b')).to.throw()
      expect(() => app.command('a/d')).not.to.throw()
    })
  })

  describe('Disposable Commands', () => {
    const app = new App()
    const foo = app.command('foo')
    const bar = foo.subcommand('bar')
    const test = bar.subcommand('test')
    bar.alias('baz').shortcut('1')
    test.alias('it').shortcut('2')

    it('basic support', () => {
      // don't forget help
      expect(app._commandList).to.have.length(4)
      expect(app._shortcuts).to.have.length(3)
      expect(foo.children).to.have.length(1)
      bar.dispose()
      expect(app._commandList).to.have.length(2)
      expect(app._shortcuts).to.have.length(1)
      expect(foo.children).to.have.length(0)
    })

    it('patch command', () => {
      app.plugin((ctx) => {
        ctx.command('foo', 'desc', { patch: true }).alias('fooo').option('opt', 'option 1')
        ctx.command('abc', 'desc', { patch: true }).alias('abcd').option('opt', 'option 1')

        const foo = app._commands.get('foo')
        expect(foo).to.be.ok
        expect(app._commands.get('fooo')).to.be.ok
        expect(foo.description).to.equal('desc')
        expect(Object.keys(foo._options)).to.have.length(2)
        expect(app._commands.get('abc')).to.be.undefined
        expect(app._commands.get('abcd')).to.be.undefined

        ctx.dispose()
        expect(app._commands.get('foo')).to.be.ok
        expect(app._commands.get('fooo')).to.be.undefined
        expect(Object.keys(foo._options)).to.have.length(1)
      })
    })
  })

  describe('Error Handling', () => {
    const app = new App()
    const command = app.command('test')
    const session = new Session(app.bots[0], {})
    const cmdWarn = jest.spyOn(new Logger('command'), 'warn')
    const argv = { command, session }

    it('throw in action', async () => {
      command.action(async ({ next }) => {
        await next(noop)
        throw new Error('message')
      })

      await expect(command.execute(argv)).eventually.to.equal('')
      expect(cmdWarn.mock.calls).to.have.length(1)
      expect(cmdWarn.mock.calls[0][0]).to.match(/^executing command: test\nError: message/)
    })

    it('throw in next', async () => {
      command.action(({ next }) => {
        return next(() => {
          throw new Error('message')
        })
      })

      cmdWarn.mockClear()
      await expect(command.execute(argv)).to.be.rejectedWith('message')
      expect(cmdWarn.mock.calls).to.have.length(0)
    })
  })
})
