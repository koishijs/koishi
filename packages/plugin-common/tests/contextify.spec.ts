import { MockedApp } from 'koishi-test-utils'
import { contextify } from '../src'
import 'koishi-database-memory'

const app = new MockedApp({ database: { memory: {} } })
const session1 = app.createSession('user', 123)
const session2 = app.createSession('group', 123, 654)

app.plugin(contextify)
app.command('show-context')
  .action(({ meta }) => {
    return meta.$send(`${meta.userId},${meta.$ctxType},${meta.$ctxId},${meta.$user?.id},${meta.$group?.id}`)
  })

beforeAll(async () => {
  await app.start()
  await app.database.getUser(123, 3)
  await app.database.getUser(456, 2)
  await app.database.getUser(789, 4)
  await app.database.getGroup(654, app.selfId)
})

test('check input', async () => {
  await session1.shouldHaveReply('ctxf -u 456', '请输入要发送的文本。')
  await session2.shouldHaveReply('ctxf -m foo show-context', '未指定目标。')
  await session1.shouldHaveReply('ctxf show-context', '请提供新的上下文。')
  await session1.shouldHaveReply('ctxf -u 789 show-context', '权限不足。')
  await session1.shouldHaveReply('ctxf -m 456 show-context', '无法在私聊上下文使用 --member 选项。')
})

test('user context', async () => {
  await session1.shouldHaveReply('ctxf -u 456 show-context', '456,user,456,456,undefined')
  await session1.shouldHaveReply('ctxf -g 654 show-context', '123,group,654,123,654')
  await session1.shouldHaveReply('ctxf -d 654 show-context', '123,discuss,654,123,undefined')
  await session1.shouldHaveReply('ctxf -u 456 -g 654 show-context', '456,group,654,456,654')
  await session1.shouldHaveReply('ctxf -u 456 -d 654 show-context', '456,discuss,654,456,undefined')
})

test('group context', async () => {
  await session2.shouldHaveReply('ctxf -u 456 show-context', '456,user,456,456,undefined')
  await session2.shouldHaveReply('ctxf -m 456 show-context', '456,group,654,456,654')
})
