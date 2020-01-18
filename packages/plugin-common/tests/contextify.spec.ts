import { MockedApp } from 'koishi-test-utils'
import contextify from '../src/contextify'
import 'koishi-database-memory'

const app = new MockedApp({ database: { memory: {} } })
const session = app.createSession('user', 123)

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
})

test('check input', async () => {
  await session.shouldHaveReply('ctxf -u 456', '请输入要发送的文本。')
  await session.shouldHaveReply('ctxf show-context', '请提供新的上下文。')
  await session.shouldHaveReply('ctxf -u 789 show-context', '权限不足。')
})

test('contextify', async () => {
  await session.shouldHaveReply('ctxf -u 456 show-context', '456,user,456,456,undefined')
  await session.shouldHaveReply('ctxf -g 654 show-context', '123,group,654,123,654')
  await session.shouldHaveReply('ctxf -d 654 show-context', '123,discuss,654,123,undefined')
  await session.shouldHaveReply('ctxf -u 456 -g 654 show-context', '456,group,654,456,654')
  await session.shouldHaveReply('ctxf -u 456 -d 654 show-context', '456,discuss,654,456,undefined')
})
