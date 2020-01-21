import { MockedApp } from '../src'

const app = new MockedApp()

beforeAll(() => app.start())

afterAll(() => app.stop())

describe('Mocked Server Implementation', () => {
  test('shouldHaveLastRequest', async () => {
    await app.sender.sendPrivateMsgAsync(123, 'foo')
    app.shouldHaveLastRequest('send_private_msg')
  })

  test('shouldHaveLastRequests', async () => {
    await app.sender.sendPrivateMsgAsync(123, 'foo')
    app.shouldHaveLastRequests([
      ['send_private_msg', { userId: 123 }],
    ])
  })

  test('shouldMatchSnapshot', async () => {
    await app.sender.sendPrivateMsgAsync(123, 'foo')
    app.shouldMatchSnapshot()
  })

  test('clearRequests', async () => {
    await app.sender.sendPrivateMsgAsync(123, 'foo')
    app.clearRequests()
    app.shouldHaveNoRequests()
  })

  test('setResponse (object, succeed)', async () => {
    app.setResponse('send_private_msg', { messageId: 321 })
    await expect(app.sender.sendPrivateMsg(123, 'foo')).resolves.toBe(321)
  })

  test('setResponse (object, failed)', async () => {
    app.setResponse('send_private_msg', { messageId: 321 }, 321)
    await expect(app.sender.sendPrivateMsg(123, 'foo')).rejects.toBeTruthy()
  })

  test('setResponse (function)', async () => {
    app.setResponse('send_private_msg', () => ({ data: { messageId: 321 } }))
    await expect(app.sender.sendPrivateMsg(123, 'foo')).resolves.toBe(321)
  })
})
