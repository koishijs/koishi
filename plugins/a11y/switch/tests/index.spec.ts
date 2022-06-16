import { App } from 'koishi'
import * as _switch from '@koishijs/plugin-switch'
import memory from '@koishijs/plugin-database-memory'
import mock from '@koishijs/plugin-mock'

const app = new App()

app.plugin(memory)
app.plugin(mock)

const client = app.mock.client('123', '321')

app.plugin(_switch)
app.command('foo', { authority: 4 })
app.command('baz').action(() => 'zab')

before(async () => {
  await app.start()
  await app.mock.initUser('123', 3)
})

describe('@koishijs/plugin-switch', () => {
  it('basic support', async () => {
    await client.shouldReply('switch -c #123', '未找到指定的频道。')
    await client.shouldReply('switch', '当前没有禁用功能。')
    await client.shouldReply('baz', 'zab')
    await client.shouldReply('switch baz', '已禁用 baz 功能。')
    await client.shouldReply('switch', '当前禁用的功能有：baz')
    await client.shouldNotReply('baz')
    await client.shouldReply('switch baz', '已启用 baz 功能。')
    await client.shouldReply('baz', 'zab')
    await client.shouldReply('switch foo', '您无权修改 foo 功能。')
  })
})
