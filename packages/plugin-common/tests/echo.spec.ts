import { MockedApp } from 'koishi-test-utils'
import { echo } from '../src'

const app = new MockedApp()

app.plugin(echo)

describe('echo command', () => {
  test('basic support', async () => {
    await app.receiveMessage('user', 'echo foo', 123)
    app.shouldHaveLastRequest('send_private_msg', { message: 'foo', userId: 123 })
    await app.receiveMessage('group', 'echo foo', 123, 456)
    app.shouldHaveLastRequest('send_group_msg', { message: 'foo', groupId: 456 })
    await app.receiveMessage('discuss', 'echo foo', 123, 789)
    app.shouldHaveLastRequest('send_discuss_msg', { message: 'foo', discussId: 789 })
  })

  test('send to other contexts', async () => {
    await app.receiveMessage('user', 'echo -u 456 foo', 123)
    app.shouldHaveLastRequest('send_private_msg', { message: 'foo', userId: 456 })
    await app.receiveMessage('user', 'echo -g 456 -d 789 foo', 123)
    app.shouldHaveLastRequests([
      ['send_group_msg', { message: 'foo', groupId: 456 }],
      ['send_discuss_msg', { message: 'foo', discussId: 789 }],
    ])
  })
})
