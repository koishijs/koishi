import debug from 'debug'
import axios from 'axios'
import { snakeCase, camelCase } from 'koishi-utils'
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
  private _messages = new Array(61).fill(0)
  private _timer: NodeJS.Timeout
  private _post: (api: string, args?: object) => Promise<CQResponse>

  constructor (public app: App) {
    const { type } = app.options
    if (type === 'http') {
      const headers = {} as any
      if (app.options.token) {
        headers.Authorization = `Token ${app.options.token}`
      }
      this._post = async (action, params = {}) => {
        const uri = new URL(action, this.app.options.server).href
        const { data } = await axios.get(uri, { params, headers })
        return data
      }
    } else if (type === 'ws') {
      const server = app.server as WsClient
      this._post = (action, params = {}) => server.send({ action, params })
    }
  }

  async get <T = any> (action: string, params?: object): Promise<T> {
    showSenderLog('request %s %o', action, params)
    const response = await this._post(action, snakeCase(params))
    showSenderLog('response %o', response)
    const { data, retcode } = response
    if (retcode === 0) {
      return camelCase(data)
    } else {
      throw new SenderError(params, action, retcode)
    }
  }

  async async (action: string, params?: object) {
    showSenderLog('request %s %o', action, params)
    const response = await this._post(action, snakeCase(params))
    showSenderLog('response %o', response)
    const { retcode } = response
    if (retcode !== 1) throw new SenderError(params, action, retcode)
  }

  start () {
    this._timer = setInterval(() => {
      this._messages.unshift(0)
      this._messages.splice(-1, 1)
    }, 1000)
  }

  stop () {
    clearInterval(this._timer)
  }

  async sendContextMsg (contextId: string, message: string, autoEscape?: boolean) {
    const type = contextId[0]
    const id = parseInt(contextId.slice(1))
    switch (type) {
      case 'g': return this.sendGroupMsg(id, message, autoEscape)
      case 'p': return this.sendPrivateMsg(id, message, autoEscape)
      case 'd': return this.sendDiscussMsg(id, message, autoEscape)
    }
  }

  private async _dispatchSendMeta <K extends ContextType> (type: K, subId: number, message: string, messageId?: number) {
    const meta: Meta<'send'> = {
      $path: `/${type}/${subId}/send`,
      postType: 'send',
      sendType: type === 'user' ? 'private' : type as any,
      messageId,
      message,
    }
    meta[type + 'Id'] = subId
    await this.app.dispatchMeta(meta)
  }

  async sendGroupMsg (groupId: number, message: string, autoEscape?: boolean) {
    if (!groupId || !message) return
    const { messageId } = await this.get<MessageResponse>('send_group_msg', { groupId, message, autoEscape })
    await this._dispatchSendMeta('group', groupId, message, messageId)
    return messageId
  }

  async sendGroupMsgAsync (groupId: number, message: string, autoEscape?: boolean) {
    if (!groupId || !message) return
    await this.async('send_group_msg', { groupId, message, autoEscape })
    await this._dispatchSendMeta('group', groupId, message)
  }

  async sendDiscussMsg (discussId: number, message: string, autoEscape?: boolean) {
    if (!discussId || !message) return
    this._messages[0] += 1
    const { messageId } = await this.get<MessageResponse>('send_discuss_msg', { discussId, message, autoEscape })
    await this._dispatchSendMeta('discuss', discussId, message, messageId)
    return messageId
  }

  async sendDiscussMsgAsync (discussId: number, message: string, autoEscape?: boolean) {
    if (!discussId || !message) return
    this._messages[0] += 1
    await this.async('send_discuss_msg', { discussId, message, autoEscape })
    await this._dispatchSendMeta('discuss', discussId, message)
  }

  async sendPrivateMsg (userId: number, message: string, autoEscape?: boolean) {
    if (!userId || !message) return
    this._messages[0] += 1
    const { messageId } = await this.get<MessageResponse>('send_private_msg', { userId, message, autoEscape })
    await this._dispatchSendMeta('user', userId, message, messageId)
    return messageId
  }

  async sendPrivateMsgAsync (userId: number, message: string, autoEscape?: boolean) {
    if (!userId || !message) return
    this._messages[0] += 1
    await this.async('send_private_msg', { userId, message, autoEscape })
    await this._dispatchSendMeta('user', userId, message)
  }

  async deleteMsg (messageId: number) {
    if (!this.app.assertVersion('sender.deleteMsg()', 3, 3)) return
    await this.get('delete_msg', { messageId })
  }

  async sendLike (userId: number, times = 1) {
    await this.get('send_like', { userId, times })
  }

  async setGroupKick (groupId: number, userId: number, rejectAddRequest = false) {
    await this.get('set_group_kick', { groupId, userId, rejectAddRequest })
  }

  async setGroupBan (groupId: number, userId: number, duration = 36 * 60) {
    await this.get('set_group_ban', { groupId, userId, duration })
  }

  setGroupAnonymousBan (groupId: number, anonymous: object, duration: number): Promise<void>
  setGroupAnonymousBan (groupId: number, flag: string, duration: number): Promise<void>
  async setGroupAnonymousBan (groupId: number, meta: object | string, duration = 36 * 60) {
    const args = { groupId, duration } as any
    args[typeof meta === 'string' ? 'flag' : 'anomymous'] = meta
    await this.get('set_group_anonymous_ban', args)
  }

  async setGroupWholeBan (groupId: number, enable = true) {
    await this.get('set_group_whole_ban', { groupId, enable })
  }

  async setGroupAdmin (groupId: number, userId: number, enable: boolean) {
    await this.get('set_group_admin', { groupId, userId, enable })
  }

  async setGroupAnonymous (groupId: number, enable: boolean) {
    await this.get('set_group_anonymous', { groupId, enable })
  }

  async setGroupCard (groupId: number, userId: number, card = '') {
    await this.get('set_group_admin', { groupId, userId, card })
  }

  async setGroupLeave (groupId: number, isDismiss = false) {
    await this.get('set_group_leave', { groupId, isDismiss })
  }

  async setGroupSpecialTitle (groupId: number, userId: number, specialTitle = '', duration = -1) {
    await this.get('set_group_special_title', { groupId, userId, specialTitle, duration })
  }

  async setDiscussLeave (discussId: number) {
    await this.get('set_discuss_leave', { discussId })
  }

  async setFriendAddRequest (flag: string, approve = true, remark = '') {
    await this.get('set_friend_add_request', { flag, approve, remark })
  }

  async setGroupAddRequest (flag: string, subType: 'add' | 'invite', approve = true, reason = '') {
    await this.get('set_group_add_request', { flag, subType, approve, reason })
  }

  getLoginInfo (): Promise<AccountInfo> {
    return this.get('get_login_info')
  }

  getVipInfo (userId: number): Promise<VipInfo> {
    if (!this.app.assertVersion('sender.getVipInfo()', 4, 3, 1)) return
    return this.get('_get_vip_info', { userId })
  }

  getStrangerInfo (userId: number, noCache = false): Promise<StrangerInfo> {
    return this.get('get_stranger_info', { userId, noCache })
  }

  getFriendList (): Promise<FriendInfo[]> {
    if (!this.app.assertVersion('sender.getFriendList()', 4, 12)) return
    return this.get('get_friend_list')
  }

  getGroupList (): Promise<ListedGroupInfo[]> {
    return this.get('get_group_list')
  }

  getGroupInfo (groupId: string, noCache = false): Promise<GroupInfo> {
    if (!this.app.assertVersion('sender.getGroupInfo()', 4, 0, 1)) return
    if (this.app.versionLessThan(4, 12)) return this.get('_get_group_info', { groupId, noCache })
    return this.get('get_group_info', { groupId, noCache })
  }

  getGroupMemberInfo (groupId: number, userId: number, noCache = false): Promise<GroupMemberInfo> {
    return this.get('get_group_member_info', { groupId, userId, noCache })
  }

  getGroupMemberList (groupId: number): Promise<GroupMemberInfo[]> {
    return this.get('get_group_member_list', { groupId })
  }

  getGroupNotice (groupId: number): Promise<GroupNoticeInfo[]> {
    if (!this.app.assertVersion('sender.getGroupNotice()', 4, 9)) return
    return this.get('_get_group_notice', { groupId })
  }

  async sendGroupNotice (groupId: number, title: string, content: string) {
    if (!this.app.assertVersion('sender.sendGroupNotice()', 4, 9)) return
    await this.get('_send_group_notice', { groupId, title, content })
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
    if (!this.app.assertVersion('sender.getRecord()', 3, 3)) return
    const response = await this.get('get_record', { file, outFormat, fullPath })
    return response.file as string
  }

  async getImage (file: string) {
    if (!this.app.assertVersion('sender.getImage()', 4, 8)) return
    const response = await this.get('get_image', { file })
    return response.file as string
  }

  async canSendImage () {
    if (!this.app.assertVersion('sender.canSendImage()', 4, 8)) return
    const { yes } = await this.get('can_send_image')
    return yes as boolean
  }

  async canSendRecord () {
    if (!this.app.assertVersion('sender.canSendRecord()', 4, 8)) return
    const { yes } = await this.get('can_send_record')
    return yes as boolean
  }

  getStatus (): Promise<StatusInfo> {
    return this.get('get_status')
  }

  async getVersionInfo (): Promise<VersionInfo> {
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
    if (!this.app.assertVersion('sender.setRestart()', 3, 0, 2)) return
    await this.get('_set_restart', { cleanLog, cleanCache, cleanEvent })
  }

  async setRestartPlugin (delay = 0) {
    if (!this.app.assertVersion('sender.setRestartPlugin()', 3, 2)) return
    await this.get('set_restart_plugin', { delay })
  }

  async cleanDataDir (dataDir: DataDirectoryType) {
    if (!this.app.assertVersion('sender.cleanDataDir()', 3, 3, 4)) return
    await this.get('clean_data_dir', { dataDir })
  }

  async cleanPluginLog () {
    if (!this.app.assertVersion('sender.cleanPluginLog()', 4, 1)) return
    await this.get('clean_plugin_log')
  }
}
