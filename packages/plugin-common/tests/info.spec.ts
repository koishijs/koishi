import { MockedApp, Session } from 'koishi-test-utils'
import { info, registerUserInfo, InfoOptions } from '../src'
import 'koishi-database-memory'

// make coverage happy
registerUserInfo(() => '')
registerUserInfo(() => 'foo', ['flag'])

let app: MockedApp, session: Session

beforeEach(async () => {
  app = new MockedApp({ database: { memory: {} } })
  session = app.createSession('user', 123)
  await app.start()
  await app.database.getUser(123, 3)
  await app.database.getUser(456, 4)
})

afterEach(() => app.stop())

test('basic support', async () => {
  app.plugin(info)

  session.meta.sender = {
    userId: 123,
    nickname: 'nick',
    card: '',
    sex: 'unknown',
    age: 20,
  }

  await session.shouldHaveReply('info', 'nick，您的权限为 3 级。\nfoo')
  await session.shouldHaveReply('info -u', '未找到用户。')
  await session.shouldHaveReply('info -u 654', '未找到用户。')
  await session.shouldHaveReply('info -u 456', '456 的权限为 4 级。\nfoo')
})

test('getUserName', async () => {
  app.plugin<InfoOptions>(info, {
    getUserName (user, meta) {
      if (user.id !== meta.userId) return 'bar'
    },
  })

  await session.shouldHaveReply('info', '123，您的权限为 3 级。\nfoo')
  await session.shouldHaveReply('info -u', '未找到用户。')
  await session.shouldHaveReply('info -u 654', '未找到用户。')
  await session.shouldHaveReply('info -u 456', 'bar (456) 的权限为 4 级。\nfoo')
})
