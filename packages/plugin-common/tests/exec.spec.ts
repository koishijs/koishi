import { MockedApp } from 'koishi-test-utils'
import { exec } from '../src'

const app = new MockedApp()
const session = app.createSession('user', 123)

app.plugin(exec)

test('no input', async () => {
  await session.shouldHaveNoReply('$')
})

test('stdout', async () => {
  await session.shouldHaveReply('$ echo foo', 'foo')
})

test('stderr', async () => {
  await session.shouldHaveReply('$ echo foo >&2', 'foo')
})
