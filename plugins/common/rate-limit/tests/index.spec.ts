import { App, Time } from 'koishi'
import mock from '@koishijs/plugin-mock'
import memory from '@koishijs/plugin-database-memory'
import * as rate from '@koishijs/plugin-rate-limit'
import { install } from '@sinonjs/fake-timers'

const app = new App()
const now = Date.now()

app.plugin(mock)
app.plugin(memory)
app.plugin(rate)

const client1 = app.mock.client('123')
const client2 = app.mock.client('456')

before(async () => {
  await app.start()
  await app.mock.initUser('123', 2)
  await app.database.setUser('mock', '123', {
    usage: { cmd1: 1, $date: Time.getDateNumber() },
    timers: { cmd2: now + Time.minute, $date: now + Time.day },
  })
})

describe('@koishijs/plugin-rate-limit', () => {
  describe('maxUsage', () => {
    const cmd = app
      .command('cmd1', '指令1', { maxUsage: 3 })
      .option('opt1', '选项1', { notUsage: true })
      .option('opt2', '选项2')
      .action(() => 'test')

    it('Extended Help', async () => {
      await client1.shouldReply('help cmd1', [
        'cmd1',
        '指令1',
        '已调用次数：1/3。',
        '可用的选项有：',
        '    --opt1  选项1（不计入总次数）',
        '    --opt2  选项2',
      ].join('\n'))
    })

    it('Runtime Check', async () => {
      cmd.config.showWarning = true
      await client1.shouldReply('cmd1', 'test')
      await client1.shouldReply('cmd1', 'test')
      await client1.shouldReply('cmd1', '调用次数已达上限。')
      await client2.shouldReply('cmd1', 'test')
      await client1.shouldReply('cmd1 --opt1', 'test')
      cmd.config.showWarning = false
      await client1.shouldNotReply('cmd1')
    })
  })

  describe('minInterval', () => {
    const cmd = app
      .command('cmd2', '指令2', { minInterval: 3 * Time.minute, hideOptions: true })
      .option('opt1', '选项1', { notUsage: true })
      .option('opt2', '选项2')
      .action(() => 'test')

    it('Extended Help', async () => {
      const clock = install({ now })
      await client1.shouldReply('help cmd2', 'cmd2\n指令2\n距离下次调用还需：60/180 秒。')
      await client2.shouldReply('help cmd2', 'cmd2\n指令2\n距离下次调用还需：0/180 秒。')
      clock.uninstall()
    })

    it('Runtime Check', async () => {
      const clock = install({ now })
      cmd.config.showWarning = true
      await client1.shouldReply('cmd2', '调用过于频繁，请稍后再试。')
      await client1.shouldReply('cmd2 --opt1', 'test')
      await client2.shouldReply('cmd2', 'test')
      clock.tick(Time.minute + 1)
      await client1.shouldReply('cmd2', 'test')
      cmd.config.showWarning = false
      await client2.shouldNotReply('cmd2')
      clock.uninstall()
    })
  })
})
