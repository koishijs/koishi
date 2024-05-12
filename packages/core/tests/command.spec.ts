import { App, Command, Logger, Next } from 'koishi'
import { inspect } from 'util'
import { expect, use } from 'chai'
import shape from 'chai-shape'
import promise from 'chai-as-promised'
import mock from '@koishijs/plugin-mock'
import { mock as jest } from 'node:test'

use(shape)
use(promise)

const print = jest.fn()

before(() => {
  Logger.levels.base = 1
  Logger.targets.push({
    levels: { base: 0, command: 2 },
    print,
  })
})

after(() => {
  Logger.levels.base = 2
  Logger.targets.pop()
})

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

      // a, b, c
      expect(app.$commander._commandList).to.have.length(3)
      expect(app.$commander.get('a').ctx).to.equal(app)
      expect(app.$commander.get('b').ctx).to.equal(ctx1)
      expect(app.$commander.get('c').ctx).to.equal(ctx2)
    })

    it('custom inspect', () => {
      expect(inspect(app.command('a'))).to.equal('Command <a>')
    })

    it('modify commands', () => {
      const d1 = app.command('d', 'foo', { authority: 1 })
      expect(app.$commander.get('d').config.authority).to.equal(1)

      const d2 = app.command('d', 'bar', { authority: 2 })
      expect(app.$commander.get('d').config.authority).to.equal(2)

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

  describe('Dispose Commands', () => {
    const app = new App()
    const foo = app.command('foo')
    const bar = foo.subcommand('bar')
    const test = bar.subcommand('test')
    bar.alias('baz').shortcut('1')
    test.alias('it').shortcut('2')

    it('basic support', () => {
      expect(app.$commander._commandList).to.have.length(3)
      expect(app.$processor._matchers).to.have.length(2)
      expect(foo.children).to.have.length(1)
      bar.dispose()
      expect(app.$commander._commandList).to.have.length(1)
      expect(app.$processor._matchers).to.have.length(0)
      expect(foo.children).to.have.length(0)
    })
  })

  describe('Execute Commands', () => {
    const app = new App()
    app.plugin(mock)
    const session = app.mock.session({})
    const next = jest.fn(Next.compose)

    let command: Command
    beforeEach(() => {
      command = app.command('test')
      print.mock.resetCalls()
      next.mock.resetCalls()
    })
    afterEach(() => command?.dispose())

    it('basic 1 (return undefined)', async () => {
      command.action(() => {})

      await expect(command.execute({ session }, next)).eventually.to.equal('')
      expect(next.mock.calls).to.have.length(0)
    })

    it('basic 2 (return string)', async () => {
      command.action(() => 'result')

      await expect(command.execute({ session }, next)).eventually.to.equal('result')
      expect(next.mock.calls).to.have.length(0)
    })

    it('compose 1 (return in next function)', async () => {
      next.mock.mockImplementationOnce(() => Promise.resolve('result'))
      command.action(({ next }) => next())

      await expect(command.execute({ session }, next)).eventually.to.equal('result')
      expect(next.mock.calls).to.have.length(1)
    })

    it('compose 2 (return in action)', async () => {
      command.action(() => 'result')
      command.action(({ next }, arg) => {
        return arg === 'ping' ? 'pong' : next()
      }, true)

      await expect(command.execute({ session }, next)).eventually.to.equal('result')
      await expect(command.execute({ session, args: ['ping'] }, next)).eventually.to.equal('pong')
      expect(next.mock.calls).to.have.length(0)
    })

    it('compose 3 (return in next callback)', async () => {
      command.action(({ next }) => next('result'))

      await expect(command.execute({ session }, async () => {})).eventually.to.equal('')
      await expect(command.execute({ session }, next)).eventually.to.equal('result')
      expect(next.mock.calls).to.have.length(1)
    })

    it('compose 4 (nested next callbacks)', async () => {
      command.action(({ next }) => {
        return next((next) => {
          return next((next) => {
            return next('result')
          })
        })
      })

      await expect(command.execute({ session }, async () => {})).eventually.to.equal('')
      await expect(command.execute({ session }, next)).eventually.to.equal('result')
      expect(next.mock.calls).to.have.length(1)
    })

    it('throw 1 (error in action)', async () => {
      command.config.handleError = () => '乌拉！'
      command.action(() => {
        throw new Error('message 1')
      })

      await expect(command.execute({ session }, next)).eventually.to.equal('乌拉！')
      expect(print.mock.calls).to.have.length(1)
      expect(print.mock.calls[0].arguments[0]).to.match(/Error: message 1/)
      expect(next.mock.calls).to.have.length(0)
    })

    it('throw 2 (error in next callback)', async () => {
      command.action(({ next }) => {
        return next(() => {
          throw new Error('message 2')
        })
      })

      await expect(command.execute({ session }, next)).eventually.to.equal('发生未知错误。')
      expect(print.mock.calls).to.have.length(1)
      expect(print.mock.calls[0].arguments[0]).to.match(/Error: message 2/)
      expect(next.mock.calls).to.have.length(1)
    })

    it('throw 3 (error in next function)', async () => {
      next.mock.mockImplementationOnce(() => Promise.reject(new Error('message 3')))
      command.action(({ next }) => next())

      await expect(command.execute({ session }, next)).to.be.rejected
      expect(print.mock.calls).to.have.length(0)
      expect(next.mock.calls).to.have.length(1)
    })

    it('throw 4 (error handling)', async () => {
      command.action(async ({ next }) => {
        return next().catch(() => 'catched')
      })
      command.action(() => {
        throw new Error('message 4')
      })

      await expect(command.execute({ session }, next)).eventually.to.equal('catched')
      expect(print.mock.calls).to.have.length(0)
      expect(next.mock.calls).to.have.length(0)
    })
  })

  describe('Bypass Middleware', async () => {
    const app = new App()
    app.plugin(mock)
    const client = app.mock.client('123')

    app.middleware((session, next) => {
      if (session.content.includes('escape')) return 'early'
      return next()
    })

    it('basic support', async () => {
      app.command('test1').action(({ next }) => next('final'))

      await app.start()
      await client.shouldReply('test1 foo', 'final')
      await client.shouldReply('test1 escape', 'early')
    })

    it('infinite loop', async () => {
      app.command('test2').action(({ next }) => next(Next.compose))

      await app.start()
      await client.shouldNotReply('test2')
    })
  })
})
