import { App } from 'koishi'
import * as _switch from '@koishijs/plugin-switch'
import memory from '@koishijs/plugin-database-memory'
import mock from '@koishijs/plugin-mock'

const app = new App()

app.plugin(memory).plugin(mock)

const client = app.mock.client('123', '321')

app.plugin(_switch)
app.command('baz').action(() => 'zab')

describe('Switch Plugin', () => {
  it('basic support', async () => {
    await client.shouldReply('switch -t #123', '未找到指定的频道。')
    await client.shouldReply('switch', '当前没有禁用功能。')
    await client.shouldReply('baz', 'zab')
    await client.shouldReply('switch baz', '已禁用 baz 功能。')
    await client.shouldReply('switch', '当前禁用的功能有：baz')
    await client.shouldNotReply('baz')
    await client.shouldReply('switch baz', '已启用 baz 功能。')
    await client.shouldReply('baz', 'zab')
    await client.shouldReply('switch assign', '您无权修改 assign 功能。')
  })
})
