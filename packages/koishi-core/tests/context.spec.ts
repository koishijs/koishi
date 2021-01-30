import { App } from 'koishi-test-utils'
import { Session } from 'koishi-core'
import { noop } from 'koishi-utils'
import { expect } from 'chai'
import { fn } from 'jest-mock'

const app = new App()
const groupSession = new Session(app, { userId: '123', groupId: '456', subType: 'group' })
const privateSession = new Session(app, { userId: '123', subType: 'private' })
const metaEventSession = new Session(app, { eventType: 'lifecycle' })

describe('Context API', () => {
  describe('Composition API', () => {
    it('root context', () => {
      expect(app.match(groupSession)).to.be.true
      expect(app.match(privateSession)).to.be.true
      expect(app.match(metaEventSession)).to.be.true
    })

    it('context.prototype.user', () => {
      expect(app.select('userId').match(groupSession)).to.be.true
      expect(app.select('userId').match(privateSession)).to.be.true
      expect(app.select('userId').match(metaEventSession)).to.be.true
      expect(app.select('userId', '123').match(groupSession)).to.be.true
      expect(app.select('userId', '123').match(privateSession)).to.be.true
      expect(app.select('userId', '456').match(groupSession)).to.be.false
      expect(app.select('userId', '456').match(privateSession)).to.be.false
      expect(app.select('userId', '456').match(metaEventSession)).to.be.true
    })

    it('context.prototype.private', () => {
      expect(app.unselect('groupId').match(groupSession)).to.be.false
      expect(app.unselect('groupId').match(privateSession)).to.be.true
      expect(app.unselect('groupId').match(metaEventSession)).to.be.true
      expect(app.unselect('groupId').select('userId', '123').match(groupSession)).to.be.false
      expect(app.unselect('groupId').select('userId', '123').match(privateSession)).to.be.true
      expect(app.unselect('groupId').select('userId', '456').match(groupSession)).to.be.false
      expect(app.unselect('groupId').select('userId', '456').match(privateSession)).to.be.false
      expect(app.unselect('groupId').select('userId', '123').match(metaEventSession)).to.be.true
    })

    it('context.prototype.group', () => {
      expect(app.select('groupId').match(groupSession)).to.be.true
      expect(app.select('groupId').match(privateSession)).to.be.false
      expect(app.select('groupId').match(metaEventSession)).to.be.true
      expect(app.select('groupId', '123').match(groupSession)).to.be.false
      expect(app.select('groupId', '123').match(privateSession)).to.be.false
      expect(app.select('groupId', '456').match(groupSession)).to.be.true
      expect(app.select('groupId', '456').match(privateSession)).to.be.false
      expect(app.select('groupId', '456').match(metaEventSession)).to.be.true
    })

    it('context chaining', () => {
      expect(app.select('groupId', '456').select('userId', '123').match(groupSession)).to.be.true
      expect(app.select('groupId', '456').select('userId', '456').match(groupSession)).to.be.false
      expect(app.select('groupId', '123').select('userId', '123').match(groupSession)).to.be.false
      expect(app.select('groupId', '456').select('userId', '123').match(metaEventSession)).to.be.true
      expect(app.select('userId', '123').select('groupId', '456').match(groupSession)).to.be.true
      expect(app.select('userId', '456').select('groupId', '456').match(groupSession)).to.be.false
      expect(app.select('userId', '123').select('groupId', '123').match(groupSession)).to.be.false
      expect(app.select('userId', '123').select('groupId', '456').match(metaEventSession)).to.be.true
    })

    it('context intersection', () => {
      expect(app.select('groupId', '456', '789').select('groupId', '123', '456').match(groupSession)).to.be.true
      expect(app.select('groupId', '456', '789').select('groupId', '123', '789').match(groupSession)).to.be.false
      expect(app.select('groupId', '123', '789').select('groupId', '123', '456').match(groupSession)).to.be.false
      expect(app.select('userId', '123', '789').select('userId', '123', '456').match(groupSession)).to.be.true
      expect(app.select('userId', '456', '789').select('userId', '123', '456').match(groupSession)).to.be.false
      expect(app.select('userId', '123', '789').select('userId', '456', '789').match(groupSession)).to.be.false
    })
  })

  describe('Composition Runtime', () => {
    beforeEach(() => {
      delete app._hooks.command
    })

    it('ctx.prototype.parallel', async () => {
      await app.parallel('command', null)
      const callback = fn<void, []>()
      app.unselect('groupId').on('command', callback)
      await app.parallel('command', null)
      expect(callback.mock.calls).to.have.length(1)
      await app.parallel(groupSession, 'command', null)
      expect(callback.mock.calls).to.have.length(1)
      await app.parallel(privateSession, 'command', null)
      expect(callback.mock.calls).to.have.length(2)
    })

    it('ctx.prototype.emit', async () => {
      app.emit('command', null)
      const callback = fn<void, []>()
      app.unselect('groupId').on('command', callback)
      app.emit('command', null)
      expect(callback.mock.calls).to.have.length(1)
      app.emit(groupSession, 'command', null)
      expect(callback.mock.calls).to.have.length(1)
      app.emit(privateSession, 'command', null)
      expect(callback.mock.calls).to.have.length(2)
    })

    it('ctx.prototype.serial', async () => {
      app.serial('command', null)
      const callback = fn<void, []>()
      app.unselect('groupId').on('command', callback)
      app.serial('command', null)
      expect(callback.mock.calls).to.have.length(1)
      app.serial(groupSession, 'command', null)
      expect(callback.mock.calls).to.have.length(1)
      app.serial(privateSession, 'command', null)
      expect(callback.mock.calls).to.have.length(2)
    })

    it('ctx.prototype.bail', async () => {
      app.bail('command', null)
      const callback = fn<void, []>()
      app.unselect('groupId').on('command', callback)
      app.bail('command', null)
      expect(callback.mock.calls).to.have.length(1)
      app.bail(groupSession, 'command', null)
      expect(callback.mock.calls).to.have.length(1)
      app.bail(privateSession, 'command', null)
      expect(callback.mock.calls).to.have.length(2)
    })
  })

  describe('Plugin API', () => {
    it('call chaining', () => {
      expect(app.plugin(noop)).to.equal(app)

      const ctx = app.select('userId', '123')
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
