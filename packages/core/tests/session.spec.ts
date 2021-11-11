import { App } from '@koishijs/test-utils'
import { sleep } from 'koishi'

describe('Session API', () => {
  describe('Command Execution', () => {
    const app = new App()
    const sess = app.session('456')
    app.command('echo [content:text]').action((_, text) => text)
    app.command('exec [command:text]').action(({ session }, text) => session.execute(text))

    it('basic support', async () => {
      await sess.shouldReply('echo 0', '0')
      await sess.shouldReply('exec echo 0', '0')
    })

    it('interpolate 1', async () => {
      await sess.shouldReply('echo $(echo 0)', '0')
      await sess.shouldReply('echo $(exec echo 0)', '0')
      await sess.shouldReply('echo 1$(echo 0)2', '102')
      await sess.shouldReply('echo 1 $(echo 0)  2', '1 0  2')
    })

    it('interpolate 2', async () => {
      await sess.shouldReply('echo $(echo $(echo 0))', '0')
      await sess.shouldReply('echo 1 $(echo $(echo 0))2', '1 02')
    })
  })

  describe('Command Suggestion', () => {
    const app = new App({ prefix: '/' })
    const session1 = app.session('456')
    const session2 = app.session('789', '987')

    app.command('foo <text>', { checkArgCount: true })
      .action((_, bar) => 'foo' + bar)

    app.command('fooo', { checkUnknown: true })
      .alias('bool')
      .option('text', '-t <bar>')
      .action(({ options }) => 'fooo' + options.text)

    it('execute command', async () => {
      await session1.shouldReply('foo bar', 'foobar')
      await session1.shouldNotReply(' ')
    })

    it('no suggestions', async () => {
      await session1.shouldNotReply('bar foo')
    })

    it('apply suggestions 1', async () => {
      await session1.shouldReply('fo bar', '您要找的是不是“foo”？发送空行或句号以使用推测的指令。')
      await session2.shouldReply('/fooo -t bar', 'fooobar')
      await session1.shouldReply(' ', 'foobar')
      await session1.shouldNotReply(' ')
    })

    it('apply suggestions 2', async () => {
      await session2.shouldReply('/foooo -t bar', '您要找的是不是“fooo”？发送空行或句号以使用推测的指令。')
      await session1.shouldReply('foo bar', 'foobar')
      await session2.shouldReply(' ', 'fooobar')
      await session2.shouldNotReply(' ')
    })

    it('ignore suggestions 1', async () => {
      await session1.shouldReply('fo bar', '您要找的是不是“foo”？发送空行或句号以使用推测的指令。')
      await session1.shouldNotReply('bar foo')
      await session1.shouldNotReply(' ')
    })

    it('ignore suggestions 2', async () => {
      await session2.shouldReply('/fo bar', '您要找的是不是“foo”？发送空行或句号以使用推测的指令。')
      await session2.shouldReply('/foo bar', 'foobar')
      await session2.shouldNotReply(' ')
    })

    it('multiple suggestions', async () => {
      await session1.shouldReply('fool bar', '您要找的是不是“foo”或“fooo”或“bool”？')
      await session1.shouldNotReply(' ')
    })
  })

  describe('Other Session Methods', () => {
    const app = new App({ prefix: '.' })
    const session = app.session('123', '456')
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

    it('no suggestions', async () => {
      await session.shouldNotReply(' ')
      await session.shouldNotReply('find for')
    })

    it('show suggestions', async () => {
      await session.shouldReply('.find 111', 'PREFIX')
      await session.shouldNotReply(' ')
      await session.shouldReply('.find for', `PREFIX您要找的是不是“foo”？SUFFIX`)
      await session.shouldReply(' ', 'found:foo')
      await session.shouldReply('.find bax', `PREFIX您要找的是不是“bar”或“baz”？`)
      await session.shouldNotReply(' ')
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
      await session.shouldReply('prompt', 'prompt text')
      await session.shouldReply('foo', 'received foo')
      await session.shouldNotReply('foo')
    })

    it('session.prompt 2', async () => {
      app.options.delay.prompt = 0
      await session.shouldReply('prompt', 'prompt text')
      await sleep(0)
      await session.shouldReply('foo', 'received nothing')
    })
  })
})
