import { App, sleep } from 'koishi'
import mock from '@koishijs/plugin-mock'

describe('Session API', () => {
  describe('Command Execution', () => {
    const app = new App().plugin(mock)
    const client = app.mock.client('456')

    app.command('echo [content:text]').action((_, text) => text)
    app.command('exec [command:text]').action(({ session }, text) => session.execute(text))

    before(() => app.start())

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

  describe('Command Suggestion', () => {
    const app = new App({ prefix: '/' }).plugin(mock)
    const client1 = app.mock.client('456')
    const client2 = app.mock.client('789', '987')

    app.command('foo <text>', { checkArgCount: true })
      .action((_, bar) => 'foo' + bar)

    app.command('fooo', { checkUnknown: true })
      .alias('bool')
      .option('text', '-t <bar>')
      .action(({ options }) => 'fooo' + options.text)

    before(() => app.start())

    it('execute command', async () => {
      await client1.shouldReply('foo bar', 'foobar')
      await client1.shouldNotReply(' ')
    })

    it('no suggestions', async () => {
      await client1.shouldNotReply('bar foo')
    })

    it('apply suggestions 1', async () => {
      await client1.shouldReply('fo bar', '您要找的是不是“foo”？发送句号以使用推测的指令。')
      await client2.shouldReply('/fooo -t bar', 'fooobar')
      await client1.shouldReply(' ', 'foobar')
      await client1.shouldNotReply(' ')
    })

    it('apply suggestions 2', async () => {
      await client2.shouldReply('/foooo -t bar', '您要找的是不是“fooo”？发送句号以使用推测的指令。')
      await client1.shouldReply('foo bar', 'foobar')
      await client2.shouldReply(' ', 'fooobar')
      await client2.shouldNotReply(' ')
    })

    it('ignore suggestions 1', async () => {
      await client1.shouldReply('fo bar', '您要找的是不是“foo”？发送句号以使用推测的指令。')
      await client1.shouldNotReply('bar foo')
      await client1.shouldNotReply(' ')
    })

    it('ignore suggestions 2', async () => {
      await client2.shouldReply('/fo bar', '您要找的是不是“foo”？发送句号以使用推测的指令。')
      await client2.shouldReply('/foo bar', 'foobar')
      await client2.shouldNotReply(' ')
    })

    it('multiple suggestions', async () => {
      await client1.shouldReply('fool bar', '您要找的是不是“foo”或“fooo”或“bool”？')
      await client1.shouldNotReply(' ')
    })
  })

  describe('Other Session Methods', () => {
    const app = new App({ prefix: '.' }).plugin(mock)
    const client = app.mock.client('123', '456')
    const items = ['foo', 'bar']

    app.command('find [item]').action(({ session }, item) => {
      if (items.includes(item)) return 'found:' + item
      return session.suggest({
        target: item,
        items: ['foo', 'bar', 'baz'],
        prefix: 'PREFIX',
        suffix: 'SUFFIX',
        apply(message) {
          return session.execute({ args: [message], name: 'find' })
        },
      })
    })

    before(() => app.start())

    it('no suggestions', async () => {
      await client.shouldNotReply(' ')
      await client.shouldNotReply('find for')
    })

    it('show suggestions', async () => {
      await client.shouldReply('.find 111', 'PREFIX')
      await client.shouldNotReply(' ')
      await client.shouldReply('.find for', `PREFIX您要找的是不是“foo”？SUFFIX`)
      await client.shouldReply(' ', 'found:foo')
      await client.shouldReply('.find bax', `PREFIX您要找的是不是“bar”或“baz”？`)
      await client.shouldNotReply(' ')
    })

    app.middleware(async (session, next) => {
      if (session.content !== 'prompt') return next()
      await session.send('prompt text')
      ;(async () => {
        const message = await session.prompt() || 'nothing'
        await session.send('received ' + message)
      })()
    })

    it('session.prompt 1', async () => {
      await client.shouldReply('prompt', 'prompt text')
      await client.shouldReply('foo', 'received foo')
      await client.shouldNotReply('foo')
    })

    it('session.prompt 2', async () => {
      app.options.delay.prompt = 0
      await client.shouldReply('prompt', 'prompt text')
      await sleep(0)
      await client.shouldReply('foo', 'received nothing')
    })
  })
})
