import { MockedApp, memory } from 'koishi-test-utils'
import { User, Group } from 'koishi-core'
import { enumKeys } from 'koishi-utils'
import { expect } from 'chai'
import * as admin from '../src/admin'

const app = new MockedApp()
const session = app.session(123, 321)

app.plugin(memory)
app.plugin(admin)
app.command('foo', { maxUsage: 10 }).action(({ session }) => session.$send('bar'))
app.command('bar', { maxUsage: 10 }).action(({ session }) => session.$send('foo'))

before(async () => {
  await app.start()
  await app.database.getUser(123, 4)
  await app.database.getUser(456, 3)
  await app.database.getUser(789, 4)
  await app.database.getGroup(321, app.bots[0].selfId)
  await app.database.getGroup(654, app.bots[0].selfId)
})

describe('basic features', () => {
  it('check', async () => {
    await session.shouldReply('admin -u 456 -g 321', '不能同时目标为指定用户和群。')
  })
})

describe('user operations', () => {
  it('list actions', async () => {
    await session.shouldMatchSnapshot('admin')
    await session.shouldMatchSnapshot('admin foo')
  })

  it('check target', async () => {
    await session.shouldReply('admin -u bar set-flag', '未指定目标。')
    await session.shouldReply('admin -u 233 set-flag', '未找到指定的用户。')
    await session.shouldReply('admin -u 789 show-usage', '权限不足。')
  })

  it('setAuth', async () => {
    await session.shouldReply('admin -u 456 set-auth -1', '参数错误。')
    await session.shouldReply('admin -u 456 set-auth 3', '用户权限未改动。')
    await session.shouldReply('admin -u 456 set-auth 2', '用户权限已修改。')
    await session.shouldReply('admin -u 456 set-auth 4', '权限不足。')
  })

  const userFlags = enumKeys(User.Flag).join(', ')

  it('setFlag', async () => {
    await session.shouldReply('admin -u 456 set-flag', `可用的标记有 ${userFlags}。`)
    await session.shouldReply('admin -u 456 set-flag foo', '未找到标记 foo。')
    await session.shouldReply('admin -u 456 set-flag ignore', '用户信息已修改。')
    await expect(app.database.getUser(456)).eventually.to.have.property('flag', User.Flag.ignore)
  })

  it('unsetFlag', async () => {
    await session.shouldReply('admin -u 456 unset-flag', `可用的标记有 ${userFlags}。`)
    await session.shouldReply('admin -u 456 unset-flag foo', '未找到标记 foo。')
    await session.shouldReply('admin -u 456 unset-flag ignore', '用户信息已修改。')
    await expect(app.database.getUser(456)).eventually.to.have.property('flag', 0)
  })

  it('clearUsage', async () => {
    await session.shouldReply('bar', 'foo')
    await session.shouldReply('admin clear-usage foo', '用户信息已修改。')
    await session.shouldReply('admin show-usage', '用户今日各指令的调用次数为：\nbar：1 次')
    await session.shouldReply('admin clear-usage', '用户信息已修改。')
    await session.shouldReply('admin show-usage', '用户今日没有调用过指令。')
  })
})

describe('group operations', () => {
  it('list actions', async () => {
    await session.shouldMatchSnapshot('admin -G')
    await session.shouldMatchSnapshot('admin -G foo')
  })

  it('check target', async () => {
    await session.shouldReply('admin -g bar set-flag', '未找到指定的群。')
  })

  const groupFlags = enumKeys(Group.Flag).join(', ')

  it('setFlag', async () => {
    await session.shouldReply('admin -G set-flag', `可用的标记有 ${groupFlags}。`)
    await session.shouldReply('admin -g 654 set-flag foo', '未找到标记 foo。')
    await session.shouldReply('admin -g 654 set-flag silent', '群信息已修改。')
    await expect(app.database.getGroup(654)).eventually.to.have.property('flag', Group.Flag.silent)
  })

  it('unsetFlag', async () => {
    await session.shouldReply('admin -G unset-flag', `可用的标记有 ${groupFlags}。`)
    await session.shouldReply('admin -g 654 unset-flag foo', '未找到标记 foo。')
    await session.shouldReply('admin -g 654 unset-flag silent ignore', '群信息已修改。')
    await expect(app.database.getGroup(654)).eventually.to.have.property('flag', 0)
  })
})

describe('custom actions', () => {
  it('user action', async () => {
    admin.UserAction.add('test', session => session.$send('foo'))
    await session.shouldReply('admin test', 'foo')
  })

  it('group action', async () => {
    admin.GroupAction.add('test', session => session.$send('bar'))
    await session.shouldReply('admin -G test', 'bar')
  })
})
