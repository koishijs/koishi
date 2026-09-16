import { App, Database, Session, sleep } from 'koishi'
import { expect } from 'chai'
import mock from '@koishijs/plugin-mock'
import memory from '@minatojs/driver-memory'

describe('Session API', () => {
  describe('Command Execution', () => {
    const app = new App()
    app.plugin(mock)
    const client = app.mock.client('456')

    app.command('echo [content:text]').action((_, text) => text)
    app.command('exec [command:text]').action(({ session }, text) => session.execute(text))

    before(() => app.start())
    after(() => app.stop())

    it('basic support', async () => {
      await client.shouldReply('echo 0', '0')
      await client.shouldReply('exec echo 0', '0')
    })

    it('interpolate 1', async () => {
      await client.shouldReply('echo $(echo 0)', '0')
      await client.shouldReply('echo $(exec echo 0)', '0')
      await client.shouldReply('echo 1$(echo 0)2', '102')
      await client.shouldReply('echo 1 $(echo 0)  2', '1 0  2')
    })

    it('interpolate 2', async () => {
      await client.shouldReply('echo $(echo $(echo 0))', '0')
      await client.shouldReply('echo 1 $(echo $(echo 0))2', '1 02')
    })
  })

  describe('Other Session Methods', () => {
    const app = new App({ prefix: '.' })
    app.plugin(mock)
    const client = app.mock.client('123', '456')

    before(() => app.start())
    after(() => app.stop())

    app.middleware(async (session, next) => {
      if (session.content !== 'prompt') return next()
      await session.send('prompt text')
      const message = await session.prompt() || 'nothing'
      await session.send('received ' + message)
    })

    it('session.prompt 1', async () => {
      await client.shouldReply('prompt', 'prompt text')
      await client.shouldReply('foo', 'received foo')
      await client.shouldNotReply('foo')
    })

    it('session.prompt 2', async () => {
      app.koishi.config.delay.prompt = 0
      await client.shouldReply('prompt', 'prompt text')
      await sleep(0)
      await client.shouldReply('foo', 'received nothing')
    })
  })

  it('autoAuthorize', async () => {
    const app = new App({ autoAuthorize: 0 })
    app.plugin(mock)
    app.plugin(memory)
    app.command('foo').action(() => 'foo')
    app.middleware(async (session, next) => {
      session.user['name'] = 'bar'
      return 'bar'
    })
    await app.start()
    const client = app.mock.client('123', '456')
    await client.shouldReply('foo', '权限不足。')
    await client.shouldReply('bar', 'bar')
  })

  // https://github.com/koishijs/koishi/issues/1545
  describe('concurrent get-or-create', () => {
    async function setup() {
      const app = new App()
      app.plugin(mock)
      app.plugin(memory)
      await app.start()
      return app
    }

    function makeSession(app: App, channelId: string) {
      const session = app.bots[0].session() as Session
      session.userId = '123'
      session.channelId = channelId
      session.guildId = channelId
      return session
    }

    // Simulate the losing side of a creation race against a
    // uniqueness-enforcing driver (sqlite/mysql/postgres reject the loser's
    // INSERT): let the winner's row land first, then run the loser's INSERT
    // for real so the driver's own primary-key check fires.
    function loseRace(table: string) {
      const create = Database.prototype.create
      let winnerDone = false
      Database.prototype.create = (async function (this: any, name: any, data: any) {
        if (name === table && !winnerDone) {
          winnerDone = true
          await create.call(this, name, data)
        }
        return create.call(this, name, data)
      }) as any
      return () => { Database.prototype.create = create }
    }

    it('getChannel returns the winning row when creation loses a race', async () => {
      const app = await setup()
      const restore = loseRace('channel')
      try {
        const channel = await makeSession(app, 'race').getChannel('race', ['assignee'])
        expect(channel.id).to.equal('race')
        expect(channel.platform).to.equal('mock')
        expect(await app.database.getChannel('mock', ['race'])).to.have.length(1)
      } finally {
        restore()
        await app.stop()
      }
    })

    it('getChannel rethrows when creation fails without a winner', async () => {
      const app = await setup()
      const create = Database.prototype.create
      Database.prototype.create = (async () => {
        throw new Error('connection lost')
      }) as any
      try {
        // Note: no chai-as-promised here on purpose. Registering it via
        // use() a second time in the same process breaks chai-shape
        // assertions in sibling spec files.
        let error: any
        try {
          await makeSession(app, 'nope').getChannel('nope', ['assignee'])
        } catch (e) {
          error = e
        }
        expect(error).to.be.instanceOf(Error)
        expect(error.message).to.equal('connection lost')
        expect(await app.database.getChannel('mock', ['nope'])).to.have.length(0)
      } finally {
        Database.prototype.create = create
        await app.stop()
      }
    })

    it('getUser returns the winning row when creation loses a race', async () => {
      const app = await setup()
      const restore = loseRace('binding')
      try {
        const user = await makeSession(app, 'race').getUser('321', ['authority'])
        expect(user.authority).to.equal(1)
      } finally {
        restore()
        await app.stop()
      }
    })
  })
})
