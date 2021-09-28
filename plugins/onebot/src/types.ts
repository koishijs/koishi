export interface Response {
  status: string
  retcode: number
  data: any
  echo?: number
}

export interface MessageId {
  message_id: number
}

export interface AccountInfo {
  user_id: string
  nickname: string
}

export interface StrangerInfo extends AccountInfo {
  sex: 'male' | 'female' | 'unknown'
  age: number
}

export interface TalkativeMemberInfo extends AccountInfo {
  avatar: string
  day_count: number
}

export type GroupRole = 'member' | 'admin' | 'owner'
export type HonorType = 'talkative' | 'performer' | 'legend' | 'strong_newbie' | 'emotion'

export interface HonoredMemberInfo {
  avatar: string
  description: string
}

export interface HonorInfo {
  current_talkative: TalkativeMemberInfo
  talkative_list: HonoredMemberInfo[]
  performer_list: HonoredMemberInfo[]
  legend_list: HonoredMemberInfo[]
  strong_newbie_list: HonoredMemberInfo[]
  emotion_list: HonoredMemberInfo[]
}

export interface SenderInfo extends StrangerInfo {
  area?: string
  level?: string
  title?: string
  role?: GroupRole
  card?: string
}

export interface Message extends MessageId {
  real_id?: number
  time: number
  message_type: 'private' | 'group'
  sender: SenderInfo
  group_id?: number
  message: string | any[]
  anonymous?: AnonymousInfo
}

export interface AnonymousInfo {
  id: number
  name: string
  flag: string
}

export type RecordFormat = 'mp3' | 'amr' | 'wma' | 'm4a' | 'spx' | 'ogg' | 'wav' | 'flac'
export type DataDirectory = 'image' | 'record' | 'show' | 'bface'

export interface FriendInfo extends AccountInfo {
  remark: string
}

export interface GroupBase {
  group_id: number
  group_name: string
}

export interface GroupInfo extends GroupBase {
  member_count: number
  max_member_count: number
}

export interface GroupMemberInfo extends SenderInfo {
  card_changeable: boolean
  group_id: number
  join_time: number
  last_sent_time: number
  title_expire_time: number
  unfriendly: boolean
}

export interface Credentials {
  cookies: string
  csrf_token: number
}

export interface ImageInfo {
  file: string
}

export interface RecordInfo {
  file: string
}

export interface VersionInfo {
  coolq_directory: string
  coolq_edition: 'air' | 'pro'
  plugin_version: string
  plugin_build_number: number
  plugin_build_configuration: 'debug' | 'release'
  version?: string
  go_cqhttp?: boolean
  runtime_version?: string
  runtime_os?: string
}

export interface ImageInfo {
  size?: number
  filename?: string
  url?: string
}

export interface ForwardMessage {
  sender: AccountInfo
  time: number
  content: string
}

export interface EssenceMessage extends MessageId {
  sender_id: number
  sender_nick: string
  sender_time: number
  operator_id: number
  operator_nick: string
  operator_time: number
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
  level_speed: number
  vip_level: number
  vip_growth_speed: number
  vip_growth_total: string
}

export interface GroupNotice {
  cn: number
  fid: string
  fn: number
  msg: {
    text: string
    text_face: string
    title: string
  }
  pubt: number
  read_num: number
  settings: {
    is_show_edit_card: number
    remind_ts: number
  }
  u: number
  vn: number
}

export interface Statistics {
  packet_received: number
  packet_sent: number
  packet_lost: number
  message_received: number
  message_sent: number
  disconnect_times: number
  lost_times: number
}

export interface StatusInfo {
  app_initialized: boolean
  app_enabled: boolean
  plugins_good: boolean
  app_good: boolean
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
  request_id: number
  invitor_uin: number
  invitor_nick: string
  checked: boolean
  actor: number
}

export interface InvitedRequest extends GroupRequest {}

export interface JoinRequest extends GroupRequest {
  message: string
}

export interface GroupSystemMessageInfo {
  invited_qequests: InvitedRequest[]
  join_requests: JoinRequest[]
}

export interface GroupFileSystemInfo {
  file_count: number
  limit_count: number
  used_space: number
  total_space: number
}

export interface GroupFile {
  file_id: string
  file_name: string
  busid: number
  file_size: number
  upload_time: number
  dead_time: number
  modify_time: number
  download_time: number
  uploader: number
  uploader_name: string
}

export interface GroupFolder {
  folder_id: string
  folder_name: string
  create_time: number
  creator: number
  creator_name: string
  total_file_count: number
}

export interface GroupFileList {
  files: GroupFile[]
  folders: GroupFolder[]
}

export interface AtAllRemain {
  can_at_all: boolean
  remain_at_all_count_for_group: number
  remain_at_all_count_for_uin: number
}

export interface Device {
  app_id: number
  device_name: string
  device_kind: string
}

export interface ModelVariant {
  model_show: string
  need_pay: boolean
}

export enum SafetyLevel { safe, unknown, danger }

export interface Payload extends Message {
  time: number
  self_id: number
  post_type: string
  request_type: string
  notice_type: string
  meta_event_type: string
  honor_type: string
  sub_type: string
  message_id: number
  user_id: number
  target_id: number
  operator_id: number
  raw_message: string
  font: number
  comment: string
  flag: string
}

type id = string | number

export interface Internal {
  sendPrivateMsg(user_id: id, message: string, autoEscape?: boolean): Promise<number>
  sendPrivateMsgAsync(user_id: id, message: string, autoEscape?: boolean): Promise<void>
  sendGroupMsg(groupId: id, message: string, autoEscape?: boolean): Promise<number>
  sendGroupMsgAsync(groupId: id, message: string, autoEscape?: boolean): Promise<void>
  sendGroupForwardMsg(groupId: id, messages: readonly CQNode[]): Promise<number>
  sendGroupForwardMsgAsync(groupId: id, messages: readonly CQNode[]): Promise<void>
  deleteMsg(message_id: id): Promise<void>
  deleteMsgAsync(message_id: id): Promise<void>
  setEssenceMsg(message_id: id): Promise<void>
  setEssenceMsgAsync(message_id: id): Promise<void>
  deleteEssenceMsg(message_id: id): Promise<void>
  deleteEssenceMsgAsync(message_id: id): Promise<void>
  sendLike(user_id: id, times?: number): Promise<void>
  sendLikeAsync(user_id: id, times?: number): Promise<void>
  getMsg(message_id: id): Promise<Message>
  getForwardMsg(message_id: id): Promise<ForwardMessage[]>
  getEssenceMsgList(groupId: id): Promise<EssenceMessage[]>
  getWordSlices(content: string): Promise<string[]>
  ocrImage(image: string): Promise<OcrResult>
  getGroupMsgHistory(groupId: id, messageSeq: id): Promise<Message[]>
  deleteFriend(user_id: id): Promise<void>
  deleteFriendAsync(user_id: id): Promise<void>
  setFriendAddRequest(flag: string, approve: boolean, remark?: string): Promise<void>
  setFriendAddRequestAsync(flag: string, approve: boolean, remark?: string): Promise<void>
  setGroupAddRequest(flag: string, subType: 'add' | 'invite', approve: boolean, reason?: string): Promise<void>
  setGroupAddRequestAsync(flag: string, subType: 'add' | 'invite', approve: boolean, reason?: string): Promise<void>

  setGroupKick(groupId: id, user_id: id, rejectAddRequest?: boolean): Promise<void>
  setGroupKickAsync(groupId: id, user_id: id, rejectAddRequest?: boolean): Promise<void>
  setGroupBan(groupId: id, user_id: id, duration?: number): Promise<void>
  setGroupBanAsync(groupId: id, user_id: id, duration?: number): Promise<void>
  setGroupWholeBan(groupId: id, enable?: boolean): Promise<void>
  setGroupWholeBanAsync(groupId: id, enable?: boolean): Promise<void>
  setGroupAdmin(groupId: id, user_id: id, enable?: boolean): Promise<void>
  setGroupAdminAsync(groupId: id, user_id: id, enable?: boolean): Promise<void>
  setGroupAnonymous(groupId: id, enable?: boolean): Promise<void>
  setGroupAnonymousAsync(groupId: id, enable?: boolean): Promise<void>
  setGroupCard(groupId: id, user_id: id, card?: string): Promise<void>
  setGroupCardAsync(groupId: id, user_id: id, card?: string): Promise<void>
  setGroupLeave(groupId: id, isDismiss?: boolean): Promise<void>
  setGroupLeaveAsync(groupId: id, isDismiss?: boolean): Promise<void>
  setGroupSpecialTitle(groupId: id, user_id: id, specialTitle?: string, duration?: number): Promise<void>
  setGroupSpecialTitleAsync(groupId: id, user_id: id, specialTitle?: string, duration?: number): Promise<void>
  setGroupName(groupId: id, name: string): Promise<void>
  setGroupNameAsync(groupId: id, name: string): Promise<void>
  setGroupPortrait(groupId: id, file: string, cache?: boolean): Promise<void>
  setGroupPortraitAsync(groupId: id, file: string, cache?: boolean): Promise<void>
  getGroupAtAllRemain(groupId: id): Promise<AtAllRemain>
  sendGroupNotice(groupId: id, content: string): Promise<void>
  sendGroupNoticeAsync(groupId: id, content: string): Promise<void>

  getLoginInfo(): Promise<AccountInfo>
  getVipInfo(): Promise<VipInfo>
  getStrangerInfo(user_id: id, noCache?: boolean): Promise<StrangerInfo>
  getFriendList(): Promise<FriendInfo[]>
  getGroupInfo(groupId: id, noCache?: boolean): Promise<GroupInfo>
  getGroupList(): Promise<GroupInfo[]>
  getGroupMemberInfo(groupId: id, user_id: id, noCache?: boolean): Promise<GroupMemberInfo>
  getGroupMemberList(groupId: id, noCache?: boolean): Promise<GroupMemberInfo[]>
  getGroupHonorInfo(groupId: id, type: HonorType): Promise<HonorInfo>
  getGroupSystemMsg(): Promise<GroupSystemMessageInfo>
  getGroupFileSystemInfo(groupId: id): Promise<GroupFileSystemInfo>
  getGroupRootFiles(groupId: id): Promise<GroupFileList>
  getGroupFilesByFolder(groupId: id, folderId: string): Promise<GroupFileList>
  getGroupFileUrl(groupId: id, fileId: string, busid: number): Promise<string>
  downloadFile(url: string, headers?: string | string[], threadCount?: number): Promise<string>
  uploadGroupFile(groupId: id, file: string, name: string, folder?: string): Promise<void>
  createGroupFileFolder(groupId: id, folderId: string, name: string): Promise<void>
  deleteGroupFolder(groupId: id, folderId: string): Promise<void>
  deleteGroupFile(groupId: id, folderId: string, fileId: string, busid: number): Promise<void>
  getOnlineClients(noCache?: boolean): Promise<Device[]>
  checkUrlSafely(url: string): Promise<SafetyLevel>
  getModelShow(model: string): Promise<ModelVariant[]>
  setModelShow(model: string, modelShow: string): Promise<void>

  getCookies(domain?: string): Promise<string>
  getCsrfToken(): Promise<number>
  getCredentials(domain?: string): Promise<Credentials>
  getRecord(file: string, outFormat: RecordFormat, fullPath?: boolean): Promise<RecordInfo>
  getImage(file: string): Promise<ImageInfo>
  canSendImage(): Promise<boolean>
  canSendRecord(): Promise<boolean>
  getStatus(): Promise<StatusInfo>
  getVersionInfo(): Promise<VersionInfo>
  setRestart(delay?: number): Promise<void>
  reloadEventFilter(): Promise<void>
}
