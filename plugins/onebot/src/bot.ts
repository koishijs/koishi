import { Bot, Session, segment, camelCase, snakeCase, BotOptions, Adapter, Time } from 'koishi'
import * as OneBot from './utils'

export interface Config extends Adapter.WsClientOptions {
  path?: string
  secret?: string
  quickOperation?: number
  responseTimeout?: number
}

export class SenderError extends Error {
  constructor(args: Record<string, any>, url: string, retcode: number, selfId: string) {
    super(`Error when trying to send to ${url}, args: ${JSON.stringify(args)}, retcode: ${retcode}`)
    Object.defineProperties(this, {
      name: { value: 'SenderError' },
      selfId: { value: selfId },
      code: { value: retcode },
      args: { value: args },
      url: { value: url },
    })
  }
}

function renderText(source: string) {
  return segment.parse(source).reduce((prev, { type, data }) => {
    if (type === 'at') {
      if (data.type === 'all') return prev + '[CQ:at,qq=all]'
      return prev + `[CQ:at,qq=${data.id}]`
    } else if (['video', 'audio', 'image'].includes(type)) {
      if (type === 'audio') type = 'record'
      if (!data.file) data.file = data.url
    } else if (type === 'quote') {
      type = 'reply'
    }
    return prev + segment(type, data)
  }, '')
}

export interface CQBot extends OneBot.API {}

export class CQBot extends Bot {
  static config: Config = {
    responseTimeout: Time.minute,
  }

  version = 'onebot'

  _request?(action: string, params: Record<string, any>): Promise<OneBot.Response>

  constructor(adapter: Adapter<'onebot'>, options: BotOptions) {
    super(adapter, options)
    this.avatar = `http://q.qlogo.cn/headimg_dl?dst_uin=${options.selfId}&spec=640`
  }

  async [Session.send](message: Session, content: string) {
    if (!content) return
    const { userId, guildId, channelId, channelName } = message
    if (!CQBot.config.quickOperation) {
      await this.sendMessage(channelId, content)
      return
    }

    let id: string
    const session = this.createSession({ content, channelId, channelName })
    if (guildId) {
      id = session.guildId = guildId
      session.subtype = 'group'
    } else {
      id = session.userId = userId
      session.subtype = 'private'
    }

    if (await this.app.serial(session, 'before-send', session)) return
    content = renderText(session.content)

    if (message._response) {
      return message._response({ reply: content, atSender: false })
    }

    return guildId
      ? this.$sendGroupMsgAsync(id, content)
      : this.$sendPrivateMsgAsync(id, content)
  }

  async get<T = any>(action: string, params = {}, silent = false): Promise<T> {
    this.logger.debug('[request] %s %o', action, params)
    const response = await this._request(action, snakeCase(params))
    this.logger.debug('[response] %o', response)
    const { data, retcode } = response
    if (retcode === 0 && !silent) {
      return camelCase(data)
    } else if (retcode < 0 && !silent) {
      throw new SenderError(params, action, retcode, this.selfId)
    } else if (retcode > 1) {
      throw new SenderError(params, action, retcode, this.selfId)
    }
  }

  async getAsync(action: string, params = {}) {
    await this.get(action + '_async', params)
  }

  sendMessage(channelId: string, content: string) {
    content = renderText(content)
    return channelId.startsWith('private:')
      ? this.sendPrivateMessage(channelId.slice(8), content)
      : this.sendGroupMessage(channelId, content)
  }

  async getMessage(channelId: string, messageId: string) {
    const data = await this.$getMsg(messageId)
    return OneBot.adaptMessage(data)
  }

  async deleteMessage(channelId: string, messageId: string) {
    await this.$deleteMsg(messageId)
  }

  async getSelf() {
    const data = await this.$getLoginInfo()
    return OneBot.adaptUser(data)
  }

  async getUser(userId: string) {
    const data = await this.$getStrangerInfo(userId)
    return OneBot.adaptUser(data)
  }

  async getFriendList() {
    const data = await this.$getFriendList()
    return data.map(OneBot.adaptUser)
  }

  async getChannel(channelId: string) {
    const data = await this.$getGroupInfo(channelId)
    return OneBot.adaptChannel(data)
  }

  async getGuild(guildId: string) {
    const data = await this.$getGroupInfo(guildId)
    return OneBot.adaptGroup(data)
  }

  async getGuildList() {
    const data = await this.$getGroupList()
    return data.map(OneBot.adaptGroup)
  }

  async getGuildMember(guildId: string, userId: string) {
    const data = await this.$getGroupMemberInfo(guildId, userId)
    return OneBot.adaptGroupMember(data)
  }

  async getGuildMemberList(guildId: string) {
    const data = await this.$getGroupMemberList(guildId)
    return data.map(OneBot.adaptGroupMember)
  }

  async sendGroupMessage(guildId: string, content: string) {
    if (!content) return
    const session = this.createSession({ content, subtype: 'group', guildId, channelId: guildId })
    if (this.app.bail(session, 'before-send', session)) return
    session.messageId = '' + await this.$sendGroupMsg(guildId, content)
    this.app.emit(session, 'send', session)
    return session.messageId
  }

  async sendPrivateMessage(userId: string, content: string) {
    if (!content) return
    const session = this.createSession({ content, subtype: 'private', userId, channelId: 'private:' + userId })
    if (this.app.bail(session, 'before-send', session)) return
    session.messageId = '' + await this.$sendPrivateMsg(userId, content)
    this.app.emit(session, 'send', session)
    return session.messageId
  }

  async $setGroupAnonymousBan(guildId: string, meta: string | object, duration?: number) {
    const args = { guildId, duration } as any
    args[typeof meta === 'string' ? 'flag' : 'anonymous'] = meta
    await this.get('set_group_anonymous_ban', args)
  }

  $setGroupAnonymousBanAsync(guildId: string, meta: string | object, duration?: number) {
    const args = { guildId, duration } as any
    args[typeof meta === 'string' ? 'flag' : 'anonymous'] = meta
    return this.getAsync('set_group_anonymous_ban', args)
  }

  async handleFriendRequest(messageId: string, approve: boolean, comment?: string) {
    await this.$setFriendAddRequest(messageId, approve, comment)
  }

  async handleGroupRequest(messageId: string, approve: boolean, comment?: string) {
    await this.$setGroupAddRequest(messageId, 'invite', approve, comment)
  }

  async handleGroupMemberRequest(messageId: string, approve: boolean, comment?: string) {
    await this.$setGroupAddRequest(messageId, 'add', approve, comment)
  }

  async deleteFriend(userId: string) {
    await this.$deleteFriend(userId)
  }

  async getStatus() {
    if (this.status !== Bot.Status.GOOD) return this.status
    try {
      const data = await this.$getStatus()
      return data.good ? Bot.Status.GOOD : data.online ? Bot.Status.SERVER_ERROR : Bot.Status.BOT_OFFLINE
    } catch {
      return Bot.Status.NET_ERROR
    }
  }
}

const asyncPrefixes = ['$set', '$send', '$delete', '$create', '$upload']

function prepareMethod(name: string) {
  const prop = '$' + camelCase(name.replace(/^[_.]/, ''))
  const isAsync = asyncPrefixes.some(prefix => prop.startsWith(prefix))
  return [prop, isAsync] as const
}

function define(name: string, ...params: string[]) {
  const [prop, isAsync] = prepareMethod(name)
  CQBot.prototype[prop] = async function (this: CQBot, ...args: any[]) {
    const data = await this.get(name, Object.fromEntries(params.map((name, index) => [name, args[index]])))
    if (!isAsync) return data
  }
  isAsync && (CQBot.prototype[prop + 'Async'] = async function (this: CQBot, ...args: any[]) {
    await this.getAsync(name, Object.fromEntries(params.map((name, index) => [name, args[index]])))
  })
}

function defineExtract(name: string, key: string, ...params: string[]) {
  key = camelCase(key)
  const [prop, isAsync] = prepareMethod(name)
  CQBot.prototype[prop] = async function (this: CQBot, ...args: any[]) {
    const data = await this.get(name, Object.fromEntries(params.map((name, index) => [name, args[index]])))
    return data[key]
  }
  isAsync && (CQBot.prototype[prop + 'Async'] = async function (this: CQBot, ...args: any[]) {
    await this.getAsync(name, Object.fromEntries(params.map((name, index) => [name, args[index]])))
  })
}

defineExtract('send_private_msg', 'message_id', 'user_id', 'message', 'auto_escape')
defineExtract('send_group_msg', 'message_id', 'group_id', 'message', 'auto_escape')
defineExtract('send_group_forward_msg', 'message_id', 'group_id', 'messages')
define('delete_msg', 'message_id')
define('set_essence_msg', 'message_id')
define('delete_essence_msg', 'message_id')
define('send_like', 'user_id', 'times')
define('get_msg', 'message_id')
define('get_essence_msg_list', 'group_id')
define('ocr_image', 'image')
defineExtract('get_forward_msg', 'messages', 'message_id')
defineExtract('.get_word_slices', 'slices', 'content')
define('get_group_msg_history', 'group_id', 'message_seq')
define('set_friend_add_request', 'flag', 'approve', 'remark')
define('set_group_add_request', 'flag', 'sub_type', 'approve', 'reason')
defineExtract('_get_model_show', 'variants', 'model')
define('_set_model_show', 'model', 'model_show')

define('set_group_kick', 'group_id', 'user_id', 'reject_add_request')
define('set_group_ban', 'group_id', 'user_id', 'duration')
define('set_group_whole_ban', 'group_id', 'enable')
define('set_group_admin', 'group_id', 'user_id', 'enable')
define('set_group_anonymous', 'group_id', 'enable')
define('set_group_card', 'group_id', 'user_id', 'card')
define('set_group_leave', 'group_id', 'is_dismiss')
define('set_group_special_title', 'group_id', 'user_id', 'special_title', 'duration')
define('set_group_name', 'group_id', 'group_name')
define('set_group_portrait', 'group_id', 'file', 'cache')
define('_send_group_notice', 'group_id', 'content')
define('get_group_at_all_remain', 'group_id')

define('get_login_info')
define('get_stranger_info', 'user_id', 'no_cache')
define('_get_vip_info', 'user_id')
define('get_friend_list')
define('get_group_info', 'group_id', 'no_cache')
define('get_group_list')
define('get_group_member_info', 'group_id', 'user_id', 'no_cache')
define('get_group_member_list', 'group_id')
define('get_group_honor_info', 'group_id', 'type')
define('get_group_system_msg')
define('get_group_file_system_info', 'group_id')
define('get_group_root_files', 'group_id')
define('get_group_files_by_folder', 'group_id', 'folder_id')
define('upload_group_file', 'group_id', 'file', 'name', 'folder')
define('create_group_file_folder', 'group_id', 'folder_id', 'name')
define('delete_group_folder', 'group_id', 'folder_id')
define('delete_group_file', 'group_id', 'folder_id', 'file_id', 'busid')
defineExtract('get_group_file_url', 'url', 'group_id', 'file_id', 'busid')
defineExtract('download_file', 'file', 'url', 'headers', 'thread_count')
defineExtract('get_online_clients', 'clients', 'no_cache')
defineExtract('check_url_safely', 'level', 'url')
define('delete_friend', 'user_id')

defineExtract('get_cookies', 'cookies', 'domain')
defineExtract('get_csrf_token', 'token')
define('get_credentials', 'domain')
define('get_record', 'file', 'out_format', 'full_path')
define('get_image', 'file')
defineExtract('can_send_image', 'yes')
defineExtract('can_send_record', 'yes')
define('get_status')
define('get_version_info')
define('set_restart', 'delay')
define('reload_event_filter')
