import { MockedApp, MemoryDatabase } from 'koishi-test-utils'
import { Meta, registerDatabase } from 'koishi-core'
import welcome from '../src/welcome'

registerDatabase('memory', MemoryDatabase)

const shared: Meta = {
  postType: 'notice',
  noticeType: 'group_increase',
  subType: 'invite',
  groupId: 123,
  userId: 456,
}

test('basic support', async () => {
  const app = new MockedApp()
  app.plugin(welcome)

  await app.receive(shared)
  app.shouldHaveLastRequest('send_group_msg', { groupId: 123, message: `欢迎新大佬 [CQ:at,qq=456]！` })
})

test('check assignee', async () => {
  const app = new MockedApp({ database: { memory: {} } })
  app.plugin(welcome, 'welcome')

  await app.start()
  await app.database.getGroup(123, app.selfId)

  await app.receive({ ...shared, groupId: 321 })
  app.shouldHaveNoRequests()

  await app.receive(shared)
  app.shouldHaveLastRequest('send_group_msg', { groupId: 123, message: 'welcome' })

  await app.stop()
})
