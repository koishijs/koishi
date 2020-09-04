import { App } from 'koishi-test-utils'
import repeater from '../src/repeater'

it.only('repeat', async () => {
  const app = new App()
  const session1 = app.session(123, 123)

  app.plugin(repeater, {
    onRepeat: ({ repeated, times }, message) => !repeated && times >= 2 ? message : '',
  })

  await session1.shouldNotReply('foo')
  await session1.shouldReply('foo', 'foo')
  await session1.shouldNotReply('foo')
  await session1.shouldNotReply('foo')
})

it('interrupt', async () => {
  const app = new App()
  const session1 = app.session(123, 123)

  app.plugin(repeater, {
    repeat: (_, times) => times >= 2,
    interrupt: (_, times) => times >= 4,
    repeatCheck: false,
    interruptCheck: false,
  })

  await session1.shouldNotReply('foo')
  await session1.shouldReply('foo', 'foo')
  await session1.shouldReply('foo', '打断复读！')
})

it('repeat check', async () => {
  const app = new App()
  const session1 = app.session(123, 123)
  const session2 = app.session(456, 123)

  app.plugin(repeater, {
    repeat: (_, times) => times >= 2,
    interrupt: false,
    repeatCheck: (_, times) => times >= 2,
    interruptCheck: false,
  })

  await session1.shouldNotReply('foo')
  await session1.shouldReply('foo', 'foo')
  await session2.shouldReply('foo', 'foo')
  await session2.shouldReply('foo', `[CQ:at,qq=${session2.userId}] 在？为什么重复复读？`)
})

it('interrupt check', async () => {
  const app = new App()
  const session1 = app.session(123, 123)

  app.plugin(repeater, {
    repeat: (_, times) => times >= 2,
    interrupt: false,
    repeatCheck: false,
    interruptCheck: (_, times) => times >= 2,
  })

  await session1.shouldNotReply('foo')
  await session1.shouldNotReply('bar')
  await session1.shouldReply('bar', 'bar')
  await session1.shouldReply('foo', `[CQ:at,qq=${session1.userId}] 在？为什么打断复读？`)
})
