import { App } from 'koishi-test-utils'
import { User, Channel } from 'koishi-core'
import { install } from '@sinonjs/fake-timers'
import * as common from 'koishi-plugin-common'

const app = new App({ mockDatabase: true })
const session = app.session('123', '321')

app.plugin(common)
app.command('foo', { maxUsage: 10 }).action(({ session }) => session.$send('bar'))
app.command('bar', { minInterval: 1000 }).action(({ session }) => session.$send('foo'))

;((flags: Record<keyof typeof User.Flag, number>) => {
  flags[flags[1 << 4] = 'test'] = 1 << 4
})(User.Flag)

;((flags: Record<keyof typeof Channel.Flag, number>) => {
  flags[flags[1 << 4] = 'test'] = 1 << 4
})(Channel.Flag)

before(async () => {
  await app.database.getUser(123, 4)
  await app.database.getUser(456, 3)
  await app.database.getUser(789, 4)
  await app.database.getChannel(321, app.selfId)
  await app.database.getChannel(654, app.selfId)
})

describe('Admin Commands', () => {
  it('user.auth', async () => {
    await session.shouldReply('user.auth -u nan', '请指定正确的目标。')
    await session.shouldReply('user.auth -u 321', '未找到指定的用户。')
    await session.shouldReply('user.auth -u 789', '权限不足。')
    await session.shouldReply('user.auth -u 456 -1', '参数错误。')
    await session.shouldReply('user.auth -u 456 3', '用户数据未改动。')
    await session.shouldReply('user.auth -u 456 4', '权限不足。')
  })

  it('user.flag', async () => {
    await session.shouldReply('user.flag -u 123', '未设置任何标记。')
    await session.shouldReply('user.flag -l', '全部标记为：ignore, test。')
    await session.shouldReply('user.flag -s foo', '未找到标记 foo。')
    await session.shouldReply('user.flag -s test', '用户数据已修改。')
    await session.shouldReply('user.flag', '当前的标记为：test。')
    await session.shouldReply('user.flag -S ignore', '用户数据未改动。')
    await session.shouldReply('user.flag', '当前的标记为：test。')
  })

  it('usage', async () => {
    await session.shouldReply('usage', '今日没有调用过消耗次数的功能。')
    await session.shouldReply('foo', 'bar')
    await session.shouldReply('usage', '今日各功能的调用次数为：\nfoo：1')
    await session.shouldReply('usage -c foo', '用户数据已修改。')
    await session.shouldReply('usage', '今日没有调用过消耗次数的功能。')
    await session.shouldReply('usage -s bar', '参数不足。')
    await session.shouldReply('usage -s bar nan', '参数错误。')
    await session.shouldReply('usage -s bar 2', '用户数据已修改。')
    await session.shouldReply('usage bar', '今日 bar 功能的调用次数为：2')
    await session.shouldReply('usage baz', '今日 baz 功能的调用次数为：0')
    await session.shouldReply('usage -c', '用户数据已修改。')
  })

  it('timer', async () => {
    const clock = install({ now: Date.now() })
    await session.shouldReply('timer', '当前没有生效的定时器。')
    await session.shouldReply('bar', 'foo')
    await session.shouldReply('timer', '各定时器的生效时间为：\nbar：剩余 1 秒')
    await session.shouldReply('timer -c bar', '用户数据已修改。')
    await session.shouldReply('timer', '当前没有生效的定时器。')
    await session.shouldReply('timer -s foo', '参数不足。')
    await session.shouldReply('timer -s foo nan', '请输入合法的时间。')
    await session.shouldReply('timer -s foo 2min', '用户数据已修改。')
    await session.shouldReply('timer foo', '定时器 foo 的生效时间为：剩余 2 分钟')
    await session.shouldReply('timer fox', '定时器 fox 当前并未生效。')
    await session.shouldReply('timer -c', '用户数据已修改。')
    clock.uninstall()
  })

  it('group.assignee', async () => {
    await app.session('123').shouldReply('group.assign', '当前不在群上下文中，请使用 -g 参数指定目标群。')
    await session.shouldReply('group.assign -g nan', '请指定正确的目标。')
    await session.shouldReply('group.assign -g 123', '未找到指定的群。')
    await session.shouldReply('group.assign -g 321', '群数据未改动。')
    await session.shouldReply('group.assign -g 321 nan', '参数错误。')
  })

  it('group.flag', async () => {
    await session.shouldReply('group.flag', '未设置任何标记。')
    await session.shouldReply('group.flag -s foo', '未找到标记 foo。')
    await session.shouldReply('group.flag -s test', '群数据已修改。')
    await session.shouldReply('group.flag', '当前的标记为：test。')
    await session.shouldReply('group.flag -S ignore', '群数据未改动。')
    await session.shouldReply('group.flag', '当前的标记为：test。')
  })
})
