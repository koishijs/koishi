import { integer, Internal, snowflake, User } from '.'

/** https://discord.com/developers/docs/resources/guild#ban-object-ban-structure */
export interface Ban {
  /** the reason for the ban */
  reason?: string
  /** the banned user */
  user: User
}

export namespace Ban {
  export namespace Event {
    /** https://discord.com/developers/docs/topics/gateway#guild-ban-add-guild-ban-add-event-fields */
    export interface Add {
      /** id of the guild */
      guild_id: snowflake
      /** the banned user */
      user: User
    }

    /** https://discord.com/developers/docs/topics/gateway#guild-ban-remove-guild-ban-remove-event-fields */
    export interface Remove {
      /** id of the guild */
      guild_id: snowflake
      /** the unbanned user */
      user: User
    }
  }

  export namespace Params {
    /** https://discord.com/developers/docs/resources/guild#create-guild-ban-json-params */
    export interface Create {
      /** number of days to delete messages for (0-7) */
      delete_message_days?: integer
      /** reason for the ban (deprecated) */
      reason?: string
    }
  }
}

declare module './gateway' {
  interface GatewayEvents {
    /** user was banned from a guild */
    GUILD_BAN_ADD: Ban.Event.Add
    /** user was unbanned from a guild */
    GUILD_BAN_REMOVE: Ban.Event.Remove
  }
}

declare module './internal' {
  interface Internal {
    /**
     * Returns a list of ban objects for the users banned from this guild. Requires the BAN_MEMBERS permission.
     * @see https://discord.com/developers/docs/resources/guild#get-guild-bans
     */
    getGuildBans(guild_id: snowflake): Promise<Ban[]>
    /**
     * Returns a ban object for the given user or a 404 not found if the ban cannot be found. Requires the BAN_MEMBERS permission.
     * @see https://discord.com/developers/docs/resources/guild#get-guild-ban
     */
    getGuildBan(guild_id: snowflake, user_id: snowflake): Promise<Ban>
    /**
     * Create a guild ban, and optionally delete previous messages sent by the banned user. Requires the BAN_MEMBERS permission. Returns a 204 empty response on success. Fires a Guild Ban Add Gateway event.
     * @see https://discord.com/developers/docs/resources/guild#create-guild-ban
     */
    createGuildBan(guild_id: snowflake, user_id: snowflake, params: Ban.Params.Create): Promise<void>
    /**
     * Remove the ban for a user. Requires the BAN_MEMBERS permissions. Returns a 204 empty response on success. Fires a Guild Ban Remove Gateway event.
     * @see https://discord.com/developers/docs/resources/guild#remove-guild-ban
     */
    removeGuildBan(guild_id: snowflake, user_id: snowflake): Promise<void>
  }
}

Internal.define({
  '/guilds/{guild.id}/bans': {
    GET: 'getGuildBans',
  },
  '/guilds/{guild.id}/bans/{user.id}': {
    GET: 'getGuildBan',
    PUT: 'createGuildBan',
    DELETE: 'removeGuildBan',
  },
})
