import { App } from 'koishi-test-utils'
import { Session, Context } from 'koishi-core'
import { noop } from 'koishi-utils'
import { expect } from 'chai'
import jest from 'jest-mock'

const app = new App()
const groupSession = new Session(app, { userId: '123', groupId: '456', subtype: 'group' })
const privateSession = new Session(app, { userId: '123', subtype: 'private' })

describe('Context API', () => {
  describe('Composition API', () => {
    it('root context', () => {
      expect(app.match(groupSession)).to.be.true
      expect(app.match(privateSession)).to.be.true
    })

    it('context.prototype.user', () => {
      expect(app.user().match(groupSession)).to.be.true
      expect(app.user().match(privateSession)).to.be.true
      expect(app.user('123').match(groupSession)).to.be.true
      expect(app.user('123').match(privateSession)).to.be.true
      expect(app.user('456').match(groupSession)).to.be.false
      expect(app.user('456').match(privateSession)).to.be.false
    })

    it('context.prototype.private', () => {
      expect(app.private().match(groupSession)).to.be.false
      expect(app.private().match(privateSession)).to.be.true
      expect(app.private().user('123').match(groupSession)).to.be.false
      expect(app.private().user('123').match(privateSession)).to.be.true
      expect(app.private().user('456').match(groupSession)).to.be.false
      expect(app.private().user('456').match(privateSession)).to.be.false
    })

    it('context.prototype.group', () => {
      expect(app.group().match(groupSession)).to.be.true
      expect(app.group().match(privateSession)).to.be.false
      expect(app.group('123').match(groupSession)).to.be.false
      expect(app.group('123').match(privateSession)).to.be.false
      expect(app.group('456').match(groupSession)).to.be.true
      expect(app.group('456').match(privateSession)).to.be.false
    })

    it('context chaining', () => {
      expect(app.group('456').user('123').match(groupSession)).to.be.true
      expect(app.group('456').user('456').match(groupSession)).to.be.false
      expect(app.group('123').user('123').match(groupSession)).to.be.false
      expect(app.user('123').group('456').match(groupSession)).to.be.true
      expect(app.user('456').group('456').match(groupSession)).to.be.false
      expect(app.user('123').group('123').match(groupSession)).to.be.false
    })

    it('context intersection', () => {
      expect(app.group('456', '789').group('123', '456').match(groupSession)).to.be.true
      expect(app.group('456', '789').group('123', '789').match(groupSession)).to.be.false
      expect(app.group('123', '789').group('123', '456').match(groupSession)).to.be.false
      expect(app.user('123', '789').user('123', '456').match(groupSession)).to.be.true
      expect(app.user('456', '789').user('123', '456').match(groupSession)).to.be.false
      expect(app.user('123', '789').user('456', '789').match(groupSession)).to.be.false
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
      await app.parallel(groupSession, event, null)
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
      app.emit(groupSession, event, null)
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
      app.serial(groupSession, event, null)
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
      app.bail(groupSession, event, null)
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
      expect(callback.mock.calls[0][1]).to.be.undefined
    })

    it('apply invalid plugin', () => {
      expect(() => app.plugin(undefined)).to.throw()
      expect(() => app.plugin({} as any)).to.throw()
      expect(() => app.plugin({ apply: {} } as any)).to.throw()
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

    it('root level dispose', async () => {
      // create a context without a plugin
      const ctx = app.platform.except()
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
