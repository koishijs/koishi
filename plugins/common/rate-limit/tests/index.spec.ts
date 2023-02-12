import { App, Time } from 'koishi'
import mock from '@koishijs/plugin-mock'
import memory from '@koishijs/plugin-database-memory'
import { install } from '@sinonjs/fake-timers'
import * as help from '@koishijs/plugin-help'
import * as rate from '../src'

const app = new App()
let now = Date.now()

app.plugin(help)
app.plugin(mock)
app.plugin(memory)
app.plugin(rate)

const client1 = app.mock.client('123')
const client2 = app.mock.client('456')

before(async () => {
  await app.start()
  await app.mock.initUser('123', 4, {
    usage: { foo: 1, _date: Time.getDateNumber() },
    timers: { bar: now + Time.minute, _date: now + Time.day },
  })
})

describe('@koishijs/plugin-rate-limit', () => {
  describe('maxUsage', () => {
    const cmd = app
      .command('foo', '指令1', { maxUsage: 3 })
      .option('opt1', '选项1', { notUsage: true })
      .option('opt2', '选项2')
      .action(() => 'test')

    it('Extended Help', async () => {
      await client1.shouldReply('help foo -H', [
        'foo',
        '指令1',
        '已调用次数：1/3。',
        '可用的选项有：',
        '    -h, --help  显示此信息 (不计入调用)',
        '    --opt1  选项1 (不计入调用)',
        '    --opt2  选项2',
      ].join('\n'))
    })

    it('Runtime Check', async () => {
      cmd.config.showWarning = true
      await client1.shouldReply('foo', 'test')
      await client1.shouldReply('foo', 'test')
      await client1.shouldReply('foo', '调用次数已达上限。')
      await client2.shouldReply('foo', 'test')
      await client1.shouldReply('foo --opt1', 'test')
      cmd.config.showWarning = false
      await client1.shouldNotReply('foo')
    })

    it('Modify Usages', async () => {
      await client1.shouldReply('usage', '今日各功能的调用次数为：\nfoo：3')
      await client1.shouldReply('usage -c foo', '用户数据已修改。')
      await client1.shouldReply('usage', '今日没有调用过消耗次数的功能。')
      await client1.shouldReply('usage -s bar', '缺少参数，输入帮助以查看用法。')
      await client1.shouldReply('usage -s bar nan', '参数 value 输入无效，请提供一个正整数。')
      await client1.shouldReply('usage -s bar 2', '用户数据已修改。')
      await client1.shouldReply('usage bar', '今日 bar 功能的调用次数为：2')
      await client1.shouldReply('usage baz', '今日 baz 功能的调用次数为：0')
      await client1.shouldReply('usage -c', '用户数据已修改。')
      await client1.shouldReply('usage', '今日没有调用过消耗次数的功能。')
    })
  })

  describe('minInterval', () => {
    const cmd = app
      .command('bar', '指令2', { minInterval: 3 * Time.minute, hideOptions: true })
      .option('opt1', '选项1', { notUsage: true })
      .option('opt2', '选项2')
      .action(() => 'test')

    it('Extended Help', async () => {
      const clock = install({ now })
      try {
        await client1.shouldReply('help bar', 'bar\n指令2\n距离下次调用还需：60/180 秒。')
        await client2.shouldReply('help bar', 'bar\n指令2\n距离下次调用还需：0/180 秒。')
      } finally {
        clock.uninstall()
      }
    })

    it('Runtime Check', async () => {
      const clock = install({ now })
      try {
        cmd.config.showWarning = true
        await client1.shouldReply('bar', '调用过于频繁，请稍后再试。')
        await client2.shouldReply('bar', 'test')
        clock.tick(Time.minute + 1)
        now = clock.now
        await client1.shouldReply('bar', 'test')
        await client1.shouldReply('bar --opt1', 'test')
        cmd.config.showWarning = false
        await client2.shouldNotReply('bar')
      } finally {
        clock.uninstall()
      }
    })

    it('Modify Timers', async () => {
      const clock = install({ now })
      try {
        await client1.shouldReply('timer', '各定时器的生效时间为：\nbar：剩余 3 分钟')
        await client1.shouldReply('timer -c bar', '用户数据已修改。')
        await client1.shouldReply('timer', '当前没有生效的定时器。')
        await client1.shouldReply('timer -s foo', '缺少参数，输入帮助以查看用法。')
        await client1.shouldReply('timer -s foo nan', '参数 value 输入无效，请输入合法的时间。')
        await client1.shouldReply('timer -s foo 2min', '用户数据已修改。')
        await client1.shouldReply('timer foo', '定时器 foo 的生效时间为：剩余 2 分钟')
        await client1.shouldReply('timer fox', '定时器 fox 当前并未生效。')
        await client1.shouldReply('timer -c', '用户数据已修改。')
        await client1.shouldReply('timer', '当前没有生效的定时器。')
      } finally {
        clock.uninstall()
      }
    })
  })

  describe('bypassAuthority', () => {
    it('bypass maxUsage', async () => {
      const cmd = app
        .command('qux', '指令3', { maxUsage: 1, bypassAuthority: 3 })
        .action(() => 'test')

      await client2.shouldReply('qux', 'test')
      await client2.shouldReply('qux', '调用次数已达上限。')
      await client1.shouldReply('qux', 'test')
      await client1.shouldReply('qux', 'test')
      await client1.shouldReply('qux', 'test')
    })
  })
})
