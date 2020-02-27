import { MockedApp, BASE_SELF_ID } from 'koishi-test-utils'
import { startAll, stopAll } from 'koishi-core'
import { broadcast } from '../src'
import 'koishi-database-memory'

const app1 = new MockedApp({ database: { memory: {} } })
const app2 = new MockedApp({ database: { memory: {} }, selfId: BASE_SELF_ID + 1 })

app1.plugin(broadcast)

beforeAll(async () => {
  await startAll()
  await app1.database.getUser(123, 4)
  await app1.database.getGroup(321, app1.selfId)
  await app1.database.getGroup(654, app1.selfId)
  await app2.database.getGroup(987, app2.selfId)
})

afterAll(() => stopAll())

test('basic support', async () => {
  await app1.receiveMessage('user', 'broadcast foo bar', 123)
  app1.shouldHaveLastRequests([
    ['send_group_msg', { message: 'foo bar', groupId: 321 }],
    ['send_group_msg', { message: 'foo bar', groupId: 654 }],
  ])
  app2.shouldHaveLastRequests([
    ['send_group_msg', { message: 'foo bar', groupId: 987 }],
  ])
})

test('self only', async () => {
  await app1.receiveMessage('user', 'broadcast -o foo bar', 123)
  app1.shouldHaveLastRequests([
    ['send_group_msg', { message: 'foo bar', groupId: 321 }],
    ['send_group_msg', { message: 'foo bar', groupId: 654 }],
  ])
  app2.shouldHaveNoRequests()
})
