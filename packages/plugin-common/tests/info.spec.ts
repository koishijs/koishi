import { App, TestSession } from 'koishi-test-utils'
import * as info from '../src/info'

// make coverage happy
info.registerUserInfo(() => '')
info.registerUserInfo(() => 'foo', ['flag'], -1)

let app: App, session: TestSession

describe('info', () => {
  beforeEach(async () => {
    app = new App({ mockDatabase: true })
    session = app.session(123)
    await app.start()
    await app.database.getUser(123, 3)
    await app.database.getUser(456, 4)
    await app.database.getUser(789, 2)
    await app.database.setUser(789, { name: 'bar' })
  })

  afterEach(() => app.stop())

  it('basic support', async () => {
    app.plugin(info)

    session.meta.sender = {
      userId: 123,
      nickname: 'nick',
      card: '',
      sex: 'unknown',
      age: 20,
    }

    await session.shouldReply('info', 'nick，您的权限为 3 级。\nfoo')
    await session.shouldReply('info -u', '未找到用户。')
    await session.shouldReply('info -u 654', '未找到用户。')
    await session.shouldReply('info -u 456', '456 的权限为 4 级。\nfoo')
    await session.shouldReply('info -u 789', 'bar (789) 的权限为 2 级。\nfoo')
  })
})
