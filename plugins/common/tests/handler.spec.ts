import { App } from '@koishijs/test-utils'
import { expect } from 'chai'
import { sleep, Session } from 'koishi'
import jest from 'jest-mock'
import * as common from 'koishi-plugin-common'

const app = new App()
const session1 = app.session('123', '123')
const session2 = app.session('456', '123')
const session3 = app.session('789', '123')

const options: common.Config = {}
app.plugin(common, options)

function receive(session: Partial<Session>) {
  app.receive(session)
  return sleep(0)
}

const receiveFriendRequest = (userId: string) => receive({
  platform: 'mock',
  selfId: app.selfId,
  type: 'friend-request',
  messageId: 'flag',
  userId,
})

const receiveGroupRequest = (userId: string) => receive({
  platform: 'mock',
  selfId: app.selfId,
  type: 'group-request',
  groupId: '10000',
  messageId: 'flag',
  userId,
})

const receiveGroupMemberRequest = (userId: string) => receive({
  platform: 'mock',
  selfId: app.selfId,
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
    expect(handleFriendRequest.mock.calls).to.have.shape([['flag', true, 'foo']])

    await receiveGroupRequest('321')
    expect(handleGroupRequest.mock.calls).to.have.shape([['flag', false, 'baz']])

    await receiveGroupMemberRequest('321')
    expect(handleGroupMemberRequest.mock.calls).to.have.shape([['flag', false, 'bar']])
  })

  it('request handler: boolean', async () => {
    options.onFriendRequest = false
    options.onGroupRequest = false
    options.onGroupMemberRequest = false

    await receiveFriendRequest('321')
    expect(handleFriendRequest.mock.calls).to.have.shape([['flag', false]])

    await receiveGroupRequest('321')
    expect(handleGroupRequest.mock.calls).to.have.shape([['flag', false]])

    await receiveGroupMemberRequest('321')
    expect(handleGroupMemberRequest.mock.calls).to.have.shape([['flag', false]])
  })

  it('request handler: function', async () => {
    options.onFriendRequest = () => true
    options.onGroupRequest = () => true
    options.onGroupMemberRequest = () => true

    await receiveFriendRequest('321')
    expect(handleFriendRequest.mock.calls).to.have.shape([['flag', true]])

    await receiveGroupRequest('321')
    expect(handleGroupRequest.mock.calls).to.have.shape([['flag', true]])

    await receiveGroupMemberRequest('321')
    expect(handleGroupMemberRequest.mock.calls).to.have.shape([['flag', true]])
  })
})

describe('Repeater', () => {
  beforeEach(async () => {
    options.onRepeat = null
    options.onInterrupt = null
    await session1.shouldNotReply('clear')
  })

  it('repeat (basic config)', async () => {
    options.onRepeat = { minTimes: 2 }

    await session1.shouldNotReply('foo')
    await session1.shouldReply('foo', 'foo')
    await session1.shouldNotReply('foo')
    await session1.shouldNotReply('foo')
  })

  it('repeat check', async () => {
    options.onRepeat = ({ users }, { userId }) => users[userId] > 2 ? '在？为什么重复复读？' : ''

    await session1.shouldNotReply('foo')
    await session2.shouldNotReply('foo')
    await session3.shouldNotReply('foo')
    await session1.shouldNotReply('foo')
    await session1.shouldReply('foo', '在？为什么重复复读？')
  })

  it('interrupt', async () => {
    options.onRepeat = ({ times }) => times >= 3 ? '打断复读！' : ''

    await session1.shouldNotReply('foo')
    await session2.shouldNotReply('foo')
    await session3.shouldReply('foo', '打断复读！')
  })

  it('interrupt check', async () => {
    options.onInterrupt = ({ times }) => times >= 2 ? '在？为什么打断复读？' : ''

    await session1.shouldNotReply('foo')
    await session2.shouldNotReply('bar')
    await session1.shouldNotReply('foo')
    await session2.shouldNotReply('foo')
    await session3.shouldReply('bar', '在？为什么打断复读？')
  })
})
