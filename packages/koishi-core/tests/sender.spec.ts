import { createApp, createServer, expectReqResToBe } from 'koishi-test-utils/src/http-server'
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

  test('setGroupCard', async () => {
    await expect(sender.setGroupCard(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupCard(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(sender.setGroupCardAsync(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupCardAsync(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')

    await expectReqResToBe(() => sender.setGroupCard(456, 123), {}, 'set_group_card', { user_id: '123', group_id: '456', card: '' })
    await expectReqResToBe(() => sender.setGroupCard(456, 123, 'foo'), {}, 'set_group_card', { user_id: '123', group_id: '456', card: 'foo' })
    await expectReqResToBe(() => sender.setGroupCardAsync(456, 123), {}, 'set_group_card_async', { user_id: '123', group_id: '456', card: '' })
    await expectReqResToBe(() => sender.setGroupCardAsync(456, 123, 'foo'), {}, 'set_group_card_async', { user_id: '123', group_id: '456', card: 'foo' })
  })

  test('setGroupSpecialTitle', async () => {
    await expect(sender.setGroupSpecialTitle(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupSpecialTitle(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')
    await expect(sender.setGroupSpecialTitleAsync(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupSpecialTitleAsync(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')

    await expectReqResToBe(() => sender.setGroupSpecialTitle(456, 123), {}, 'set_group_special_title', { user_id: '123', group_id: '456', special_title: '' })
    await expectReqResToBe(() => sender.setGroupSpecialTitle(456, 123, 'foo'), {}, 'set_group_special_title', { user_id: '123', group_id: '456', special_title: 'foo' })
    await expectReqResToBe(() => sender.setGroupSpecialTitleAsync(456, 123), {}, 'set_group_special_title_async', { user_id: '123', group_id: '456', special_title: '' })
    await expectReqResToBe(() => sender.setGroupSpecialTitleAsync(456, 123, 'foo'), {}, 'set_group_special_title_async', { user_id: '123', group_id: '456', special_title: 'foo' })
  })

  test('setGroupLeave', async () => {
    await expect(sender.setGroupLeave(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.setGroupLeaveAsync(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')

    await expectReqResToBe(() => sender.setGroupLeave(456), {}, 'set_group_leave', { group_id: '456' })
    await expectReqResToBe(() => sender.setGroupLeave(456, true), {}, 'set_group_leave', { group_id: '456', is_dismiss: 'true' })
    await expectReqResToBe(() => sender.setGroupLeaveAsync(456), {}, 'set_group_leave_async', { group_id: '456' })
    await expectReqResToBe(() => sender.setGroupLeaveAsync(456, true), {}, 'set_group_leave_async', { group_id: '456', is_dismiss: 'true' })
  })

  test('setDiscussLeave', async () => {
    await expect(sender.setDiscussLeave(undefined)).rejects.toHaveProperty('message', 'missing argument: discussId')
    await expect(sender.setDiscussLeaveAsync(undefined)).rejects.toHaveProperty('message', 'missing argument: discussId')

    await expectReqResToBe(() => sender.setDiscussLeave(456), {}, 'set_discuss_leave', { discuss_id: '456' })
    await expectReqResToBe(() => sender.setDiscussLeaveAsync(456), {}, 'set_discuss_leave_async', { discuss_id: '456' })
  })

  test('setFriendAddRequest', async () => {
    await expect(sender.setFriendAddRequest(undefined)).rejects.toHaveProperty('message', 'missing argument: flag')
    await expect(sender.setFriendAddRequestAsync(undefined)).rejects.toHaveProperty('message', 'missing argument: flag')

    await expectReqResToBe(() => sender.setFriendAddRequest('foo'), {}, 'set_friend_add_request', { flag: 'foo', approve: 'true' })
    await expectReqResToBe(() => sender.setFriendAddRequest('foo', false), {}, 'set_friend_add_request', { flag: 'foo', approve: 'false' })
    await expectReqResToBe(() => sender.setFriendAddRequest('foo', 'bar'), {}, 'set_friend_add_request', { flag: 'foo', approve: 'true', remark: 'bar' })
    await expectReqResToBe(() => sender.setFriendAddRequestAsync('foo'), {}, 'set_friend_add_request_async', { flag: 'foo', approve: 'true' })
    await expectReqResToBe(() => sender.setFriendAddRequestAsync('foo', false), {}, 'set_friend_add_request_async', { flag: 'foo', approve: 'false' })
    await expectReqResToBe(() => sender.setFriendAddRequestAsync('foo', 'bar'), {}, 'set_friend_add_request_async', { flag: 'foo', approve: 'true', remark: 'bar' })
  })

  test('setGroupAddRequest', async () => {
    await expect(sender.setGroupAddRequest(undefined, 'add')).rejects.toHaveProperty('message', 'missing argument: flag')
    await expect(sender.setGroupAddRequest('foo', undefined)).rejects.toHaveProperty('message', 'missing argument: subType')
    await expect(sender.setGroupAddRequest('foo', 'bar' as any)).rejects.toHaveProperty('message', 'invalid argument: subType')
    await expect(sender.setGroupAddRequestAsync(undefined, 'add')).rejects.toHaveProperty('message', 'missing argument: flag')
    await expect(sender.setGroupAddRequestAsync('foo', undefined)).rejects.toHaveProperty('message', 'missing argument: subType')
    await expect(sender.setGroupAddRequestAsync('foo', 'bar' as any)).rejects.toHaveProperty('message', 'invalid argument: subType')

    await expectReqResToBe(() => sender.setGroupAddRequest('foo', 'add'), {}, 'set_group_add_request', { flag: 'foo', sub_type: 'add', approve: 'true' })
    await expectReqResToBe(() => sender.setGroupAddRequest('foo', 'add', false), {}, 'set_group_add_request', { flag: 'foo', sub_type: 'add', approve: 'false' })
    await expectReqResToBe(() => sender.setGroupAddRequest('foo', 'add', 'bar'), {}, 'set_group_add_request', { flag: 'foo', sub_type: 'add', approve: 'false', reason: 'bar' })
    await expectReqResToBe(() => sender.setGroupAddRequestAsync('foo', 'add'), {}, 'set_group_add_request_async', { flag: 'foo', sub_type: 'add', approve: 'true' })
    await expectReqResToBe(() => sender.setGroupAddRequestAsync('foo', 'add', false), {}, 'set_group_add_request_async', { flag: 'foo', sub_type: 'add', approve: 'false' })
    await expectReqResToBe(() => sender.setGroupAddRequestAsync('foo', 'add', 'bar'), {}, 'set_group_add_request_async', { flag: 'foo', sub_type: 'add', approve: 'false', reason: 'bar' })
  })

  const user_info = { user_id: 321 }
  const userInfo = { userId: 321 }
  const group_info = { group_id: 654 }
  const groupInfo = { groupId: 654 }

  test('getLoginInfo', async () => {
    await expectReqResToBe(() => sender.getLoginInfo(), user_info, 'get_login_info', {}, userInfo)
  })

  test('getVipInfo', async () => {
    await expectReqResToBe(() => sender.getVipInfo(), user_info, '_get_vip_info', {}, userInfo)
  })

  test('getStrangerInfo', async () => {
    await expect(sender.getStrangerInfo(undefined)).rejects.toHaveProperty('message', 'missing argument: userId')

    await expectReqResToBe(() => sender.getStrangerInfo(123), user_info, 'get_stranger_info', { user_id: '123' }, userInfo)
    await expectReqResToBe(() => sender.getStrangerInfo(123, true), user_info, 'get_stranger_info', { user_id: '123', no_cache: 'true' }, userInfo)
  })

  test('getFriendList', async () => {
    await expectReqResToBe(() => sender.getFriendList(), [user_info], 'get_friend_list', {}, [userInfo])
  })

  test('getGroupInfo', async () => {
    await expect(sender.getGroupInfo(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')

    await expectReqResToBe(() => sender.getGroupInfo(456), group_info, 'get_group_info', { group_id: '456' }, groupInfo)
    await expectReqResToBe(() => sender.getGroupInfo(456, true), group_info, 'get_group_info', { group_id: '456', no_cache: 'true' }, groupInfo)
  })

  test('getGroupList', async () => {
    await expectReqResToBe(() => sender.getGroupList(), [group_info], 'get_group_list', {}, [groupInfo])
  })

  test('getGroupMemberInfo', async () => {
    await expect(sender.getGroupMemberInfo(undefined, 123)).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.getGroupMemberInfo(456, undefined)).rejects.toHaveProperty('message', 'missing argument: userId')

    await expectReqResToBe(() => sender.getGroupMemberInfo(456, 123), user_info, 'get_group_member_info', { group_id: '456', user_id: '123' }, userInfo)
    await expectReqResToBe(() => sender.getGroupMemberInfo(456, 123, true), user_info, 'get_group_member_info', { group_id: '456', user_id: '123', no_cache: 'true' }, userInfo)
  })

  test('getGroupMemberList', async () => {
    await expect(sender.getGroupMemberList(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')

    await expectReqResToBe(() => sender.getGroupMemberList(456), [user_info], 'get_group_member_list', { group_id: '456' }, [userInfo])
  })

  test('getGroupNotice', async () => {
    await expect(sender.getGroupNotice(undefined)).rejects.toHaveProperty('message', 'missing argument: groupId')

    await expectReqResToBe(() => sender.getGroupNotice(456), group_info, '_get_group_notice', { group_id: '456' }, groupInfo)
  })

  test('sendGroupNotice', async () => {
    await expect(sender.sendGroupNotice(undefined, 'foo', 'bar')).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.sendGroupNotice(456, undefined, 'bar')).rejects.toHaveProperty('message', 'missing argument: title')
    await expect(sender.sendGroupNotice(456, 'foo', undefined)).rejects.toHaveProperty('message', 'missing argument: content')
    await expect(sender.sendGroupNoticeAsync(undefined, 'foo', 'bar')).rejects.toHaveProperty('message', 'missing argument: groupId')
    await expect(sender.sendGroupNoticeAsync(456, undefined, 'bar')).rejects.toHaveProperty('message', 'missing argument: title')
    await expect(sender.sendGroupNoticeAsync(456, 'foo', undefined)).rejects.toHaveProperty('message', 'missing argument: content')

    await expectReqResToBe(() => sender.sendGroupNotice(456, 'foo', 'bar'), {}, '_send_group_notice', { group_id: '456', title: 'foo', content: 'bar' })
    await expectReqResToBe(() => sender.sendGroupNoticeAsync(456, 'foo', 'bar'), {}, '_send_group_notice_async', { group_id: '456', title: 'foo', content: 'bar' })
  })

  test('getCookies', async () => {
    await expectReqResToBe(() => sender.getCookies(), { cookies: 'baz' }, 'get_cookies', {}, 'baz')
    await expectReqResToBe(() => sender.getCookies('foo'), { cookies: 'baz' }, 'get_cookies', { domain: 'foo' }, 'baz')
  })

  test('getCsrfToken', async () => {
    await expectReqResToBe(() => sender.getCsrfToken(), { token: 'baz' }, 'get_csrf_token', {}, 'baz')
  })

  test('getCredentials', async () => {
    const credentials = { cookies: 'baz', token: 'bar' }
    await expectReqResToBe(() => sender.getCredentials(), credentials, 'get_credentials', {}, credentials)
  })

  test('getRecord', async () => {
    await expect(sender.getRecord(undefined, 'mp3')).rejects.toHaveProperty('message', 'missing argument: file')
    await expect(sender.getRecord('foo', undefined)).rejects.toHaveProperty('message', 'missing argument: outFormat')

    await expectReqResToBe(() => sender.getRecord('foo', 'mp3'), { file: 'bar' }, 'get_record', { file: 'foo', out_format: 'mp3' }, 'bar')
    await expectReqResToBe(() => sender.getRecord('foo', 'mp3', true), { file: 'bar' }, 'get_record', { file: 'foo', out_format: 'mp3', full_path: 'true' }, 'bar')
  })

  test('getImage', async () => {
    await expect(sender.getImage(undefined)).rejects.toHaveProperty('message', 'missing argument: file')

    await expectReqResToBe(() => sender.getImage('foo'), { file: 'bar' }, 'get_image', { file: 'foo' }, 'bar')
  })

  test('canSendRecord', async () => {
    await expectReqResToBe(() => sender.canSendRecord(), { yes: true }, 'can_send_record', {}, true)
  })

  test('canSendImage', async () => {
    await expectReqResToBe(() => sender.canSendImage(), { yes: true }, 'can_send_image', {}, true)
  })

  test('getStatus', async () => {
    const status = { good: true }
    await expectReqResToBe(() => sender.getStatus(), status, 'get_status', {}, status)
  })

  test('getVersionInfo', async () => {
    await expectReqResToBe(() => sender.getVersionInfo(), { plugin_version: '4.12.3' }, 'get_version_info', {}, {
      pluginVersion: '4.12.3',
      pluginMajorVersion: 4,
      pluginMinorVersion: 12,
      pluginPatchVersion: 3,
    })
  })

  test('getStatus', async () => {
    await expectReqResToBe(() => sender.setRestart(true, false, false), {}, '_set_restart', { clean_log: 'true', clean_cache: 'false', clean_event: 'false' })
    await expectReqResToBe(() => sender.setRestart(false, true, false), {}, '_set_restart', { clean_log: 'false', clean_cache: 'true', clean_event: 'false' })
    await expectReqResToBe(() => sender.setRestart(false, false, true), {}, '_set_restart', { clean_log: 'false', clean_cache: 'false', clean_event: 'true' })
  })

  test('setRestartPlugin', async () => {
    await expectReqResToBe(() => sender.setRestartPlugin(10), {}, 'set_restart_plugin', { delay: '10' })
  })

  test('cleanDataDir', async () => {
    await expect(sender.cleanDataDir(undefined)).rejects.toHaveProperty('message', 'missing argument: dataDir')
    await expect(sender.cleanDataDir('foo' as any)).rejects.toHaveProperty('message', 'invalid argument: dataDir')
    await expect(sender.cleanDataDirAsync(undefined)).rejects.toHaveProperty('message', 'missing argument: dataDir')
    await expect(sender.cleanDataDirAsync('foo' as any)).rejects.toHaveProperty('message', 'invalid argument: dataDir')

    await expectReqResToBe(() => sender.cleanDataDir('image'), {}, 'clean_data_dir', { data_dir: 'image' })
    await expectReqResToBe(() => sender.cleanDataDirAsync('image'), {}, 'clean_data_dir_async', { data_dir: 'image' })
  })

  test('cleanPluginLog', async () => {
    await expectReqResToBe(() => sender.cleanPluginLog(), {}, 'clean_plugin_log', {})
    await expectReqResToBe(() => sender.cleanPluginLogAsync(), {}, 'clean_plugin_log_async', {})
  })
})
