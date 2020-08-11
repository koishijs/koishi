import { MockedApp } from 'koishi-test-utils'
import * as teach from '../src'
import './memory'

const app = new MockedApp({ database: { memory: {} } })
const session = app.createSession('group', 123, 456)

app.plugin<teach.TeachConfig>(teach, {
  useEnvironment: true,
})

beforeAll(async () => {
  await app.start()
  await app.database.getUser(123, 3)
  await app.database.getGroup(456, app.selfId)
})

test('global env', async () => {
  await session.shouldHaveReply('teach foo bar -g', '问答已添加，编号为 1。')
  await session.shouldHaveReply('foo', 'bar')
})

test('no env', async () => {
  await session.shouldHaveReply('teach bar foo -n', '问答已添加，编号为 2。')
  console.log(await session.getReply('teach -u 2'))
  await session.shouldHaveNoResponse('bar')
})
