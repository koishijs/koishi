import { MockedApp } from '../src'
import { expect } from 'chai'
import { fn } from 'jest-mock'

const app = new MockedApp()

before(() => app.start())

after(() => app.stop())

describe('Sender', () => {
  test('shouldHaveLastRequest', async () => {
    await app.bots[0].sendPrivateMsgAsync(123, 'foo')
    app.shouldHaveLastRequest('send_private_msg')
  })

  test('shouldHaveLastRequests', async () => {
    await app.bots[0].sendPrivateMsgAsync(123, 'foo')
    app.shouldHaveLastRequests([
      ['send_private_msg', { userId: 123 }],
    ])
  })

  test('shouldMatchSnapshot', async () => {
    await app.bots[0].sendPrivateMsgAsync(123, 'foo')
    app.shouldMatchSnapshot()
  })

  test('clearRequests', async () => {
    await app.bots[0].sendPrivateMsgAsync(123, 'foo')
    app.clearRequests()
    app.shouldHaveNoRequests()
  })

  test('setResponse (object, succeed)', async () => {
    app.setResponse('send_private_msg', { messageId: 321 })
    await expect(app.bots[0].sendPrivateMsg(123, 'foo')).resolves.toBe(321)
  })

  test('setResponse (object, failed)', async () => {
    app.setResponse('send_private_msg', { messageId: 321 }, 321)
    await expect(app.bots[0].sendPrivateMsg(123, 'foo')).rejects.toBeTruthy()
  })

  test('setResponse (function)', async () => {
    app.setResponse('send_private_msg', () => ({ data: { messageId: 321 } }))
    await expect(app.bots[0].sendPrivateMsg(123, 'foo')).resolves.toBe(321)
  })
})

describe('Receiver', () => {
  test('receiveFriendRequest', async () => {
    const mock = jest.fn()
    app.on('request/friend', mock)
    app.receiveFriendRequest(123)
    expect(mock).toBeCalledTimes(1)
    expect(mock.mock.calls[0]).toMatchObject([{
      postType: 'request',
      requestType: 'friend',
      userId: 123,
      selfId: 514,
      flag: 'flag',
    }])
  })

  test('receiveGroupRequest', async () => {
    const mock = jest.fn()
    app.on('request/group/add', mock)
    app.receiveGroupRequest('add', 123)
    expect(mock).toBeCalledTimes(1)
    expect(mock.mock.calls[0]).toMatchObject([{
      postType: 'request',
      requestType: 'group',
      subType: 'add',
      userId: 123,
      selfId: 514,
      groupId: 10000,
      flag: 'flag',
    }])
  })

  test('receiveGroupUpload', async () => {
    const mock = jest.fn()
    app.on('group-upload', mock)
    app.receiveGroupUpload({} as any, 123)
    expect(mock).toBeCalledTimes(1)
    expect(mock.mock.calls[0]).toMatchObject([{
      postType: 'notice',
      noticeType: 'group_upload',
      userId: 123,
      selfId: 514,
      groupId: 10000,
      file: {},
    }])
  })

  test('receiveGroupAdmin', async () => {
    const mock = jest.fn()
    app.on('group-admin/set', mock)
    app.receiveGroupAdmin('set', 123)
    expect(mock).toBeCalledTimes(1)
    expect(mock.mock.calls[0]).toMatchObject([{
      postType: 'notice',
      noticeType: 'group_admin',
      subType: 'set',
      userId: 123,
      selfId: 514,
      groupId: 10000,
    }])
  })

  test('receiveGroupIncrease', async () => {
    const mock = jest.fn()
    app.on('group-increase/invite', mock)
    app.receiveGroupIncrease('invite', 123)
    expect(mock).toBeCalledTimes(1)
    expect(mock.mock.calls[0]).toMatchObject([{
      postType: 'notice',
      noticeType: 'group_increase',
      subType: 'invite',
      userId: 123,
      selfId: 514,
      groupId: 10000,
      operatorId: 1000,
    }])
  })

  test('receiveGroupDecrease', async () => {
    const mock = jest.fn()
    app.on('group-decrease/kick', mock)
    app.receiveGroupDecrease('kick', 123)
    expect(mock).toBeCalledTimes(1)
    expect(mock.mock.calls[0]).toMatchObject([{
      postType: 'notice',
      noticeType: 'group_decrease',
      subType: 'kick',
      userId: 123,
      selfId: 514,
      groupId: 10000,
      operatorId: 1000,
    }])
  })

  test('receiveGroupBan', async () => {
    const mock = jest.fn()
    app.on('group-ban/ban', mock)
    app.receiveGroupBan('ban', 60, 123)
    expect(mock).toBeCalledTimes(1)
    expect(mock.mock.calls[0]).toMatchObject([{
      postType: 'notice',
      noticeType: 'group_ban',
      subType: 'ban',
      userId: 123,
      selfId: 514,
      groupId: 10000,
      operatorId: 1000,
      duration: 60,
    }])
  })

  test('receiveFriendAdd', async () => {
    const mock = jest.fn()
    app.on('friend-add', mock)
    app.receiveFriendAdd(123)
    expect(mock).toBeCalledTimes(1)
    expect(mock.mock.calls[0]).toMatchObject([{
      postType: 'notice',
      noticeType: 'friend_add',
      userId: 123,
      selfId: 514,
    }])
  })
})
