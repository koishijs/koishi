import { GuildMember, integer, Internal, snowflake, timestamp, User } from '.'

/** https://discord.com/developers/docs/resources/channel#channel-object-channel-structure */
export interface Channel {
  /** the id of this channel */
  id: snowflake
  /** the type of channel */
  type: integer
  /** the id of the guild (may be missing for some channel objects received over gateway guild dispatches) */
  guild_id?: snowflake
  /** sorting position of the channel */
  position?: integer
  /** explicit permission overwrites for members and roles */
  permission_overwrites?: Overwrite[]
  /** the name of the channel (1-100 characters) */
  name?: string
  /** the channel topic (0-1024 characters) */
  topic?: string
  /** whether the channel is nsfw */
  nsfw?: boolean
  /** the id of the last message sent in this channel (may not point to an existing or valid message) */
  last_message_id?: snowflake
  /** the bitrate (in bits) of the voice channel */
  bitrate?: integer
  /** the user limit of the voice channel */
  user_limit?: integer
  /** amount of seconds a user has to wait before sending another message (0-21600); bots, as well as users with the permission manage_messages or manage_channel, are unaffected */
  rate_limit_per_user?: integer
  /** the recipients of the DM */
  recipients?: User[]
  /** icon hash */
  icon?: string
  /** id of the creator of the group DM or thread */
  owner_id?: snowflake
  /** application id of the group DM creator if it is bot-created */
  application_id?: snowflake
  /** for guild channels: id of the parent category for a channel (each parent category can contain up to 50 channels), for threads: id of the text channel this thread was created */
  parent_id?: snowflake
  /** when the last pinned message was pinned. This may be null in events such as GUILD_CREATE when a message is not pinned. */
  last_pin_timestamp?: timestamp
  /** voice region id for the voice channel, automatic when set to null */
  rtc_region?: string
  /** the camera video quality mode of the voice channel, 1 when not present */
  video_quality_mode?: integer
  /** an approximate count of messages in a thread, stops counting at 50 */
  message_count?: integer
  /** an approximate count of users in a thread, stops counting at 50 */
  member_count?: integer
  /** thread-specific fields not needed by other channels */
  thread_metadata?: ThreadMetadata
  /** thread member object for the current user, if they have joined the thread, only included on certain API endpoints */
  member?: ThreadMember
  /** default duration for newly created threads, in minutes, to automatically archive the thread after recent activity, can be set to: 60, 1440, 4320, 10080 */
  default_auto_archive_duration?: integer
  /** computed permissions for the invoking user in the channel, including overwrites, only included when part of the resolved data received on a slash command interaction */
  permissions?: string
}

/** https://discord.com/developers/docs/resources/channel#channel-object-channel-types */
export enum ChannelType {
  /** a text channel within a server */
  GUILD_TEXT = 0,
  /** a direct message between users */
  DM = 1,
  /** a voice channel within a server */
  GUILD_VOICE = 2,
  /** a direct message between multiple users */
  GROUP_DM = 3,
  /** an organizational category that contains up to 50 channels */
  GUILD_CATEGORY = 4,
  /** a channel that users can follow and crosspost into their own server */
  GUILD_NEWS = 5,
  /** a channel in which game developers can sell their game on Discord */
  GUILD_STORE = 6,
  /** a temporary sub-channel within a GUILD_NEWS channel */
  GUILD_NEWS_THREAD = 10,
  /** a temporary sub-channel within a GUILD_TEXT channel */
  GUILD_PUBLIC_THREAD = 11,
  /** a temporary sub-channel within a GUILD_TEXT channel that is only viewable by those invited and those with the MANAGE_THREADS permission */
  GUILD_PRIVATE_THREAD = 12,
  /** a voice channel for hosting events with an audience */
  GUILD_STAGE_VOICE = 13,
}

/** https://discord.com/developers/docs/resources/channel#followed-channel-object-followed-channel-structure */
export interface FollowedChannel {
  /** source channel id */
  channel_id: snowflake
  /** created target webhook id */
  webhook_id: snowflake
}

/** https://discord.com/developers/docs/resources/channel#overwrite-object-overwrite-structure */
export interface Overwrite {
  /** role or user id */
  id: snowflake
  /** either 0 (role) or 1 (member) */
  type: integer
  /** permission bit set */
  allow: string
  /** permission bit set */
  deny: string
}

/** https://discord.com/developers/docs/resources/channel#thread-metadata-object-thread-metadata-structure */
export interface ThreadMetadata {
  /** whether the thread is archived */
  archived: boolean
  /** duration in minutes to automatically archive the thread after recent activity, can be set to: 60, 1440, 4320, 10080 */
  auto_archive_duration: integer
  /** timestamp when the thread's archive status was last changed, used for calculating recent activity */
  archive_timestamp: timestamp
  /** whether the thread is locked; when a thread is locked, only users with MANAGE_THREADS can unarchive it */
  locked: boolean
  /** whether non-moderators can add other non-moderators to a thread; only available on private threads */
  invitable?: boolean
}

/** https://discord.com/developers/docs/resources/channel#thread-member-object-thread-member-structure */
export interface ThreadMember {
  /** the id of the thread */
  id?: snowflake
  /** the id of the user */
  user_id?: snowflake
  /** the time the current user last joined the thread */
  join_timestamp: timestamp
  /** any user-thread settings, currently only used for notifications */
  flags: integer
}

/** https://discord.com/developers/docs/resources/channel#allowed-mentions-object-allowed-mention-types */
export enum AllowedMentionType {
  /** Controls role mentions */
  ROLE_MENTIONS = 'roles',
  /** Controls user mentions */
  USER_MENTIONS = 'users',
  /** Controls @everyone and @here mentions */
  EVERYONE_MENTIONS = 'everyone',
}

/** https://discord.com/developers/docs/resources/channel#allowed-mentions-object-allowed-mentions-structure */
export interface AllowedMentions {
  /** An array of allowed mention types to parse from the content. */
  parse: AllowedMentionType[]
  /** Array of role_ids to mention (Max size of 100) */
  roles: snowflake[]
  /** Array of user_ids to mention (Max size of 100) */
  users: snowflake[]
  /** For replies, whether to mention the author of the message being replied to (default false) */
  replied_user: boolean
}

export interface ChannelCreateEvent extends Channel {}

export interface ChannelUpdateEvent extends Channel {}

export interface ChannelDeleteEvent extends Channel {}

/** https://discord.com/developers/docs/topics/gateway#channel-pins-update-channel-pins-update-event-fields */
export interface ChannelPinsUpdateEvent {
  /** the id of the guild */
  guild_id?: snowflake
  /** the id of the channel */
  channel_id: snowflake
  /** the time at which the most recent pinned message was pinned */
  last_pin_timestamp?: timestamp
}

/** https://discord.com/developers/docs/topics/gateway#thread-list-sync-thread-list-sync-event-fields */
export interface ThreadListSyncEvent {
  /** the id of the guild */
  guild_id: snowflake
  /** the parent channel ids whose threads are being synced.  If omitted, then threads were synced for the entire guild.  This array may contain channel_ids that have no active threads as well, so you know to clear that data. */
  channel_ids?: snowflake[]
  /** all active threads in the given channels that the current user can access */
  threads: Channel[]
  /** all thread member objects from the synced threads for the current user, indicating which threads the current user has been added to */
  members: ThreadMember[]
}

export interface ThreadMemberUpdateEvent extends ThreadMember {}

/** https://discord.com/developers/docs/topics/gateway#thread-members-update-thread-members-update-event-fields */
export interface ThreadMembersUpdateEvent {
  /** the id of the thread */
  id: snowflake
  /** the id of the guild */
  guild_id: snowflake
  /** the approximate number of members in the thread, capped at 50 */
  member_count: integer
  /** the users who were added to the thread */
  added_members?: ThreadMember[]
  /** the id of the users who were removed from the thread */
  removed_member_ids?: snowflake[]
}

/** https://discord.com/developers/docs/topics/gateway#typing-start-typing-start-event-fields */
export interface TypingStartEvent {
  /** id of the channel */
  channel_id: snowflake
  /** id of the guild */
  guild_id?: snowflake
  /** id of the user */
  user_id: snowflake
  /** unix time (in seconds) of when the user started typing */
  timestamp: integer
  /** the member who started typing if this happened in a guild */
  member?: GuildMember
}

declare module './gateway' {
  interface GatewayEvents {
    /** new guild channel created */
    CHANNEL_CREATE: ChannelCreateEvent
    /** channel was updated */
    CHANNEL_UPDATE: ChannelUpdateEvent
    /** channel was deleted */
    CHANNEL_DELETE: ChannelDeleteEvent
    /** message was pinned or unpinned */
    CHANNEL_PINS_UPDATE: ChannelPinsUpdateEvent
    /** sent when gaining access to a channel, contains all active threads in that channel */
    THREAD_LIST_SYNC: ThreadListSyncEvent
    /** thread member for the current user was updated */
    THREAD_MEMBER_UPDATE: ThreadMemberUpdateEvent
    /** some user(s) were added to or removed from a thread */
    THREAD_MEMBERS_UPDATE: ThreadMembersUpdateEvent
    /** user started typing in a channel */
    TYPING_START: TypingStartEvent
  }
}

declare module './internal' {
  interface Internal {
    /** https://discord.com/developers/docs/resources/channel#get-channel */
    getChannel(channel_id: string): Promise<Channel>
    /** https://discord.com/developers/docs/resources/channel#modify-channel */
    modifyChannel(channel_id: string, data: Partial<Channel>): Promise<Channel>
    /** https://discord.com/developers/docs/resources/channel#deleteclose-channel */
    deleteChannel(channel_id: string): Promise<Channel>
  }
}

Internal.define({
  '/channels/{channel.id}': {
    GET: 'getChannel',
    PATCH: 'modifyChannel',
    DELETE: 'delete/CloseChannel',
  },
  '/channels/{channel.id}/messages': {
    GET: 'getChannelMessages',
    POST: 'createMessage',
  },
  '/channels/{channel.id}/messages/{message.id}': {
    GET: 'getChannelMessage',
    PATCH: 'editMessage',
    DELETE: 'deleteMessage',
  },
  '/channels/{channel.id}/messages/{message.id}/crosspost': {
    POST: 'crosspostMessage',
  },
  '/channels/{channel.id}/messages/{message.id}/reactions/{emoji}/@me': {
    PUT: 'createReaction',
    DELETE: 'deleteOwnReaction',
  },
  '/channels/{channel.id}/messages/{message.id}/reactions/{emoji}/{user.id}': {
    DELETE: 'deleteUserReaction',
  },
  '/channels/{channel.id}/messages/{message.id}/reactions/{emoji}': {
    GET: 'getReactions',
    DELETE: 'deleteAllReactionsforEmoji',
  },
  '/channels/{channel.id}/messages/{message.id}/reactions': {
    DELETE: 'deleteAllReactions',
  },
  '/channels/{channel.id}/messages/bulk-delete': {
    POST: 'bulkDeleteMessages',
  },
  '/channels/{channel.id}/permissions/{overwrite.id}': {
    PUT: 'editChannelPermissions',
    DELETE: 'deleteChannelPermission',
  },
  '/channels/{channel.id}/invites': {
    GET: 'getChannelInvites',
    POST: 'createChannelInvite',
  },
  '/channels/{channel.id}/followers': {
    POST: 'followNewsChannel',
  },
  '/channels/{channel.id}/typing': {
    POST: 'triggerTypingIndicator',
  },
  '/channels/{channel.id}/pins': {
    GET: 'getPinnedMessages',
  },
  '/channels/{channel.id}/pins/{message.id}': {
    PUT: 'pinMessage',
    DELETE: 'unpinMessage',
  },
  '/channels/{channel.id}/recipients/{user.id}': {
    PUT: 'groupDMAddRecipient',
    DELETE: 'groupDMRemoveRecipient',
  },
  '/channels/{channel.id}/messages/{message.id}/threads': {
    POST: 'startThreadwithMessage',
  },
  '/channels/{channel.id}/threads': {
    POST: 'startThreadwithoutMessage',
  },
  '/channels/{channel.id}/thread-members/@me': {
    PUT: 'joinThread',
    DELETE: 'leaveThread',
  },
  '/channels/{channel.id}/thread-members/{user.id}': {
    PUT: 'addThreadMember',
    DELETE: 'removeThreadMember',
    GET: 'getThreadMember',
  },
  '/channels/{channel.id}/thread-members': {
    GET: 'listThreadMembers',
  },
  '/channels/{channel.id}/threads/active': {
    GET: 'listActiveThreads',
  },
  '/channels/{channel.id}/threads/archived/public': {
    GET: 'listPublicArchivedThreads',
  },
  '/channels/{channel.id}/threads/archived/private': {
    GET: 'listPrivateArchivedThreads',
  },
  '/channels/{channel.id}/users/@me/threads/archived/private': {
    GET: 'listJoinedPrivateArchivedThreads',
  },
})
