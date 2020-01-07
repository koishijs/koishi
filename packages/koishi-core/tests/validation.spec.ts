import { httpServer } from 'koishi-test-utils'
import { UserFlag, GroupFlag } from '../src'
import { messages } from '../src/messages'
import { resolve } from 'path'
import 'koishi-database-level'
import del from 'del'

const { createApp, createServer, ServerSession } = httpServer

const path = resolve(__dirname, '../temp')

const server = createServer()
const app = createApp({
  database: { level: { path } },
})

app.command('cmd1', { authority: 2, maxUsage: 1 })
  // make coverage happy
  .userFields(['name', 'flag', 'authority', 'usage'])
  .groupFields(['id', 'flag', 'assignee'])
  .option('--bar', '', { authority: 3 })
  .option('--baz', '', { notUsage: true })
  .action(({ meta }) => meta.$send('1:' + meta.$user.id))

app.command('cmd2', { minInterval: () => 100 })
  .option('--bar', '', { authority: 3 })
  .option('--baz', '', { notUsage: true })
  .action(({ meta }) => meta.$send('2:' + meta.$user.id))

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

afterAll(async () => {
  server.close()
  await app.stop()
  await del(path)
})

const session1 = new ServerSession('private', 123)
const session2 = new ServerSession('private', 456)
const session3 = new ServerSession('private', 789)
const session4 = new ServerSession('group', 123, { groupId: 321 })
const session5 = new ServerSession('group', 123, { groupId: 654 })

describe('middleware validation', () => {
  test('user.flag.ignore', async () => {
    await session1.shouldHaveResponse('cmd2', '2:123')
    await session3.shouldHaveNoResponse('cmd2')
  })

  test('group.assignee', async () => {
    await session4.shouldHaveResponse('cmd1 --baz', '1:123')
    await session4.shouldHaveResponse('mid', 'mid')
    await session5.shouldHaveNoResponse('cmd1 --baz')
    await session5.shouldHaveResponse(`[CQ:at,qq=${app.selfId}] cmd1 --baz`, '1:123')
  })

  test('group.flag.noCommand', async () => {
    await app.database.setGroup(321, { flag: GroupFlag.noCommand })
    await session4.shouldHaveResponse('mid', 'mid')
    await session4.shouldHaveNoResponse('cmd1 --baz')
    await session4.shouldHaveNoResponse(`[CQ:at,qq=${app.selfId}] cmd1 --baz`)
    await app.database.setGroup(321, { flag: 0 })
  })

  test('group.flag.noResponse', async () => {
    await app.database.setGroup(321, { flag: GroupFlag.noResponse })
    await session4.shouldHaveNoResponse('mid')
    await session4.shouldHaveNoResponse('cmd1 --baz')
    await session4.shouldHaveResponse(`[CQ:at,qq=${app.selfId}] cmd1 --baz`, '1:123')
    await app.database.setGroup(321, { flag: 0 })
  })
})

describe('command validation', () => {
  test('check authority', async () => {
    app.command('cmd1', { showWarning: true })
    await session2.shouldHaveResponse('cmd1', messages.LOW_AUTHORITY)
    await session1.shouldHaveResponse('cmd1 --bar', messages.LOW_AUTHORITY)
    app.command('cmd1', { showWarning: false })
    await session1.shouldHaveNoResponse('cmd1 --bar')
  })

  test('check usage', async () => {
    app.command('cmd1', { showWarning: true })
    await session1.shouldHaveResponse('cmd1', '1:123')
    await session1.shouldHaveResponse('cmd1 --baz', '1:123')
    await session1.shouldHaveResponse('cmd1', messages.USAGE_EXHAUSTED)
    await session1.shouldHaveResponse('cmd1 --baz', '1:123')
    app.command('cmd1', { showWarning: false })
    await session1.shouldHaveNoResponse('cmd1')
  })

  test('check frequency', async () => {
    app.command('cmd2', { showWarning: true })
    await session2.shouldHaveResponse('cmd2', '2:456')
    await session2.shouldHaveResponse('cmd2', messages.TOO_FREQUENT)
    app.command('cmd2', { showWarning: false })
    await session2.shouldHaveNoResponse('cmd2')
  })
})
