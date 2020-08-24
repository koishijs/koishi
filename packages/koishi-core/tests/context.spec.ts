import { App } from 'koishi-test-utils'
import { Session } from 'koishi-core'
import { noop } from 'koishi-utils'
import { expect } from 'chai'
import { fn } from 'jest-mock'
import '@shigma/chai-extended'

const app = new App()
const groupSession = new Session(app, { userId: 123, groupId: 456, messageType: 'group' })
const privateSession = new Session(app, { userId: 123, messageType: 'private' })
const metaEventSession = new Session(app, { postType: 'meta_event' })

describe('Context API', () => {
  describe('Composition API', () => {
    it('root context', () => {
      expect(app.match(groupSession)).to.be.true
      expect(app.match(privateSession)).to.be.true
      expect(app.match(metaEventSession)).to.be.true
    })

    it('context.prototype.user', () => {
      expect(app.user().match(groupSession)).to.be.true
      expect(app.user().match(privateSession)).to.be.true
      expect(app.user().match(metaEventSession)).to.be.true
      expect(app.user(123).match(groupSession)).to.be.true
      expect(app.user(123).match(privateSession)).to.be.true
      expect(app.user(456).match(groupSession)).to.be.false
      expect(app.user(456).match(privateSession)).to.be.false
      expect(app.user(456).match(metaEventSession)).to.be.true
    })

    it('context.prototype.private', () => {
      expect(app.private().match(groupSession)).to.be.false
      expect(app.private().match(privateSession)).to.be.true
      expect(app.private().match(metaEventSession)).to.be.true
      expect(app.private(123).match(groupSession)).to.be.false
      expect(app.private(123).match(privateSession)).to.be.true
      expect(app.private(456).match(groupSession)).to.be.false
      expect(app.private(456).match(privateSession)).to.be.false
      expect(app.private(123).match(metaEventSession)).to.be.true
    })

    it('context.prototype.group', () => {
      expect(app.group().match(groupSession)).to.be.true
      expect(app.group().match(privateSession)).to.be.false
      expect(app.group().match(metaEventSession)).to.be.true
      expect(app.group(123).match(groupSession)).to.be.false
      expect(app.group(123).match(privateSession)).to.be.false
      expect(app.group(456).match(groupSession)).to.be.true
      expect(app.group(456).match(privateSession)).to.be.false
      expect(app.group(456).match(metaEventSession)).to.be.true
    })

    it('context chaining', () => {
      expect(app.group(456).user(123).match(groupSession)).to.be.true
      expect(app.group(456).user(456).match(groupSession)).to.be.false
      expect(app.group(123).user(123).match(groupSession)).to.be.false
      expect(app.group(456).user(123).match(metaEventSession)).to.be.true
      expect(app.user(123).group(456).match(groupSession)).to.be.true
      expect(app.user(456).group(456).match(groupSession)).to.be.false
      expect(app.user(123).group(123).match(groupSession)).to.be.false
      expect(app.user(123).group(456).match(metaEventSession)).to.be.true
    })

    it('context intersection', () => {
      expect(app.group(456, 789).group(123, 456).match(groupSession)).to.be.true
      expect(app.group(456, 789).group(123, 789).match(groupSession)).to.be.false
      expect(app.group(123, 789).group(123, 456).match(groupSession)).to.be.false
      expect(app.user(123, 789).user(123, 456).match(groupSession)).to.be.true
      expect(app.user(456, 789).user(123, 456).match(groupSession)).to.be.false
      expect(app.user(123, 789).user(456, 789).match(groupSession)).to.be.false
    })
  })

  describe('Composition Runtime', () => {
    beforeEach(() => {
      delete app._hooks.attach
    })

    it('ctx.prototype.parallel', async () => {
      await app.parallel('attach', null)
      const callback = fn<void, []>()
      app.private().on('attach', callback)
      await app.parallel('attach', null)
      expect(callback.mock.calls).to.have.length(1)
      await app.parallel(groupSession, 'attach', null)
      expect(callback.mock.calls).to.have.length(1)
      await app.parallel(privateSession, 'attach', null)
      expect(callback.mock.calls).to.have.length(2)
    })

    it('ctx.prototype.emit', async () => {
      app.emit('attach', null)
      const callback = fn<void, []>()
      app.private().on('attach', callback)
      app.emit('attach', null)
      expect(callback.mock.calls).to.have.length(1)
      app.emit(groupSession, 'attach', null)
      expect(callback.mock.calls).to.have.length(1)
      app.emit(privateSession, 'attach', null)
      expect(callback.mock.calls).to.have.length(2)
    })

    it('ctx.prototype.serial', async () => {
      app.serial('attach', null)
      const callback = fn<void, []>()
      app.private().on('attach', callback)
      app.serial('attach', null)
      expect(callback.mock.calls).to.have.length(1)
      app.serial(groupSession, 'attach', null)
      expect(callback.mock.calls).to.have.length(1)
      app.serial(privateSession, 'attach', null)
      expect(callback.mock.calls).to.have.length(2)
    })

    it('ctx.prototype.bail', async () => {
      app.bail('attach', null)
      const callback = fn<void, []>()
      app.private().on('attach', callback)
      app.bail('attach', null)
      expect(callback.mock.calls).to.have.length(1)
      app.bail(groupSession, 'attach', null)
      expect(callback.mock.calls).to.have.length(1)
      app.bail(privateSession, 'attach', null)
      expect(callback.mock.calls).to.have.length(2)
    })
  })

  describe('Plugin API', () => {
    it('call chaining', () => {
      expect(app.plugin(noop)).to.equal(app)

      const ctx = app.user(123)
      expect(ctx.plugin(noop)).to.equal(ctx)
    })

    it('apply functional plugin', () => {
      const callback = fn()
      const options = { foo: 'bar' }
      app.plugin(callback, options)

      expect(callback.mock.calls).to.have.length(1)
      expect(callback.mock.calls[0][1]).to.have.shape(options)
    })

    it('apply object plugin', () => {
      const callback = fn()
      const options = { bar: 'foo' }
      const plugin = { apply: callback }
      app.plugin(plugin, options)

      expect(callback.mock.calls).to.have.length(1)
      expect(callback.mock.calls[0][1]).to.have.shape(options)
    })

    it('apply functional plugin with false', () => {
      const callback = fn()
      app.plugin(callback, false)

      expect(callback.mock.calls).to.have.length(0)
    })

    it('apply object plugin with true', () => {
      const callback = fn()
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
})
