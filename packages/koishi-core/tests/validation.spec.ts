import { createApp, createServer, ServerSession } from 'koishi-test-utils'
import { resolve } from 'path'
import { messages } from '../src/messages'
import 'koishi-database-level'
import del from 'del'

const path = resolve(__dirname, '../temp')

const server = createServer()
const app = createApp({
  database: { level: { path } }
})

app.command('cmd1', { authority: 2, maxUsage: 1 })
  .option('--bar', '', { authority: 3 })
  .option('--baz', '', { notUsage: true })
  .action(({ meta }) => meta.$send('1:' + meta.$user.id))

app.command('cmd2', { minInterval: 100, showWarning: true })
  .option('--bar', '', { authority: 3 })
  .option('--baz', '', { notUsage: true })
  .action(({ meta }) => meta.$send('2:' + meta.$user.id))

beforeAll(async () => {
  await app.start()
  await app.database.getUser(123, 2)
  await app.database.getUser(456, 1)
})

afterAll(async () => {
  server.close()
  await app.stop()
  await del(path)
})

const session1 = new ServerSession('private', 123)
const session2 = new ServerSession('private', 456)

describe('validation', () => {
  test('check authority', async () => {
    await session2.shouldHaveResponse('cmd1', messages.LOW_AUTHORITY)
    await session1.shouldHaveResponse('cmd1 --bar', messages.LOW_AUTHORITY)
  })

  test('check usage', async () => {
    await session1.shouldHaveResponse('cmd1', '1:123')
    await session1.shouldHaveResponse('cmd1 --baz', '1:123')
    await session1.shouldHaveResponse('cmd1', messages.USAGE_EXHAUSTED)
    await session1.shouldHaveResponse('cmd1 --baz', '1:123')
  })

  test('check frequency', async () => {
    await session2.shouldHaveResponse('cmd2', '2:456')
    await session1.shouldHaveResponse('cmd2', '2:123')
    await session2.shouldHaveResponse('cmd2 --baz', messages.TOO_FREQUENT)
  })
})
