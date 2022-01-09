import { App } from 'koishi'
import mock from '@koishijs/plugin-mock'
import * as repeater from '@koishijs/plugin-repeater'

const app = new App().plugin(mock)
const session1 = app.mock.client('123', '123')
const session2 = app.mock.client('456', '123')
const session3 = app.mock.client('789', '123')

const options: repeater.Config = {}
app.plugin(repeater, options)

before(() => app.start())

describe('Repeater', () => {
  beforeEach(async () => {
    options.onRepeat = null
    options.onInterrupt = null
    await session1.shouldNotReply('clear')
  })

  it('repeat (basic config)', async () => {
    options.onRepeat = { minTimes: 2 }

    await session1.shouldNotReply('foo')
    await session1.shouldReply('foo', 'foo')
    await session1.shouldNotReply('foo')
    await session1.shouldNotReply('foo')
  })

  it('repeat check', async () => {
    options.onRepeat = ({ users }, { userId }) => users[userId] > 2 ? '在？为什么重复复读？' : ''

    await session1.shouldNotReply('foo')
    await session2.shouldNotReply('foo')
    await session3.shouldNotReply('foo')
    await session1.shouldNotReply('foo')
    await session1.shouldReply('foo', '在？为什么重复复读？')
  })

  it('interrupt', async () => {
    options.onRepeat = ({ times }) => times >= 3 ? '打断复读！' : ''

    await session1.shouldNotReply('foo')
    await session2.shouldNotReply('foo')
    await session3.shouldReply('foo', '打断复读！')
  })

  it('interrupt check', async () => {
    options.onInterrupt = ({ times }) => times >= 2 ? '在？为什么打断复读？' : ''

    await session1.shouldNotReply('foo')
    await session2.shouldNotReply('bar')
    await session1.shouldNotReply('foo')
    await session2.shouldNotReply('foo')
    await session3.shouldReply('bar', '在？为什么打断复读？')
  })
})
