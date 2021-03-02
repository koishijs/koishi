import { expect } from 'chai'
import { App } from 'koishi-test-utils'
import { sleep, Session } from 'koishi-core'
import jest from 'jest-mock'
import * as common from 'koishi-plugin-common'

const app = new App({ mockDatabase: true })

const session = app.session('123')

const options: common.Config = {
  respondents: [{
    match: '挖坑一时爽',
    reply: '填坑火葬场',
  }, {
    match: /^(.+)一时爽$/,
    reply: (_, action) => `一直${action}一直爽`,
  }],
}

app.plugin(common, options)

before(async () => {
  await app.database.initUser('123', 3)
  await app.database.initChannel('123')
})

function receive(session: Partial<Session>) {
  app.receive(session)
  return sleep(0)
}

const receiveFriendRequest = (userId: string) => receive({
  type: 'friend-request',
  messageId: 'flag',
  userId,
})

const receiveGroupRequest = (userId: string) => receive({
  type: 'group-request',
  groupId: '10000',
  messageId: 'flag',
  userId,
})

const receiveGroupMemberRequest = (userId: string) => receive({
  type: 'group-member-request',
  groupId: '10000',
  messageId: 'flag',
  userId,
})

const handleFriendRequest = app.bots[0].handleFriendRequest = jest.fn(async () => {})
const handleGroupRequest = app.bots[0].handleGroupRequest = jest.fn(async () => {})
const handleGroupMemberRequest = app.bots[0].handleGroupMemberRequest = jest.fn(async () => {})

describe('Common Handlers', () => {
  beforeEach(() => {
    handleFriendRequest.mockClear()
    handleGroupRequest.mockClear()
    handleGroupMemberRequest.mockClear()
  })

  it('request handler: undefined', async () => {
    await receiveFriendRequest('321')
    expect(handleFriendRequest.mock.calls).to.have.length(0)

    await receiveGroupRequest('321')
    expect(handleGroupRequest.mock.calls).to.have.length(0)

    await receiveGroupMemberRequest('321')
    expect(handleGroupMemberRequest.mock.calls).to.have.length(0)
  })

  it('request handler: string', async () => {
    options.onFriendRequest = 'foo'
    options.onGroupRequest = 'baz'
    options.onGroupMemberRequest = 'bar'

    await receiveFriendRequest('321')
    expect(handleFriendRequest.mock.calls).to.have.length(1)
    expect(handleFriendRequest.mock.calls).to.have.shape([['flag', true, 'foo']])

    await receiveGroupRequest('321')
    expect(handleGroupRequest.mock.calls).to.have.length(1)
    expect(handleGroupRequest.mock.calls).to.have.shape([['flag', false, 'baz']])

    await receiveGroupMemberRequest('321')
    expect(handleGroupMemberRequest.mock.calls).to.have.length(1)
    expect(handleGroupMemberRequest.mock.calls).to.have.shape([['flag', false, 'bar']])
  })

  it('request handler: boolean', async () => {
    options.onFriendRequest = false
    options.onGroupRequest = false
    options.onGroupMemberRequest = false

    await receiveFriendRequest('321')
    expect(handleFriendRequest.mock.calls).to.have.length(1)
    expect(handleFriendRequest.mock.calls).to.have.shape([['flag', false]])

    await receiveGroupRequest('321')
    expect(handleGroupRequest.mock.calls).to.have.length(1)
    expect(handleGroupRequest.mock.calls).to.have.shape([['flag', false]])

    await receiveGroupMemberRequest('321')
    expect(handleGroupMemberRequest.mock.calls).to.have.length(1)
    expect(handleGroupMemberRequest.mock.calls).to.have.shape([['flag', false]])
  })

  it('request handler: function', async () => {
    options.onFriendRequest = () => true
    options.onGroupRequest = () => true
    options.onGroupMemberRequest = () => true

    await receiveFriendRequest('321')
    expect(handleFriendRequest.mock.calls).to.have.length(1)
    expect(handleFriendRequest.mock.calls).to.have.shape([['flag', true]])

    await receiveGroupRequest('321')
    expect(handleGroupRequest.mock.calls).to.have.length(1)
    expect(handleGroupRequest.mock.calls).to.have.shape([['flag', true]])

    await receiveGroupMemberRequest('321')
    expect(handleGroupMemberRequest.mock.calls).to.have.length(1)
    expect(handleGroupMemberRequest.mock.calls).to.have.shape([['flag', true]])
  })

  it('respondent', async () => {
    await session.shouldReply('挖坑一时爽', '填坑火葬场')
    await session.shouldReply('填坑一时爽', '一直填坑一直爽')
    await session.shouldNotReply('填坑一直爽')
  })
})
