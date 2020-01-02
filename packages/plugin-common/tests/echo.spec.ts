import { httpServer } from 'koishi-test-utils'
import echo from '../src/echo'

const { createApp, createServer, postMeta, createMeta, waitFor } = httpServer

const server = createServer()
const app = createApp()

app.plugin(echo)

jest.setTimeout(1000)

beforeAll(() => {
  return app.start()
})

afterAll(() => {
  server.close()
  return app.stop()
})

describe('echo command', () => {
  test('basic support', async () => {
    await postMeta(createMeta('message', 'private', 'friend', { message: 'echo foo', userId: 123 }))
    await expect(waitFor('send_private_msg')).resolves.toMatchObject({ message: 'foo', user_id: '123' })
    await postMeta(createMeta('message', 'group', 'normal', { message: 'echo foo', groupId: 123 }))
    await expect(waitFor('send_group_msg')).resolves.toMatchObject({ message: 'foo', group_id: '123' })
    await postMeta(createMeta('message', 'discuss', null, { message: 'echo foo', discussId: 123 }))
    await expect(waitFor('send_discuss_msg')).resolves.toMatchObject({ message: 'foo', discuss_id: '123' })
  })

  test('send to multiple contexts', async () => {
    await postMeta(createMeta('message', 'private', 'friend', { message: 'echo -u 456 foo', userId: 123 }))
    await expect(waitFor('send_private_msg')).resolves.toMatchObject({ message: 'foo', user_id: '456' })
    await postMeta(createMeta('message', 'private', 'friend', { message: 'echo -g 456 -d 789 foo', userId: 123 }))
    await Promise.all([
      expect(waitFor('send_group_msg')).resolves.toMatchObject({ message: 'foo', group_id: '456' }),
      expect(waitFor('send_discuss_msg')).resolves.toMatchObject({ message: 'foo', discuss_id: '789' }),
    ])
  })
})
