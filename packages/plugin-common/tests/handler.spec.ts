import { MockedApp, MemoryDatabase } from 'koishi-test-utils'
import { registerDatabase } from 'koishi-core'
import { sleep } from 'koishi-utils'
import requestHandler, { HandlerConfig } from '../src/request-handler'

registerDatabase('memory', MemoryDatabase)

let app: MockedApp

describe('support string', () => {
  beforeAll(async () => {
    app = new MockedApp()
    app.plugin<HandlerConfig>(requestHandler, {
      handleFriend: 'foo',
      handleGroupAdd: 'bar',
    })
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
})

describe('support boolean', () => {
  beforeAll(async () => {
    app = new MockedApp()
    app.plugin<HandlerConfig>(requestHandler, {
      handleFriend: false,
      handleGroupInvite: false,
    })
  })

  test('friend add', async () => {
    app.receiveFriendRequest(321)
    await sleep(0)
    app.shouldHaveLastRequest('set_friend_add_request', { approve: false })
  })

  test('group invite', async () => {
    app.receiveGroupRequest(321, 'invite')
    await sleep(0)
    app.shouldHaveLastRequest('set_group_add_request', { approve: false })
  })
})

describe('default behaviour without database', () => {
  beforeAll(async () => {
    app = new MockedApp()
    app.plugin<HandlerConfig>(requestHandler)
  })

  test('friend add', async () => {
    app.receiveFriendRequest(321)
    await sleep(0)
    app.shouldHaveNoRequests()
  })

  test('group invite', async () => {
    app.receiveGroupRequest(654, 'invite')
    await sleep(0)
    app.shouldHaveNoRequests()
  })

  test('group add', async () => {
    app.receiveGroupRequest(456, 'add')
    await sleep(0)
    app.shouldHaveNoRequests()
  })
})

describe('default behaviour with database', () => {
  beforeAll(async () => {
    app = new MockedApp({ database: { memory: {} } })
    app.plugin<HandlerConfig>(requestHandler)

    await app.start()
    await app.database.getUser(123, 1)
    await app.database.getUser(456, 4)
    await app.database.getUser(654, 3)
  })

  test('friend add with authority 0', async () => {
    app.receiveFriendRequest(321)
    await sleep(0)
    app.shouldHaveNoRequests()
  })

  test('friend add with authority 1', async () => {
    app.receiveFriendRequest(123)
    await sleep(0)
    app.shouldHaveLastRequest('set_friend_add_request', { approve: true })
  })

  test('group invite with authority 3', async () => {
    app.receiveGroupRequest(654, 'invite')
    await sleep(0)
    app.shouldHaveNoRequests()
  })

  test('group invite with authority 4', async () => {
    app.receiveGroupRequest(456, 'invite')
    await sleep(0)
    app.shouldHaveLastRequest('set_group_add_request', { approve: true, subType: 'invite' })
  })

  test('group add with authority 4', async () => {
    app.receiveGroupRequest(456, 'add')
    await sleep(0)
    app.shouldHaveNoRequests()
  })
})
