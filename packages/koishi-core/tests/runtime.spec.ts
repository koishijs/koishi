import { App, memory } from 'koishi-test-utils'
import { User, Group, Command } from 'koishi-core'
import { sleep } from 'koishi-utils'

const app = new App({
  groupCacheAge: Number.EPSILON,
  userCacheAge: Number.EPSILON,
  similarityCoefficient: 0,
})

app.plugin(memory)

// make coverage happy
Command.groupFields([])

const session1 = app.createSession('user', 123)
const session2 = app.createSession('user', 456)
const session3 = app.createSession('user', 789)
const session4 = app.createSession('group', 123, 321)
const session5 = app.createSession('group', 123, 654)

const cmd1 = app.command('cmd1 <arg1>', { authority: 2 })
  .groupFields(['id'])
  .shortcut('foo1', { args: ['bar'] })
  .shortcut('foo4', { oneArg: true, fuzzy: true })
  .option('--bar', '', { authority: 3 })
  .option('--baz', '', { notUsage: true })
  .action(({ session }, arg) => session.$send('cmd1:' + arg))

const cmd2 = app.command('cmd2')
  .userFields(['id'])
  .shortcut('foo2', { options: { text: 'bar' } })
  .shortcut('foo3', { prefix: true, fuzzy: true })
  .option('--bar', '', { authority: 3 })
  .option('--baz', '', { notUsage: true })
  .action(({ session }) => session.$send('cmd2:' + session.$user.id))

before(async () => {
  await app.start()
  await app.database.getUser(123, 2)
  await app.database.getUser(456, 1)
  await app.database.getUser(789, 1)
  // make coverage happy (checkTimer)
  await app.database.setUser(456, { timers: { foo: 0 } })
  await app.database.setUser(789, { flag: User.Flag.ignore })
  await app.database.getGroup(321, app.selfId)
  await app.database.getGroup(654, 999)
})

after(() => app.stop())

describe('Runtime', () => {
  describe('command prefix', () => {
    it('single prefix', async () => {
      app.options.prefix = '!'
      app.prepare()

      await session1.shouldHaveReply('cmd2', 'cmd2:123')
      await session4.shouldHaveNoReply('cmd2')
      await session1.shouldHaveReply('!cmd2', 'cmd2:123')
      await session4.shouldHaveReply('!cmd2', 'cmd2:123')
      await session1.shouldHaveNoReply('.cmd2')
      await session4.shouldHaveNoReply('.cmd2')
    })

    it('multiple prefixes', async () => {
      app.options.prefix = ['!', '.']
      app.prepare()

      await session1.shouldHaveReply('cmd2', 'cmd2:123')
      await session4.shouldHaveNoReply('cmd2')
      await session1.shouldHaveReply('!cmd2', 'cmd2:123')
      await session4.shouldHaveReply('!cmd2', 'cmd2:123')
      await session1.shouldHaveReply('.cmd2', 'cmd2:123')
      await session4.shouldHaveReply('.cmd2', 'cmd2:123')
    })

    it('optional prefix', async () => {
      app.options.prefix = ['.', '']
      app.prepare()

      await session1.shouldHaveReply('cmd2', 'cmd2:123')
      await session4.shouldHaveReply('cmd2', 'cmd2:123')
      await session1.shouldHaveNoReply('!cmd2')
      await session4.shouldHaveNoReply('!cmd2')
      await session1.shouldHaveReply('.cmd2', 'cmd2:123')
      await session4.shouldHaveReply('.cmd2', 'cmd2:123')
    })

    it('no prefix', async () => {
      app.options.prefix = null
      app.prepare()

      await session1.shouldHaveReply('cmd2', 'cmd2:123')
      await session4.shouldHaveReply('cmd2', 'cmd2:123')
      await session1.shouldHaveNoReply('!cmd2')
      await session4.shouldHaveNoReply('!cmd2')
      await session1.shouldHaveNoReply('.cmd2')
      await session4.shouldHaveNoReply('.cmd2')
    })
  })

  describe('nickname prefix', () => {
    before(() => {
      app.options.prefix = '-'
      app.prepare()
    })

    after(() => {
      app.options.prefix = null
      app.prepare()
    })

    it('no nickname', async () => {
      await session1.shouldHaveReply('cmd2', 'cmd2:123')
      await session4.shouldHaveNoReply('cmd2')
      await session1.shouldHaveReply('-cmd2', 'cmd2:123')
      await session4.shouldHaveReply('-cmd2', 'cmd2:123')
      await session4.shouldHaveReply(`[CQ:reply,id=123][CQ:at,qq=${app.selfId}] cmd2`, 'cmd2:123')
    })

    it('single nickname', async () => {
      app.options.nickname = 'koishi'
      app.prepare()

      await session1.shouldHaveReply('koishi, cmd2', 'cmd2:123')
      await session4.shouldHaveReply('koishi, cmd2', 'cmd2:123')
      await session1.shouldHaveReply('koishi\n cmd2', 'cmd2:123')
      await session4.shouldHaveReply('koishi\n cmd2', 'cmd2:123')
      await session1.shouldHaveReply('@koishi cmd2', 'cmd2:123')
      await session4.shouldHaveReply('@koishi cmd2', 'cmd2:123')
      await session1.shouldHaveNoReply('komeiji, cmd2')
      await session4.shouldHaveNoReply('komeiji, cmd2')
    })

    it('multiple nicknames', async () => {
      app.options.nickname = ['komeiji', 'koishi']
      app.prepare()

      await session1.shouldHaveReply('cmd2', 'cmd2:123')
      await session4.shouldHaveNoReply('cmd2')
      await session1.shouldHaveReply('-cmd2', 'cmd2:123')
      await session4.shouldHaveReply('-cmd2', 'cmd2:123')
      await session1.shouldHaveReply('koishi, cmd2', 'cmd2:123')
      await session4.shouldHaveReply('koishi, cmd2', 'cmd2:123')
      await session1.shouldHaveReply('komeiji cmd2', 'cmd2:123')
      await session4.shouldHaveReply('komeiji cmd2', 'cmd2:123')
    })
  })

  describe('shortcuts', () => {
    before(() => {
      app.options.prefix = '#'
      app.prepare()
    })

    after(() => {
      app.options.prefix = null
      app.prepare()
    })

    it('single shortcut', async () => {
      await session4.shouldHaveReply(' foo1 ', 'cmd1:bar')
      await session4.shouldHaveReply(' foo2 ', 'cmd2:123')
      await session4.shouldHaveNoReply('foo1 bar')
      await session4.shouldHaveNoReply('foo2 -t bar')
    })

    it('no command prefix', async () => {
      await session4.shouldHaveNoReply('#foo1')
      await session4.shouldHaveNoReply('#foo2')
    })

    it('nickname prefix & fuzzy', async () => {
      await session4.shouldHaveNoReply('foo3 -t baz')
      await session4.shouldHaveReply(`[CQ:at,qq=${app.selfId}] foo3 -t baz`, 'cmd2:123')
    })

    it('one argument & fuzzy', async () => {
      await session4.shouldHaveReply('foo4 bar baz', 'cmd1:bar baz')
      await session4.shouldHaveNoReply('foo4bar baz')
      await session4.shouldHaveReply(`[CQ:at,qq=${app.selfId}] foo4bar baz`, 'cmd1:bar baz')
    })
  })

  describe('middleware validation', () => {
    app.middleware((session) => {
      if (session.message === 'mid') return session.$send('mid')
    })

    it('user.flag.ignore', async () => {
      await session1.shouldHaveReply('cmd2', 'cmd2:123')
      await session3.shouldHaveNoReply('cmd2')
    })

    it('group.assignee', async () => {
      await session4.shouldHaveReply('cmd1 test --baz', 'cmd1:test')
      await session4.shouldHaveReply('mid', 'mid')
      await session5.shouldHaveNoReply('cmd1 test --baz')
      await session5.shouldHaveReply(`[CQ:at,qq=${app.selfId}] cmd1 test --baz`, 'cmd1:test')
    })

    it('group.flag.ignore', async () => {
      await app.database.setGroup(321, { flag: Group.Flag.ignore })
      await sleep(0)
      await session4.shouldHaveNoReply('mid')
      await session4.shouldHaveNoReply('cmd1 --baz')
      await session4.shouldHaveNoReply(`[CQ:at,qq=${app.selfId}] cmd1 --baz`)
      await app.database.setGroup(321, { flag: 0 })
    })
  })

  describe('command validation', () => {
    it('check authority', async () => {
      app.command('cmd1', { showWarning: true })
      await session2.shouldHaveReply('cmd1', '权限不足。')
      await session1.shouldHaveReply('cmd1 --bar', '权限不足。')
      app.command('cmd1', { showWarning: false })
      await session1.shouldHaveNoReply('cmd1 --bar')
    })

    it('check usage', async () => {
      cmd1.config.maxUsage = 1
      cmd1.config.showWarning = true
      await session4.shouldHaveReply('cmd1 test', 'cmd1:test')
      await session4.shouldHaveReply('cmd1 test --baz', 'cmd1:test')
      await session1.shouldHaveReply('cmd1 test', '调用次数已达上限。')
      await session4.shouldHaveReply('cmd1 test --baz', 'cmd1:test')
      cmd1.config.showWarning = false
      await session1.shouldHaveNoReply('cmd1')
      delete cmd1.config.maxUsage
    })

    it('check frequency', async () => {
      cmd2.config.minInterval = () => 1000
      cmd2.config.showWarning = true
      await session2.shouldHaveReply('cmd2', 'cmd2:456')
      await session2.shouldHaveReply('cmd2 --baz', 'cmd2:456')
      await session2.shouldHaveReply('cmd2', '调用过于频繁，请稍后再试。')
      await session2.shouldHaveReply('cmd2 --baz', 'cmd2:456')
      cmd2.config.showWarning = false
      await session2.shouldHaveNoReply('cmd2')
      delete cmd2.config.minInterval
    })

    it('check arg count', async () => {
      cmd1.config.checkArgCount = true
      cmd1.config.showWarning = true
      await session4.shouldHaveReply('cmd1', '缺少参数，请检查指令语法。')
      await session4.shouldHaveReply('cmd1 foo', 'cmd1:foo')
      await session4.shouldHaveReply('cmd1 foo bar', '存在多余参数，请检查指令语法。')
      cmd1.config.showWarning = false
      await session4.shouldHaveNoReply('cmd1')
      cmd1.config.checkArgCount = false
    })

    it('check unknown option', async () => {
      cmd2.config.checkUnknown = true
      cmd2.config.showWarning = true
      await session2.shouldHaveReply('cmd2', 'cmd2:456')
      await session2.shouldHaveReply('cmd2 --foo', '存在未知选项 foo，请检查指令语法。')
      cmd2.config.showWarning = false
      await session2.shouldHaveNoReply('cmd2 --foo')
      cmd2.config.checkUnknown = false
    })

    it('option.validate', async () => {
      const cmd3 = app.command('cmd3').action(() => 'after cmd3')
      cmd3.option('foo', '', { validate: () => true })
      cmd3.option('bar', '', { validate: () => 'SUFFIX' })
      cmd3.option('baz', '', { validate: /$^/ })
      await session1.shouldHaveReply('cmd3', 'after cmd3')
      await session1.shouldHaveReply('cmd3 --foo', '选项 foo 输入无效，请检查指令语法。')
      await session1.shouldHaveReply('cmd3 --bar', '选项 bar 输入无效，SUFFIX')
      await session1.shouldHaveReply('cmd3 --baz', '选项 baz 输入无效，请检查指令语法。')
      cmd3.dispose()
    })

    it('command.before', async () => {
      const cmd3 = app.command('cmd3').action(() => 'after cmd3')
      await session1.shouldHaveReply('cmd3', 'after cmd3')
      let value: any = 'before cmd3'
      cmd3.before(() => value)
      await session1.shouldHaveReply('cmd3', 'before cmd3')
      value = true
      await session1.shouldHaveNoReply('cmd3')
      cmd3.dispose()
    })
  })
})
