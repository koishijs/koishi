import { MockedApp } from 'koishi-test-utils'
import { sleep } from 'koishi-utils'
import { broadcast } from '../src'
import 'koishi-database-memory'

const app = new MockedApp({ database: { memory: {} } })

app.plugin(broadcast)

jest.useFakeTimers()

beforeAll(async () => {
  await app.start()
  await app.database.getUser(123, 4)
  await app.database.getGroup(321, app.selfId)
  await app.database.getGroup(654, app.selfId)
})

afterAll(() => app.stop())

async function nextTick () {
  jest.advanceTimersToNextTimer()
  jest.useRealTimers()
  await sleep(0)
  jest.useFakeTimers()
}

test('basic support', async () => {
  await app.receiveMessage('user', 'broadcast foo bar', 123)
  app.shouldHaveLastRequest('send_group_msg', { message: 'foo bar', groupId: 321 })
  await nextTick()
  app.shouldHaveLastRequest('send_group_msg', { message: 'foo bar', groupId: 654 })
})
