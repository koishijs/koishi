export enum MessageType {
  // 建联相关
  Identity = 'identity',
  Dispatch = 'dispatch',
  Subscription = 'subscription',
  Active = 'active',
}

export enum EventType {
  // 用户
  UserUpdate = 'user_update',
  UserTyping = 'user_typing',
  UserRelationshipUpdate = 'user_relationship_update',

  // 据点
  NodeCreate = 'node_create',
  NodeUpdate = 'node_update',
  NodeDelete = 'node_delete',
  NodePosition = 'node_position',

  // 频道
  TopicCreate = 'topic_create',
  TopicUpdate = 'topic_update',
  TopicDelete = 'topic_delete',
  TopicPosition = 'topic_position',

  // 角色
  RoleCreate = 'role_create',
  RoleUpdate = 'role_update',
  RoleDelete = 'role_delete',
  RolePosition = 'role_position',

  // 据点成员
  NodeMemberAdd = 'node_member_add',
  NodeMemberUpdate = 'node_member_update',
  NodeMemberRemove = 'node_member_remove',

  // 聊天
  MessageCreate = 'message_create',
  MessageUpdate = 'message_update',
  MessageDelete = 'message_delete',

  // 想法
  ThoughtCreate = 'thought_create',
  ThoughtUpdate = 'thought_update',
  ThoughtDelete = 'thought_delete',
  ThoughtEngagement = 'thought_engagement',

  // 评论
  CommentEngagement = 'comment_engagement',
  CommentCreate = 'comment_create',
  CommentUpdate = 'comment_update',
  CommentDelete = 'comment_delete',

  // 通知
  Notification = 'notification',

  // 想法置顶
  ThoughtPin = 'thought_pin',
  ThoughtUnpin = 'thought_unpin',
}

export type Payload = {
  event: EventType
  data: any
}

export type snowflake = string

export interface Thought {

}

export interface Stamp {

}

export interface User {
  avator: string
  background: any
  banned: boolean
  can_dm: boolean
  description: string
  created_at: string
  deactivated: boolean
  email: string
  email_verified: boolean
  follower_count: number
  following_count: number
  id: snowflake
  name: string
  username: string
  objects: Objects
  phone: string
  phone_verified: boolean
  profile: string
  protected: boolean
  slience_to: any
  type: number
  updated_at: string
}

export interface Media {
  content: string
  height: number
  width: number
  id: snowflake
  thumbnail: string
  url: string
  type: string
  volc_type: number
}

export interface Node {
  created_at: string
  description: string
  enable_join_question: boolean
  enable_speak_question: boolean
  hottest_topic: Topic
  member: Member[]
  member_count: number
  name: string
  node_name: string
  objects: Objects
  tags: string[]
  pin_unread: boolean
  topics: Topic[]
  super_moderator: string
  id: string
}

export interface Topic {
  node_id: string
  name: string
  description: string
  postion: number
  archived: boolean
  creator: string
  created_at: string
  updated_at: string
  id: string
  last_message: Message[]
  speaker_size: number
}

export interface Embed {

}

export interface Role {
  color: number
  hoist: boolean
  id: string
  name: string
  node_id: string
  permissions: number
  position: number
  type: number
}

// export interface PartialGuild extends Pick<Node, 'id' | 'name' | 'icon' | 'owner' | 'permissions' | 'features'> {
// }

export interface Member {
  roles: string[]
  is_super_moderator: boolean
  is_moderator: boolean
  is_verified: boolean
  nick: string
  permissions_allow: number
  permissions_deny: number
  joined_at: string
  updated_at: string
  node_id: string
  user_id: string
  objects: Objects
}

export interface Objects {
  users: Record<string, User>
  media: Record<string, Media>
  embeds: Record<string, Media>
  member: Record<string, Member>
}

export interface Message {
  id: snowflake
  node_id?: snowflake
  topic_id: snowflake
  author_id: string
  type: number
  content: string
  thought: Thought
  mention_everyone: boolean
  parent: Message
  nonce: snowflake
  objects: Objects
  mention_roles: string[]
  mentions: User[]
  stamp?: string
  media?: string[]
  created_at: string
}
