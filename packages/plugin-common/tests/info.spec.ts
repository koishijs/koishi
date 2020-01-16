import { MockedApp, MemoryDatabase } from 'koishi-test-utils'
import { registerDatabase } from 'koishi-core'
import info, { registerUserInfo } from '../src/info'

registerDatabase('memory', MemoryDatabase)

// make coverage happy
registerUserInfo(() => '')
registerUserInfo(() => 'foo', ['flag'])

const app = new MockedApp({ database: { memory: {} } })
const session = app.createSession('user', 123)

app.plugin(info)

beforeAll(async () => {
  await app.start()
  await app.database.getUser(123, 3)
  await app.database.getUser(456, 4)
})

afterAll(() => app.stop())

test('basic support', async () => {
  await session.shouldHaveReply('info', '123，您的权限为 3 级。\nfoo')
  await session.shouldHaveReply('info -u', '未找到用户。')
  await session.shouldHaveReply('info -u 654', '未找到用户。')
  await session.shouldHaveReply('info -u 456', '用户 456 的权限为 4 级。\nfoo')
})
