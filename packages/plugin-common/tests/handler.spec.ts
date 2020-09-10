import { expect } from 'chai'
import { fn } from 'jest-mock'
import { Meta } from 'koishi-core'
import { App } from 'koishi-test-utils'
import { sleep } from 'koishi-utils'
import * as common from 'koishi-plugin-common'

const app = new App({ mockDatabase: true })
const options: common.Config = {}

app.plugin(common, options)

before(async () => {
  await app.database.getGroup(123, app.selfId)
})

const receive = (meta: Meta) => {
  app.receive(meta)
  return sleep(0)
}

const receiveFriendRequest = (userId: number) => receive({
  postType: 'request',
  requestType: 'friend',
  flag: 'flag',
  userId,
})

const receiveGroupRequest = (subType: 'add' | 'invite', userId: number) => receive({
  postType: 'request',
  requestType: 'group',
  groupId: 10000,
  flag: 'flag',
  subType,
  userId,
})

const receiveGroupIncrease = (groupId: number, userId: number) => receive({
  postType: 'notice',
  noticeType: 'group_increase',
  subType: 'invite',
  userId,
  groupId,
})

const setFriendAddRequest = app.bots[0].setFriendAddRequest = fn(async () => {})
const setGroupAddRequest = app.bots[0].setGroupAddRequest = fn(async () => {})
const sendGroupMsg = app.bots[0].sendGroupMsg = fn(async () => 0)

describe('Common Handlers', () => {
  it('request handler: undefined', async () => {
    setFriendAddRequest.mockClear()
    await receiveFriendRequest(321)
    expect(setFriendAddRequest.mock.calls).to.have.length(0)

    setGroupAddRequest.mockClear()
    await receiveGroupRequest('add', 321)
    expect(setGroupAddRequest.mock.calls).to.have.length(0)

    setGroupAddRequest.mockClear()
    await receiveGroupRequest('invite', 321)
    expect(setGroupAddRequest.mock.calls).to.have.length(0)
  })

  it('request handler: string', async () => {
    options.onFriend = 'foo'
    options.onGroupAdd = 'bar'
    options.onGroupInvite = 'baz'

    setFriendAddRequest.mockClear()
    await receiveFriendRequest(321)
    expect(setFriendAddRequest.mock.calls).to.have.length(1)
    expect(setFriendAddRequest.mock.calls).to.have.shape([['flag', 'foo']])

    setGroupAddRequest.mockClear()
    await receiveGroupRequest('add', 321)
    expect(setGroupAddRequest.mock.calls).to.have.length(1)
    expect(setGroupAddRequest.mock.calls).to.have.shape([['flag', 'add', 'bar']])

    setGroupAddRequest.mockClear()
    await receiveGroupRequest('invite', 321)
    expect(setGroupAddRequest.mock.calls).to.have.length(1)
    expect(setGroupAddRequest.mock.calls).to.have.shape([['flag', 'invite', 'baz']])
  })

  it('request handler: boolean', async () => {
    options.onFriend = false
    options.onGroupAdd = false
    options.onGroupInvite = false

    setFriendAddRequest.mockClear()
    await receiveFriendRequest(321)
    expect(setFriendAddRequest.mock.calls).to.have.length(1)
    expect(setFriendAddRequest.mock.calls).to.have.shape([['flag', false]])

    setGroupAddRequest.mockClear()
    await receiveGroupRequest('add', 321)
    expect(setGroupAddRequest.mock.calls).to.have.length(1)
    expect(setGroupAddRequest.mock.calls).to.have.shape([['flag', 'add', false]])

    setGroupAddRequest.mockClear()
    await receiveGroupRequest('invite', 321)
    expect(setGroupAddRequest.mock.calls).to.have.length(1)
    expect(setGroupAddRequest.mock.calls).to.have.shape([['flag', 'invite', false]])
  })

  it('request handler: function', async () => {
    options.onFriend = () => true
    options.onGroupAdd = () => true
    options.onGroupInvite = () => true

    setFriendAddRequest.mockClear()
    await receiveFriendRequest(321)
    expect(setFriendAddRequest.mock.calls).to.have.length(1)
    expect(setFriendAddRequest.mock.calls).to.have.shape([['flag', true]])

    setGroupAddRequest.mockClear()
    await receiveGroupRequest('add', 321)
    expect(setGroupAddRequest.mock.calls).to.have.length(1)
    expect(setGroupAddRequest.mock.calls).to.have.shape([['flag', 'add', true]])

    setGroupAddRequest.mockClear()
    await receiveGroupRequest('invite', 321)
    expect(setGroupAddRequest.mock.calls).to.have.length(1)
    expect(setGroupAddRequest.mock.calls).to.have.shape([['flag', 'invite', true]])
  })

  it('welcome', async () => {
    sendGroupMsg.mockClear()
    await receiveGroupIncrease(321, 456)
    expect(sendGroupMsg.mock.calls).to.have.length(0)

    sendGroupMsg.mockClear()
    await receiveGroupIncrease(123, app.selfId)
    expect(sendGroupMsg.mock.calls).to.have.length(0)

    sendGroupMsg.mockClear()
    await receiveGroupIncrease(123, 456)
    expect(sendGroupMsg.mock.calls).to.have.length(1)
  })
})
