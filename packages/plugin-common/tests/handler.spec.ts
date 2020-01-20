import { MockedApp } from 'koishi-test-utils'
import { sleep } from 'koishi-utils'
import { requestHandler, HandlerOptions } from '../src'
import 'koishi-database-memory'

let app: MockedApp

describe('type: undefined', () => {
  beforeAll(async () => {
    app = new MockedApp()
    app.plugin<HandlerOptions>(requestHandler)
    await app.start()
  })

  test('friend add', async () => {
    app.receiveFriendRequest(321)
    await sleep(0)
    app.shouldHaveNoRequests()
  })

  test('group add', async () => {
    app.receiveGroupRequest(321, 'add')
    await sleep(0)
    app.shouldHaveNoRequests()
  })

  test('group invite', async () => {
    app.receiveGroupRequest(321, 'invite')
    await sleep(0)
    app.shouldHaveNoRequests()
  })
})

describe('type: string', () => {
  beforeAll(async () => {
    app = new MockedApp()
    app.plugin<HandlerOptions>(requestHandler, {
      handleFriend: 'foo',
      handleGroupAdd: 'bar',
      handleGroupInvite: 'baz',
    })
    await app.start()
  })

  test('friend add', async () => {
    app.receiveFriendRequest(321)
    await sleep(0)
    app.shouldHaveLastRequest('set_friend_add_request', { approve: true, remark: 'foo' })
  })

  test('group add', async () => {
    app.receiveGroupRequest(321, 'add')
    await sleep(0)
    app.shouldHaveLastRequest('set_group_add_request', { approve: false, reason: 'bar' })
  })

  test('group invite', async () => {
    app.receiveGroupRequest(321, 'invite')
    await sleep(0)
    app.shouldHaveLastRequest('set_group_add_request', { approve: false, reason: 'baz' })
  })
})

describe('type: boolean', () => {
  beforeAll(async () => {
    app = new MockedApp()
    app.plugin<HandlerOptions>(requestHandler, {
      handleFriend: false,
      handleGroupAdd: false,
      handleGroupInvite: false,
    })
    await app.start()
  })

  test('friend add', async () => {
    app.receiveFriendRequest(321)
    await sleep(0)
    app.shouldHaveLastRequest('set_friend_add_request', { approve: false })
  })

  test('group add', async () => {
    app.receiveGroupRequest(321, 'add')
    await sleep(0)
    app.shouldHaveLastRequest('set_group_add_request', { approve: false })
  })

  test('group invite', async () => {
    app.receiveGroupRequest(321, 'invite')
    await sleep(0)
    app.shouldHaveLastRequest('set_group_add_request', { approve: false })
  })
})

describe('type: function', () => {
  beforeAll(async () => {
    app = new MockedApp()
    app.plugin<HandlerOptions>(requestHandler, {
      handleFriend: () => true,
      handleGroupAdd: () => true,
      handleGroupInvite: () => true,
    })
    await app.start()
  })

  test('friend add', async () => {
    app.receiveFriendRequest(321)
    await sleep(0)
    app.shouldHaveLastRequest('set_friend_add_request', { approve: true })
  })

  test('group add', async () => {
    app.receiveGroupRequest(321, 'add')
    await sleep(0)
    app.shouldHaveLastRequest('set_group_add_request', { approve: true })
  })

  test('group invite', async () => {
    app.receiveGroupRequest(321, 'invite')
    await sleep(0)
    app.shouldHaveLastRequest('set_group_add_request', { approve: true })
  })
})
