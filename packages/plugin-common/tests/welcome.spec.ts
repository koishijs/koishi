import { MockedApp } from 'koishi-test-utils'
import { Meta } from 'koishi-core'
import { sleep } from 'koishi-utils'
import { welcome } from '../src'
import 'koishi-database-memory'

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

  app.receive(shared)
  await sleep(0)
  app.shouldHaveLastRequest('send_group_msg', { groupId: 123, message: `欢迎新大佬 [CQ:at,qq=456]！` })
})

test('check assignee', async () => {
  const app = new MockedApp({ database: { memory: {} } })
  app.plugin(welcome, 'welcome')

  await app.start()
  await app.database.getGroup(123, app.selfId)

  app.receive({ ...shared, groupId: 321 })
  await sleep(0)
  app.shouldHaveNoRequests()

  app.receive(shared)
  await sleep(0)
  app.shouldHaveLastRequest('send_group_msg', { groupId: 123, message: 'welcome' })

  await app.stop()
})
