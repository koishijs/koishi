import { MockedApp, MemoryDatabase } from 'koishi-test-utils'
import { registerDatabase } from 'koishi-core'
import repeater, { RepeaterOptions } from '../src/repeater'

registerDatabase('memory', MemoryDatabase)

test('repeat', async () => {
  const app = new MockedApp()
  const session1 = app.createSession('group', 123, 123)

  app.plugin<RepeaterOptions>(repeater, {
    repeat: (repeated, times) => !repeated && times >= 2,
    interrupt: false,
    repeatCheck: false,
    interruptCheck: false,
  })

  await session1.shouldHaveNoResponse('foo')
  await session1.shouldHaveReply('foo', 'foo')
  await session1.shouldHaveNoResponse('foo')
  await session1.shouldHaveNoResponse('foo')
})

test('interrupt', async () => {
  const app = new MockedApp()
  const session1 = app.createSession('group', 123, 123)

  app.plugin<RepeaterOptions>(repeater, {
    repeat: (_, times) => times >= 2,
    interrupt: (_, times) => times >= 4,
    repeatCheck: false,
    interruptCheck: false,
  })

  await session1.shouldHaveNoResponse('foo')
  await session1.shouldHaveReply('foo', 'foo')
  await session1.shouldHaveReply('foo', '打断复读！')
})

test('repeat check', async () => {
  const app = new MockedApp()
  const session1 = app.createSession('group', 123, 123)
  const session2 = app.createSession('group', 456, 123)

  app.plugin<RepeaterOptions>(repeater, {
    repeat: (_, times) => times >= 2,
    interrupt: false,
    repeatCheck: (_, times) => times >= 2,
    interruptCheck: false,
  })

  await session1.shouldHaveNoResponse('foo')
  await session1.shouldHaveReply('foo', 'foo')
  await session2.shouldHaveReply('foo', 'foo')
  await session2.shouldHaveReply('foo', `[CQ:at,qq=${session2.userId}] 在？为什么重复复读？`)
})

test('interrupt check', async () => {
  const app = new MockedApp()
  const session1 = app.createSession('group', 123, 123)

  app.plugin<RepeaterOptions>(repeater, {
    repeat: (_, times) => times >= 2,
    interrupt: false,
    repeatCheck: false,
    interruptCheck: (_, times) => times >= 2,
  })

  await session1.shouldHaveNoResponse('foo')
  await session1.shouldHaveNoResponse('bar')
  await session1.shouldHaveReply('bar', 'bar')
  await session1.shouldHaveReply('foo', `[CQ:at,qq=${session1.userId}] 在？为什么打断复读？`)
})

// make coverage happy
test('default behavior', async () => {
  const app = new MockedApp()
  const session1 = app.createSession('group', 123, 123)
  const session2 = app.createSession('group', 456, 123)
  const session3 = app.createSession('group', 789, 123)

  app.plugin(repeater)

  await session1.send('foo')
  await session2.send('foo')
  await session3.send('foo')
  await session1.send('foo')

  await session1.send('bar')
  await session2.send('bar')
  await session3.send('bar')
  await session1.send('foo')
})
