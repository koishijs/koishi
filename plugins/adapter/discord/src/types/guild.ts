import { Channel, Emoji, integer, PresenceUpdateEvent, PresenceUpdateParams, Role, snowflake, StageInstance, Sticker, timestamp, User, VoiceState } from '.'

/** https://discord.com/developers/docs/resources/guild#guild-object-guild-structure */
export interface Guild {
  /** guild id */
  id: snowflake
  /** guild name (2-100 characters, excluding trailing and leading whitespace) */
  name: string
  /** icon hash */
  icon?: string
  /** icon hash, returned when in the template object */
  icon_hash?: string
  /** splash hash */
  splash?: string
  /** discovery splash hash; only present for guilds with the "DISCOVERABLE" feature */
  discovery_splash?: string
  /** true if the user is the owner of the guild */
  owner?: boolean
  /** id of owner */
  owner_id: snowflake
  /** total permissions for the user in the guild (excludes overwrites) */
  permissions?: string
  /** voice region id for the guild (deprecated) */
  region?: string
  /** id of afk channel */
  afk_channel_id?: snowflake
  /** afk timeout in seconds */
  afk_timeout: integer
  /** true if the server widget is enabled */
  widget_enabled?: boolean
  /** the channel id that the widget will generate an invite to, or null if set to no invite */
  widget_channel_id?: snowflake
  /** verification level required for the guild */
  verification_level: integer
  /** default message notifications level */
  default_message_notifications: integer
  /** explicit content filter level */
  explicit_content_filter: integer
  /** roles in the guild */
  roles: Role[]
  /** custom guild emojis */
  emojis: Emoji[]
  /** enabled guild features */
  features: GuildFeature[]
  /** required MFA level for the guild */
  mfa_level: integer
  /** application id of the guild creator if it is bot-created */
  application_id?: snowflake
  /** the id of the channel where guild notices such as welcome messages and boost events are posted */
  system_channel_id?: snowflake
  /** system channel flags */
  system_channel_flags: integer
  /** the id of the channel where Community guilds can display rules and/or guidelines */
  rules_channel_id?: snowflake
  /** when this guild was joined at */
  joined_at?: timestamp
  /** true if this is considered a large guild */
  large?: boolean
  /** true if this guild is unavailable due to an outage */
  unavailable?: boolean
  /** total number of members in this guild */
  member_count?: integer
  /** states of members currently in voice channels; lacks the guild_id key */
  voice_states?: Partial<VoiceState>[]
  /** users in the guild */
  members?: GuildMember[]
  /** channels in the guild */
  channels?: Channel[]
  /** all active threads in the guild that current user has permission to view */
  threads?: Channel[]
  /** presences of the members in the guild, will only include non-offline members if the size is greater than large threshold */
  presences?: Partial<PresenceUpdateEvent>[]
  /** the maximum number of presences for the guild (null is always returned, apart from the largest of guilds) */
  max_presences?: integer
  /** the maximum number of members for the guild */
  max_members?: integer
  /** the vanity url code for the guild */
  vanity_url_code?: string
  /** the description of a Community guild */
  description?: string
  /** banner hash */
  banner?: string
  /** premium tier (Server Boost level) */
  premium_tier: integer
  /** the number of boosts this guild currently has */
  premium_subscription_count?: integer
  /** the preferred locale of a Community guild; used in server discovery and notices from Discord; defaults to "en-US" */
  preferred_locale: string
  /** the id of the channel where admins and moderators of Community guilds receive notices from Discord */
  public_updates_channel_id?: snowflake
  /** the maximum amount of users in a video channel */
  max_video_channel_users?: integer
  /** approximate number of members in this guild, returned from the GET /guilds/<id> endpoint when with_counts is true */
  approximate_member_count?: integer
  /** approximate number of non-offline members in this guild, returned from the GET /guilds/<id> endpoint when with_counts is true */
  approximate_presence_count?: integer
  /** the welcome screen of a Community guild, shown to new members, returned in an Invite's guild object */
  welcome_screen?: WelcomeScreen
  /** guild NSFW level */
  nsfw_level: integer
  /** Stage instances in the guild */
  stage_instances?: StageInstance[]
  /** custom guild stickers */
  stickers?: Sticker[]
}

/** https://discord.com/developers/docs/resources/guild#guild-object-system-channel-flags */
export enum SystemChannelFlag {
  /** Suppress member join notifications */
  SUPPRESS_JOIN_NOTIFICATIONS = 1 << 0,
  /** Suppress server boost notifications */
  SUPPRESS_PREMIUM_SUBSCRIPTIONS = 1 << 1,
  /** Suppress server setup tips */
  SUPPRESS_GUILD_REMINDER_NOTIFICATIONS = 1 << 2,
}

/** https://discord.com/developers/docs/resources/guild#guild-object-guild-features */
export enum GuildFeature {
  /** guild has access to set an animated guild icon */
  ANIMATED_ICON = 'ANIMATED_ICON',
  /** guild has access to set a guild banner image */
  BANNER = 'BANNER',
  /** guild has access to use commerce features (i.e. create store channels) */
  COMMERCE = 'COMMERCE',
  /** guild can enable welcome screen, Membership Screening, stage channels and discovery, and receives community updates */
  COMMUNITY = 'COMMUNITY',
  /** guild is able to be discovered in the directory */
  DISCOVERABLE = 'DISCOVERABLE',
  /** guild is able to be featured in the directory */
  FEATURABLE = 'FEATURABLE',
  /** guild has access to set an invite splash background */
  INVITE_SPLASH = 'INVITE_SPLASH',
  /** guild has enabled Membership Screening */
  MEMBER_VERIFICATION_GATE_ENABLED = 'MEMBER_VERIFICATION_GATE_ENABLED',
  /** guild has enabled monetization */
  MONETIZATION_ENABLED = 'MONETIZATION_ENABLED',
  /** guild has increased custom sticker slots */
  MORE_STICKERS = 'MORE_STICKERS',
  /** guild has access to create news channels */
  NEWS = 'NEWS',
  /** guild is partnered */
  PARTNERED = 'PARTNERED',
  /** guild can be previewed before joining via Membership Screening or the directory */
  PREVIEW_ENABLED = 'PREVIEW_ENABLED',
  /** guild has access to create private threads */
  PRIVATE_THREADS = 'PRIVATE_THREADS',
  /** guild is able to set role icons */
  ROLE_ICONS = 'ROLE_ICONS',
  /** guild has access to the seven day archive time for threads */
  SEVEN_DAY_THREAD_ARCHIVE = 'SEVEN_DAY_THREAD_ARCHIVE',
  /** guild has access to the three day archive time for threads */
  THREE_DAY_THREAD_ARCHIVE = 'THREE_DAY_THREAD_ARCHIVE',
  /** guild has enabled ticketed events */
  TICKETED_EVENTS_ENABLED = 'TICKETED_EVENTS_ENABLED',
  /** guild has access to set a vanity URL */
  VANITY_URL = 'VANITY_URL',
  /** guild is verified */
  VERIFIED = 'VERIFIED',
  /** guild has access to set 384kbps bitrate in voice (previously VIP voice servers) */
  VIP_REGIONS = 'VIP_REGIONS',
  /** guild has enabled the welcome screen */
  WELCOME_SCREEN_ENABLED = 'WELCOME_SCREEN_ENABLED',
}

/** https://discord.com/developers/docs/resources/guild#guild-preview-object-guild-preview-structure */
export interface GuildPreview {
  /** guild id */
  id: snowflake
  /** guild name (2-100 characters) */
  name: string
  /** icon hash */
  icon?: string
  /** splash hash */
  splash?: string
  /** discovery splash hash */
  discovery_splash?: string
  /** custom guild emojis */
  emojis: Emoji[]
  /** enabled guild features */
  features: GuildFeature[]
  /** approximate number of members in this guild */
  approximate_member_count: integer
  /** approximate number of online members in this guild */
  approximate_presence_count: integer
  /** the description for the guild, if the guild is discoverable */
  description?: string
}

/** https://discord.com/developers/docs/resources/guild#guild-widget-object-guild-widget-structure */
export interface GuildWidget {
  /** whether the widget is enabled */
  enabled: boolean
  /** the widget channel id */
  channel_id?: snowflake
}

/** https://discord.com/developers/docs/resources/guild#guild-member-object-guild-member-structure */
export interface GuildMember {
  /** the user this guild member represents */
  user?: User
  /** this users guild nickname */
  nick?: string
  /** the member's guild avatar hash */
  avatar?: string
  /** array of role object ids */
  roles: snowflake[]
  /** when the user joined the guild */
  joined_at: timestamp
  /** when the user started boosting the guild */
  premium_since?: timestamp
  /** whether the user is deafened in voice channels */
  deaf: boolean
  /** whether the user is muted in voice channels */
  mute: boolean
  /** whether the user has not yet passed the guild's Membership Screening requirements */
  pending?: boolean
  /** total permissions of the member in the channel, including overwrites, returned when in the interaction object */
  permissions?: string
}

/** https://discord.com/developers/docs/resources/guild#ban-object-ban-structure */
export interface Ban {
  /** the reason for the ban */
  reason?: string
  /** the banned user */
  user: User
}

/** https://discord.com/developers/docs/resources/guild#welcome-screen-object-welcome-screen-structure */
export interface WelcomeScreen {
  /** the server description shown in the welcome screen */
  description?: string
  /** the channels shown in the welcome screen, up to 5 */
  welcome_channels: WelcomeScreenChannel[]
}

/** https://discord.com/developers/docs/resources/guild#welcome-screen-object-welcome-screen-channel-structure */
export interface WelcomeScreenChannel {
  /** the channel's id */
  channel_id: snowflake
  /** the description shown for the channel */
  description: string
  /** the emoji id, if the emoji is custom */
  emoji_id?: snowflake
  /** the emoji name if custom, the unicode character if standard, or null if no emoji is set */
  emoji_name?: string
}

export interface GuildCreateEvent extends Guild {}

export interface GuildUpdateEvent extends Guild {}

export interface GuildDeleteEvent extends Guild {}

/** https://discord.com/developers/docs/topics/gateway#guild-ban-add-guild-ban-add-event-fields */
export interface GuildBanAddEvent {
  /** id of the guild */
  guild_id: snowflake
  /** the banned user */
  user: User
}

/** https://discord.com/developers/docs/topics/gateway#guild-ban-remove-guild-ban-remove-event-fields */
export interface GuildBanRemoveEvent {
  /** id of the guild */
  guild_id: snowflake
  /** the unbanned user */
  user: User
}

/** https://discord.com/developers/docs/topics/gateway#guild-member-add-guild-member-add-extra-fields */
export interface GuildMemberAddEvent extends GuildMember {
  /** id of the guild */
  guild_id: snowflake
}

/** https://discord.com/developers/docs/topics/gateway#guild-member-remove-guild-member-remove-event-fields */
export interface GuildMemberRemoveEvent {
  /** the id of the guild */
  guild_id: snowflake
  /** the user who was removed */
  user: User
}

/** https://discord.com/developers/docs/topics/gateway#guild-member-update-guild-member-update-event-fields */
export interface GuildMemberUpdateEvent {
  /** the id of the guild */
  guild_id: snowflake
  /** user role ids */
  roles: snowflake[]
  /** the user */
  user: User
  /** nickname of the user in the guild */
  nick?: string
  /** the member's guild avatar hash */
  avatar?: string
  /** when the user joined the guild */
  joined_at?: timestamp
  /** when the user starting boosting the guild */
  premium_since?: timestamp
  /** whether the user is deafened in voice channels */
  deaf?: boolean
  /** whether the user is muted in voice channels */
  mute?: boolean
  /** whether the user has not yet passed the guild's Membership Screening requirements */
  pending?: boolean
}

/** https://discord.com/developers/docs/topics/gateway#guild-members-chunk-guild-members-chunk-event-fields */
export interface GuildMembersChunkEvent {
  /** the id of the guild */
  guild_id: snowflake
  /** set of guild members */
  members: GuildMember[]
  /** the chunk index in the expected chunks for this response (0 <= chunk_index < chunk_count) */
  chunk_index: integer
  /** the total number of expected chunks for this response */
  chunk_count: integer
  /** if passing an invalid id to REQUEST_GUILD_MEMBERS, it will be returned here */
  not_found?: snowflake[]
  /** if passing true to REQUEST_GUILD_MEMBERS, presences of the returned members will be here */
  presences?: PresenceUpdateParams[]
  /** the nonce used in the Guild Members Request */
  nonce?: string
}

declare module './gateway' {
  interface GatewayEvents {
    /** lazy-load for unavailable guild, guild became available, or user joined a new guild */
    GUILD_CREATE: GuildCreateEvent
    /** guild was updated */
    GUILD_UPDATE: GuildUpdateEvent
    /** guild became unavailable, or user left/was removed from a guild */
    GUILD_DELETE: GuildDeleteEvent
    /** user was banned from a guild */
    GUILD_BAN_ADD: GuildBanAddEvent
    /** user was unbanned from a guild */
    GUILD_BAN_REMOVE: GuildBanRemoveEvent
    /** new user joined a guild */
    GUILD_MEMBER_ADD: GuildMemberAddEvent
    /** user was removed from a guild */
    GUILD_MEMBER_REMOVE: GuildMemberRemoveEvent
    /** guild member was updated */
    GUILD_MEMBER_UPDATE: GuildMemberUpdateEvent
    /** response to Request Guild Members */
    GUILD_MEMBERS_CHUNK: GuildMembersChunkEvent
  }
}
