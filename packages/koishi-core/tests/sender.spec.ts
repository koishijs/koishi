import { createApp, createServer, expectReqResToBe } from 'koishi-test-utils'
import { Server } from 'http'

let server: Server
const app = createApp()

beforeAll(() => {
  server = createServer()
  return app.start()
})

afterAll(() => {
  server.close()
  return app.stop()
})

describe('Sender API', () => {
  const { sender } = app
  const response = { message_id: 456 }

  test('sendGroupMsg', async () => {
    await expect(sender.sendGroupMsg(undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.sendGroupMsgAsync(undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')

    await expectReqResToBe(() => sender.sendGroupMsg(123, 'foo'), response, 'send_group_msg', { group_id: '123', message: 'foo' }, 456)
    await expectReqResToBe(() => sender.sendGroupMsg(123, 'foo', true), response, 'send_group_msg', { group_id: '123', message: 'foo', auto_escape: 'true' }, 456)
    await expectReqResToBe(() => sender.sendGroupMsgAsync(123, 'foo'), {}, 'send_group_msg_async', { group_id: '123', message: 'foo' })
    await expectReqResToBe(() => sender.sendGroupMsgAsync(123, 'foo', true), {}, 'send_group_msg_async', { group_id: '123', message: 'foo', auto_escape: 'true' })
  })

  test('sendDiscussMsg', async () => {
    await expect(sender.sendDiscussMsg(undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: discussId')
    await expect(sender.sendDiscussMsgAsync(undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: discussId')

    await expectReqResToBe(() => sender.sendDiscussMsg(123, 'foo'), response, 'send_discuss_msg', { discuss_id: '123', message: 'foo' }, 456)
    await expectReqResToBe(() => sender.sendDiscussMsg(123, 'foo', true), response, 'send_discuss_msg', { discuss_id: '123', message: 'foo', auto_escape: 'true' }, 456)
    await expectReqResToBe(() => sender.sendDiscussMsgAsync(123, 'foo'), {}, 'send_discuss_msg_async', { discuss_id: '123', message: 'foo' })
    await expectReqResToBe(() => sender.sendDiscussMsgAsync(123, 'foo', true), {}, 'send_discuss_msg_async', { discuss_id: '123', message: 'foo', auto_escape: 'true' })
  })

  test('sendPrivateMsg', async () => {
    await expect(sender.sendPrivateMsg(undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(sender.sendPrivateMsgAsync(undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')

    await expectReqResToBe(() => sender.sendPrivateMsg(123, 'foo'), response, 'send_private_msg', { user_id: '123', message: 'foo' }, 456)
    await expectReqResToBe(() => sender.sendPrivateMsg(123, 'foo', true), response, 'send_private_msg', { user_id: '123', message: 'foo', auto_escape: 'true' }, 456)
    await expectReqResToBe(() => sender.sendPrivateMsgAsync(123, 'foo'), {}, 'send_private_msg_async', { user_id: '123', message: 'foo' })
    await expectReqResToBe(() => sender.sendPrivateMsgAsync(123, 'foo', true), {}, 'send_private_msg_async', { user_id: '123', message: 'foo', auto_escape: 'true' })
  })

  test('deleteMsg', async () => {
    await expect(sender.deleteMsg(undefined)).rejects.toHaveProperty('message', 'missing argument: messageId')
    await expect(sender.deleteMsgAsync(undefined)).rejects.toHaveProperty('message', 'missing argument: messageId')

    await expectReqResToBe(() => sender.deleteMsg(456), {}, 'delete_msg', { message_id: '456' })
    await expectReqResToBe(() => sender.deleteMsgAsync(456), {}, 'delete_msg_async', { message_id: '456' })
  })

  test('sendLike', async () => {
    await expect(sender.sendLike(undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(sender.sendLike(123, 0.1)).rejects.toHaveProperty('message', 'invalid argument: times')
    await expect(sender.sendLikeAsync(undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(sender.sendLikeAsync(123, 0.1)).rejects.toHaveProperty('message', 'invalid argument: times')

    await expectReqResToBe(() => sender.sendLike(123), {}, 'send_like', { user_id: '123', times: '1' })
    await expectReqResToBe(() => sender.sendLike(123, 5), {}, 'send_like', { user_id: '123', times: '5' })
    await expectReqResToBe(() => sender.sendLikeAsync(123), {}, 'send_like_async', { user_id: '123', times: '1' })
    await expectReqResToBe(() => sender.sendLikeAsync(123, 5), {}, 'send_like_async', { user_id: '123', times: '5' })
  })

  test('setGroupKick', async () => {
    await expect(sender.setGroupKick(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupKick(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(sender.setGroupKickAsync(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupKickAsync(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')

    await expectReqResToBe(() => sender.setGroupKick(456, 123), {}, 'set_group_kick', { user_id: '123', group_id: '456' })
    await expectReqResToBe(() => sender.setGroupKick(456, 123, true), {}, 'set_group_kick', { user_id: '123', group_id: '456', reject_add_request: 'true' })
    await expectReqResToBe(() => sender.setGroupKickAsync(456, 123), {}, 'set_group_kick_async', { user_id: '123', group_id: '456' })
    await expectReqResToBe(() => sender.setGroupKickAsync(456, 123, true), {}, 'set_group_kick_async', { user_id: '123', group_id: '456', reject_add_request: 'true' })
  })

  test('setGroupBan', async () => {
    await expect(sender.setGroupBan(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupBan(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(sender.setGroupBanAsync(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupBanAsync(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')

    await expectReqResToBe(() => sender.setGroupBan(456, 123), {}, 'set_group_ban', { user_id: '123', group_id: '456' })
    await expectReqResToBe(() => sender.setGroupBan(456, 123, 1000), {}, 'set_group_ban', { user_id: '123', group_id: '456', duration: '1000' })
    await expectReqResToBe(() => sender.setGroupBanAsync(456, 123), {}, 'set_group_ban_async', { user_id: '123', group_id: '456' })
    await expectReqResToBe(() => sender.setGroupBanAsync(456, 123, 1000), {}, 'set_group_ban_async', { user_id: '123', group_id: '456', duration: '1000' })
  })

  test('setGroupAnonymousBan', async () => {
    await expect(sender.setGroupAnonymousBan(undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupAnonymousBan(456, undefined)).rejects.toHaveProperty('message', 'missing argument: anonymous or flag')
    await expect(sender.setGroupAnonymousBanAsync(undefined, undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupAnonymousBanAsync(456, undefined)).rejects.toHaveProperty('message', 'missing argument: anonymous or flag')

    await expectReqResToBe(() => sender.setGroupAnonymousBan(456, 'foo'), {}, 'set_group_anonymous_ban', { flag: 'foo', group_id: '456' })
    await expectReqResToBe(() => sender.setGroupAnonymousBan(456, 'foo', 1000), {}, 'set_group_anonymous_ban', { flag: 'foo', group_id: '456', duration: '1000' })
    await expectReqResToBe(() => sender.setGroupAnonymousBanAsync(456, 'foo'), {}, 'set_group_anonymous_ban_async', { flag: 'foo', group_id: '456' })
    await expectReqResToBe(() => sender.setGroupAnonymousBanAsync(456, 'foo', 1000), {}, 'set_group_anonymous_ban_async', { flag: 'foo', group_id: '456', duration: '1000' })

    const anonymous = { flag: 'foo' }
    const serialized = JSON.stringify(anonymous)
    await expectReqResToBe(() => sender.setGroupAnonymousBan(456, anonymous), {}, 'set_group_anonymous_ban', { anonymous: serialized, group_id: '456' })
    await expectReqResToBe(() => sender.setGroupAnonymousBan(456, anonymous, 1000), {}, 'set_group_anonymous_ban', { anonymous: serialized, group_id: '456', duration: '1000' })
    await expectReqResToBe(() => sender.setGroupAnonymousBanAsync(456, anonymous), {}, 'set_group_anonymous_ban_async', { anonymous: serialized, group_id: '456' })
    await expectReqResToBe(() => sender.setGroupAnonymousBanAsync(456, anonymous, 1000), {}, 'set_group_anonymous_ban_async', { anonymous: serialized, group_id: '456', duration: '1000' })
  })

  test('setGroupWholeBan', async () => {
    await expect(sender.setGroupWholeBan(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupWholeBanAsync(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')

    await expectReqResToBe(() => sender.setGroupWholeBan(456), {}, 'set_group_whole_ban', { group_id: '456', enable: 'true' })
    await expectReqResToBe(() => sender.setGroupWholeBan(456, false), {}, 'set_group_whole_ban', { group_id: '456', enable: 'false' })
    await expectReqResToBe(() => sender.setGroupWholeBanAsync(456), {}, 'set_group_whole_ban_async', { group_id: '456', enable: 'true' })
    await expectReqResToBe(() => sender.setGroupWholeBanAsync(456, false), {}, 'set_group_whole_ban_async', { group_id: '456', enable: 'false' })
  })

  test('setGroupAdmin', async () => {
    await expect(sender.setGroupAdmin(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupAdmin(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(sender.setGroupAdminAsync(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupAdminAsync(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')

    await expectReqResToBe(() => sender.setGroupAdmin(456, 123), {}, 'set_group_admin', { user_id: '123', group_id: '456', enable: 'true' })
    await expectReqResToBe(() => sender.setGroupAdmin(456, 123, false), {}, 'set_group_admin', { user_id: '123', group_id: '456', enable: 'false' })
    await expectReqResToBe(() => sender.setGroupAdminAsync(456, 123), {}, 'set_group_admin_async', { user_id: '123', group_id: '456', enable: 'true' })
    await expectReqResToBe(() => sender.setGroupAdminAsync(456, 123, false), {}, 'set_group_admin_async', { user_id: '123', group_id: '456', enable: 'false' })
  })

  test('setGroupAnonymous', async () => {
    await expect(sender.setGroupAnonymous(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupAnonymousAsync(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')

    await expectReqResToBe(() => sender.setGroupAnonymous(456), {}, 'set_group_anonymous', { group_id: '456', enable: 'true' })
    await expectReqResToBe(() => sender.setGroupAnonymous(456, false), {}, 'set_group_anonymous', { group_id: '456', enable: 'false' })
    await expectReqResToBe(() => sender.setGroupAnonymousAsync(456), {}, 'set_group_anonymous_async', { group_id: '456', enable: 'true' })
    await expectReqResToBe(() => sender.setGroupAnonymousAsync(456, false), {}, 'set_group_anonymous_async', { group_id: '456', enable: 'false' })
  })
})
