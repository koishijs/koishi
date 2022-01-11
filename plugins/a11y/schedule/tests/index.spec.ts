import { App, Time } from 'koishi'
import { install, InstalledClock } from '@sinonjs/fake-timers'
import * as schedule from '@koishijs/plugin-schedule'
import memory from '@koishijs/plugin-database-memory'
import mock from '@koishijs/plugin-mock'
import jest from 'jest-mock'
import { expect } from 'chai'

const app = new App().plugin(mock)
const client1 = app.mock.client('123', '456')
const client2 = app.mock.client('123')

const send = app.bots[0].sendMessage = jest.fn()

app.plugin(memory)
app.plugin(schedule)
app.command('echo [content:text]').action((_, text) => text)

let clock: InstalledClock

before(async () => {
  await app.start()
  await app.mock.initUser('123', 4)
  await app.mock.initChannel('456')
  await app.database.create('schedule', {
    id: 1,
    time: new Date('2000-1-1 0:59'),
    assignee: app.bots[0].sid,
    interval: Time.day,
    command: 'echo bar',
    session: client2.meta,
  })
})

describe('Schedule Plugin', () => {
  before(async () => {
    clock = install({ now: new Date('2000-1-1 1:00') })
    await app.start()
  })

  after(() => clock.uninstall())

  it('register schedule', async () => {
    await client1.shouldReply('schedule -l', '当前没有等待执行的日程。')
    await client1.shouldReply('schedule 1m -- echo foo', '日程已创建，编号为 2。')
    await client1.shouldReply('schedule -l', '2. 2000-01-01 01:01:00：echo foo')
    await client1.shouldReply('schedule -lf', '1. 每天 00:59：echo bar，上下文：私聊 123\n2. 2000-01-01 01:01:00：echo foo，上下文：群聊 456')
    clock.tick(Time.minute) // 01:01
    await new Promise(process.nextTick)
    await client1.shouldReply('', 'foo')
    await client1.shouldReply('schedule -l', '当前没有等待执行的日程。')
  })

  it('interval schedule', async () => {
    await client1.shouldReply('schedule 00:30 / 1h -- echo foo', '日程已创建，编号为 2。')
    clock.tick(Time.minute * 20) // 01:21
    await new Promise(process.nextTick)
    await client1.shouldNotReply('')
    clock.tick(Time.minute * 10) // 01:31
    await new Promise(process.nextTick)
    await client1.shouldReply('', 'foo')
    await client1.shouldReply('schedule -l', '2. 2000-01-01 00:30:00 起每隔 1 小时：echo foo')
    await client1.shouldReply('schedule -d 2', '日程 2 已删除。')
    clock.tick(Time.hour) // 02:31
    await new Promise(process.nextTick)
    await client1.shouldNotReply('')
  })

  it('database integration', async () => {
    expect(send.mock.calls).to.have.length(0)
    clock.tick(Time.day) // 02:31
    await new Promise(process.nextTick)
    await new Promise(process.nextTick)
    expect(send.mock.calls).to.have.length(1)
    expect(send.mock.calls).to.have.shape([['private:123', 'bar']])
  })

  it('check arguments', async () => {
    await client1.shouldReply('schedule 1m', '请输入要执行的指令。')
    await client1.shouldReply('schedule -- echo bar', '请输入执行时间。')
    await client1.shouldReply('schedule 12345 -- echo bar', '请输入合法的日期。你要输入的是不是 12345s？')
    await client1.shouldReply('schedule foo -- echo bar', '请输入合法的日期。')
    await client1.shouldReply('schedule 1999-01-01 -- echo bar', '不能指定过去的时间为执行时间。')
    await client1.shouldReply('schedule 1999-01-01 / 1s -- echo bar', '时间间隔过短。')
    await client1.shouldReply('schedule 1999-01-01 / foo -- echo bar', '请输入合法的时间间隔。')
  })
})
