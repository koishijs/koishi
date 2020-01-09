import { MockedApp, createMeta } from 'koishi-test-utils'
import echo from '../src/echo'

const app = new MockedApp()

app.plugin(echo)

describe('echo command', () => {
  test('basic support', async () => {
    await app.receive(createMeta('message', 'private', 'friend', { message: 'echo foo', userId: 123 }))
    app.shouldHaveLastRequest('send_private_msg', { message: 'foo', userId: 123 })
    await app.receive(createMeta('message', 'group', 'normal', { message: 'echo foo', groupId: 123 }))
    app.shouldHaveLastRequest('send_group_msg', { message: 'foo', groupId: 123 })
    await app.receive(createMeta('message', 'discuss', null, { message: 'echo foo', discussId: 123 }))
    app.shouldHaveLastRequest('send_discuss_msg', { message: 'foo', discussId: 123 })
  })

  test('send to other contexts', async () => {
    await app.receive(createMeta('message', 'private', 'friend', { message: 'echo -u 456 foo', userId: 123 }))
    app.shouldHaveLastRequest('send_private_msg', { message: 'foo', userId: 456 })
    await app.receive(createMeta('message', 'private', 'friend', { message: 'echo -g 456 -d 789 foo', userId: 123 }))
    app.shouldHaveLastRequests([
      ['send_group_msg', { message: 'foo', groupId: 456 }],
      ['send_discuss_msg', { message: 'foo', discussId: 789 }],
    ])
  })
})
