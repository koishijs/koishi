import debug from 'debug'
import axios from 'axios'
import { snakeCase, camelCase, isInteger } from 'koishi-utils'
import { WsClient } from './server'
import { App } from './app'

import {
  GroupMemberInfo,
  StatusInfo,
  VersionInfo,
  Meta,
  FriendInfo,
  GroupInfo,
  Credentials,
  AccountInfo,
  StrangerInfo,
  ListedGroupInfo,
  VipInfo,
  GroupNoticeInfo,
  ContextType,
} from './meta'

const showSenderLog = debug('koishi:sender')

export class SenderError extends Error {
  readonly name = 'SenderError'

  constructor (readonly args: Record<string, any>, readonly url: string, readonly retcode: number) {
    super(`Error when trying to send to ${url}, args: ${JSON.stringify(args)}, retcode: ${retcode}`)
  }
}

export type RecordFormat = 'mp3' | 'amr' | 'wma' | 'm4a' | 'spx' | 'ogg' | 'wav' | 'flac'
export type DataDirectoryType = 'image' | 'record' | 'show' | 'bface'

export interface CQResponse {
  status: string
  retcode: number
  data: any
  echo?: number
}

interface MessageResponse {
  messageId: number
}

export class Sender {
  private _get: (api: string, args?: object) => Promise<CQResponse>

  constructor (public app: App) {
    const { type } = app.options
    if (type === 'http') {
      const headers = {} as any
      if (app.options.token) {
        headers.Authorization = `Token ${app.options.token}`
      }
      this._get = async (action, params = {}) => {
        const uri = new URL(action, this.app.options.server).href
        const { data } = await axios.get(uri, { params, headers })
        return data
      }
    } else if (type === 'ws') {
      const server = app.server as WsClient
      this._get = (action, params = {}) => server.send({ action, params })
    }
  }

  async get <T = any> (action: string, params?: object, silent = false): Promise<T> {
    showSenderLog('request %s %o', action, params)
    const response = await this._get(action, snakeCase(params))
    showSenderLog('response %o', response)
    const { data, retcode } = response
    if (retcode === 0 && !silent) {
      return camelCase(data)
    } else if (retcode < 0 && !silent) {
      throw new SenderError(params, action, retcode)
    } else if (retcode > 1) {
      throw new SenderError(params, action, retcode)
    }
  }

  private getAsync (action: string, params?: object): Promise<void> {
    return this.app.server.versionLessThan(4)
      ? this.get(action, params, true)
      : this.get(action + '_async', params)
  }

  private async _dispatchSendMeta (type: ContextType, subId: number, message: string, messageId?: number) {
    const meta: Meta<'send'> = {
      postType: 'send',
      sendType: type === 'user' ? 'private' : type as any,
      messageId,
      message,
    }
    meta[type + 'Id'] = subId
    await this.app.dispatchMeta(meta)
  }

  private _assertInteger (name: string, value: any) {
    if (!isInteger(value)) throw new Error('missing or invalid argument: ' + name)
  }

  private _assertElement (name: string, value: any, array: any[]) {
    if (!array.includes(value)) throw new Error('missing or invalid argument: ' + name)
  }

  private _assertVersion (label: string, major: number, minor: number = 0, patch: number = 0) {
    if (this.app.server.versionLessThan(major, minor, patch)) {
      throw new Error(`${label} requires CQHTTP version >= ${major}.${minor}`)
    }
  }

  async sendGroupMsg (groupId: number, message: string, autoEscape?: boolean) {
    this._assertInteger('groupId', groupId)
    if (!message) return
    const { messageId } = await this.get<MessageResponse>('send_group_msg', { groupId, message, autoEscape })
    await this._dispatchSendMeta('group', groupId, message, messageId)
    return messageId
  }

  async sendGroupMsgAsync (groupId: number, message: string, autoEscape?: boolean) {
    this._assertInteger('groupId', groupId)
    if (!message) return
    await this.get('send_group_msg_async', { groupId, message, autoEscape })
    return this._dispatchSendMeta('group', groupId, message)
  }

  async sendDiscussMsg (discussId: number, message: string, autoEscape?: boolean) {
    this._assertInteger('discussId', discussId)
    if (!message) return
    const { messageId } = await this.get<MessageResponse>('send_discuss_msg', { discussId, message, autoEscape })
    await this._dispatchSendMeta('discuss', discussId, message, messageId)
    return messageId
  }

  async sendDiscussMsgAsync (discussId: number, message: string, autoEscape?: boolean) {
    this._assertInteger('discussId', discussId)
    if (!message) return
    await this.get('send_discuss_msg_async', { discussId, message, autoEscape })
    return this._dispatchSendMeta('discuss', discussId, message)
  }

  async sendPrivateMsg (userId: number, message: string, autoEscape?: boolean) {
    this._assertInteger('userId', userId)
    if (!message) return
    const { messageId } = await this.get<MessageResponse>('send_private_msg', { userId, message, autoEscape })
    await this._dispatchSendMeta('user', userId, message, messageId)
    return messageId
  }

  async sendPrivateMsgAsync (userId: number, message: string, autoEscape?: boolean) {
    this._assertInteger('userId', userId)
    if (!message) return
    await this.get('send_private_msg_async', { userId, message, autoEscape })
    return this._dispatchSendMeta('user', userId, message)
  }

  async deleteMsg (messageId: number) {
    this._assertInteger('messageId', messageId)
    this._assertVersion('sender.deleteMsg()', 3, 3)
    return this.get<void>('delete_msg', { messageId })
  }

  async deleteMsgAsync (messageId: number) {
    this._assertInteger('messageId', messageId)
    this._assertVersion('sender.deleteMsgAsync()', 3, 3)
    return this.getAsync('delete_msg', { messageId })
  }

  async sendLike (userId: number, times = 1) {
    this._assertInteger('userId', userId)
    this._assertInteger('times', times)
    await this.get('send_like', { userId, times })
  }

  async sendLikeAsync (userId: number, times = 1) {
    this._assertInteger('userId', userId)
    this._assertInteger('times', times)
    return this.getAsync('send_like', { userId, times })
  }

  async setGroupKick (groupId: number, userId: number, rejectAddRequest = false) {
    this._assertInteger('groupId', groupId)
    this._assertInteger('userId', userId)
    await this.get('set_group_kick', { groupId, userId, rejectAddRequest })
  }

  async setGroupKickAsync (groupId: number, userId: number, rejectAddRequest = false) {
    this._assertInteger('groupId', groupId)
    this._assertInteger('userId', userId)
    return this.getAsync('set_group_kick', { groupId, userId, rejectAddRequest })
  }

  async setGroupBan (groupId: number, userId: number, duration = 30 * 60) {
    this._assertInteger('groupId', groupId)
    this._assertInteger('userId', userId)
    await this.get('set_group_ban', { groupId, userId, duration })
  }

  async setGroupBanAsync (groupId: number, userId: number, duration = 30 * 60) {
    this._assertInteger('groupId', groupId)
    this._assertInteger('userId', userId)
    return this.getAsync('set_group_ban', { groupId, userId, duration })
  }

  setGroupAnonymousBan (groupId: number, anonymous: object, duration?: number): Promise<void>
  setGroupAnonymousBan (groupId: number, flag: string, duration?: number): Promise<void>
  async setGroupAnonymousBan (groupId: number, meta: object | string, duration = 30 * 60) {
    this._assertInteger('groupId', groupId)
    if (!meta) throw new Error('missing argument: anonymous or flag')
    const args = { groupId, duration } as any
    args[typeof meta === 'string' ? 'flag' : 'anomymous'] = meta
    await this.get('set_group_anonymous_ban', args)
  }

  setGroupAnonymousBanAsync (groupId: number, anonymous: object, duration?: number): Promise<void>
  setGroupAnonymousBanAsync (groupId: number, flag: string, duration?: number): Promise<void>
  async setGroupAnonymousBanAsync (groupId: number, meta: object | string, duration = 30 * 60) {
    this._assertInteger('groupId', groupId)
    if (!meta) throw new Error('missing argument: anonymous or flag')
    const args = { groupId, duration } as any
    args[typeof meta === 'string' ? 'flag' : 'anomymous'] = meta
    return this.getAsync('set_group_anonymous_ban', args)
  }

  async setGroupWholeBan (groupId: number, enable = true) {
    this._assertInteger('groupId', groupId)
    await this.get('set_group_whole_ban', { groupId, enable })
  }

  async setGroupWholeBanAsync (groupId: number, enable = true) {
    this._assertInteger('groupId', groupId)
    return this.getAsync('set_group_whole_ban', { groupId, enable })
  }

  async setGroupAdmin (groupId: number, userId: number, enable: boolean) {
    this._assertInteger('groupId', groupId)
    this._assertInteger('userId', userId)
    await this.get('set_group_admin', { groupId, userId, enable })
  }

  async setGroupAdminAsync (groupId: number, userId: number, enable: boolean) {
    this._assertInteger('groupId', groupId)
    this._assertInteger('userId', userId)
    return this.getAsync('set_group_admin', { groupId, userId, enable })
  }

  async setGroupAnonymous (groupId: number, enable: boolean) {
    this._assertInteger('groupId', groupId)
    await this.get('set_group_anonymous', { groupId, enable })
  }

  async setGroupAnonymousAsync (groupId: number, enable: boolean) {
    this._assertInteger('groupId', groupId)
    return this.getAsync('set_group_anonymous', { groupId, enable })
  }

  async setGroupCard (groupId: number, userId: number, card = '') {
    this._assertInteger('groupId', groupId)
    this._assertInteger('userId', userId)
    await this.get('set_group_admin', { groupId, userId, card })
  }

  async setGroupCardAsync (groupId: number, userId: number, card = '') {
    this._assertInteger('groupId', groupId)
    this._assertInteger('userId', userId)
    return this.getAsync('set_group_admin', { groupId, userId, card })
  }

  async setGroupLeave (groupId: number, isDismiss = false) {
    this._assertInteger('groupId', groupId)
    await this.get('set_group_leave', { groupId, isDismiss })
  }

  async setGroupLeaveAsync (groupId: number, isDismiss = false) {
    this._assertInteger('groupId', groupId)
    return this.getAsync('set_group_leave', { groupId, isDismiss })
  }

  async setGroupSpecialTitle (groupId: number, userId: number, specialTitle = '', duration = -1) {
    this._assertInteger('groupId', groupId)
    this._assertInteger('userId', userId)
    await this.get('set_group_special_title', { groupId, userId, specialTitle, duration })
  }

  async setGroupSpecialTitleAsync (groupId: number, userId: number, specialTitle = '', duration = -1) {
    this._assertInteger('groupId', groupId)
    this._assertInteger('userId', userId)
    return this.getAsync('set_group_special_title', { groupId, userId, specialTitle, duration })
  }

  async setDiscussLeave (discussId: number) {
    this._assertInteger('discussId', discussId)
    await this.get('set_discuss_leave', { discussId })
  }

  async setDiscussLeaveAsync (discussId: number) {
    this._assertInteger('discussId', discussId)
    return this.getAsync('set_discuss_leave', { discussId })
  }

  async setFriendAddRequest (flag: string, approve = true, remark = '') {
    if (!flag) throw new Error('missing argument: flag')
    await this.get('set_friend_add_request', { flag, approve, remark })
  }

  async setFriendAddRequestAsync (flag: string, approve = true, remark = '') {
    if (!flag) throw new Error('missing argument: flag')
    return this.getAsync('set_friend_add_request', { flag, approve, remark })
  }

  async setGroupAddRequest (flag: string, subType: 'add' | 'invite', approve = true, reason = '') {
    if (!flag) throw new Error('missing argument: flag')
    this._assertElement('subType', subType, ['add', 'invite'])
    await this.get('set_group_add_request', { flag, subType, approve, reason })
  }

  async setGroupAddRequestAsync (flag: string, subType: 'add' | 'invite', approve = true, reason = '') {
    if (!flag) throw new Error('missing argument: flag')
    this._assertElement('subType', subType, ['add', 'invite'])
    return this.getAsync('set_group_add_request', { flag, subType, approve, reason })
  }

  getLoginInfo (): Promise<AccountInfo> {
    return this.get('get_login_info')
  }

  getVipInfo (): Promise<VipInfo> {
    this._assertVersion('sender.getVipInfo()', 4, 3, 1)
    return this.get('_get_vip_info')
  }

  getStrangerInfo (userId: number, noCache = false): Promise<StrangerInfo> {
    this._assertInteger('userId', userId)
    return this.get('get_stranger_info', { userId, noCache })
  }

  getFriendList (): Promise<FriendInfo[]> {
    this._assertVersion('sender.getFriendList()', 4, 12)
    return this.get('get_friend_list')
  }

  getGroupList (): Promise<ListedGroupInfo[]> {
    return this.get('get_group_list')
  }

  getGroupInfo (groupId: string, noCache = false): Promise<GroupInfo> {
    this._assertInteger('groupId', groupId)
    this._assertVersion('sender.getGroupInfo()', 4, 0, 1)
    return this.app.server.versionLessThan(4, 12)
      ? this.get('_get_group_info', { groupId, noCache })
      : this.get('get_group_info', { groupId, noCache })
  }

  getGroupMemberInfo (groupId: number, userId: number, noCache = false): Promise<GroupMemberInfo> {
    this._assertInteger('groupId', groupId)
    this._assertInteger('userId', userId)
    return this.get('get_group_member_info', { groupId, userId, noCache })
  }

  getGroupMemberList (groupId: number): Promise<GroupMemberInfo[]> {
    this._assertInteger('groupId', groupId)
    return this.get('get_group_member_list', { groupId })
  }

  getGroupNotice (groupId: number): Promise<GroupNoticeInfo[]> {
    this._assertInteger('groupId', groupId)
    this._assertVersion('sender.getGroupNotice()', 4, 9)
    return this.get('_get_group_notice', { groupId })
  }

  async sendGroupNotice (groupId: number, title: string, content: string) {
    this._assertInteger('groupId', groupId)
    this._assertVersion('sender.sendGroupNotice()', 4, 9)
    await this.get('_send_group_notice', { groupId, title, content })
  }

  async sendGroupNoticeAsync (groupId: number, title: string, content: string) {
    this._assertInteger('groupId', groupId)
    this._assertVersion('sender.sendGroupNotice()', 4, 9)
    return this.getAsync('_send_group_notice', { groupId, title, content })
  }

  async getCookies (domain?: string): Promise<string> {
    const { cookies } = await this.get('get_cookies', { domain })
    return cookies
  }

  async getCsrfToken (): Promise<number> {
    const { token } = await this.get('get_csrf_token')
    return token
  }

  getCredentials (): Promise<Credentials> {
    return this.get('get_credentials')
  }

  async getRecord (file: string, outFormat: RecordFormat, fullPath = false) {
    this._assertVersion('sender.getRecord()', 3, 3)
    const response = await this.get('get_record', { file, outFormat, fullPath })
    return response.file as string
  }

  async getImage (file: string) {
    this._assertVersion('sender.getImage()', 4, 8)
    const response = await this.get('get_image', { file })
    return response.file as string
  }

  async canSendImage () {
    this._assertVersion('sender.canSendImage()', 4, 8)
    const { yes } = await this.get('can_send_image')
    return yes as boolean
  }

  async canSendRecord () {
    this._assertVersion('sender.canSendRecord()', 4, 8)
    const { yes } = await this.get('can_send_record')
    return yes as boolean
  }

  getStatus () {
    return this.get<StatusInfo>('get_status')
  }

  async getVersionInfo () {
    const data = await this.get<VersionInfo>('get_version_info')
    const match = /^(\d+)\.(\d+)\.(\d+)/.exec(data.pluginVersion)
    if (match) {
      const [, major, minor, patch] = match
      data.pluginMajorVersion = +major
      data.pluginMinorVersion = +minor
      data.pluginPatchVersion = +patch
    }
    return data
  }

  async setRestart (cleanLog = false, cleanCache = false, cleanEvent = false) {
    this._assertVersion('sender.setRestart()', 3, 0, 2)
    await this.get('_set_restart', { cleanLog, cleanCache, cleanEvent })
  }

  async setRestartPlugin (delay = 0) {
    this._assertVersion('sender.setRestartPlugin()', 3, 2)
    await this.get('set_restart_plugin', { delay })
  }

  async cleanDataDir (dataDir: DataDirectoryType) {
    this._assertElement('dataDir', dataDir, ['bface', 'image', 'record', 'show'])
    this._assertVersion('sender.cleanDataDir()', 3, 3, 4)
    await this.get('clean_data_dir', { dataDir })
  }

  async cleanDataDirAsync (dataDir: DataDirectoryType) {
    this._assertElement('dataDir', dataDir, ['bface', 'image', 'record', 'show'])
    this._assertVersion('sender.cleanDataDirAsync()', 3, 3, 4)
    return this.getAsync('clean_data_dir', { dataDir })
  }

  async cleanPluginLog () {
    this._assertVersion('sender.cleanPluginLog()', 4, 1)
    await this.get('clean_plugin_log')
  }

  async cleanPluginLogAsync () {
    this._assertVersion('sender.cleanPluginLogAsync()', 4, 1)
    await this.get('clean_plugin_log_async')
  }
}
