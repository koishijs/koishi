import { App, User, Channel, defineEnumProperty } from 'koishi'
import { expect, use } from 'chai'
import * as admin from '@koishijs/plugin-admin'
import memory from '@koishijs/plugin-database-memory'
import mock from '@koishijs/plugin-mock'
import promise from 'chai-as-promised'

use(promise)

const app = new App()

app.plugin(memory)
app.plugin(mock)
app.plugin(admin)

const client1 = app.mock.client('123', '321')
const client2 = app.mock.client('123')

before(() => app.start())

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
  await app.mock.initUser('123', 4)
  await app.mock.initUser('456', 3)
  await app.mock.initUser('789', 4)
  await app.mock.initChannel('321')
  await app.mock.initChannel('654')
})

describe('Admin Commands', () => {
  it('user/authorize', async () => {
    await client1.shouldReply('authorize', '请指定目标用户。')
    await client1.shouldReply('authorize -u nan', '选项 user 输入无效，请指定正确的用户。')
    await client1.shouldReply('authorize -u @789', '权限不足。')
    await client1.shouldReply('authorize -u @456 1.5', '参数 value 输入无效，请提供一个非负整数。')
    await client1.shouldReply('authorize -u @456 3', '用户数据未改动。')
    await client1.shouldReply('authorize -u @456 4', '权限不足。')
    await client1.shouldReply('authorize -u @456 2', '用户数据已修改。')
    await client1.shouldReply('authorize -u @111 1', '用户数据已修改。')
  })

  it('user.flag', async () => {
    await client1.shouldReply('user.flag -u @123', '未设置任何标记。')
    await client1.shouldReply('user.flag -u @321', '未找到指定的用户。')
    await client1.shouldReply('user.flag -l', '全部标记为：ignore, test。')
    await client1.shouldReply('user.flag -s foo', '未找到标记 foo。')
    await client1.shouldReply('user.flag -s test', '用户数据已修改。')
    await client1.shouldReply('user.flag', '当前的标记为：test。')
    await client1.shouldReply('user.flag -S ignore', '用户数据未改动。')
    await client1.shouldReply('user.flag', '当前的标记为：test。')
  })

  it('channel/assign', async () => {
    await app.mock.client('123').shouldReply('assign', '当前不在群组上下文中，请使用 -c 参数指定目标频道。')
    await client1.shouldReply('assign -c nan', '选项 channel 输入无效，请指定正确的频道。')
    await client1.shouldReply('assign -c #321', '频道数据未改动。')
    await client1.shouldReply('assign -c #321 nan', '参数 bot 输入无效，请指定正确的用户。')
    await client1.shouldReply('assign -c #321 @foo:bar', '代理者应与目标频道属于同一平台。')
    await client1.shouldReply('assign -c #333', '频道数据已修改。')

    const getChannel = () => expect(app.database.getChannel('mock', '321')).eventually
    await getChannel().to.have.property('assignee', '514')
    await client1.shouldReply('assign -c #321 @123', '频道数据已修改。')
    await getChannel().to.have.property('assignee', '123')
    await client2.shouldReply('assign -c #321', '频道数据已修改。')
    await getChannel().to.have.property('assignee', '514')
  })

  it('channel.flag', async () => {
    await client1.shouldReply('channel.flag', '未设置任何标记。')
    await client1.shouldReply('channel.flag -s foo', '未找到标记 foo。')
    await client1.shouldReply('channel.flag -s test', '频道数据已修改。')
    await client1.shouldReply('channel.flag', '当前的标记为：test。')
    await client1.shouldReply('channel.flag -S ignore', '频道数据未改动。')
    await client1.shouldReply('channel.flag', '当前的标记为：test。')
  })
})
