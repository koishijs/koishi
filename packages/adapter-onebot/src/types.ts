import * as Koishi from 'koishi-core'
import { capitalize } from 'koishi-core'

export interface Response {
  status: string
  retcode: number
  data: any
  echo?: number
}

export interface MessageId {
  messageId: number
}

export interface AccountInfo {
  userId: string
  nickname: string
}

export const adaptUser = (user: AccountInfo): Koishi.UserInfo => ({
  userId: user.userId.toString(),
  username: user.nickname,
})

export interface StrangerInfo extends AccountInfo {
  sex: 'male' | 'female' | 'unknown'
  age: number
}

export interface TalkativeMemberInfo extends AccountInfo {
  avatar: string
  dayCount: number
}

export type GroupRole = 'member' | 'admin' | 'owner'
export type HonorType = 'talkative' | 'performer' | 'legend' | 'strong_newbie' | 'emotion'

export interface HonoredMemberInfo {
  avatar: string
  description: string
}

export interface HonorInfo {
  currentTalkative: TalkativeMemberInfo
  talkativeList: HonoredMemberInfo[]
  performerList: HonoredMemberInfo[]
  legendList: HonoredMemberInfo[]
  strongNewbieList: HonoredMemberInfo[]
  emotionList: HonoredMemberInfo[]
}

export interface SenderInfo extends StrangerInfo {
  area?: string
  level?: string
  title?: string
  role?: GroupRole
  card?: string
}

export const adaptGroupMember = (user: SenderInfo): Koishi.GroupMemberInfo => ({
  ...adaptUser(user),
  nickname: user.card,
})

export const adaptAuthor = (user: SenderInfo, anonymous?: AnonymousInfo): Koishi.AuthorInfo => ({
  ...adaptUser(user),
  nickname: anonymous?.name || user.card,
  anonymous: anonymous?.flag,
})

export interface Message extends MessageId {
  realId: number
  time: number
  messageType: 'private' | 'group'
  sender: SenderInfo
  message: string
  anonymous?: AnonymousInfo
}

export interface AnonymousInfo {
  id: number
  name: string
  flag: string
}

export const adaptMessage = (message: Message): Koishi.MessageInfo => ({
  messageId: message.messageId.toString(),
  timestamp: message.time * 1000,
  content: message.message,
  author: adaptAuthor(message.sender, message.anonymous),
})

export type RecordFormat = 'mp3' | 'amr' | 'wma' | 'm4a' | 'spx' | 'ogg' | 'wav' | 'flac'
export type DataDirectory = 'image' | 'record' | 'show' | 'bface'

export interface FriendInfo extends AccountInfo {
  remark: string
}

export interface GroupBase {
  groupId: number
  groupName: string
}

export interface GroupInfo extends GroupBase {
  memberCount: number
  maxMemberCount: number
}

export const adaptGroup = (group: GroupInfo): Koishi.GroupInfo => ({
  groupId: group.groupId.toString(),
  groupName: group.groupName,
})

export const adaptChannel = (group: GroupInfo): Koishi.ChannelInfo => ({
  channelId: group.groupId.toString(),
  channelName: group.groupName,
})

export interface GroupMemberInfo extends SenderInfo {
  cardChangeable: boolean
  groupId: number
  joinTime: number
  lastSentTime: number
  titleExpireTime: number
  unfriendly: boolean
}

export interface Credentials {
  cookies: string
  csrfToken: number
}

export interface ImageInfo {
  file: string
}

export interface RecordInfo {
  file: string
}

export interface VersionInfo {
  coolqDirectory: string
  coolqEdition: 'air' | 'pro'
  pluginVersion: string
  pluginBuildNumber: number
  pluginBuildConfiguration: 'debug' | 'release'
  version?: string
  goCqhttp?: boolean
  runtimeVersion?: string
  runtimeOs?: string
}

export interface ImageInfo {
  size?: number
  filename?: string
  url?: string
}

export function toVersion(data: VersionInfo) {
  const { coolqEdition, pluginVersion, goCqhttp, version } = data
  if (goCqhttp) {
    return `go-cqhttp/${version.slice(1)}`
  } else {
    return `coolq/${capitalize(coolqEdition)} cqhttp/${pluginVersion}`
  }
}

export interface ForwardMessage {
  sender: AccountInfo
  time: number
  content: string
}

export interface EssenceMessage extends MessageId {
  senderId: number
  senderNick: string
  senderTime: number
  operatorId: number
  operatorNick: string
  operatorTime: number
}

interface CQNode {
  type: 'node'
  data: {
    id: number
  } | {
    name: string
    uin: number
    content: string
  }
}

export interface VipInfo extends AccountInfo {
  level: number
  levelSpeed: number
  vipLevel: number
  vipGrowthSpeed: number
  vipGrowthTotal: string
}

export interface GroupNotice {
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

export interface Statistics {
  packetReceived: number
  packetSent: number
  packetLost: number
  messageReceived: number
  messageSent: number
  disconnectTimes: number
  lostTimes: number
}

export interface StatusInfo {
  appInitialized: boolean
  appEnabled: boolean
  pluginsGood: boolean
  appGood: boolean
  online: boolean
  good: boolean
  stat: Statistics
}

export interface TextDetection {
  text: string
  confidence: string
  coordinates: any
}

export interface OcrResult {
  language: string
  texts: TextDetection[]
}

export interface GroupRequest extends GroupBase {
  requestId: number
  invitorUin: number
  invitorNick: string
  checked: boolean
  actor: number
}

export interface InvitedRequest extends GroupRequest {}

export interface JoinRequest extends GroupRequest {
  message: string
}

export interface GroupSystemMessageInfo {
  invitedRequests: InvitedRequest[]
  joinRequests: JoinRequest[]
}

export interface GroupFileSystemInfo {
  fileCount: number
  limitCount: number
  usedSpace: number
  totalSpace: number
}

export interface GroupFile {
  fileId: string
  fileName: string
  busid: number
  fileSize: number
  uploadTime: number
  deadTime: number
  modifyTime: number
  downloadTime: number
  uploader: number
  uploaderName: string
}

export interface GroupFolder {
  folderId: string
  folderName: string
  createTime: number
  creator: number
  creatorName: string
  totalFileCount: number
}

export interface GroupFileList {
  files: GroupFile[]
  folders: GroupFolder[]
}

export interface AtAllRemain {
  canAtAll: boolean
  remainAtAllCountForGroup: number
  remainAtAllCountForUin: number
}

export interface Device {
  appId: number
  deviceName: string
  deviceKind: string
}

export enum SafetyLevel { safe, unknown, danger }

type id = string | number

export interface API {
  $sendPrivateMsg(userId: id, message: string, autoEscape?: boolean): Promise<number>
  $sendPrivateMsgAsync(userId: id, message: string, autoEscape?: boolean): Promise<void>
  $sendGroupMsg(groupId: id, message: string, autoEscape?: boolean): Promise<number>
  $sendGroupMsgAsync(groupId: id, message: string, autoEscape?: boolean): Promise<void>
  $sendGroupForwardMsg(groupId: id, messages: readonly CQNode[]): Promise<number>
  $sendGroupForwardMsgAsync(groupId: id, messages: readonly CQNode[]): Promise<void>
  $deleteMsg(messageId: id): Promise<void>
  $deleteMsgAsync(messageId: id): Promise<void>
  $setEssenceMsg(messageId: id): Promise<void>
  $setEssenceMsgAsync(messageId: id): Promise<void>
  $deleteEssenceMsg(messageId: id): Promise<void>
  $deleteEssenceMsgAsync(messageId: id): Promise<void>
  $sendLike(userId: id, times?: number): Promise<void>
  $sendLikeAsync(userId: id, times?: number): Promise<void>
  $getMsg(messageId: id): Promise<Message>
  $getForwardMsg(messageId: id): Promise<ForwardMessage[]>
  $getEssenceMsgList(groupId: id): Promise<EssenceMessage[]>
  $getWordSlices(content: string): Promise<string[]>
  $ocrImage(image: string): Promise<OcrResult>
  $getGroupMsgHistory(groupId: id, messageSeq: id): Promise<Message[]>

  $setGroupKick(groupId: id, userId: id, rejectAddRequest?: boolean): Promise<void>
  $setGroupKickAsync(groupId: id, userId: id, rejectAddRequest?: boolean): Promise<void>
  $setGroupBan(groupId: id, userId: id, duration?: number): Promise<void>
  $setGroupBanAsync(groupId: id, userId: id, duration?: number): Promise<void>
  $setGroupWholeBan(groupId: id, enable?: boolean): Promise<void>
  $setGroupWholeBanAsync(groupId: id, enable?: boolean): Promise<void>
  $setGroupAdmin(groupId: id, userId: id, enable?: boolean): Promise<void>
  $setGroupAdminAsync(groupId: id, userId: id, enable?: boolean): Promise<void>
  $setGroupAnonymous(groupId: id, enable?: boolean): Promise<void>
  $setGroupAnonymousAsync(groupId: id, enable?: boolean): Promise<void>
  $setGroupCard(groupId: id, userId: id, card?: string): Promise<void>
  $setGroupCardAsync(groupId: id, userId: id, card?: string): Promise<void>
  $setGroupLeave(groupId: id, isDismiss?: boolean): Promise<void>
  $setGroupLeaveAsync(groupId: id, isDismiss?: boolean): Promise<void>
  $setGroupSpecialTitle(groupId: id, userId: id, specialTitle?: string, duration?: number): Promise<void>
  $setGroupSpecialTitleAsync(groupId: id, userId: id, specialTitle?: string, duration?: number): Promise<void>
  $setGroupName(groupId: id, name: string): Promise<void>
  $setGroupNameAsync(groupId: id, name: string): Promise<void>
  $setGroupPortrait(groupId: id, file: string, cache?: boolean): Promise<void>
  $setGroupPortraitAsync(groupId: id, file: string, cache?: boolean): Promise<void>
  $getGroupAtAllRemain(groupId: id): Promise<AtAllRemain>
  $sendGroupNotice(groupId: id, content: string): Promise<void>
  $sendGroupNoticeAsync(groupId: id, content: string): Promise<void>

  $getLoginInfo(): Promise<AccountInfo>
  $getVipInfo(): Promise<VipInfo>
  $getStrangerInfo(userId: id, noCache?: boolean): Promise<StrangerInfo>
  $getFriendList(): Promise<FriendInfo[]>
  $getGroupInfo(groupId: id, noCache?: boolean): Promise<GroupInfo>
  $getGroupList(): Promise<GroupInfo[]>
  $getGroupMemberInfo(groupId: id, userId: id, noCache?: boolean): Promise<GroupMemberInfo>
  $getGroupMemberList(groupId: id, noCache?: boolean): Promise<GroupMemberInfo[]>
  $getGroupHonorInfo(groupId: id, type: HonorType): Promise<HonorInfo>
  $getGroupSystemMsg(): Promise<GroupSystemMessageInfo>
  $getGroupFileSystemInfo(groupId: id): Promise<GroupFileSystemInfo>
  $getGroupRootFiles(groupId: id): Promise<GroupFileList>
  $getGroupFilesByFolder(groupId: id, folderId: string): Promise<GroupFileList>
  $getGroupFileUrl(groupId: id, fileId: string, busid: number): Promise<string>
  $uploadGroupFile(groupId: id, file: string, name: string, folder?: string): Promise<void>
  $downloadFile(url: string, headers?: string | string[], threadCount?: number): Promise<string>
  $getOnlineClients(noCache?: boolean): Promise<Device[]>
  $checkUrlSafely(url: string): Promise<SafetyLevel>

  $getCookies(domain?: string): Promise<string>
  $getCsrfToken(): Promise<number>
  $getCredentials(domain?: string): Promise<Credentials>
  $getRecord(file: string, outFormat: RecordFormat, fullPath?: boolean): Promise<RecordInfo>
  $getImage(file: string): Promise<ImageInfo>
  $canSendImage(): Promise<boolean>
  $canSendRecord(): Promise<boolean>
  $getStatus(): Promise<StatusInfo>
  $getVersionInfo(): Promise<VersionInfo>
  $setRestart(delay?: number): Promise<void>
}
