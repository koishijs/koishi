import { App, Context, Dict, noop } from 'koishi'
import { expect } from 'chai'
import { inspect } from 'util'
import mock from '@koishijs/plugin-mock'
import jest from 'jest-mock'
import {} from 'chai-shape'

const app = new App().plugin(mock)
const guildSession = app.mock.session({ userId: '123', guildId: '456', subtype: 'group' })
const privateSession = app.mock.session({ userId: '123', subtype: 'private' })

describe('Context API', () => {
  describe('Composition API', () => {
    it('root context', () => {
      expect(app.match(guildSession)).to.be.true
      expect(app.match(privateSession)).to.be.true
    })

    it('context.prototype.user', () => {
      expect(app.user().match(guildSession)).to.be.true
      expect(app.user().match(privateSession)).to.be.true
      expect(app.user('123').match(guildSession)).to.be.true
      expect(app.user('123').match(privateSession)).to.be.true
      expect(app.user('456').match(guildSession)).to.be.false
      expect(app.user('456').match(privateSession)).to.be.false
    })

    it('context.prototype.private', () => {
      expect(app.private().match(guildSession)).to.be.false
      expect(app.private().match(privateSession)).to.be.true
      expect(app.private().user('123').match(guildSession)).to.be.false
      expect(app.private().user('123').match(privateSession)).to.be.true
      expect(app.private().user('456').match(guildSession)).to.be.false
      expect(app.private().user('456').match(privateSession)).to.be.false
    })

    it('context.prototype.guild', () => {
      expect(app.guild().match(guildSession)).to.be.true
      expect(app.guild().match(privateSession)).to.be.false
      expect(app.guild('123').match(guildSession)).to.be.false
      expect(app.guild('123').match(privateSession)).to.be.false
      expect(app.guild('456').match(guildSession)).to.be.true
      expect(app.guild('456').match(privateSession)).to.be.false
    })

    it('context chaining', () => {
      expect(app.guild('456').user('123').match(guildSession)).to.be.true
      expect(app.guild('456').user('456').match(guildSession)).to.be.false
      expect(app.guild('123').user('123').match(guildSession)).to.be.false
      expect(app.user('123').guild('456').match(guildSession)).to.be.true
      expect(app.user('456').guild('456').match(guildSession)).to.be.false
      expect(app.user('123').guild('123').match(guildSession)).to.be.false
    })

    it('context intersection', () => {
      expect(app.guild('456', '789').guild('123', '456').match(guildSession)).to.be.true
      expect(app.guild('456', '789').guild('123', '789').match(guildSession)).to.be.false
      expect(app.guild('123', '789').guild('123', '456').match(guildSession)).to.be.false
      expect(app.user('123', '789').user('123', '456').match(guildSession)).to.be.true
      expect(app.user('456', '789').user('123', '456').match(guildSession)).to.be.false
      expect(app.user('123', '789').user('456', '789').match(guildSession)).to.be.false
    })
  })

  describe('Hook API', () => {
    const event = 'attach'

    beforeEach(() => {
      delete app._hooks[event]
    })

    it('context.prototype.parallel', async () => {
      await app.parallel(event, null)
      const callback = jest.fn<void, []>()
      app.private().on(event, callback)
      await app.parallel(event, null)
      expect(callback.mock.calls).to.have.length(1)
      await app.parallel(guildSession, event, null)
      expect(callback.mock.calls).to.have.length(1)
      await app.parallel(privateSession, event, null)
      expect(callback.mock.calls).to.have.length(2)
    })

    it('context.prototype.emit', async () => {
      app.emit(event, null)
      const callback = jest.fn<void, []>()
      app.private().on(event, callback)
      app.emit(event, null)
      expect(callback.mock.calls).to.have.length(1)
      app.emit(guildSession, event, null)
      expect(callback.mock.calls).to.have.length(1)
      app.emit(privateSession, event, null)
      expect(callback.mock.calls).to.have.length(2)
    })

    it('context.prototype.serial', async () => {
      app.serial(event, null)
      const callback = jest.fn<void, []>()
      app.private().on(event, callback)
      app.serial(event, null)
      expect(callback.mock.calls).to.have.length(1)
      app.serial(guildSession, event, null)
      expect(callback.mock.calls).to.have.length(1)
      app.serial(privateSession, event, null)
      expect(callback.mock.calls).to.have.length(2)
    })

    it('context.prototype.bail', async () => {
      app.bail(event, null)
      const callback = jest.fn<void, []>()
      app.private().on(event, callback)
      app.bail(event, null)
      expect(callback.mock.calls).to.have.length(1)
      app.bail(guildSession, event, null)
      expect(callback.mock.calls).to.have.length(1)
      app.bail(privateSession, event, null)
      expect(callback.mock.calls).to.have.length(2)
    })
  })

  describe('Plugin API', () => {
    it('call chaining', () => {
      expect(app.plugin(noop)).to.equal(app)

      const ctx = app.user('123')
      expect(ctx.plugin(noop)).to.equal(ctx)
    })

    it('apply functional plugin', () => {
      const callback = jest.fn()
      const options = { foo: 'bar' }
      app.plugin(callback, options)

      expect(callback.mock.calls).to.have.length(1)
      expect(callback.mock.calls[0][1]).to.have.shape(options)
    })

    it('apply object plugin', () => {
      const callback = jest.fn()
      const options = { bar: 'foo' }
      const plugin = { apply: callback }
      app.plugin(plugin, options)

      expect(callback.mock.calls).to.have.length(1)
      expect(callback.mock.calls[0][1]).to.have.shape(options)
    })

    it('apply functional plugin with false', () => {
      const callback = jest.fn()
      app.plugin(callback, false)

      expect(callback.mock.calls).to.have.length(0)
    })

    it('apply object plugin with true', () => {
      const callback = jest.fn()
      const plugin = { apply: callback }
      app.plugin(plugin, true)

      expect(callback.mock.calls).to.have.length(1)
      expect(callback.mock.calls[0][1]).to.have.shape({})
    })

    it('apply invalid plugin', () => {
      expect(() => app.plugin(undefined)).to.throw()
      expect(() => app.plugin({} as any)).to.throw()
      expect(() => app.plugin({ apply: {} } as any)).to.throw()
    })

    it('context inspect', () => {
      expect(inspect(app)).to.equal('Context <root>')

      app.plugin(function foo(ctx) {
        expect(inspect(ctx)).to.equal('Context <foo>')
      })

      app.plugin({
        name: 'bar',
        apply: (ctx) => {
          expect(inspect(ctx)).to.equal('Context <bar>')
        },
      })
    })
  })

  describe('Disposable API', () => {
    it('context.prototype.dispose', () => {
      const callback = jest.fn()
      let pluginCtx: Context
      app.on('attach', callback)
      app.plugin((ctx) => {
        pluginCtx = ctx
        ctx.on('attach', callback)
        ctx.plugin((ctx) => {
          ctx.on('attach', callback)
        })
      })

      // 3 handlers now
      expect(callback.mock.calls).to.have.length(0)
      app.emit('attach', null)
      expect(callback.mock.calls).to.have.length(3)

      // only 1 handler left
      pluginCtx.dispose()
      app.emit('attach', null)
      expect(callback.mock.calls).to.have.length(4)
    })

    it('memory leak test', async () => {
      function plugin(ctx: Context) {
        ctx.command('temp')
        ctx.on('attach', () => {})
        ctx.before('attach', () => {})
        ctx.on('dispose', () => {})
        ctx.middleware(() => {})
      }

      function getHookSnapshot() {
        const result: Dict<number> = {}
        for (const name in app._hooks) {
          result[name] = app._hooks[name].length
        }
        result._ = app.state.disposables.length
        return result
      }

      app.plugin(plugin)
      const shot1 = getHookSnapshot()
      await app.dispose(plugin)
      app.plugin(plugin)
      const shot2 = getHookSnapshot()
      expect(shot1).to.deep.equal(shot2)
    })

    it('root level dispose', async () => {
      // create a context without a plugin
      const ctx = app.exclude(app.platform())
      await expect(ctx.dispose()).to.be.rejected
    })

    it('dispose event', () => {
      const callback = jest.fn<void, []>()
      app.plugin(async (ctx) => {
        ctx.on('dispose', callback)
        expect(callback.mock.calls).to.have.length(0)
        await ctx.dispose()
        expect(callback.mock.calls).to.have.length(1)
        // callback should only be called once
        await ctx.dispose()
        expect(callback.mock.calls).to.have.length(1)
      })
    })
  })
})
