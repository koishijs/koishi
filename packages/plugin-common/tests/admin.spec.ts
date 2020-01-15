import { MockedApp, MemoryDatabase } from 'koishi-test-utils'
import { registerDatabase, userFlags, groupFlags, UserFlag, GroupFlag } from 'koishi-core'
import admin, { registerUserAction, registerGroupAction } from '../src/admin'

registerDatabase('memory', MemoryDatabase)

const app = new MockedApp({ database: { memory: {} } })
const session = app.createSession('group', 123, 321)

app.plugin(admin)
app.command('foo', { maxUsage: 10 }).action(({ meta }) => meta.$send('bar'))
app.command('bar', { maxUsage: 10 }).action(({ meta }) => meta.$send('foo'))

beforeAll(async () => {
  await app.start()
  await app.database.getUser(123, 4)
  await app.database.getUser(456, 3)
  await app.database.getUser(789, 4)
  await app.database.getGroup(321, app.selfId)
  await app.database.getGroup(654, app.selfId)
})

describe('basic features', () => {
  test('check', async () => {
    await session.shouldHaveReply('admin -u 456 -g 321', '不能同时目标为指定用户和群。')
  })
})

describe('user operations', () => {
  test('list actions', async () => {
    await session.shouldMatchSnapshot('admin')
    await session.shouldMatchSnapshot('admin foo')
  })

  test('check target', async () => {
    await session.shouldHaveReply('admin -u bar set-flag', '未指定目标。')
    await session.shouldHaveReply('admin -u 233 set-flag', '未找到指定的用户。')
    await session.shouldHaveReply('admin -u 789 show-usage', '权限不足。')
  })

  test('setAuth', async () => {
    await session.shouldHaveReply('admin -u 456 set-auth -1', '参数错误。')
    await session.shouldHaveReply('admin -u 456 set-auth 3', '用户权限未改动。')
    await session.shouldHaveReply('admin -u 456 set-auth 2', '用户权限已修改。')
    await session.shouldHaveReply('admin -u 456 set-auth 4', '权限不足。')
  })

  test('setFlag', async () => {
    await session.shouldHaveReply('admin -u 456 set-flag', `可用的标记有 ${userFlags.join(', ')}。`)
    await session.shouldHaveReply('admin -u 456 set-flag foo', '未找到标记 foo。')
    await session.shouldHaveReply('admin -u 456 set-flag ignore', '用户信息已修改。')
    await expect(app.database.getUser(456)).resolves.toHaveProperty('flag', UserFlag.ignore)
  })

  test('unsetFlag', async () => {
    await session.shouldHaveReply('admin -u 456 unset-flag', `可用的标记有 ${userFlags.join(', ')}。`)
    await session.shouldHaveReply('admin -u 456 unset-flag foo', '未找到标记 foo。')
    await session.shouldHaveReply('admin -u 456 unset-flag ignore', '用户信息已修改。')
    await expect(app.database.getUser(456)).resolves.toHaveProperty('flag', 0)
  })

  test('showUsage', async () => {
    await session.shouldHaveReply('admin show-usage', '用户今日没有调用过指令。')
    await session.shouldHaveReply('foo', 'bar')
    await session.shouldHaveReply('admin show-usage', '用户今日各指令的调用次数为：\nfoo：1 次')
    await session.shouldHaveReply('admin show-usage foo bar', '用户今日各指令的调用次数为：\nbar：0 次\nfoo：1 次')
  })

  test('clearUsage', async () => {
    await session.shouldHaveReply('bar', 'foo')
    await session.shouldHaveReply('admin clear-usage foo', '用户信息已修改。')
    await session.shouldHaveReply('admin show-usage', '用户今日各指令的调用次数为：\nbar：1 次')
    await session.shouldHaveReply('admin clear-usage', '用户信息已修改。')
    await session.shouldHaveReply('admin show-usage', '用户今日没有调用过指令。')
  })
})

describe('group operations', () => {
  test('list actions', async () => {
    await session.shouldMatchSnapshot('admin -G')
    await session.shouldMatchSnapshot('admin -G foo')
  })

  test('check target', async () => {
    await session.shouldHaveReply('admin -g bar set-flag', '未找到指定的群。')
  })

  test('setFlag', async () => {
    await session.shouldHaveReply('admin -G set-flag', `可用的标记有 ${groupFlags.join(', ')}。`)
    await session.shouldHaveReply('admin -g 654 set-flag foo', '未找到标记 foo。')
    await session.shouldHaveReply('admin -g 654 set-flag noCommand noEmit', '群信息已修改。')
    await expect(app.database.getGroup(654)).resolves.toHaveProperty('flag', GroupFlag.noCommand | GroupFlag.noEmit)
  })

  test('unsetFlag', async () => {
    await session.shouldHaveReply('admin -G unset-flag', `可用的标记有 ${groupFlags.join(', ')}。`)
    await session.shouldHaveReply('admin -g 654 unset-flag foo', '未找到标记 foo。')
    await session.shouldHaveReply('admin -g 654 unset-flag noEmit noResponse', '群信息已修改。')
    await expect(app.database.getGroup(654)).resolves.toHaveProperty('flag', GroupFlag.noCommand)
  })
})

describe('custom actions', () => {
  test('user action', async () => {
    registerUserAction('test', meta => meta.$send('foo'))
    await session.shouldHaveReply('admin test', 'foo')
  })

  test('group action', async () => {
    registerGroupAction('test', meta => meta.$send('bar'))
    await session.shouldHaveReply('admin -G test', 'bar')
  })
})
