import { App } from 'koishi-test-utils'
import { sleep } from 'koishi-utils'
import handler from '../src/handler'
import 'koishi-database-memory'

let app: App

describe('type: undefined', () => {
  before(async () => {
    app = new App()
    app.plugin(handler)
    await app.start()
  })

  test('friend add', async () => {
    app.receiveFriendRequest(321)
    await sleep(0)
    app.shouldHaveNoRequests()
  })

  test('group add', async () => {
    app.receiveGroupRequest('add', 321)
    await sleep(0)
    app.shouldHaveNoRequests()
  })

  test('group invite', async () => {
    app.receiveGroupRequest('invite', 321)
    await sleep(0)
    app.shouldHaveNoRequests()
  })
})

describe('type: string', () => {
  before(async () => {
    app = new App()
    app.plugin(handler, {
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
    app.receiveGroupRequest('add', 321)
    await sleep(0)
    app.shouldHaveLastRequest('set_group_add_request', { approve: false, reason: 'bar' })
  })

  test('group invite', async () => {
    app.receiveGroupRequest('invite', 321)
    await sleep(0)
    app.shouldHaveLastRequest('set_group_add_request', { approve: false, reason: 'baz' })
  })
})

describe('type: boolean', () => {
  before(async () => {
    app = new App()
    app.plugin(handler, {
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
    app.receiveGroupRequest('add', 321)
    await sleep(0)
    app.shouldHaveLastRequest('set_group_add_request', { approve: false })
  })

  test('group invite', async () => {
    app.receiveGroupRequest('invite', 321)
    await sleep(0)
    app.shouldHaveLastRequest('set_group_add_request', { approve: false })
  })
})

describe('type: function', () => {
  before(async () => {
    app = new App()
    app.plugin(handler, {
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
    app.receiveGroupRequest('add', 321)
    await sleep(0)
    app.shouldHaveLastRequest('set_group_add_request', { approve: true })
  })

  test('group invite', async () => {
    app.receiveGroupRequest('invite', 321)
    await sleep(0)
    app.shouldHaveLastRequest('set_group_add_request', { approve: true })
  })
})
