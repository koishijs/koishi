import { App, User, Channel, Command, sleep } from 'koishi'
import mock, { DEFAULT_SELF_ID } from '@koishijs/plugin-mock'
import memory from '@koishijs/plugin-database-memory'

const app = new App()

app.plugin(memory)
app.plugin(mock)

// make coverage happy
Command.channelFields([])

const client1 = app.mock.client('123')
const client2 = app.mock.client('456')
const client3 = app.mock.client('789')
const client4 = app.mock.client('123', '321')
const client5 = app.mock.client('123', '654')

const cmd1 = app.command('cmd1 <arg1>', { authority: 2 })
  .channelFields(['id'])
  .shortcut('foo1', { args: ['bar'] })
  .shortcut('foo4', { fuzzy: true })
  .option('bar', '', { authority: 3 })
  .option('baz', '')
  .action(({}, arg) => 'cmd1:' + arg)

const cmd2 = app.command('cmd2')
  .userFields(['id'])
  .shortcut('foo2', { options: { text: 'bar' } })
  .shortcut('foo3', { prefix: true, fuzzy: true })
  .option('bar', '', { authority: 3 })
  .option('baz', '')
  .action(({ session }) => 'cmd2:' + session.userId)

app.middleware((session, next) => {
  if (session.content.includes('escape')) return 'early'
  return next()
})

before(async () => {
  await app.start()
  await app.mock.initUser('123', 2)
  await app.mock.initUser('456', 1)
  await app.mock.initUser('789', 1)
  await app.database.setUser('mock', '789', { flag: User.Flag.ignore })
  await app.mock.initChannel('321')
  await app.mock.initChannel('654', '999')
})

after(() => app.stop())

describe('Runtime', () => {
  describe('Command Prefix', () => {
    it('single prefix', async () => {
      // also support functions
      app.config.prefix = () => '!'

      await client1.shouldReply('cmd2', 'cmd2:123')
      await client4.shouldNotReply('cmd2')
      await client1.shouldReply('!cmd2', 'cmd2:123')
      await client4.shouldReply('!cmd2', 'cmd2:123')
      await client1.shouldNotReply('.cmd2')
      await client4.shouldNotReply('.cmd2')
    })

    it('multiple prefixes', async () => {
      app.config.prefix = ['!', '.']

      await client1.shouldReply('cmd2', 'cmd2:123')
      await client4.shouldNotReply('cmd2')
      await client1.shouldReply('!cmd2', 'cmd2:123')
      await client4.shouldReply('!cmd2', 'cmd2:123')
      await client1.shouldReply('.cmd2', 'cmd2:123')
      await client4.shouldReply('.cmd2', 'cmd2:123')
    })

    it('optional prefix', async () => {
      app.config.prefix = ['.', '']

      await client1.shouldReply('cmd2', 'cmd2:123')
      await client4.shouldReply('cmd2', 'cmd2:123')
      await client1.shouldNotReply('!cmd2')
      await client4.shouldNotReply('!cmd2')
      await client1.shouldReply('.cmd2', 'cmd2:123')
      await client4.shouldReply('.cmd2', 'cmd2:123')
    })

    it('no prefix', async () => {
      app.config.prefix = null

      await client1.shouldReply('cmd2', 'cmd2:123')
      await client4.shouldReply('cmd2', 'cmd2:123')
      await client1.shouldNotReply('!cmd2')
      await client4.shouldNotReply('!cmd2')
      await client1.shouldNotReply('.cmd2')
      await client4.shouldNotReply('.cmd2')
    })
  })

  describe('Nickname Prefix', () => {
    before(() => {
      app.config.prefix = '-'
      app.$internal.prepare()
    })

    after(() => {
      app.config.prefix = null
      app.$internal.prepare()
    })

    it('no nickname', async () => {
      await client1.shouldReply('cmd2', 'cmd2:123')
      await client4.shouldNotReply('cmd2')
      await client1.shouldReply('-cmd2', 'cmd2:123')
      await client4.shouldReply('-cmd2', 'cmd2:123')
      await client4.shouldNotReply(`<reply id=123/> <at id=${DEFAULT_SELF_ID}/> cmd2`)
    })

    it('single nickname', async () => {
      app.config.nickname = 'koishi'
      app.$internal.prepare()

      await client1.shouldReply('koishi, cmd2', 'cmd2:123')
      await client4.shouldReply('koishi, cmd2', 'cmd2:123')
      await client1.shouldReply('koishi\n cmd2', 'cmd2:123')
      await client4.shouldReply('koishi\n cmd2', 'cmd2:123')
      await client1.shouldReply('@koishi cmd2', 'cmd2:123')
      await client4.shouldReply('@koishi cmd2', 'cmd2:123')
      await client1.shouldNotReply('komeiji, cmd2')
      await client4.shouldNotReply('komeiji, cmd2')
    })

    it('multiple nicknames', async () => {
      app.config.nickname = ['komeiji', 'koishi']
      app.$internal.prepare()

      await client1.shouldReply('cmd2', 'cmd2:123')
      await client4.shouldNotReply('cmd2')
      await client1.shouldReply('-cmd2', 'cmd2:123')
      await client4.shouldReply('-cmd2', 'cmd2:123')
      await client1.shouldReply('koishi, cmd2', 'cmd2:123')
      await client4.shouldReply('koishi, cmd2', 'cmd2:123')
      await client1.shouldReply('komeiji cmd2', 'cmd2:123')
      await client4.shouldReply('komeiji cmd2', 'cmd2:123')
    })
  })

  describe('Shortcuts', () => {
    before(() => {
      app.config.prefix = '#'
      app.$internal.prepare()
    })

    after(() => {
      app.config.prefix = null
      app.$internal.prepare()
    })

    it('single shortcut', async () => {
      await client4.shouldReply(' foo1 ', 'cmd1:bar')
      await client4.shouldReply(' foo2 ', 'cmd2:123')
      await client4.shouldNotReply('foo1 bar')
      await client4.shouldNotReply('foo2 -t bar')
    })

    it('no command prefix', async () => {
      await client4.shouldNotReply('#foo1')
      await client4.shouldNotReply('#foo2')
    })

    it('nickname prefix & fuzzy', async () => {
      await client4.shouldNotReply('foo3 -t baz')
      await client4.shouldReply(`<at id=${DEFAULT_SELF_ID}/> foo3 -t baz`, 'cmd2:123')
    })

    it('one argument & fuzzy', async () => {
      await client4.shouldReply('foo4 bar baz', 'cmd1:bar')
      await client4.shouldNotReply('foo4bar baz')
      await client4.shouldReply(`<at id=${DEFAULT_SELF_ID}/> foo4bar baz`, 'cmd1:bar')
    })
  })

  describe('Middleware Validation', () => {
    it('user.flag.ignore', async () => {
      await client1.shouldReply('cmd2', 'cmd2:123')
      await client3.shouldNotReply('cmd2')
    })

    it('channel.assignee', async () => {
      await client4.shouldReply('cmd1 test --baz', 'cmd1:test')
      await client4.shouldReply('escape', 'early')
      await client5.shouldNotReply('cmd1 test --baz')
      await client5.shouldReply(`<at id=${DEFAULT_SELF_ID}/> cmd1 test --baz`, 'cmd1:test')
    })

    it('channel.flag.ignore', async () => {
      await app.database.setChannel('mock', '321', { flag: Channel.Flag.ignore })
      await sleep(0)
      await client4.shouldNotReply('escape')
      await client4.shouldNotReply('cmd1 --baz')
      await client4.shouldNotReply(`<at id=${DEFAULT_SELF_ID}/> cmd1 --baz`)
      await app.database.setChannel('mock', '321', { flag: 0 })
    })
  })

  describe('Command Validation', () => {
    it('check authority', async () => {
      app.command('cmd1', { showWarning: true })
      await client2.shouldReply('cmd1', '权限不足。')
      await client1.shouldReply('cmd1 --bar', '权限不足。')
      app.command('cmd1', { showWarning: false })
      await client1.shouldNotReply('cmd1 --bar')
    })

    it('check arg count', async () => {
      cmd1.config.checkArgCount = true
      cmd1.config.showWarning = true
      await client4.shouldReply('cmd1', '缺少参数，输入帮助以查看用法。')
      await client4.shouldReply('cmd1 foo', 'cmd1:foo')
      await client4.shouldReply('cmd1 foo bar', '存在多余参数，输入帮助以查看用法。')
      cmd1.config.showWarning = false
      await client4.shouldNotReply('cmd1')
      cmd1.config.checkArgCount = false
    })

    it('check unknown option', async () => {
      cmd2.config.checkUnknown = true
      cmd2.config.showWarning = true
      await client2.shouldReply('cmd2', 'cmd2:456')
      await client2.shouldReply('cmd2 --foo', '存在未知选项 foo，输入帮助以查看用法。')
      cmd2.config.showWarning = false
      await client2.shouldNotReply('cmd2 --foo')
      cmd2.config.checkUnknown = false
    })

    it('option.validate', async () => {
      const cmd3 = app.command('cmd3').action(() => 'after cmd3')
      cmd3.option('foo', '<foo>', { type: () => { throw new Error() } })
      cmd3.option('bar', '<bar>', { type: () => { throw new Error('SUFFIX') } })
      cmd3.option('baz', '<baz>', { type: /$^/ })
      cmd3.option('bax', '<baz>', { type: ['abc', 'def'] })
      await client1.shouldReply('cmd3', 'after cmd3')
      await client1.shouldReply('cmd3 --foo xxx', '选项 foo 输入无效，输入帮助以查看用法。')
      await client1.shouldReply('cmd3 --bar xxx', '选项 bar 输入无效，SUFFIX')
      await client1.shouldReply('cmd3 --baz xxx', '选项 baz 输入无效，输入帮助以查看用法。')
      await client1.shouldReply('cmd3 --bax cba', '选项 bax 输入无效，输入帮助以查看用法。')
      cmd3.dispose()
    })

    it('command.before()', async () => {
      const cmd3 = app.command('cmd3').action(() => 'after cmd3')
      await client1.shouldReply('cmd3', 'after cmd3')
      let value = 'before cmd3'
      cmd3.before(() => value)
      await client1.shouldReply('cmd3', 'before cmd3')
      value = ''
      await client1.shouldNotReply('cmd3')
      cmd3.dispose()
    })
  })
})
