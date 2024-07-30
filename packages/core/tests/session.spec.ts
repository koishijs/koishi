import { App, sleep } from 'koishi'
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
})
