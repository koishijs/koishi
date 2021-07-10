import { createHttpServer, HttpServer } from '@koishijs/test-utils'
import { Sender } from 'koishi-core'

let server: HttpServer
let bot: Sender

before(async () => {
  server = await createHttpServer()
  const app = server.createBoundApp()
  await app.start()
  bot = app.sender
})

after(() => server.close())

describe('Sender API', () => {
  beforeEach(() => {
    server.clearRequests()
    bot.app.server.version = {} as any
  })

  const foo = { foo: 'foo' }
  const bar = { bar: 'bar' }

  test('get', async () => {
    server.setResponse('bar', bar)
    await expect(bot.get('bar')).resolves.to.have.shape(bar)

    server.setResponse('bar', bar, 102)
    await expect(bot.get('bar')).rejects.toHaveProperty('name', 'SenderError')

    server.setResponse('bar', bar, -99)
    await expect(bot.get('bar')).rejects.toHaveProperty('name', 'SenderError')
  })

  test('getAsync', async () => {
    server.setResponse('foo_async', foo, 1)
    await expect(bot.getAsync('foo')).resolves.toBeUndefined()

    server.setResponse('foo_async', foo, 102)
    await expect(bot.getAsync('foo')).rejects.toHaveProperty('name', 'SenderError')

    // < 4.0.0
    bot.app.version.pluginMajorVersion = 3
    bot.app.version.pluginMinorVersion = 4

    server.setResponse('foo', foo)
    await expect(bot.getAsync('foo')).resolves.toBeUndefined()

    server.setResponse('foo', foo, -99)
    await expect(bot.getAsync('foo')).resolves.toBeUndefined()
  })

  const messageId = 456

  test('sendMsg', async () => {
    await expect(bot.sendMsg(undefined, undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: type')
    await expect(bot.sendMsg('foo' as any, undefined, undefined)).rejects.toHaveProperty('message', 'invalid argument: type')
    await expect(bot.sendMsg('private', undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(bot.sendMsg('group', undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(bot.sendMsg('discuss', undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: discussId')
    await expect(bot.sendMsgAsync(undefined, undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: type')
    await expect(bot.sendMsgAsync('foo' as any, undefined, undefined)).rejects.toHaveProperty('message', 'invalid argument: type')
    await expect(bot.sendMsgAsync('private', undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(bot.sendMsgAsync('group', undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(bot.sendMsgAsync('discuss', undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: discussId')

    server.setResponse('send_msg', { messageId })
    await expect(bot.sendMsg('group', 123, '')).resolves.toBeUndefined()
    server.shouldHaveNoRequests()
    await expect(bot.sendMsg('group', 123, 'foo')).resolves.to.equal(messageId)
    server.shouldHaveLastRequest('send_msg', { groupId: '123', message: 'foo' })
    await expect(bot.sendMsg('private', 123, 'foo')).resolves.to.equal(messageId)
    server.shouldHaveLastRequest('send_msg', { userId: '123', message: 'foo' })
    await expect(bot.sendMsg('private', 123, 'foo', true)).resolves.to.equal(messageId)
    server.shouldHaveLastRequest('send_msg', { userId: '123', message: 'foo', autoEscape: 'true' })
    await expect(bot.sendMsgAsync('group', 123, '')).resolves.toBeUndefined()
    server.shouldHaveNoRequests()
    await expect(bot.sendMsgAsync('group', 123, 'foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_msg_async', { groupId: '123', message: 'foo' })
    await expect(bot.sendMsgAsync('private', 123, 'foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_msg_async', { userId: '123', message: 'foo' })
    await expect(bot.sendMsgAsync('private', 123, 'foo', true)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_msg_async', { userId: '123', message: 'foo', autoEscape: 'true' })
  })

  test('sendGroupMsg', async () => {
    await expect(bot.sendGroupMsg(undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(bot.sendGroupMsgAsync(undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')

    server.setResponse('send_group_msg', { messageId })
    await expect(bot.sendGroupMsg(123, '')).resolves.toBeUndefined()
    server.shouldHaveNoRequests()
    await expect(bot.sendGroupMsg(123, 'foo')).resolves.to.equal(messageId)
    server.shouldHaveLastRequest('send_group_msg', { groupId: '123', message: 'foo' })
    await expect(bot.sendGroupMsg(123, 'foo', true)).resolves.to.equal(messageId)
    server.shouldHaveLastRequest('send_group_msg', { groupId: '123', message: 'foo', autoEscape: 'true' })
    await expect(bot.sendGroupMsgAsync(123, '')).resolves.toBeUndefined()
    server.shouldHaveNoRequests()
    await expect(bot.sendGroupMsgAsync(123, 'foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_group_msg_async', { groupId: '123', message: 'foo' })
    await expect(bot.sendGroupMsgAsync(123, 'foo', true)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_group_msg_async', { groupId: '123', message: 'foo', autoEscape: 'true' })
  })

  test('sendDiscussMsg', async () => {
    await expect(bot.sendDiscussMsg(undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: discussId')
    await expect(bot.sendDiscussMsgAsync(undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: discussId')

    server.setResponse('send_discuss_msg', { messageId })
    await expect(bot.sendDiscussMsg(123, '')).resolves.toBeUndefined()
    server.shouldHaveNoRequests()
    await expect(bot.sendDiscussMsg(123, 'foo')).resolves.to.equal(messageId)
    server.shouldHaveLastRequest('send_discuss_msg', { discussId: '123', message: 'foo' })
    await expect(bot.sendDiscussMsg(123, 'foo', true)).resolves.to.equal(messageId)
    server.shouldHaveLastRequest('send_discuss_msg', { discussId: '123', message: 'foo', autoEscape: 'true' })
    await expect(bot.sendDiscussMsgAsync(123, '')).resolves.toBeUndefined()
    server.shouldHaveNoRequests()
    await expect(bot.sendDiscussMsgAsync(123, 'foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_discuss_msg_async', { discussId: '123', message: 'foo' })
    await expect(bot.sendDiscussMsgAsync(123, 'foo', true)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_discuss_msg_async', { discussId: '123', message: 'foo', autoEscape: 'true' })
  })

  test('sendPrivateMsg', async () => {
    await expect(bot.sendPrivateMsg(undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(bot.sendPrivateMsgAsync(undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')

    server.setResponse('send_private_msg', { messageId })
    await expect(bot.sendPrivateMsg(123, '')).resolves.toBeUndefined()
    server.shouldHaveNoRequests()
    await expect(bot.sendPrivateMsg(123, 'foo')).resolves.to.equal(messageId)
    server.shouldHaveLastRequest('send_private_msg', { userId: '123', message: 'foo' })
    await expect(bot.sendPrivateMsg(123, 'foo', true)).resolves.to.equal(messageId)
    server.shouldHaveLastRequest('send_private_msg', { userId: '123', message: 'foo', autoEscape: 'true' })
    await expect(bot.sendPrivateMsgAsync(123, '')).resolves.toBeUndefined()
    server.shouldHaveNoRequests()
    await expect(bot.sendPrivateMsgAsync(123, 'foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_private_msg_async', { userId: '123', message: 'foo' })
    await expect(bot.sendPrivateMsgAsync(123, 'foo', true)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_private_msg_async', { userId: '123', message: 'foo', autoEscape: 'true' })
  })

  test('deleteMsg', async () => {
    await expect(bot.deleteMsg(undefined)).rejects.toHaveProperty('message', 'missing argument: messageId')
    await expect(bot.deleteMsgAsync(undefined)).rejects.toHaveProperty('message', 'missing argument: messageId')

    await expect(bot.deleteMsg(456)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('delete_msg', { messageId: '456' })
    await expect(bot.deleteMsgAsync(456)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('delete_msg_async', { messageId: '456' })
  })

  test('sendLike', async () => {
    await expect(bot.sendLike(undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(bot.sendLike(123, 0.1)).rejects.toHaveProperty('message', 'invalid argument: times')
    await expect(bot.sendLikeAsync(undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(bot.sendLikeAsync(123, 0.1)).rejects.toHaveProperty('message', 'invalid argument: times')

    await expect(bot.sendLike(123)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_like', { userId: '123', times: '1' })
    await expect(bot.sendLike(123, 5)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_like', { userId: '123', times: '5' })
    await expect(bot.sendLikeAsync(123)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_like_async', { userId: '123', times: '1' })
    await expect(bot.sendLikeAsync(123, 5)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('send_like_async', { userId: '123', times: '5' })
  })

  test('setGroupKick', async () => {
    await expect(bot.setGroupKick(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(bot.setGroupKick(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(bot.setGroupKickAsync(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(bot.setGroupKickAsync(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')

    await expect(bot.setGroupKick(456, 123)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_kick', { userId: '123', groupId: '456' })
    await expect(bot.setGroupKick(456, 123, true)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_kick', { userId: '123', groupId: '456', rejectAddRequest: 'true' })
    await expect(bot.setGroupKickAsync(456, 123)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_kick_async', { userId: '123', groupId: '456' })
    await expect(bot.setGroupKickAsync(456, 123, true)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_kick_async', { userId: '123', groupId: '456', rejectAddRequest: 'true' })
  })

  test('setGroupBan', async () => {
    await expect(bot.setGroupBan(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(bot.setGroupBan(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(bot.setGroupBanAsync(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(bot.setGroupBanAsync(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')

    await expect(bot.setGroupBan(456, 123)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_ban', { userId: '123', groupId: '456' })
    await expect(bot.setGroupBan(456, 123, 1000)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_ban', { userId: '123', groupId: '456', duration: '1000' })
    await expect(bot.setGroupBanAsync(456, 123)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_ban_async', { userId: '123', groupId: '456' })
    await expect(bot.setGroupBanAsync(456, 123, 1000)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_ban_async', { userId: '123', groupId: '456', duration: '1000' })
  })

  test('setGroupAnonymousBan', async () => {
    await expect(bot.setGroupAnonymousBan(undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(bot.setGroupAnonymousBan(456, undefined)).rejects.toHaveProperty('message', 'missing argument: anonymous or flag')
    await expect(bot.setGroupAnonymousBanAsync(undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(bot.setGroupAnonymousBanAsync(456, undefined)).rejects.toHaveProperty('message', 'missing argument: anonymous or flag')

    await expect(bot.setGroupAnonymousBan(456, 'foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_anonymous_ban', { flag: 'foo', groupId: '456' })
    await expect(bot.setGroupAnonymousBan(456, 'foo', 1000)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_anonymous_ban', { flag: 'foo', groupId: '456', duration: '1000' })
    await expect(bot.setGroupAnonymousBanAsync(456, 'foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_anonymous_ban_async', { flag: 'foo', groupId: '456' })
    await expect(bot.setGroupAnonymousBanAsync(456, 'foo', 1000)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_anonymous_ban_async', { flag: 'foo', groupId: '456', duration: '1000' })

    const anonymous = { flag: 'foo' }
    const serialized = JSON.stringify(anonymous)
    await expect(bot.setGroupAnonymousBan(456, anonymous)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_anonymous_ban', { anonymous: serialized, groupId: '456' })
    await expect(bot.setGroupAnonymousBan(456, anonymous, 1000)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_anonymous_ban', { anonymous: serialized, groupId: '456', duration: '1000' })
    await expect(bot.setGroupAnonymousBanAsync(456, anonymous)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_anonymous_ban_async', { anonymous: serialized, groupId: '456' })
    await expect(bot.setGroupAnonymousBanAsync(456, anonymous, 1000)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_anonymous_ban_async', { anonymous: serialized, groupId: '456', duration: '1000' })
  })

  test('setGroupWholeBan', async () => {
    await expect(bot.setGroupWholeBan(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(bot.setGroupWholeBanAsync(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')

    await expect(bot.setGroupWholeBan(456)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_whole_ban', { groupId: '456', enable: 'true' })
    await expect(bot.setGroupWholeBan(456, false)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_whole_ban', { groupId: '456', enable: 'false' })
    await expect(bot.setGroupWholeBanAsync(456)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_whole_ban_async', { groupId: '456', enable: 'true' })
    await expect(bot.setGroupWholeBanAsync(456, false)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_whole_ban_async', { groupId: '456', enable: 'false' })
  })

  test('setGroupAdmin', async () => {
    await expect(bot.setGroupAdmin(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(bot.setGroupAdmin(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(bot.setGroupAdminAsync(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(bot.setGroupAdminAsync(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')

    await expect(bot.setGroupAdmin(456, 123)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_admin', { userId: '123', groupId: '456', enable: 'true' })
    await expect(bot.setGroupAdmin(456, 123, false)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_admin', { userId: '123', groupId: '456', enable: 'false' })
    await expect(bot.setGroupAdminAsync(456, 123)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_admin_async', { userId: '123', groupId: '456', enable: 'true' })
    await expect(bot.setGroupAdminAsync(456, 123, false)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_admin_async', { userId: '123', groupId: '456', enable: 'false' })
  })

  test('setGroupAnonymous', async () => {
    await expect(bot.setGroupAnonymous(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(bot.setGroupAnonymousAsync(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')

    await expect(bot.setGroupAnonymous(456)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_anonymous', { groupId: '456', enable: 'true' })
    await expect(bot.setGroupAnonymous(456, false)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_anonymous', { groupId: '456', enable: 'false' })
    await expect(bot.setGroupAnonymousAsync(456)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_anonymous_async', { groupId: '456', enable: 'true' })
    await expect(bot.setGroupAnonymousAsync(456, false)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_anonymous_async', { groupId: '456', enable: 'false' })
  })

  test('setGroupCard', async () => {
    await expect(bot.setGroupCard(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(bot.setGroupCard(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(bot.setGroupCardAsync(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(bot.setGroupCardAsync(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')

    await expect(bot.setGroupCard(456, 123)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_card', { userId: '123', groupId: '456', card: '' })
    await expect(bot.setGroupCard(456, 123, 'foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_card', { userId: '123', groupId: '456', card: 'foo' })
    await expect(bot.setGroupCardAsync(456, 123)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_card_async', { userId: '123', groupId: '456', card: '' })
    await expect(bot.setGroupCardAsync(456, 123, 'foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_card_async', { userId: '123', groupId: '456', card: 'foo' })
  })

  test('setGroupSpecialTitle', async () => {
    await expect(bot.setGroupSpecialTitle(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(bot.setGroupSpecialTitle(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(bot.setGroupSpecialTitleAsync(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(bot.setGroupSpecialTitleAsync(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')

    await expect(bot.setGroupSpecialTitle(456, 123)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_special_title', { userId: '123', groupId: '456', specialTitle: '' })
    await expect(bot.setGroupSpecialTitle(456, 123, 'foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_special_title', { userId: '123', groupId: '456', specialTitle: 'foo' })
    await expect(bot.setGroupSpecialTitleAsync(456, 123)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_special_title_async', { userId: '123', groupId: '456', specialTitle: '' })
    await expect(bot.setGroupSpecialTitleAsync(456, 123, 'foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_special_title_async', { userId: '123', groupId: '456', specialTitle: 'foo' })
  })

  test('setGroupLeave', async () => {
    await expect(bot.setGroupLeave(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(bot.setGroupLeaveAsync(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')

    await expect(bot.setGroupLeave(456)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_leave', { groupId: '456' })
    await expect(bot.setGroupLeave(456, true)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_leave', { groupId: '456', isDismiss: 'true' })
    await expect(bot.setGroupLeaveAsync(456)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_leave_async', { groupId: '456' })
    await expect(bot.setGroupLeaveAsync(456, true)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_leave_async', { groupId: '456', isDismiss: 'true' })
  })

  test('setDiscussLeave', async () => {
    await expect(bot.setDiscussLeave(undefined)).rejects.toHaveProperty('message', 'missing argument: discussId')
    await expect(bot.setDiscussLeaveAsync(undefined)).rejects.toHaveProperty('message', 'missing argument: discussId')

    await expect(bot.setDiscussLeave(456)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_discuss_leave', { discussId: '456' })
    await expect(bot.setDiscussLeaveAsync(456)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_discuss_leave_async', { discussId: '456' })
  })

  test('setFriendAddRequest', async () => {
    await expect(bot.setFriendAddRequest(undefined)).rejects.toHaveProperty('message', 'missing argument: flag')
    await expect(bot.setFriendAddRequestAsync(undefined)).rejects.toHaveProperty('message', 'missing argument: flag')

    await expect(bot.setFriendAddRequest('foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_friend_add_request', { flag: 'foo', approve: 'true' })
    await expect(bot.setFriendAddRequest('foo', false)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_friend_add_request', { flag: 'foo', approve: 'false' })
    await expect(bot.setFriendAddRequest('foo', 'bar')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_friend_add_request', { flag: 'foo', approve: 'true', remark: 'bar' })
    await expect(bot.setFriendAddRequestAsync('foo')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_friend_add_request_async', { flag: 'foo', approve: 'true' })
    await expect(bot.setFriendAddRequestAsync('foo', false)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_friend_add_request_async', { flag: 'foo', approve: 'false' })
    await expect(bot.setFriendAddRequestAsync('foo', 'bar')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_friend_add_request_async', { flag: 'foo', approve: 'true', remark: 'bar' })
  })

  test('setGroupAddRequest', async () => {
    await expect(bot.setGroupAddRequest(undefined, 'add')).rejects.toHaveProperty('message', 'missing argument: flag')
    await expect(bot.setGroupAddRequest('foo', undefined)).rejects.toHaveProperty('message', 'missing argument: subtype')
    await expect(bot.setGroupAddRequest('foo', 'bar' as any)).rejects.toHaveProperty('message', 'invalid argument: subtype')
    await expect(bot.setGroupAddRequestAsync(undefined, 'add')).rejects.toHaveProperty('message', 'missing argument: flag')
    await expect(bot.setGroupAddRequestAsync('foo', undefined)).rejects.toHaveProperty('message', 'missing argument: subtype')
    await expect(bot.setGroupAddRequestAsync('foo', 'bar' as any)).rejects.toHaveProperty('message', 'invalid argument: subtype')

    await expect(bot.setGroupAddRequest('foo', 'add')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_add_request', { flag: 'foo', subtype: 'add', approve: 'true' })
    await expect(bot.setGroupAddRequest('foo', 'add', false)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_add_request', { flag: 'foo', subtype: 'add', approve: 'false' })
    await expect(bot.setGroupAddRequest('foo', 'add', 'bar')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_add_request', { flag: 'foo', subtype: 'add', approve: 'false', reason: 'bar' })
    await expect(bot.setGroupAddRequestAsync('foo', 'add')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_add_request_async', { flag: 'foo', subtype: 'add', approve: 'true' })
    await expect(bot.setGroupAddRequestAsync('foo', 'add', false)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_add_request_async', { flag: 'foo', subtype: 'add', approve: 'false' })
    await expect(bot.setGroupAddRequestAsync('foo', 'add', 'bar')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_group_add_request_async', { flag: 'foo', subtype: 'add', approve: 'false', reason: 'bar' })
  })

  const userInfo = { userId: 321 }
  const groupInfo = { groupId: 654 }

  test('getLoginInfo', async () => {
    server.setResponse('get_login_info', userInfo)
    await expect(bot.getLoginInfo()).resolves.to.have.shape(userInfo)
    server.shouldHaveLastRequest('get_login_info', {})
  })

  test('getVipInfo', async () => {
    server.setResponse('_get_vip_info', userInfo)
    await expect(bot.getVipInfo()).resolves.to.have.shape(userInfo)
    server.shouldHaveLastRequest('_get_vip_info', {})
  })

  test('getStrangerInfo', async () => {
    await expect(bot.getStrangerInfo(undefined)).rejects.toHaveProperty('message', 'missing argument: userId')

    server.setResponse('get_stranger_info', userInfo)
    await expect(bot.getStrangerInfo(123)).resolves.to.have.shape(userInfo)
    server.shouldHaveLastRequest('get_stranger_info', { userId: '123' })
    await expect(bot.getStrangerInfo(123, true)).resolves.to.have.shape(userInfo)
    server.shouldHaveLastRequest('get_stranger_info', { userId: '123', noCache: 'true' })
  })

  test('getFriendList', async () => {
    server.setResponse('get_friend_list', [userInfo])
    await expect(bot.getFriendList()).resolves.to.have.shape([userInfo])
    server.shouldHaveLastRequest('get_friend_list', {})
  })

  test('getGroupInfo', async () => {
    await expect(bot.getGroupInfo(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')

    server.setResponse('get_group_info', groupInfo)
    await expect(bot.getGroupInfo(456)).resolves.to.have.shape(groupInfo)
    server.shouldHaveLastRequest('get_group_info', { groupId: '456' })
    await expect(bot.getGroupInfo(456, true)).resolves.to.have.shape(groupInfo)
    server.shouldHaveLastRequest('get_group_info', { groupId: '456', noCache: 'true' })

    // < 4.12.0
    bot.app.version.pluginMajorVersion = 4
    bot.app.version.pluginMinorVersion = 11
    server.setResponse('_get_group_info', groupInfo)
    await expect(bot.getGroupInfo(456)).resolves.to.have.shape(groupInfo)
    server.shouldHaveLastRequest('_get_group_info', { groupId: '456' })
    await expect(bot.getGroupInfo(456, true)).resolves.to.have.shape(groupInfo)
    server.shouldHaveLastRequest('_get_group_info', { groupId: '456', noCache: 'true' })

    // < 4.0.1
    bot.app.version.pluginMajorVersion = 3
    bot.app.version.pluginMinorVersion = 4
    await expect(bot.getGroupInfo(456)).rejects.toHaveProperty('message', 'bot.getGroupInfo() requires CQHTTP version >= 4.0.1')
  })

  test('getGroupList', async () => {
    server.setResponse('get_group_list', [groupInfo])
    await expect(bot.getGroupList()).resolves.to.have.shape([groupInfo])
    server.shouldHaveLastRequest('get_group_list', {})
  })

  test('getGroupMemberInfo', async () => {
    await expect(bot.getGroupMemberInfo(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(bot.getGroupMemberInfo(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')

    server.setResponse('get_group_member_info', userInfo)
    await expect(bot.getGroupMemberInfo(456, 123)).resolves.to.have.shape(userInfo)
    server.shouldHaveLastRequest('get_group_member_info', { groupId: '456', userId: '123' })
    await expect(bot.getGroupMemberInfo(456, 123, true)).resolves.to.have.shape(userInfo)
    server.shouldHaveLastRequest('get_group_member_info', { groupId: '456', userId: '123', noCache: 'true' })
  })

  test('getGroupMemberList', async () => {
    await expect(bot.getGroupMemberList(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')

    server.setResponse('get_group_member_list', [userInfo])
    await expect(bot.getGroupMemberList(456)).resolves.to.have.shape([userInfo])
    server.shouldHaveLastRequest('get_group_member_list', { groupId: '456' })
  })

  test('getGroupNotice', async () => {
    await expect(bot.getGroupNotice(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')

    server.setResponse('_get_group_notice', groupInfo)
    await expect(bot.getGroupNotice(456)).resolves.to.have.shape(groupInfo)
    server.shouldHaveLastRequest('_get_group_notice', { groupId: '456' })
  })

  test('sendGroupNotice', async () => {
    await expect(bot.sendGroupNotice(undefined, 'foo', 'bar')).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(bot.sendGroupNotice(456, undefined, 'bar')).rejects.toHaveProperty('message', 'missing argument: title')
    await expect(bot.sendGroupNotice(456, 'foo', undefined)).rejects.toHaveProperty('message', 'missing argument: content')
    await expect(bot.sendGroupNoticeAsync(undefined, 'foo', 'bar')).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(bot.sendGroupNoticeAsync(456, undefined, 'bar')).rejects.toHaveProperty('message', 'missing argument: title')
    await expect(bot.sendGroupNoticeAsync(456, 'foo', undefined)).rejects.toHaveProperty('message', 'missing argument: content')

    await expect(bot.sendGroupNotice(456, 'foo', 'bar')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('_send_group_notice', { groupId: '456', title: 'foo', content: 'bar' })
    await expect(bot.sendGroupNoticeAsync(456, 'foo', 'bar')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('_send_group_notice_async', { groupId: '456', title: 'foo', content: 'bar' })
  })

  const cookies = 'baz'
  const token = 'bar'

  test('getCookies', async () => {
    server.setResponse('get_cookies', { cookies })
    await expect(bot.getCookies()).resolves.to.equal(cookies)
    server.shouldHaveLastRequest('get_cookies', {})
    await expect(bot.getCookies('foo')).resolves.to.equal(cookies)
    server.shouldHaveLastRequest('get_cookies', { domain: 'foo' })
  })

  test('getCsrfToken', async () => {
    server.setResponse('get_csrf_token', { token })
    await expect(bot.getCsrfToken()).resolves.to.equal(token)
    server.shouldHaveLastRequest('get_csrf_token', {})
  })

  test('getCredentials', async () => {
    const credentials = { cookies, token }
    server.setResponse('get_credentials', credentials)
    await expect(bot.getCredentials()).resolves.to.have.shape(credentials)
    server.shouldHaveLastRequest('get_credentials', {})
  })

  const file = 'filename'

  test('getRecord', async () => {
    await expect(bot.getRecord(undefined, 'mp3')).rejects.toHaveProperty('message', 'missing argument: file')
    await expect(bot.getRecord('foo', undefined)).rejects.toHaveProperty('message', 'missing argument: outFormat')

    server.setResponse('get_record', { file })
    await expect(bot.getRecord('foo', 'mp3')).resolves.to.equal(file)
    server.shouldHaveLastRequest('get_record', { file: 'foo', outFormat: 'mp3' })
    await expect(bot.getRecord('foo', 'mp3', true)).resolves.to.equal(file)
    server.shouldHaveLastRequest('get_record', { file: 'foo', outFormat: 'mp3', fullPath: 'true' })
  })

  test('getImage', async () => {
    await expect(bot.getImage(undefined)).rejects.toHaveProperty('message', 'missing argument: file')

    server.setResponse('get_image', { file })
    await expect(bot.getImage('foo')).resolves.to.equal(file)
    server.shouldHaveLastRequest('get_image', { file: 'foo' })
  })

  test('canSendRecord', async () => {
    server.setResponse('can_send_record', { yes: true })
    await expect(bot.canSendRecord()).resolves.to.equal(true)
    server.shouldHaveLastRequest('can_send_record', {})
  })

  test('canSendImage', async () => {
    server.setResponse('can_send_image', { yes: true })
    await expect(bot.canSendImage()).resolves.to.equal(true)
    server.shouldHaveLastRequest('can_send_image', {})
  })

  test('getStatus', async () => {
    const status = { good: true }
    server.setResponse('get_status', status)
    await expect(bot.getStatus()).resolves.to.have.shape(status)
    server.shouldHaveLastRequest('get_status', {})
  })

  test('getVersionInfo', async () => {
    server.setResponse('get_version_info', { pluginVersion: '4.12.3' })
    await expect(bot.getVersionInfo()).resolves.to.have.shape({
      pluginVersion: '4.12.3',
      pluginMajorVersion: 4,
      pluginMinorVersion: 12,
      pluginPatchVersion: 3,
    })
    server.shouldHaveLastRequest('get_version_info', {})
  })

  test('getStatus', async () => {
    await expect(bot.setRestart()).resolves.toBeUndefined()
    server.shouldHaveLastRequest('_set_restart', { cleanLog: 'false', cleanCache: 'false', cleanEvent: 'false' })
    await expect(bot.setRestart(true, true, true)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('_set_restart', { cleanLog: 'true', cleanCache: 'true', cleanEvent: 'true' })
  })

  test('setRestartPlugin', async () => {
    await expect(bot.setRestartPlugin(10)).resolves.toBeUndefined()
    server.shouldHaveLastRequest('set_restart_plugin', { delay: '10' })
  })

  test('cleanDataDir', async () => {
    await expect(bot.cleanDataDir(undefined)).rejects.toHaveProperty('message', 'missing argument: dataDir')
    await expect(bot.cleanDataDir('foo' as any)).rejects.toHaveProperty('message', 'invalid argument: dataDir')
    await expect(bot.cleanDataDirAsync(undefined)).rejects.toHaveProperty('message', 'missing argument: dataDir')
    await expect(bot.cleanDataDirAsync('foo' as any)).rejects.toHaveProperty('message', 'invalid argument: dataDir')

    await expect(bot.cleanDataDir('image')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('clean_data_dir', { dataDir: 'image' })
    await expect(bot.cleanDataDirAsync('image')).resolves.toBeUndefined()
    server.shouldHaveLastRequest('clean_data_dir_async', { dataDir: 'image' })
  })

  test('cleanPluginLog', async () => {
    await expect(bot.cleanPluginLog()).resolves.toBeUndefined()
    server.shouldHaveLastRequest('clean_plugin_log', {})
    await expect(bot.cleanPluginLogAsync()).resolves.toBeUndefined()
    server.shouldHaveLastRequest('clean_plugin_log_async', {})
  })
})
