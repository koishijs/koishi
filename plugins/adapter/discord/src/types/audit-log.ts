import { Channel, Integration, Internal, snowflake, User, Webhook } from '.'

/** https://discord.com/developers/docs/resources/audit-log#audit-log-object-audit-log-structure */
export interface AuditLog {
  /** list of audit log entries */
  audit_log_entries: AuditLogEntry[]
  /** list of partial integration objects */
  integrations: Partial<Integration>[]
  /** list of threads found in the audit log* */
  threads: Channel[]
  /** list of users found in the audit log */
  users: User[]
  /** list of webhooks found in the audit log */
  webhooks: Webhook[]
}

/** https://discord.com/developers/docs/resources/audit-log#audit-log-entry-object-audit-log-entry-structure */
export interface AuditLogEntry {
  /** id of the affected entity (webhook, user, role, etc.) */
  target_id?: string
  /** changes made to the target_id */
  changes?: AuditLogChange[]
  /** the user who made the changes */
  user_id?: snowflake
  /** id of the entry */
  id: snowflake
  /** type of action that occurred */
  action_type: AuditLogEvent
  /** additional info for certain action types */
  options?: OptionalAuditEntryInfo
  /** the reason for the change (0-512 characters) */
  reason?: string
}

/** https://discord.com/developers/docs/resources/audit-log#audit-log-entry-object-audit-log-events */
export enum AuditLogEvent {
  GUILD_UPDATE = 1,
  CHANNEL_CREATE = 10,
  CHANNEL_UPDATE = 11,
  CHANNEL_DELETE = 12,
  CHANNEL_OVERWRITE_CREATE = 13,
  CHANNEL_OVERWRITE_UPDATE = 14,
  CHANNEL_OVERWRITE_DELETE = 15,
  MEMBER_KICK = 20,
  MEMBER_PRUNE = 21,
  MEMBER_BAN_ADD = 22,
  MEMBER_BAN_REMOVE = 23,
  MEMBER_UPDATE = 24,
  MEMBER_ROLE_UPDATE = 25,
  MEMBER_MOVE = 26,
  MEMBER_DISCONNECT = 27,
  BOT_ADD = 28,
  ROLE_CREATE = 30,
  ROLE_UPDATE = 31,
  ROLE_DELETE = 32,
  INVITE_CREATE = 40,
  INVITE_UPDATE = 41,
  INVITE_DELETE = 42,
  WEBHOOK_CREATE = 50,
  WEBHOOK_UPDATE = 51,
  WEBHOOK_DELETE = 52,
  EMOJI_CREATE = 60,
  EMOJI_UPDATE = 61,
  EMOJI_DELETE = 62,
  MESSAGE_DELETE = 72,
  MESSAGE_BULK_DELETE = 73,
  MESSAGE_PIN = 74,
  MESSAGE_UNPIN = 75,
  INTEGRATION_CREATE = 80,
  INTEGRATION_UPDATE = 81,
  INTEGRATION_DELETE = 82,
  STAGE_INSTANCE_CREATE = 83,
  STAGE_INSTANCE_UPDATE = 84,
  STAGE_INSTANCE_DELETE = 85,
  STICKER_CREATE = 90,
  STICKER_UPDATE = 91,
  STICKER_DELETE = 92,
  THREAD_CREATE = 110,
  THREAD_UPDATE = 111,
  THREAD_DELETE = 112,
}

/** https://discord.com/developers/docs/resources/audit-log#audit-log-entry-object-optional-audit-entry-info */
export interface OptionalAuditEntryInfo {
  /** channel in which the entities were targeted */
  channel_id: snowflake
  /** number of entities that were targeted */
  count: string
  /** number of days after which inactive members were kicked */
  delete_member_days: string
  /** id of the overwritten entity */
  id: snowflake
  /** number of members removed by the prune */
  members_removed: string
  /** id of the message that was targeted */
  message_id: snowflake
  /** name of the role if type is "0" (not present if type is "1") */
  role_name: string
  /** type of overwritten entity - "0" for "role" or "1" for "member" */
  type: string
}

/** https://discord.com/developers/docs/resources/audit-log#audit-log-change-object-audit-log-change-structure */
export interface AuditLogChange {
  /** new value of the key */
  new_value?: any
  /** old value of the key */
  old_value?: any
  /** name of audit log change key */
  key: string
}

declare module './internal' {
  interface Internal {
    /** https://discord.com/developers/docs/resources/audit-log#get-guild-audit-log */
    getGuildAuditLog(guildId: snowflake): Promise<AuditLog>
  }
}

Internal.define({
  '/guilds/{guild.id}/audit-logs': {
    GET: 'getGuildAuditLog',
  },
})
