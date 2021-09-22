import { App } from '@koishijs/test-utils'
import { User, Channel, defineEnumProperty } from 'koishi'
import { install } from '@sinonjs/fake-timers'
import * as common from '@koishijs/plugin-common'
import { expect } from 'chai'

const app = new App({ mockDatabase: true })
const session = app.session('123', '321')
const session2 = app.session('123')

app.plugin(common)
app.command('foo', { maxUsage: 10 }).action(() => 'bar')
app.command('bar', { minInterval: 1000 }).action(() => 'foo')
app.command('baz').action(() => 'zab')

declare module 'koishi' {
  namespace User {
    enum Flag {
      test = 1 << 4,
    }
  }

  namespace Channel {
    enum Flag {
      test = 1 << 4,
    }
  }
}

defineEnumProperty(User.Flag, 'test', 1 << 4)
defineEnumProperty(Channel.Flag, 'test', 1 << 4)

before(async () => {
  await app.initUser('123', 4)
  await app.initUser('456', 3)
  await app.initUser('789', 4)
  await app.initChannel('321')
  await app.initChannel('654')
})

describe('Admin Commands', () => {
  it('user/authorize', async () => {
    await session.shouldReply('authorize', '请指定目标用户。')
    await session.shouldReply('authorize -t nan', '选项 target 输入无效，请指定正确的用户。')
    await session.shouldReply('authorize -t @789', '权限不足。')
    await session.shouldReply('authorize -t @456 1.5', '参数 value 输入无效，请提供一个非负整数。')
    await session.shouldReply('authorize -t @456 3', '用户数据未改动。')
    await session.shouldReply('authorize -t @456 4', '权限不足。')
    await session.shouldReply('authorize -t @456 2', '用户数据已修改。')
    await session.shouldReply('authorize -t @111 1', '用户数据已修改。')
  })

  it('user.flag', async () => {
    await session.shouldReply('user.flag -t @123', '未设置任何标记。')
    await session.shouldReply('user.flag -t @321', '未找到指定的用户。')
    await session.shouldReply('user.flag -l', '全部标记为：ignore, test。')
    await session.shouldReply('user.flag -s foo', '未找到标记 foo。')
    await session.shouldReply('user.flag -s test', '用户数据已修改。')
    await session.shouldReply('user.flag', '当前的标记为：test。')
    await session.shouldReply('user.flag -S ignore', '用户数据未改动。')
    await session.shouldReply('user.flag', '当前的标记为：test。')
  })

  it('user.usage', async () => {
    await session.shouldReply('user.usage', '今日没有调用过消耗次数的功能。')
    await session.shouldReply('foo', 'bar')
    await session.shouldReply('user.usage', '今日各功能的调用次数为：\nfoo：1')
    await session.shouldReply('user.usage -c foo', '用户数据已修改。')
    await session.shouldReply('user.usage', '今日没有调用过消耗次数的功能。')
    await session.shouldReply('user.usage -s bar', '缺少参数，输入帮助以查看用法。')
    await session.shouldReply('user.usage -s bar nan', '参数 value 输入无效，请提供一个正整数。')
    await session.shouldReply('user.usage -s bar 2', '用户数据已修改。')
    await session.shouldReply('user.usage bar', '今日 bar 功能的调用次数为：2')
    await session.shouldReply('user.usage baz', '今日 baz 功能的调用次数为：0')
    await session.shouldReply('user.usage -c', '用户数据已修改。')
  })

  it('user.timer', async () => {
    const clock = install({ now: Date.now() })
    await session.shouldReply('user.timer', '当前没有生效的定时器。')
    await session.shouldReply('bar', 'foo')
    await session.shouldReply('user.timer', '各定时器的生效时间为：\nbar：剩余 1 秒')
    await session.shouldReply('user.timer -c bar', '用户数据已修改。')
    await session.shouldReply('user.timer', '当前没有生效的定时器。')
    await session.shouldReply('user.timer -s foo', '缺少参数，输入帮助以查看用法。')
    await session.shouldReply('user.timer -s foo nan', '参数 value 输入无效，请输入合法的时间。')
    await session.shouldReply('user.timer -s foo 2min', '用户数据已修改。')
    await session.shouldReply('user.timer foo', '定时器 foo 的生效时间为：剩余 2 分钟')
    await session.shouldReply('user.timer fox', '定时器 fox 当前并未生效。')
    await session.shouldReply('user.timer -c', '用户数据已修改。')
    clock.uninstall()
  })

  it('channel/assign', async () => {
    await app.session('123').shouldReply('assign', '当前不在群组上下文中，请使用 -t 参数指定目标频道。')
    await session.shouldReply('assign -t nan', '选项 target 输入无效，请指定正确的频道。')
    await session.shouldReply('assign -t #321', '频道数据未改动。')
    await session.shouldReply('assign -t #321 nan', '参数 bot 输入无效，请指定正确的用户。')
    await session.shouldReply('assign -t #321 @foo:bar', '代理者应与目标频道属于同一平台。')
    await session.shouldReply('assign -t #333', '频道数据已修改。')

    const getChannel = () => expect(app.database.getChannel('mock', '321')).eventually
    await getChannel().to.have.property('assignee', '514')
    await session.shouldReply('assign -t #321 @123', '频道数据已修改。')
    await getChannel().to.have.property('assignee', '123')
    await session2.shouldReply('assign -t #321', '频道数据已修改。')
    await getChannel().to.have.property('assignee', '514')
  })

  it('channel/switch', async () => {
    await session.shouldReply('switch -t #123', '未找到指定的频道。')
    await session.shouldReply('switch', '当前没有禁用功能。')
    await session.shouldReply('baz', 'zab')
    await session.shouldReply('switch baz', '已禁用 baz 功能。')
    await session.shouldReply('switch', '当前禁用的功能有：baz')
    await session.shouldNotReply('baz')
    await session.shouldReply('switch baz', '已启用 baz 功能。')
    await session.shouldReply('baz', 'zab')
    await session.shouldReply('switch assign', '您无权修改 assign 功能。')
  })

  it('channel.flag', async () => {
    await session.shouldReply('channel.flag', '未设置任何标记。')
    await session.shouldReply('channel.flag -s foo', '未找到标记 foo。')
    await session.shouldReply('channel.flag -s test', '频道数据已修改。')
    await session.shouldReply('channel.flag', '当前的标记为：test。')
    await session.shouldReply('channel.flag -S ignore', '频道数据未改动。')
    await session.shouldReply('channel.flag', '当前的标记为：test。')
  })
})
