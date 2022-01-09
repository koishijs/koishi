import { App } from 'koishi'
import memory from '@koishijs/plugin-database-memory'
import mock from '@koishijs/plugin-mock'
import * as contextify from '@koishijs/plugin-contextify'

const app = new App()

app.plugin(memory)
app.plugin(mock)
app.plugin(contextify)

const client1 = app.mock.client('123')
const client2 = app.mock.client('123', '456')

app.command('show-context')
  .userFields(['mock'])
  .channelFields(['id'])
  .action(({ session }) => {
    return `${session.userId},${session.user?.mock},${session.channel?.id}`
  })

before(async () => {
  await app.start()
  await app.mock.initUser('123', 4)
  await app.mock.initUser('456', 3)
  await app.mock.initUser('789', 5)
  await app.mock.initChannel('456')
})

describe('@koishijs/plugin-contextify', () => {
  it('check input', async () => {
    await client1.shouldReply('ctxf -u @456', '请输入要触发的指令。')
    await client1.shouldReply('ctxf -m @456 show-context', '无法在私聊上下文使用 --member 选项。')
    await client2.shouldReply('ctxf show-context', '请提供新的上下文。')
    await client2.shouldReply('ctxf -u @789 show-context', '权限不足。')
  })

  it('private context', async () => {
    await client1.shouldReply('ctxf -u @456 show-context', '456,456,undefined')
    await client1.shouldReply('ctxf -c #456 show-context', '123,123,456')
    await client1.shouldReply('ctxf -u @456 -c #456 show-context', '456,456,456')
  })

  it('guild context', async () => {
    await client2.shouldReply('ctxf -u @456 show-context', '456,456,undefined')
    await client2.shouldReply('ctxf -m @456 show-context', '456,456,456')
  })
})
