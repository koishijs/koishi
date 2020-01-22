import { User, Group } from './database'

export type PostType = 'message' | 'notice' | 'request' | 'meta_event' | 'send'

export interface MetaTypeMap {
  message: 'private' | 'group' | 'discuss'
  notice: 'group_upload' | 'group_admin' | 'group_increase' | 'group_decrease' | 'group_ban' | 'friend_add'
  request: 'friend' | 'group'
  // eslint-disable-next-line camelcase
  meta_event: 'lifecycle' | 'heartbeat'
  send: 'private' | 'group' | 'discuss'
}

export interface SubTypeMap {
  message: 'friend' | 'group' | 'discuss' | 'other' | 'normal' | 'anonymous' | 'notice'
  notice: 'set' | 'unset' | 'approve' | 'invite' | 'leave' | 'kick' | 'kick_me' | 'ban' | 'lift_ban'
  request: 'add' | 'invite'
  // eslint-disable-next-line camelcase
  meta_event: 'enable' | 'disable'
  send: never
}

export enum contextTypes {
  user = 0,
  group = 1,
  discuss = 2,
}

export type ContextType = keyof typeof contextTypes

export interface ResponsePayload {
  delete?: boolean
  ban?: boolean
  banDuration?: number
  kick?: boolean
  reply?: string
  autoEscape?: boolean
  atSender?: boolean
  approve?: boolean
  remark?: string
  reason?: string
}

export interface ParsedMessage {
  atMe?: boolean
  nickname?: string
  prefix?: string
  message?: string
}

/** CQHTTP Meta Information */
export interface Meta <T extends PostType = PostType> {
  // database bindings
  $user?: User
  $group?: Group

  // context identifier
  $ctxId?: number
  $ctxType?: ContextType

  // other properties
  $parsed?: ParsedMessage

  // quick operations
  $response?: (payload: ResponsePayload) => void
  $delete?: () => Promise<void>
  $kick?: () => Promise<void>
  $ban?: (duration?: number) => Promise<void>
  $approve?: (remark?: string) => Promise<void>
  $reject?: (reason?: string) => Promise<void>
  $send?: (message: string, autoEscape?: boolean) => Promise<void>

  // basic properties
  postType?: T
  messageType?: MetaTypeMap[T & 'message']
  noticeType?: MetaTypeMap[T & 'notice']
  requestType?: MetaTypeMap[T & 'request']
  metaEventType?: MetaTypeMap[T & 'meta_event']
  sendType?: MetaTypeMap[T & 'send']
  subType?: SubTypeMap[T]
  selfId?: number
  userId?: number
  groupId?: number
  discussId?: number
  time?: number

  // message event
  messageId?: number
  message?: string
  rawMessage?: string
  font?: number
  sender?: SenderInfo
  anonymous?: AnonymousInfo

  // notice event
  operatorId?: number
  duration?: number
  file?: FileInfo

  // request event
  comment?: string
  flag?: string

  // metaEvent event
  status?: StatusInfo
  interval?: number
}

export interface AnonymousInfo {
  id?: number
  name: string
  flag: string
}

export interface FileInfo {
  id: string
  name: string
  size: number
  busid: number
}

export interface AccountInfo {
  userId: number
  nickname: string
}

export interface FriendInfo extends AccountInfo {
  remark: string
}

export interface StrangerInfo extends AccountInfo {
  sex: 'male' | 'female' | 'unknown'
  age: number
}

export type GroupRole = 'owner' | 'admin' | 'member'

export interface SenderInfo extends StrangerInfo {
  area?: string
  card?: string
  level?: string
  role?: GroupRole
  title?: string
}

export interface GroupMemberInfo extends SenderInfo {
  cardChangeable: boolean
  groupId: number
  joinTime: number
  lastSentTime: number
  titleExpireTime: number
  unfriendly: boolean
}

export interface ListedGroupInfo {
  groupId: number
  groupName: string
}

export interface GroupInfo extends ListedGroupInfo {
  memberCount: number
  maxMemberCount: number
}

export interface Credentials {
  cookies: string
  csrfToken: number
}

export interface StatusInfo {
  appInitialized: boolean
  appEnabled: boolean
  pluginsGood: boolean
  appGood: boolean
  online: boolean
  good: boolean
}

export interface VersionInfo {
  coolqDirectory: string
  coolqEdition: 'air' | 'pro'
  pluginVersion: string
  pluginMajorVersion: number
  pluginMinorVersion: number
  pluginPatchVersion: number
  pluginBuildNumber: number
  pluginBuildConfiguration: 'debug' | 'release'
}

export interface VipInfo extends AccountInfo {
  level: number
  levelSpeed: number
  vipLevel: number
  vipGrowthSpeed: number
  vipGrowthTotal: string
}

export interface GroupNoticeInfo {
  cn: number
  fid: string
  fn: number
  msg: {
    text: string
    textFace: string
    title: string
  }
  pubt: number
  readNum: number
  settings: {
    isShowEditCard: number
    remindTs: number
  }
  u: number
  vn: number
}
