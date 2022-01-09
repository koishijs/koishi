import { App } from 'koishi'
import mock from '@koishijs/plugin-mock'
import * as override from '@koishijs/plugin-override'

const app = new App({
  minSimilarity: 0,
})

app.plugin(mock)

const command = app.command('bar').action(() => 'foo')
const client = app.mock.client('123')

before(() => app.start())

describe('@koishijs/plugin-override', () => {
  it('basic support', async () => {
    await client.shouldReply('bar', 'foo')
    await client.shouldNotReply('baz')

    app.plugin(override, {
      bar: { name: 'baz' },
    })

    await client.shouldReply('bar', 'foo')
    await client.shouldReply('baz', 'foo')

    command.dispose()

    await client.shouldNotReply('bar')
    await client.shouldNotReply('baz')
  })
})
