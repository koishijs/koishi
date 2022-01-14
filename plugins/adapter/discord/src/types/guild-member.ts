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

export namespace GuildMember {
  export namespace Params {
    /** https://discord.com/developers/docs/resources/guild#list-guild-members-query-string-params */
    export interface List {
      /** max number of members to return (1-1000) */
      limit: integer
      /** the highest user id in the previous page */
      after: snowflake
    }

    /** https://discord.com/developers/docs/resources/guild#search-guild-members-query-string-params */
    export interface Search {
      /** Query string to match username(s) and nickname(s) against. */
      query: string
      /** max number of members to return (1-1000) */
      limit: integer
    }

    /** https://discord.com/developers/docs/resources/guild#add-guild-member-json-params */
    export interface Add {
      /** an oauth2 access token granted with the guilds.join to the bot's application for the user you want to add to the guild */
      access_token: string
      /** value to set user's nickname to */
      nick: string
      /** array of role ids the member is assigned */
      roles: snowflake[]
      /** whether the user is muted in voice channels */
      mute: boolean
      /** whether the user is deafened in voice channels */
      deaf: boolean
    }

    /** https://discord.com/developers/docs/resources/guild#modify-guild-member-json-params */
    export interface Modify {
      /** value to set user's nickname to */
      nick: string
      /** array of role ids the member is assigned */
      roles: snowflake[]
      /** whether the user is muted in voice channels. Will throw a 400 if the user is not in a voice channel */
      mute: boolean
      /** whether the user is deafened in voice channels. Will throw a 400 if the user is not in a voice channel */
      deaf: boolean
      /** id of channel to move user to (if they are connected to voice) */
      channel_id: snowflake
      /** when the user's timeout will expire and the user will be able to communicate in the guild again (up to 28 days in the future), set to null to remove timeout */
      communication_disabled_until?: timestamp
    }

    /** https://discord.com/developers/docs/resources/guild#modify-current-member-json-params */
    export interface ModifyCurrent {
      /** value to set user's nickname to */
      nick?: string
    }

    /** https://discord.com/developers/docs/resources/guild#get-guild-prune-count-query-string-params */
    export interface GetPruneCount {
      /** number of days to count prune for (1-30) */
      days: integer
      /** role(s) to include */
      include_roles: string
    }

    /** https://discord.com/developers/docs/resources/guild#begin-guild-prune-json-params */
    export interface BeginPrune {
      /** number of days to prune (1-30) */
      days: integer
      /** whether 'pruned' is returned, discouraged for large guilds */
      compute_prune_count: boolean
      /** role(s) to include */
      include_roles: snowflake[]
    }
  }

  export namespace Event {
    /** https://discord.com/developers/docs/topics/gateway#guild-member-add-guild-member-add-extra-fields */
    export interface Add extends GuildMember {
      /** id of the guild */
      guild_id: snowflake
    }

    /** https://discord.com/developers/docs/topics/gateway#guild-member-remove-guild-member-remove-event-fields */
    export interface Remove {
      /** the id of the guild */
      guild_id: snowflake
      /** the user who was removed */
      user: User
    }

    /** https://discord.com/developers/docs/topics/gateway#guild-member-update-guild-member-update-event-fields */
    export interface Update {
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
    export interface Chunk {
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
  }
}

declare module './gateway' {
  interface GatewayEvents {
    /** new user joined a guild */
    GUILD_MEMBER_ADD: GuildMember.Event.Add
    /** user was removed from a guild */
    GUILD_MEMBER_REMOVE: GuildMember.Event.Remove
    /** guild member was updated */
    GUILD_MEMBER_UPDATE: GuildMember.Event.Update
    /** response to Request Guild Members */
    GUILD_MEMBERS_CHUNK: GuildMember.Event.Chunk
  }
}

declare module './internal' {
  interface Internal {
    /**
     * Returns a guild member object for the specified user.
     * @see https://discord.com/developers/docs/resources/guild#get-guild-member
     */
    getGuildMember(guild_id: snowflake, user_id: snowflake): Promise<GuildMember>
    /**
     * Returns a list of guild member objects that are members of the guild.
     * @see https://discord.com/developers/docs/resources/guild#list-guild-members
     */
    listGuildMembers(guild_id: snowflake, params?: GuildMember.Params.List): Promise<GuildMember[]>
    /**
     * Returns a list of guild member objects whose username or nickname starts with a provided string.
     * @see https://discord.com/developers/docs/resources/guild#search-guild-members
     */
    searchGuildMembers(guild_id: snowflake, params?: GuildMember.Params.Search): Promise<GuildMember[]>
    /**
     * Adds a user to the guild, provided you have a valid oauth2 access token for the user with the guilds.join scope. Returns a 201 Created with the guild member as the body, or 204 No Content if the user is already a member of the guild. Fires a Guild Member Add Gateway event.
     * @see https://discord.com/developers/docs/resources/guild#add-guild-member
     */
    addGuildMember(guild_id: snowflake, user_id: snowflake, params: GuildMember.Params.Add): Promise<void>
    /**
     * Modify attributes of a guild member. Returns a 200 OK with the guild member as the body. Fires a Guild Member Update Gateway event. If the channel_id is set to null, this will force the target user to be disconnected from voice.
     * @see https://discord.com/developers/docs/resources/guild#modify-guild-member
     */
    modifyGuildMember(guild_id: snowflake, user_id: snowflake, params: GuildMember.Params.Modify): Promise<void>
    /**
     * Modifies the current member in a guild. Returns a 200 with the updated member object on success. Fires a Guild Member Update Gateway event.
     * @see https://discord.com/developers/docs/resources/guild#modify-current-member
     */
    modifyCurrentMember(guild_id: snowflake, params: GuildMember.Params.ModifyCurrent): Promise<void>
    /**
     * Adds a role to a guild member. Requires the MANAGE_ROLES permission. Returns a 204 empty response on success. Fires a Guild Member Update Gateway event.
     * @see https://discord.com/developers/docs/resources/guild#add-guild-member-role
     */
    addGuildMemberRole(guild_id: snowflake, user_id: snowflake, role_id: snowflake): Promise<void>
    /**
     * Removes a role from a guild member. Requires the MANAGE_ROLES permission. Returns a 204 empty response on success. Fires a Guild Member Update Gateway event.
     * @see https://discord.com/developers/docs/resources/guild#remove-guild-member-role
     */
    removeGuildMemberRole(guild_id: snowflake, user_id: snowflake, role_id: snowflake): Promise<void>
    /**
     * Remove a member from a guild. Requires KICK_MEMBERS permission. Returns a 204 empty response on success. Fires a Guild Member Remove Gateway event.
     * @see https://discord.com/developers/docs/resources/guild#remove-guild-member
     */
    removeGuildMember(guild_id: snowflake, user_id: snowflake): Promise<void>
    /**
     * Returns an object with one 'pruned' key indicating the number of members that would be removed in a prune operation. Requires the KICK_MEMBERS permission.
     * @see https://discord.com/developers/docs/resources/guild#get-guild-prune-count
     */
    getGuildPruneCount(guild_id: snowflake, params?: GuildMember.Params.GetPruneCount): Promise<void>
    /**
     * Begin a prune operation. Requires the KICK_MEMBERS permission. Returns an object with one 'pruned' key indicating the number of members that were removed in the prune operation. For large guilds it's recommended to set the compute_prune_count option to false, forcing 'pruned' to null. Fires multiple Guild Member Remove Gateway events.
     * @see https://discord.com/developers/docs/resources/guild#begin-guild-prune
     */
    beginGuildPrune(guild_id: snowflake, params: GuildMember.Params.BeginPrune): Promise<void>
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
  '/guilds/{guild.id}/members/{user.id}/roles/{role.id}': {
    PUT: 'addGuildMemberRole',
    DELETE: 'removeGuildMemberRole',
  },
  '/guilds/{guild.id}/prune': {
    GET: 'getGuildPruneCount',
    POST: 'beginGuildPrune',
  },
})
