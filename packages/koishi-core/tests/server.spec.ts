import { App, BASE_SELF_ID, memory } from 'koishi-test-utils'
import { App as RealApp, extendDatabase, Group, Session } from 'koishi-core'
import { expect } from 'chai'
import { fn, spyOn } from 'jest-mock'
import { Logger } from 'koishi-utils'

describe('Server API', () => {
  describe('Adaptation API', () => {
    it('type check', () => {
      expect(() => new RealApp({ type: 'foo' })).to.throw('unsupported type "foo", you should import the adapter yourself')
    })

    it('http server 1', async () => {
      const app = new App({ port: 10000 })
      expect(app.router).to.equal(app.server.router)
      const listen = spyOn(app.server.server, 'listen')
      listen.mockReturnThis()
      await expect(app.start()).to.be.fulfilled
      await expect(app.start()).to.be.fulfilled
    })

    it('http server 2', async () => {
      const app = new App({ port: 20000 })
      const listen = spyOn(app.server.server, 'listen')
      listen.mockImplementation(() => { throw new Error() })
      await expect(app.start()).to.be.rejected
      await expect(app.start()).to.be.rejected
    })

    it('ctx.bots', async () => {
      const app = new App()
      expect(app.bots[0]).to.equal(app.bots[BASE_SELF_ID])
    })

    it('app.getSelfIds 1', async () => {
      const app = new App()
      await expect(app.getSelfIds()).eventually.to.deep.equal([BASE_SELF_ID])
    })

    it('app.getSelfIds 2', async () => {
      const app = new App()
      delete app.bots[0].selfId
      const getSelfId = app.bots[0].getSelfId = fn()
      getSelfId.mockReturnValue(Promise.resolve(BASE_SELF_ID))
      await expect(app.getSelfIds()).eventually.to.deep.equal([BASE_SELF_ID])
    })

    it('server.prepare', async () => {
      const app = new App()
      delete app.bots[0].selfId
      expect(app.server.prepare({ selfId: BASE_SELF_ID + 1 })).to.be.ok
      expect(app.bots[0].selfId).to.equal(BASE_SELF_ID + 1)
      expect(app.server.prepare({ selfId: BASE_SELF_ID })).to.be.undefined
    })
  })

  describe('Sender API', () => {
    const app = new App({ broadcastDelay: Number.EPSILON }).plugin(memory)
    const bot = app.bots[0]

    const sendGroupMsg = bot.sendGroupMsg = fn(async (id) => {
      if (id === 456) return 789
      throw new Error('bar')
    })

    before(async () => {
      await app.database.getGroup(123, BASE_SELF_ID)
      await app.database.getGroup(456, BASE_SELF_ID)
      await app.database.getGroup(789, BASE_SELF_ID)
      await app.database.setGroup(456, { flag: Group.Flag.silent })
    })

    beforeEach(async () => {
      sendGroupMsg.mockClear()
    })

    it('bot.createSession', async () => {
      const session = bot.createSession('group', 'group', 123, 'foo')
      expect(session).to.be.instanceof(Session)
      expect(session.$app).to.equal(app)
      expect(session.$bot).to.equal(bot)
      expect(Object.keys(session.toJSON())).to.have.length(6)
    })

    it('ctx.broadcast 1', async () => {
      await expect(app.broadcast([123, 456], '')).to.eventually.deep.equal([])
      expect(sendGroupMsg.mock.calls).to.deep.equal([])
    })

    it('ctx.broadcast 2', async () => {
      await expect(app.broadcast([123, 456], 'foo')).to.eventually.deep.equal([])
      expect(sendGroupMsg.mock.calls).to.deep.equal([[123, 'foo']])
    })

    it('ctx.broadcast 3', async () => {
      await expect(app.broadcast([123, 456], 'foo', true)).to.eventually.deep.equal([789])
      expect(sendGroupMsg.mock.calls).to.deep.equal([[123, 'foo'], [456, 'foo']])
    })
  })

  describe('Database API', () => {
    const app = new App()
    const warn = spyOn(new Logger('app'), 'warn')

    it('override database', () => {
      warn.mockClear()
      app.database = {} as any
      expect(warn.mock.calls).to.have.length(0)
      app.database = {} as any
      expect(warn.mock.calls).to.have.length(1)
    })

    it('extend database', () => {
      const callback = fn()
      const id = 'this-module-does-not-exist'
      extendDatabase(id, callback)
      expect(callback.mock.calls).to.have.length(0)
      class CustomDatabase {}
      const module = require.cache[require.resolve('koishi-core/src/database.ts')]
      const mockedRequire = spyOn(module, 'require')
      mockedRequire.mockReturnValue({ default: CustomDatabase })
      extendDatabase(id, callback)
      expect(callback.mock.calls).to.deep.equal([[CustomDatabase]])
      mockedRequire.mockRestore()
    })
  })
})
