import { createHttpServer, HttpServer } from 'koishi-test-utils'
import { Sender } from 'koishi-core'

let server: HttpServer
let sender: Sender

beforeAll(async () => {
  server = await createHttpServer()
  const app = server.createBoundApp()
  await app.start()
  sender = app.sender
})

afterAll(() => server.close())

describe('Sender API', () => {
  beforeEach(() => {
    server.clearRequests()
    sender.app.server.version = {} as any
  })

  const foo = { foo: 'foo' }
  const bar = { bar: 'bar' }

  test('get', async () => {
    server.setResponse('bar', bar)
    await expect(sender.get('bar')).resolves.to.have.shape(bar)

    server.setResponse('bar', bar, 102)
    await expect(sender.get('bar')).rejects.toHaveProperty('name', 'SenderError')

    server.setResponse('bar', bar, -99)
    await expect(sender.get('bar')).rejects.toHaveProperty('name', 'SenderError')
  })

  test('getAsync', async () => {
    server.setResponse('foo_async', foo, 1)
    await expect(sender.getAsync('foo')).resolves.toBeUndefined()

    server.setResponse('foo_async', foo, 102)
    await expect(sender.getAsync('foo')).rejects.toHaveProperty('name', 'SenderError')

    // < 4.0.0
    sender.app.version.pluginMajorVersion = 3
    sender.app.version.pluginMinorVersion = 4

    server.setResponse('foo', foo)
    await expect(sender.getAsync('foo')).resolves.toBeUndefined()

    server.setResponse('foo', foo, -99)
    await expect(sender.getAsync('foo')).resolves.toBeUndefined()
  })

  const messageId = 456

  test('sendMsg', async () => {
    await expect(sender.sendMsg(undefined, undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: type')
    await expect(sender.sendMsg('foo' as any, undefined, undefined)).rejects.toHaveProperty('message', 'invalid argument: type')
    await expect(sender.sendMsg('private', undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(sender.sendMsg('group', undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.sendMsg('discuss', undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: discussId')
    await expect(sender.sendMsgAsync(undefined, undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: type')
    await expect(sender.sendMsgAsync('foo' as any, undefined, undefined)).rejects.toHaveProperty('message', 'invalid argument: type')
    await expect(sender.sendMsgAsync('private', undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(sender.sendMsgAsync('group', undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.sendMsgAsync('discuss', undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: discussId')

    server.setResponse('send_msg', { messageId })
    await expect(sender.sendMsg('group', 123, '')).resolves.toBeUndefined()
    server.shouldHaveNoRequests()
    await expect(sender.sendMsg('group', 123, 'foo')).resolves.to.equal(messageId)
    server.shouldHaveLastRequest('send_msg', { groupId: '123', message: 'foo' })
    await expect(sender.sendMsg('private', 123, 'foo')).resolves.to.equal(messageId)
    server.shouldHaveLastRequest('send_msg', { userId: '123', message: 'foo' })
    await expect(sender.sendMsg('private', 123, 'foo', true)).resolves.to.equal(messageId)
    server.shouldHaveLastRequest('send_msg', { userId: '123', message: 'foo', autoEscape: 'true' })
    await expect(sender.sendMsgAsync('group', 123, '')).resolves.toBeUndefined()
    server.shouldHaveNoRequests()
    await expect(sender.sendMsgAsync('group', 123, 'foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_msg_async', { groupId: '123', message: 'foo' })
    await expect(sender.sendMsgAsync('private', 123, 'foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_msg_async', { userId: '123', message: 'foo' })
    await expect(sender.sendMsgAsync('private', 123, 'foo', true)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_msg_async', { userId: '123', message: 'foo', autoEscape: 'true' })
  })

  test('sendGroupMsg', async () => {
    await expect(sender.sendGroupMsg(undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.sendGroupMsgAsync(undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')

    server.setResponse('send_group_msg', { messageId })
    await expect(sender.sendGroupMsg(123, '')).resolves.toBeUndefined()
    server.shouldHaveNoRequests()
    await expect(sender.sendGroupMsg(123, 'foo')).resolves.to.equal(messageId)
    server.shouldHaveLastRequest('send_group_msg', { groupId: '123', message: 'foo' })
    await expect(sender.sendGroupMsg(123, 'foo', true)).resolves.to.equal(messageId)
    server.shouldHaveLastRequest('send_group_msg', { groupId: '123', message: 'foo', autoEscape: 'true' })
    await expect(sender.sendGroupMsgAsync(123, '')).resolves.toBeUndefined()
    server.shouldHaveNoRequests()
    await expect(sender.sendGroupMsgAsync(123, 'foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_group_msg_async', { groupId: '123', message: 'foo' })
    await expect(sender.sendGroupMsgAsync(123, 'foo', true)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_group_msg_async', { groupId: '123', message: 'foo', autoEscape: 'true' })
  })

  test('sendDiscussMsg', async () => {
    await expect(sender.sendDiscussMsg(undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: discussId')
    await expect(sender.sendDiscussMsgAsync(undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: discussId')

    server.setResponse('send_discuss_msg', { messageId })
    await expect(sender.sendDiscussMsg(123, '')).resolves.toBeUndefined()
    server.shouldHaveNoRequests()
    await expect(sender.sendDiscussMsg(123, 'foo')).resolves.to.equal(messageId)
    server.shouldHaveLastRequest('send_discuss_msg', { discussId: '123', message: 'foo' })
    await expect(sender.sendDiscussMsg(123, 'foo', true)).resolves.to.equal(messageId)
    server.shouldHaveLastRequest('send_discuss_msg', { discussId: '123', message: 'foo', autoEscape: 'true' })
    await expect(sender.sendDiscussMsgAsync(123, '')).resolves.toBeUndefined()
    server.shouldHaveNoRequests()
    await expect(sender.sendDiscussMsgAsync(123, 'foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_discuss_msg_async', { discussId: '123', message: 'foo' })
    await expect(sender.sendDiscussMsgAsync(123, 'foo', true)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_discuss_msg_async', { discussId: '123', message: 'foo', autoEscape: 'true' })
  })

  test('sendPrivateMsg', async () => {
    await expect(sender.sendPrivateMsg(undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(sender.sendPrivateMsgAsync(undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')

    server.setResponse('send_private_msg', { messageId })
    await expect(sender.sendPrivateMsg(123, '')).resolves.toBeUndefined()
    server.shouldHaveNoRequests()
    await expect(sender.sendPrivateMsg(123, 'foo')).resolves.to.equal(messageId)
    server.shouldHaveLastRequest('send_private_msg', { userId: '123', message: 'foo' })
    await expect(sender.sendPrivateMsg(123, 'foo', true)).resolves.to.equal(messageId)
    server.shouldHaveLastRequest('send_private_msg', { userId: '123', message: 'foo', autoEscape: 'true' })
    await expect(sender.sendPrivateMsgAsync(123, '')).resolves.toBeUndefined()
    server.shouldHaveNoRequests()
    await expect(sender.sendPrivateMsgAsync(123, 'foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_private_msg_async', { userId: '123', message: 'foo' })
    await expect(sender.sendPrivateMsgAsync(123, 'foo', true)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_private_msg_async', { userId: '123', message: 'foo', autoEscape: 'true' })
  })

  test('deleteMsg', async () => {
    await expect(sender.deleteMsg(undefined)).rejects.toHaveProperty('message', 'missing argument: messageId')
    await expect(sender.deleteMsgAsync(undefined)).rejects.toHaveProperty('message', 'missing argument: messageId')

    await expect(sender.deleteMsg(456)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('delete_msg', { messageId: '456' })
    await expect(sender.deleteMsgAsync(456)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('delete_msg_async', { messageId: '456' })
  })

  test('sendLike', async () => {
    await expect(sender.sendLike(undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(sender.sendLike(123, 0.1)).rejects.toHaveProperty('message', 'invalid argument: times')
    await expect(sender.sendLikeAsync(undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(sender.sendLikeAsync(123, 0.1)).rejects.toHaveProperty('message', 'invalid argument: times')

    await expect(sender.sendLike(123)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_like', { userId: '123', times: '1' })
    await expect(sender.sendLike(123, 5)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_like', { userId: '123', times: '5' })
    await expect(sender.sendLikeAsync(123)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_like_async', { userId: '123', times: '1' })
    await expect(sender.sendLikeAsync(123, 5)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_like_async', { userId: '123', times: '5' })
  })

  test('setGroupKick', async () => {
    await expect(sender.setGroupKick(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupKick(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(sender.setGroupKickAsync(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupKickAsync(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')

    await expect(sender.setGroupKick(456, 123)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_kick', { userId: '123', groupId: '456' })
    await expect(sender.setGroupKick(456, 123, true)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_kick', { userId: '123', groupId: '456', rejectAddRequest: 'true' })
    await expect(sender.setGroupKickAsync(456, 123)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_kick_async', { userId: '123', groupId: '456' })
    await expect(sender.setGroupKickAsync(456, 123, true)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_kick_async', { userId: '123', groupId: '456', rejectAddRequest: 'true' })
  })

  test('setGroupBan', async () => {
    await expect(sender.setGroupBan(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupBan(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(sender.setGroupBanAsync(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupBanAsync(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')

    await expect(sender.setGroupBan(456, 123)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_ban', { userId: '123', groupId: '456' })
    await expect(sender.setGroupBan(456, 123, 1000)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_ban', { userId: '123', groupId: '456', duration: '1000' })
    await expect(sender.setGroupBanAsync(456, 123)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_ban_async', { userId: '123', groupId: '456' })
    await expect(sender.setGroupBanAsync(456, 123, 1000)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_ban_async', { userId: '123', groupId: '456', duration: '1000' })
  })

  test('setGroupAnonymousBan', async () => {
    await expect(sender.setGroupAnonymousBan(undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupAnonymousBan(456, undefined)).rejects.toHaveProperty('message', 'missing argument: anonymous or flag')
    await expect(sender.setGroupAnonymousBanAsync(undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupAnonymousBanAsync(456, undefined)).rejects.toHaveProperty('message', 'missing argument: anonymous or flag')

    await expect(sender.setGroupAnonymousBan(456, 'foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_anonymous_ban', { flag: 'foo', groupId: '456' })
    await expect(sender.setGroupAnonymousBan(456, 'foo', 1000)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_anonymous_ban', { flag: 'foo', groupId: '456', duration: '1000' })
    await expect(sender.setGroupAnonymousBanAsync(456, 'foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_anonymous_ban_async', { flag: 'foo', groupId: '456' })
    await expect(sender.setGroupAnonymousBanAsync(456, 'foo', 1000)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_anonymous_ban_async', { flag: 'foo', groupId: '456', duration: '1000' })

    const anonymous = { flag: 'foo' }
    const serialized = JSON.stringify(anonymous)
    await expect(sender.setGroupAnonymousBan(456, anonymous)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_anonymous_ban', { anonymous: serialized, groupId: '456' })
    await expect(sender.setGroupAnonymousBan(456, anonymous, 1000)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_anonymous_ban', { anonymous: serialized, groupId: '456', duration: '1000' })
    await expect(sender.setGroupAnonymousBanAsync(456, anonymous)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_anonymous_ban_async', { anonymous: serialized, groupId: '456' })
    await expect(sender.setGroupAnonymousBanAsync(456, anonymous, 1000)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_anonymous_ban_async', { anonymous: serialized, groupId: '456', duration: '1000' })
  })

  test('setGroupWholeBan', async () => {
    await expect(sender.setGroupWholeBan(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupWholeBanAsync(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')

    await expect(sender.setGroupWholeBan(456)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_whole_ban', { groupId: '456', enable: 'true' })
    await expect(sender.setGroupWholeBan(456, false)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_whole_ban', { groupId: '456', enable: 'false' })
    await expect(sender.setGroupWholeBanAsync(456)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_whole_ban_async', { groupId: '456', enable: 'true' })
    await expect(sender.setGroupWholeBanAsync(456, false)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_whole_ban_async', { groupId: '456', enable: 'false' })
  })

  test('setGroupAdmin', async () => {
    await expect(sender.setGroupAdmin(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupAdmin(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(sender.setGroupAdminAsync(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupAdminAsync(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')

    await expect(sender.setGroupAdmin(456, 123)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_admin', { userId: '123', groupId: '456', enable: 'true' })
    await expect(sender.setGroupAdmin(456, 123, false)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_admin', { userId: '123', groupId: '456', enable: 'false' })
    await expect(sender.setGroupAdminAsync(456, 123)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_admin_async', { userId: '123', groupId: '456', enable: 'true' })
    await expect(sender.setGroupAdminAsync(456, 123, false)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_admin_async', { userId: '123', groupId: '456', enable: 'false' })
  })

  test('setGroupAnonymous', async () => {
    await expect(sender.setGroupAnonymous(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupAnonymousAsync(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')

    await expect(sender.setGroupAnonymous(456)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_anonymous', { groupId: '456', enable: 'true' })
    await expect(sender.setGroupAnonymous(456, false)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_anonymous', { groupId: '456', enable: 'false' })
    await expect(sender.setGroupAnonymousAsync(456)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_anonymous_async', { groupId: '456', enable: 'true' })
    await expect(sender.setGroupAnonymousAsync(456, false)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_anonymous_async', { groupId: '456', enable: 'false' })
  })

  test('setGroupCard', async () => {
    await expect(sender.setGroupCard(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupCard(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(sender.setGroupCardAsync(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupCardAsync(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')

    await expect(sender.setGroupCard(456, 123)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_card', { userId: '123', groupId: '456', card: '' })
    await expect(sender.setGroupCard(456, 123, 'foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_card', { userId: '123', groupId: '456', card: 'foo' })
    await expect(sender.setGroupCardAsync(456, 123)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_card_async', { userId: '123', groupId: '456', card: '' })
    await expect(sender.setGroupCardAsync(456, 123, 'foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_card_async', { userId: '123', groupId: '456', card: 'foo' })
  })

  test('setGroupSpecialTitle', async () => {
    await expect(sender.setGroupSpecialTitle(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupSpecialTitle(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(sender.setGroupSpecialTitleAsync(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupSpecialTitleAsync(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')

    await expect(sender.setGroupSpecialTitle(456, 123)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_special_title', { userId: '123', groupId: '456', specialTitle: '' })
    await expect(sender.setGroupSpecialTitle(456, 123, 'foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_special_title', { userId: '123', groupId: '456', specialTitle: 'foo' })
    await expect(sender.setGroupSpecialTitleAsync(456, 123)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_special_title_async', { userId: '123', groupId: '456', specialTitle: '' })
    await expect(sender.setGroupSpecialTitleAsync(456, 123, 'foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_special_title_async', { userId: '123', groupId: '456', specialTitle: 'foo' })
  })

  test('setGroupLeave', async () => {
    await expect(sender.setGroupLeave(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupLeaveAsync(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')

    await expect(sender.setGroupLeave(456)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_leave', { groupId: '456' })
    await expect(sender.setGroupLeave(456, true)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_leave', { groupId: '456', isDismiss: 'true' })
    await expect(sender.setGroupLeaveAsync(456)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_leave_async', { groupId: '456' })
    await expect(sender.setGroupLeaveAsync(456, true)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_leave_async', { groupId: '456', isDismiss: 'true' })
  })

  test('setDiscussLeave', async () => {
    await expect(sender.setDiscussLeave(undefined)).rejects.toHaveProperty('message', 'missing argument: discussId')
    await expect(sender.setDiscussLeaveAsync(undefined)).rejects.toHaveProperty('message', 'missing argument: discussId')

    await expect(sender.setDiscussLeave(456)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_discuss_leave', { discussId: '456' })
    await expect(sender.setDiscussLeaveAsync(456)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_discuss_leave_async', { discussId: '456' })
  })

  test('setFriendAddRequest', async () => {
    await expect(sender.setFriendAddRequest(undefined)).rejects.toHaveProperty('message', 'missing argument: flag')
    await expect(sender.setFriendAddRequestAsync(undefined)).rejects.toHaveProperty('message', 'missing argument: flag')

    await expect(sender.setFriendAddRequest('foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_friend_add_request', { flag: 'foo', approve: 'true' })
    await expect(sender.setFriendAddRequest('foo', false)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_friend_add_request', { flag: 'foo', approve: 'false' })
    await expect(sender.setFriendAddRequest('foo', 'bar')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_friend_add_request', { flag: 'foo', approve: 'true', remark: 'bar' })
    await expect(sender.setFriendAddRequestAsync('foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_friend_add_request_async', { flag: 'foo', approve: 'true' })
    await expect(sender.setFriendAddRequestAsync('foo', false)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_friend_add_request_async', { flag: 'foo', approve: 'false' })
    await expect(sender.setFriendAddRequestAsync('foo', 'bar')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_friend_add_request_async', { flag: 'foo', approve: 'true', remark: 'bar' })
  })

  test('setGroupAddRequest', async () => {
    await expect(sender.setGroupAddRequest(undefined, 'add')).rejects.toHaveProperty('message', 'missing argument: flag')
    await expect(sender.setGroupAddRequest('foo', undefined)).rejects.toHaveProperty('message', 'missing argument: subType')
    await expect(sender.setGroupAddRequest('foo', 'bar' as any)).rejects.toHaveProperty('message', 'invalid argument: subType')
    await expect(sender.setGroupAddRequestAsync(undefined, 'add')).rejects.toHaveProperty('message', 'missing argument: flag')
    await expect(sender.setGroupAddRequestAsync('foo', undefined)).rejects.toHaveProperty('message', 'missing argument: subType')
    await expect(sender.setGroupAddRequestAsync('foo', 'bar' as any)).rejects.toHaveProperty('message', 'invalid argument: subType')

    await expect(sender.setGroupAddRequest('foo', 'add')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_add_request', { flag: 'foo', subType: 'add', approve: 'true' })
    await expect(sender.setGroupAddRequest('foo', 'add', false)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_add_request', { flag: 'foo', subType: 'add', approve: 'false' })
    await expect(sender.setGroupAddRequest('foo', 'add', 'bar')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_add_request', { flag: 'foo', subType: 'add', approve: 'false', reason: 'bar' })
    await expect(sender.setGroupAddRequestAsync('foo', 'add')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_add_request_async', { flag: 'foo', subType: 'add', approve: 'true' })
    await expect(sender.setGroupAddRequestAsync('foo', 'add', false)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_add_request_async', { flag: 'foo', subType: 'add', approve: 'false' })
    await expect(sender.setGroupAddRequestAsync('foo', 'add', 'bar')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_add_request_async', { flag: 'foo', subType: 'add', approve: 'false', reason: 'bar' })
  })

  const userInfo = { userId: 321 }
  const groupInfo = { groupId: 654 }

  test('getLoginInfo', async () => {
    server.setResponse('get_login_info', userInfo)
    await expect(sender.getLoginInfo()).resolves.to.have.shape(userInfo)
    server.shouldHaveLastRequest('get_login_info', {})
  })

  test('getVipInfo', async () => {
    server.setResponse('_get_vip_info', userInfo)
    await expect(sender.getVipInfo()).resolves.to.have.shape(userInfo)
    server.shouldHaveLastRequest('_get_vip_info', {})
  })

  test('getStrangerInfo', async () => {
    await expect(sender.getStrangerInfo(undefined)).rejects.toHaveProperty('message', 'missing argument: userId')

    server.setResponse('get_stranger_info', userInfo)
    await expect(sender.getStrangerInfo(123)).resolves.to.have.shape(userInfo)
    server.shouldHaveLastRequest('get_stranger_info', { userId: '123' })
    await expect(sender.getStrangerInfo(123, true)).resolves.to.have.shape(userInfo)
    server.shouldHaveLastRequest('get_stranger_info', { userId: '123', noCache: 'true' })
  })

  test('getFriendList', async () => {
    server.setResponse('get_friend_list', [userInfo])
    await expect(sender.getFriendList()).resolves.to.have.shape([userInfo])
    server.shouldHaveLastRequest('get_friend_list', {})
  })

  test('getGroupInfo', async () => {
    await expect(sender.getGroupInfo(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')

    server.setResponse('get_group_info', groupInfo)
    await expect(sender.getGroupInfo(456)).resolves.to.have.shape(groupInfo)
    server.shouldHaveLastRequest('get_group_info', { groupId: '456' })
    await expect(sender.getGroupInfo(456, true)).resolves.to.have.shape(groupInfo)
    server.shouldHaveLastRequest('get_group_info', { groupId: '456', noCache: 'true' })

    // < 4.12.0
    sender.app.version.pluginMajorVersion = 4
    sender.app.version.pluginMinorVersion = 11
    server.setResponse('_get_group_info', groupInfo)
    await expect(sender.getGroupInfo(456)).resolves.to.have.shape(groupInfo)
    server.shouldHaveLastRequest('_get_group_info', { groupId: '456' })
    await expect(sender.getGroupInfo(456, true)).resolves.to.have.shape(groupInfo)
    server.shouldHaveLastRequest('_get_group_info', { groupId: '456', noCache: 'true' })

    // < 4.0.1
    sender.app.version.pluginMajorVersion = 3
    sender.app.version.pluginMinorVersion = 4
    await expect(sender.getGroupInfo(456)).rejects.toHaveProperty('message', 'sender.getGroupInfo() requires CQHTTP version >= 4.0.1')
  })

  test('getGroupList', async () => {
    server.setResponse('get_group_list', [groupInfo])
    await expect(sender.getGroupList()).resolves.to.have.shape([groupInfo])
    server.shouldHaveLastRequest('get_group_list', {})
  })

  test('getGroupMemberInfo', async () => {
    await expect(sender.getGroupMemberInfo(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.getGroupMemberInfo(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')

    server.setResponse('get_group_member_info', userInfo)
    await expect(sender.getGroupMemberInfo(456, 123)).resolves.to.have.shape(userInfo)
    server.shouldHaveLastRequest('get_group_member_info', { groupId: '456', userId: '123' })
    await expect(sender.getGroupMemberInfo(456, 123, true)).resolves.to.have.shape(userInfo)
    server.shouldHaveLastRequest('get_group_member_info', { groupId: '456', userId: '123', noCache: 'true' })
  })

  test('getGroupMemberList', async () => {
    await expect(sender.getGroupMemberList(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')

    server.setResponse('get_group_member_list', [userInfo])
    await expect(sender.getGroupMemberList(456)).resolves.to.have.shape([userInfo])
    server.shouldHaveLastRequest('get_group_member_list', { groupId: '456' })
  })

  test('getGroupNotice', async () => {
    await expect(sender.getGroupNotice(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')

    server.setResponse('_get_group_notice', groupInfo)
    await expect(sender.getGroupNotice(456)).resolves.to.have.shape(groupInfo)
    server.shouldHaveLastRequest('_get_group_notice', { groupId: '456' })
  })

  test('sendGroupNotice', async () => {
    await expect(sender.sendGroupNotice(undefined, 'foo', 'bar')).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.sendGroupNotice(456, undefined, 'bar')).rejects.toHaveProperty('message', 'missing argument: title')
    await expect(sender.sendGroupNotice(456, 'foo', undefined)).rejects.toHaveProperty('message', 'missing argument: content')
    await expect(sender.sendGroupNoticeAsync(undefined, 'foo', 'bar')).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.sendGroupNoticeAsync(456, undefined, 'bar')).rejects.toHaveProperty('message', 'missing argument: title')
    await expect(sender.sendGroupNoticeAsync(456, 'foo', undefined)).rejects.toHaveProperty('message', 'missing argument: content')

    await expect(sender.sendGroupNotice(456, 'foo', 'bar')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('_send_group_notice', { groupId: '456', title: 'foo', content: 'bar' })
    await expect(sender.sendGroupNoticeAsync(456, 'foo', 'bar')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('_send_group_notice_async', { groupId: '456', title: 'foo', content: 'bar' })
  })

  const cookies = 'baz'
  const token = 'bar'

  test('getCookies', async () => {
    server.setResponse('get_cookies', { cookies })
    await expect(sender.getCookies()).resolves.to.equal(cookies)
    server.shouldHaveLastRequest('get_cookies', {})
    await expect(sender.getCookies('foo')).resolves.to.equal(cookies)
    server.shouldHaveLastRequest('get_cookies', { domain: 'foo' })
  })

  test('getCsrfToken', async () => {
    server.setResponse('get_csrf_token', { token })
    await expect(sender.getCsrfToken()).resolves.to.equal(token)
    server.shouldHaveLastRequest('get_csrf_token', {})
  })

  test('getCredentials', async () => {
    const credentials = { cookies, token }
    server.setResponse('get_credentials', credentials)
    await expect(sender.getCredentials()).resolves.to.have.shape(credentials)
    server.shouldHaveLastRequest('get_credentials', {})
  })

  const file = 'filename'

  test('getRecord', async () => {
    await expect(sender.getRecord(undefined, 'mp3')).rejects.toHaveProperty('message', 'missing argument: file')
    await expect(sender.getRecord('foo', undefined)).rejects.toHaveProperty('message', 'missing argument: outFormat')

    server.setResponse('get_record', { file })
    await expect(sender.getRecord('foo', 'mp3')).resolves.to.equal(file)
    server.shouldHaveLastRequest('get_record', { file: 'foo', outFormat: 'mp3' })
    await expect(sender.getRecord('foo', 'mp3', true)).resolves.to.equal(file)
    server.shouldHaveLastRequest('get_record', { file: 'foo', outFormat: 'mp3', fullPath: 'true' })
  })

  test('getImage', async () => {
    await expect(sender.getImage(undefined)).rejects.toHaveProperty('message', 'missing argument: file')

    server.setResponse('get_image', { file })
    await expect(sender.getImage('foo')).resolves.to.equal(file)
    server.shouldHaveLastRequest('get_image', { file: 'foo' })
  })

  test('canSendRecord', async () => {
    server.setResponse('can_send_record', { yes: true })
    await expect(sender.canSendRecord()).resolves.to.equal(true)
    server.shouldHaveLastRequest('can_send_record', {})
  })

  test('canSendImage', async () => {
    server.setResponse('can_send_image', { yes: true })
    await expect(sender.canSendImage()).resolves.to.equal(true)
    server.shouldHaveLastRequest('can_send_image', {})
  })

  test('getStatus', async () => {
    const status = { good: true }
    server.setResponse('get_status', status)
    await expect(sender.getStatus()).resolves.to.have.shape(status)
    server.shouldHaveLastRequest('get_status', {})
  })

  test('getVersionInfo', async () => {
    server.setResponse('get_version_info', { pluginVersion: '4.12.3' })
    await expect(sender.getVersionInfo()).resolves.to.have.shape({
      pluginVersion: '4.12.3',
      pluginMajorVersion: 4,
      pluginMinorVersion: 12,
      pluginPatchVersion: 3,
    })
    server.shouldHaveLastRequest('get_version_info', {})
  })

  test('getStatus', async () => {
    await expect(sender.setRestart()).resolves.toBeUndefined()
    server.shouldHaveLastRequest('_set_restart', { cleanLog: 'false', cleanCache: 'false', cleanEvent: 'false' })
    await expect(sender.setRestart(true, true, true)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('_set_restart', { cleanLog: 'true', cleanCache: 'true', cleanEvent: 'true' })
  })

  test('setRestartPlugin', async () => {
    await expect(sender.setRestartPlugin(10)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_restart_plugin', { delay: '10' })
  })

  test('cleanDataDir', async () => {
    await expect(sender.cleanDataDir(undefined)).rejects.toHaveProperty('message', 'missing argument: dataDir')
    await expect(sender.cleanDataDir('foo' as any)).rejects.toHaveProperty('message', 'invalid argument: dataDir')
    await expect(sender.cleanDataDirAsync(undefined)).rejects.toHaveProperty('message', 'missing argument: dataDir')
    await expect(sender.cleanDataDirAsync('foo' as any)).rejects.toHaveProperty('message', 'invalid argument: dataDir')

    await expect(sender.cleanDataDir('image')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('clean_data_dir', { dataDir: 'image' })
    await expect(sender.cleanDataDirAsync('image')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('clean_data_dir_async', { dataDir: 'image' })
  })

  test('cleanPluginLog', async () => {
    await expect(sender.cleanPluginLog()).resolves.toBeUndefined()
    server.shouldHaveLastRequest('clean_plugin_log', {})
    await expect(sender.cleanPluginLogAsync()).resolves.toBeUndefined()
    server.shouldHaveLastRequest('clean_plugin_log_async', {})
  })
})
