import { App } from 'koishi-test-utils'
import { sleep } from 'koishi-utils'

describe('Session API', () => {
  describe('command suggestions', () => {
    const app = new App()
    const session1 = app.createSession('user', 456)
    const session2 = app.createSession('group', 789, 987)

    app.command('foo <text>', { checkArgCount: true })
      .action((_, bar) => 'foo' + bar)

    app.command('fooo', { checkUnknown: true })
      .alias('bool')
      .option('text', '-t <bar>')
      .action(({ options }) => 'fooo' + options.text)

    it('execute command', async () => {
      await session1.shouldHaveReply('foo bar', 'foobar')
      await session1.shouldHaveNoReply(' ')
    })

    it('no suggestions', async () => {
      await session1.shouldHaveNoReply('bar foo')
    })

    it('apply suggestions 1', async () => {
      await session1.shouldHaveReply('fo bar', '你要找的是不是“foo”？发送空行或句号以调用推测的指令。')
      await session2.shouldHaveReply('fooo -t bar', 'fooobar')
      await session1.shouldHaveReply(' ', 'foobar')
      await session1.shouldHaveNoReply(' ')
    })

    it('apply suggestions 2', async () => {
      await session2.shouldHaveReply('foooo -t bar', '你要找的是不是“fooo”？发送空行或句号以调用推测的指令。')
      await session1.shouldHaveReply('foo bar', 'foobar')
      await session2.shouldHaveReply(' ', 'fooobar')
      await session2.shouldHaveNoReply(' ')
    })

    it('ignore suggestions 1', async () => {
      await session1.shouldHaveReply('fo bar', '你要找的是不是“foo”？发送空行或句号以调用推测的指令。')
      await session1.shouldHaveNoReply('bar foo')
      await session1.shouldHaveNoReply(' ')
    })

    it('ignore suggestions 2', async () => {
      await session2.shouldHaveReply('fo bar', '你要找的是不是“foo”？发送空行或句号以调用推测的指令。')
      await session2.shouldHaveReply('foo bar', 'foobar')
      await session2.shouldHaveNoReply(' ')
    })

    it('multiple suggestions', async () => {
      await session1.shouldHaveReply('fool bar', '你要找的是不是“foo”或“fooo”或“bool”？')
      await session1.shouldHaveNoReply(' ')
    })
  })

  describe('other session methods', () => {
    const app = new App({ prefix: '.' })
    const session = app.createSession('group', 123, 456)
    const items = ['foo', 'bar']
    const command = app.command('find [item]').action(({ session }, item) => {
      if (items.includes(item)) return 'found:' + item
      return session.$suggest({
        target: item,
        items: ['foo', 'bar', 'baz'],
        prefix: 'PREFIX',
        suffix: 'SUFFIX',
        apply(message) {
          return command.execute({ args: [message], session: this, command })
        },
      })
    })

    it('no suggestions', async () => {
      await session.shouldHaveNoReply(' ')
      await session.shouldHaveNoReply('find for')
    })

    it('show suggestions', async () => {
      await session.shouldHaveReply('.find 111', 'PREFIX')
      await session.shouldHaveNoReply(' ')
      await session.shouldHaveReply('.find for', `PREFIX你要找的是不是“foo”？SUFFIX`)
      await session.shouldHaveReply(' ', 'found:foo')
      await session.shouldHaveReply('.find bax', `PREFIX你要找的是不是“bar”或“baz”？`)
      await session.shouldHaveNoReply(' ')
    })

    app.middleware(async (session, next) => {
      if (session.message !== 'prompt') return next()
      await session.$send('prompt text')
      session.$prompt().then(
        message => session.$send('received ' + message),
        () => session.$send('received nothing'),
      )
    })

    it('session.$prompt (resolved)', async () => {
      await session.shouldHaveReply('prompt', 'prompt text')
      await session.shouldHaveReply('foo', 'received foo')
      await session.shouldHaveNoReply('foo')
    })

    it('session.$prompt (rejected)', async () => {
      app.options.promptTimeout = 0
      await session.shouldHaveReply('prompt', 'prompt text')
      await sleep(0)
      await session.shouldHaveReply('foo', 'received nothing')
    })
  })
})
