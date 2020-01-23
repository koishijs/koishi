import { MockedApp } from 'koishi-test-utils'
import { UserFlag, GroupFlag, messages } from 'koishi-core'
import 'koishi-database-memory'

const app = new MockedApp({ database: { memory: {} } })
const session1 = app.createSession('user', 123)
const session2 = app.createSession('user', 456)
const session3 = app.createSession('user', 789)
const session4 = app.createSession('group', 123, 321)
const session5 = app.createSession('group', 123, 654)

app.command('cmd1', { authority: 2, maxUsage: 1 })
  // make coverage happy
  .userFields(['flag', 'authority', 'usage'])
  .groupFields(['id', 'flag', 'assignee'])
  .option('--bar', '', { authority: 3 })
  .option('--baz', '', { notUsage: true })
  .action(({ meta }) => meta.$send('cmd1:' + meta.$user.id))

app.command('cmd2', { minInterval: () => 100 })
  .option('--bar', '', { authority: 3 })
  .option('--baz', '', { notUsage: true })
  .action(({ meta }) => meta.$send('cmd2:' + meta.$user.id))

app.middleware((meta) => {
  if (meta.message === 'mid') return meta.$send('mid')
})

beforeAll(async () => {
  await app.start()
  await app.database.getUser(123, 2)
  await app.database.getUser(456, 1)
  await app.database.getUser(789, 1)
  await app.database.setUser(789, { flag: UserFlag.ignore })
  await app.database.getGroup(321, app.selfId)
  await app.database.getGroup(654, 999)
})

afterAll(() => app.stop())

describe('middleware validation', () => {
  test('user.flag.ignore', async () => {
    await session1.shouldHaveReply('cmd2', 'cmd2:123')
    await session3.shouldHaveNoResponse('cmd2')
  })

  test('group.assignee', async () => {
    await session4.shouldHaveReply('cmd1 --baz', 'cmd1:123')
    await session4.shouldHaveReply('mid', 'mid')
    await session5.shouldHaveNoResponse('cmd1 --baz')
    await session5.shouldHaveReply(`[CQ:at,qq=${app.selfId}] cmd1 --baz`, 'cmd1:123')
  })

  test('group.flag.noCommand', async () => {
    await app.database.setGroup(321, { flag: GroupFlag.noCommand })
    await session4.shouldHaveReply('mid', 'mid')
    await session4.shouldHaveNoResponse('cmd1 --baz')
    await session4.shouldHaveNoResponse(`[CQ:at,qq=${app.selfId}] cmd1 --baz`)
    await app.database.setGroup(321, { flag: 0 })
  })

  test('group.flag.noResponse', async () => {
    await app.database.setGroup(321, { flag: GroupFlag.noResponse })
    await session4.shouldHaveNoResponse('mid')
    await session4.shouldHaveNoResponse('cmd1 --baz')
    await session4.shouldHaveReply(`[CQ:at,qq=${app.selfId}] cmd1 --baz`, 'cmd1:123')
    await app.database.setGroup(321, { flag: 0 })
  })
})

describe('command validation', () => {
  test('check authority', async () => {
    app.command('cmd1', { showWarning: true })
    await session2.shouldHaveReply('cmd1', messages.LOW_AUTHORITY)
    await session1.shouldHaveReply('cmd1 --bar', messages.LOW_AUTHORITY)
    app.command('cmd1', { showWarning: false })
    await session1.shouldHaveNoResponse('cmd1 --bar')
  })

  test('check usage', async () => {
    app.command('cmd1', { showWarning: true })
    await session1.shouldHaveReply('cmd1', 'cmd1:123')
    await session1.shouldHaveReply('cmd1 --baz', 'cmd1:123')
    await session1.shouldHaveReply('cmd1', messages.USAGE_EXHAUSTED)
    await session1.shouldHaveReply('cmd1 --baz', 'cmd1:123')
    app.command('cmd1', { showWarning: false })
    await session1.shouldHaveNoResponse('cmd1')
  })

  test('check frequency', async () => {
    app.command('cmd2', { showWarning: true })
    await session2.shouldHaveReply('cmd2', 'cmd2:456')
    await session2.shouldHaveReply('cmd2', messages.TOO_FREQUENT)
    app.command('cmd2', { showWarning: false })
    await session2.shouldHaveNoResponse('cmd2')
  })
})
