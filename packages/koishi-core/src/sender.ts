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
  protected _get: (action: string, params?: Record<string, any>) => Promise<CQResponse>

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

  async get <T = any> (action: string, params?: Record<string, any>, silent = false): Promise<T> {
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

  async getAsync (action: string, params?: Record<string, any>): Promise<void> {
    if (this.app.server.versionLessThan(4)) {
      await this.get(action, params, true)
    } else {
      await this.get(action + '_async', params)
    }
  }

  private _assertInteger (name: string, value: any) {
    if (value === undefined) throw new Error('missing argument: ' + name)
    if (!isInteger(value)) throw new Error('invalid argument: ' + name)
  }

  private _assertElement (name: string, value: any, array: any[]) {
    if (value === undefined) throw new Error('missing argument: ' + name)
    if (!array.includes(value)) throw new Error('invalid argument: ' + name)
  }

  private _assertVersion (label: string, major: number, minor: number = 0, patch: number = 0) {
    if (this.app.server.versionLessThan(major, minor, patch)) {
      throw new Error(`${label} requires CQHTTP version >= ${major}.${minor}`)
    }
  }

  _createSendMeta ($ctxType: ContextType, $ctxId: number, message: string) {
    const sendType = $ctxType === 'user' ? 'private' : $ctxType as any
    return {
      $ctxId,
      $ctxType,
      message,
      sendType,
      postType: 'send',
      [$ctxType + 'Id']: $ctxId,
    } as Meta<'send'>
  }

  async sendGroupMsg (groupId: number, message: string, autoEscape?: boolean) {
    this._assertInteger('groupId', groupId)
    if (!message) return
    const meta = this._createSendMeta('group', groupId, message)
    this.app.emitEvent(meta, 'before-send', meta)
    const { messageId } = await this.get<MessageResponse>('send_group_msg', { groupId, message, autoEscape })
    meta.messageId = messageId
    this.app.emitEvent(meta, 'send', meta)
    return messageId
  }

  async sendGroupMsgAsync (groupId: number, message: string, autoEscape?: boolean) {
    this._assertInteger('groupId', groupId)
    if (!message) return
    await this.get('send_group_msg_async', { groupId, message, autoEscape })
  }

  async sendDiscussMsg (discussId: number, message: string, autoEscape?: boolean) {
    this._assertInteger('discussId', discussId)
    if (!message) return
    const meta = this._createSendMeta('discuss', discussId, message)
    this.app.emitEvent(meta, 'before-send', meta)
    const { messageId } = await this.get<MessageResponse>('send_discuss_msg', { discussId, message, autoEscape })
    meta.messageId = messageId
    this.app.emitEvent(meta, 'send', meta)
    return messageId
  }

  async sendDiscussMsgAsync (discussId: number, message: string, autoEscape?: boolean) {
    this._assertInteger('discussId', discussId)
    if (!message) return
    await this.get('send_discuss_msg_async', { discussId, message, autoEscape })
  }

  async sendPrivateMsg (userId: number, message: string, autoEscape?: boolean) {
    this._assertInteger('userId', userId)
    if (!message) return
    const meta = this._createSendMeta('user', userId, message)
    this.app.emitEvent(meta, 'before-send', meta)
    const { messageId } = await this.get<MessageResponse>('send_private_msg', { userId, message, autoEscape })
    meta.messageId = messageId
    this.app.emitEvent(meta, 'send', meta)
    return messageId
  }

  async sendPrivateMsgAsync (userId: number, message: string, autoEscape?: boolean) {
    this._assertInteger('userId', userId)
    if (!message) return
    await this.get('send_private_msg_async', { userId, message, autoEscape })
  }

  async deleteMsg (messageId: number) {
    this._assertInteger('messageId', messageId)
    this._assertVersion('sender.deleteMsg()', 3, 3)
    await this.get('delete_msg', { messageId })
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

  async setGroupKick (groupId: number, userId: number, rejectAddRequest?: boolean) {
    this._assertInteger('groupId', groupId)
    this._assertInteger('userId', userId)
    await this.get('set_group_kick', { groupId, userId, rejectAddRequest })
  }

  async setGroupKickAsync (groupId: number, userId: number, rejectAddRequest?: boolean) {
    this._assertInteger('groupId', groupId)
    this._assertInteger('userId', userId)
    return this.getAsync('set_group_kick', { groupId, userId, rejectAddRequest })
  }

  async setGroupBan (groupId: number, userId: number, duration?: number) {
    this._assertInteger('groupId', groupId)
    this._assertInteger('userId', userId)
    await this.get('set_group_ban', { groupId, userId, duration })
  }

  async setGroupBanAsync (groupId: number, userId: number, duration?: number) {
    this._assertInteger('groupId', groupId)
    this._assertInteger('userId', userId)
    return this.getAsync('set_group_ban', { groupId, userId, duration })
  }

  setGroupAnonymousBan (groupId: number, anonymous: object, duration?: number): Promise<void>
  setGroupAnonymousBan (groupId: number, flag: string, duration?: number): Promise<void>
  async setGroupAnonymousBan (groupId: number, meta: object | string, duration?: number) {
    this._assertInteger('groupId', groupId)
    if (!meta) throw new Error('missing argument: anonymous or flag')
    const args = { groupId, duration } as any
    args[typeof meta === 'string' ? 'flag' : 'anonymous'] = meta
    await this.get('set_group_anonymous_ban', args)
  }

  setGroupAnonymousBanAsync (groupId: number, anonymous: object, duration?: number): Promise<void>
  setGroupAnonymousBanAsync (groupId: number, flag: string, duration?: number): Promise<void>
  async setGroupAnonymousBanAsync (groupId: number, meta: object | string, duration?: number) {
    this._assertInteger('groupId', groupId)
    if (!meta) throw new Error('missing argument: anonymous or flag')
    const args = { groupId, duration } as any
    args[typeof meta === 'string' ? 'flag' : 'anonymous'] = meta
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

  async setGroupAdmin (groupId: number, userId: number, enable = true) {
    this._assertInteger('groupId', groupId)
    this._assertInteger('userId', userId)
    await this.get('set_group_admin', { groupId, userId, enable })
  }

  async setGroupAdminAsync (groupId: number, userId: number, enable = true) {
    this._assertInteger('groupId', groupId)
    this._assertInteger('userId', userId)
    return this.getAsync('set_group_admin', { groupId, userId, enable })
  }

  async setGroupAnonymous (groupId: number, enable = true) {
    this._assertInteger('groupId', groupId)
    await this.get('set_group_anonymous', { groupId, enable })
  }

  async setGroupAnonymousAsync (groupId: number, enable = true) {
    this._assertInteger('groupId', groupId)
    return this.getAsync('set_group_anonymous', { groupId, enable })
  }

  async setGroupCard (groupId: number, userId: number, card = '') {
    this._assertInteger('groupId', groupId)
    this._assertInteger('userId', userId)
    await this.get('set_group_card', { groupId, userId, card })
  }

  async setGroupCardAsync (groupId: number, userId: number, card = '') {
    this._assertInteger('groupId', groupId)
    this._assertInteger('userId', userId)
    return this.getAsync('set_group_card', { groupId, userId, card })
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

  async setGroupLeave (groupId: number, isDismiss?: boolean) {
    this._assertInteger('groupId', groupId)
    await this.get('set_group_leave', { groupId, isDismiss })
  }

  async setGroupLeaveAsync (groupId: number, isDismiss?: boolean) {
    this._assertInteger('groupId', groupId)
    return this.getAsync('set_group_leave', { groupId, isDismiss })
  }

  async setDiscussLeave (discussId: number) {
    this._assertInteger('discussId', discussId)
    await this.get('set_discuss_leave', { discussId })
  }

  async setDiscussLeaveAsync (discussId: number) {
    this._assertInteger('discussId', discussId)
    return this.getAsync('set_discuss_leave', { discussId })
  }

  setFriendAddRequest (flag: string, approve?: boolean): Promise<void>
  setFriendAddRequest (flag: string, remark?: string): Promise<void>
  async setFriendAddRequest (flag: string, info: string | boolean = true) {
    if (!flag) throw new Error('missing argument: flag')
    if (typeof info === 'string') {
      await this.get('set_friend_add_request', { flag, approve: true, remark: info })
    } else {
      await this.get('set_friend_add_request', { flag, approve: info })
    }
  }

  setFriendAddRequestAsync (flag: string, approve?: boolean): Promise<void>
  setFriendAddRequestAsync (flag: string, remark?: string): Promise<void>
  async setFriendAddRequestAsync (flag: string, info: string | boolean = true) {
    if (!flag) throw new Error('missing argument: flag')
    if (typeof info === 'string') {
      return this.getAsync('set_friend_add_request', { flag, approve: true, remark: info })
    } else {
      return this.getAsync('set_friend_add_request', { flag, approve: info })
    }
  }

  setGroupAddRequest (flag: string, subType: 'add' | 'invite', approve?: boolean): Promise<void>
  setGroupAddRequest (flag: string, subType: 'add' | 'invite', reason?: string): Promise<void>
  async setGroupAddRequest (flag: string, subType: 'add' | 'invite', info: string | boolean = true) {
    if (!flag) throw new Error('missing argument: flag')
    this._assertElement('subType', subType, ['add', 'invite'])
    if (typeof info === 'string') {
      await this.get('set_group_add_request', { flag, subType, approve: false, reason: info })
    } else {
      await this.get('set_group_add_request', { flag, subType, approve: info })
    }
  }

  setGroupAddRequestAsync (flag: string, subType: 'add' | 'invite', approve?: boolean): Promise<void>
  setGroupAddRequestAsync (flag: string, subType: 'add' | 'invite', reason?: string): Promise<void>
  async setGroupAddRequestAsync (flag: string, subType: 'add' | 'invite', info: string | boolean = true) {
    if (!flag) throw new Error('missing argument: flag')
    this._assertElement('subType', subType, ['add', 'invite'])
    if (typeof info === 'string') {
      return this.getAsync('set_group_add_request', { flag, subType, approve: false, reason: info })
    } else {
      return this.getAsync('set_group_add_request', { flag, subType, approve: info })
    }
  }

  async getLoginInfo (): Promise<AccountInfo> {
    return this.get('get_login_info')
  }

  async getVipInfo (): Promise<VipInfo> {
    this._assertVersion('sender.getVipInfo()', 4, 3, 1)
    return this.get('_get_vip_info')
  }

  async getStrangerInfo (userId: number, noCache?: boolean): Promise<StrangerInfo> {
    this._assertInteger('userId', userId)
    return this.get('get_stranger_info', { userId, noCache })
  }

  async getFriendList (): Promise<FriendInfo[]> {
    this._assertVersion('sender.getFriendList()', 4, 12)
    return this.get('get_friend_list')
  }

  async getGroupInfo (groupId: number, noCache?: boolean): Promise<GroupInfo> {
    this._assertInteger('groupId', groupId)
    this._assertVersion('sender.getGroupInfo()', 4, 0, 1)
    return this.app.server.versionLessThan(4, 12)
      ? this.get('_get_group_info', { groupId, noCache })
      : this.get('get_group_info', { groupId, noCache })
  }

  async getGroupList (): Promise<ListedGroupInfo[]> {
    return this.get('get_group_list')
  }

  async getGroupMemberInfo (groupId: number, userId: number, noCache?: boolean): Promise<GroupMemberInfo> {
    this._assertInteger('groupId', groupId)
    this._assertInteger('userId', userId)
    return this.get('get_group_member_info', { groupId, userId, noCache })
  }

  async getGroupMemberList (groupId: number): Promise<GroupMemberInfo[]> {
    this._assertInteger('groupId', groupId)
    return this.get('get_group_member_list', { groupId })
  }

  async getGroupNotice (groupId: number): Promise<GroupNoticeInfo[]> {
    this._assertInteger('groupId', groupId)
    this._assertVersion('sender.getGroupNotice()', 4, 9)
    return this.get('_get_group_notice', { groupId })
  }

  async sendGroupNotice (groupId: number, title: string, content: string) {
    this._assertInteger('groupId', groupId)
    if (!title) throw new Error('missing argument: title')
    if (!content) throw new Error('missing argument: content')
    this._assertVersion('sender.sendGroupNotice()', 4, 9)
    await this.get('_send_group_notice', { groupId, title, content })
  }

  async sendGroupNoticeAsync (groupId: number, title: string, content: string) {
    this._assertInteger('groupId', groupId)
    if (!title) throw new Error('missing argument: title')
    if (!content) throw new Error('missing argument: content')
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

  getCredentials (domain?: string) {
    return this.get<Credentials>('get_credentials', { domain })
  }

  async getRecord (file: string, outFormat: RecordFormat, fullPath?: boolean) {
    if (!file) throw new Error('missing argument: file')
    this._assertElement('outFormat', outFormat, ['mp3', 'amr', 'wma', 'm4a', 'spx', 'ogg', 'wav', 'flac'])
    this._assertVersion('sender.getRecord()', 3, 3)
    const response = await this.get('get_record', { file, outFormat, fullPath })
    return response.file as string
  }

  async getImage (file: string) {
    if (!file) throw new Error('missing argument: file')
    this._assertVersion('sender.getImage()', 4, 8)
    const response = await this.get('get_image', { file })
    return response.file as string
  }

  async canSendRecord () {
    this._assertVersion('sender.canSendRecord()', 4, 8)
    const { yes } = await this.get('can_send_record')
    return yes as boolean
  }

  async canSendImage () {
    this._assertVersion('sender.canSendImage()', 4, 8)
    const { yes } = await this.get('can_send_image')
    return yes as boolean
  }

  getStatus () {
    return this.get<StatusInfo>('get_status')
  }

  async getVersionInfo () {
    const data = await this.get<VersionInfo>('get_version_info')
    const match = /^(\d+)(?:\.(\d+)(?:\.(\d+)?))?/.exec(data.pluginVersion)
    if (match) {
      const [, major, minor, patch] = match
      data.pluginMajorVersion = +major
      data.pluginMinorVersion = +minor || 0
      data.pluginPatchVersion = +patch || 0
    }
    return data
  }

  async setRestart (cleanLog = false, cleanCache = false, cleanEvent = false) {
    this._assertVersion('sender.setRestart()', 3, 0, 2)
    await this.get('_set_restart', { cleanLog, cleanCache, cleanEvent })
  }

  async setRestartPlugin (delay?: number) {
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
