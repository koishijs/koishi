import { Context } from 'koishi'
import mock from '@koishijs/plugin-mock'
import * as repeater from '@koishijs/plugin-repeater'

async function setup(config: repeater.Config) {
  const app = new Context()
  app.plugin(mock)
  const client1 = app.mock.client('123', '123')
  const client2 = app.mock.client('456', '123')
  const client3 = app.mock.client('789', '123')

  app.plugin(repeater, config)
  await app.start()
  return [client1, client2, client3]
}

describe('Repeater', () => {
  it('repeat (basic config)', async () => {
    const [client1] = await setup({
      onRepeat: { minTimes: 2 },
    })

    await client1.shouldNotReply('foo')
    await client1.shouldReply('foo', 'foo')
    await client1.shouldNotReply('foo')
    await client1.shouldNotReply('foo')
  })

  it('repeat check', async () => {
    const [client1, client2, client3] = await setup({
      onRepeat: ({ users }, { userId }) => users[userId] > 2 ? '在？为什么重复复读？' : '',
    })

    await client1.shouldNotReply('foo')
    await client2.shouldNotReply('foo')
    await client3.shouldNotReply('foo')
    await client1.shouldNotReply('foo')
    await client1.shouldReply('foo', '在？为什么重复复读？')
  })

  it('interrupt', async () => {
    const [client1, client2, client3] = await setup({
      onRepeat: ({ times, repeated }) => times >= 3 && !repeated ? '打断复读！' : '',
    })

    await client1.shouldNotReply('foo')
    await client2.shouldNotReply('foo')
    await client3.shouldReply('foo', '打断复读！')
    await client3.shouldNotReply('打断复读！')
    await client3.shouldNotReply('打断复读！')
  })

  it('interrupt check', async () => {
    const [client1, client2, client3] = await setup({
      onInterrupt: ({ times }) => times >= 2 ? '在？为什么打断复读？' : '',
    })

    await client1.shouldNotReply('foo')
    await client2.shouldNotReply('bar')
    await client1.shouldNotReply('foo')
    await client2.shouldNotReply('foo')
    await client3.shouldReply('bar', '在？为什么打断复读？')
  })
})
