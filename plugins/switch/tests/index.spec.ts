import { App } from '@koishijs/test-utils'
import * as _switch from '@koishijs/plugin-switch'
import memory from '@koishijs/plugin-database-memory'

const app = new App()

app.plugin(memory)

const session = app.session('123', '321')

app.plugin(_switch)
app.command('baz').action(() => 'zab')

describe('Switch Plugin', () => {
  it('basic support', async () => {
    await session.shouldReply('switch -t #123', '未找到指定的频道。')
    await session.shouldReply('switch', '当前没有禁用功能。')
    await session.shouldReply('baz', 'zab')
    await session.shouldReply('switch baz', '已禁用 baz 功能。')
    await session.shouldReply('switch', '当前禁用的功能有：baz')
    await session.shouldNotReply('baz')
    await session.shouldReply('switch baz', '已启用 baz 功能。')
    await session.shouldReply('baz', 'zab')
    await session.shouldReply('switch assign', '您无权修改 assign 功能。')
  })
})
