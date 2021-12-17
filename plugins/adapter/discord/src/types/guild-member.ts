import { integer, Internal, PresenceUpdateParams, snowflake, timestamp, User } from '.'

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

export interface ListGuildMembersOptions {
  /** max number of members to return (1-1000) */
  limit?: integer
  /** the highest user id in the previous page */
  after?: snowflake
}

export interface SearchGuildMembersOptions {
  /** query string to match username(s) and nickname(s) against */
  query: string
  /** max number of members to return (1-1000) */
  limit?: integer
}

declare module './internal' {
  interface Internal {
    /** https://discord.com/developers/docs/resources/guild#get-guild-member */
    getGuildMember(guild_id: snowflake, user_id: snowflake): Promise<GuildMember>
    /** https://discord.com/developers/docs/resources/guild#list-guild-members */
    listGuildMembers(guild_id: snowflake, options?: ListGuildMembersOptions): Promise<GuildMember[]>
    /** https://discord.com/developers/docs/resources/guild#search-guild-members */
    searchGuildMembers(guild_id: snowflake, options: SearchGuildMembersOptions): Promise<GuildMember[]>
  }
}

Internal.define({
  '/guilds/{guild.id}/members/{user.id}': {
    GET: 'getGuildMember',
    PUT: 'addGuildMember',
    PATCH: 'modifyGuildMember',
    DELETE: 'removeGuildMember',
  },
  '/guilds/{guild.id}/members': {
    GET: 'listGuildMembers',
  },
  '/guilds/{guild.id}/members/search': {
    GET: 'searchGuildMembers',
  },
  '/guilds/{guild.id}/members/@me': {
    PATCH: 'modifyCurrentMember',
  },
  '/guilds/{guild.id}/members/@me/nick': {
    PATCH: 'modifyCurrentUserNick',
  },
  '/guilds/{guild.id}/members/{user.id}/roles/{role.id}': {
    PUT: 'addGuildMemberRole',
    DELETE: 'removeGuildMemberRole',
  },
})
