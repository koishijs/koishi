import { integer, Internal, snowflake } from '.'

/** https://discord.com/developers/docs/topics/permissions#permissions-bitwise-permission-flags */
export enum Permission {
  /** Allows creation of instant invites */
  CREATE_INSTANT_INVITE = 1 << 0,
  /** Allows kicking members */
  KICK_MEMBERS = 1 << 1,
  /** Allows banning members */
  BAN_MEMBERS = 1 << 2,
  /** Allows all permissions and bypasses channel permission overwrites */
  ADMINISTRATOR = 1 << 3,
  /** Allows management and editing of channels */
  MANAGE_CHANNELS = 1 << 4,
  /** Allows management and editing of the guild */
  MANAGE_GUILD = 1 << 5,
  /** Allows for the addition of reactions to messages */
  ADD_REACTIONS = 1 << 6,
  /** Allows for viewing of audit logs */
  VIEW_AUDIT_LOG = 1 << 7,
  /** Allows for using priority speaker in a voice channel */
  PRIORITY_SPEAKER = 1 << 8,
  /** Allows the user to go live */
  STREAM = 1 << 9,
  /** Allows guild members to view a channel, which includes reading messages in text channels */
  VIEW_CHANNEL = 1 << 10,
  /** Allows for sending messages in a channel (does not allow sending messages in threads) */
  SEND_MESSAGES = 1 << 11,
  /** Allows for sending of /tts messages */
  SEND_TTS_MESSAGES = 1 << 12,
  /** Allows for deletion of other users messages */
  MANAGE_MESSAGES = 1 << 13,
  /** Links sent by users with this permission will be auto-embedded */
  EMBED_LINKS = 1 << 14,
  /** Allows for uploading images and files */
  ATTACH_FILES = 1 << 15,
  /** Allows for reading of message history */
  READ_MESSAGE_HISTORY = 1 << 16,
  /** Allows for using the @everyone tag to notify all users in a channel, and the @here tag to notify all online users in a channel */
  MENTION_EVERYONE = 1 << 17,
  /** Allows the usage of custom emojis from other servers */
  USE_EXTERNAL_EMOJIS = 1 << 18,
  /** Allows for viewing guild insights */
  VIEW_GUILD_INSIGHTS = 1 << 19,
  /** Allows for joining of a voice channel */
  CONNECT = 1 << 20,
  /** Allows for speaking in a voice channel */
  SPEAK = 1 << 21,
  /** Allows for muting members in a voice channel */
  MUTE_MEMBERS = 1 << 22,
  /** Allows for deafening of members in a voice channel */
  DEAFEN_MEMBERS = 1 << 23,
  /** Allows for moving of members between voice channels */
  MOVE_MEMBERS = 1 << 24,
  /** Allows for using voice-activity-detection in a voice channel */
  USE_VAD = 1 << 25,
  /** Allows for modification of own nickname */
  CHANGE_NICKNAME = 1 << 26,
  /** Allows for modification of other users nicknames */
  MANAGE_NICKNAMES = 1 << 27,
  /** Allows management and editing of roles */
  MANAGE_ROLES = 1 << 28,
  /** Allows management and editing of webhooks */
  MANAGE_WEBHOOKS = 1 << 29,
  /** Allows management and editing of emojis and stickers */
  MANAGE_EMOJIS_AND_STICKERS = 1 << 30,
  /** Allows members to use application commands, including slash commands and context menu commands. */
  USE_APPLICATION_COMMANDS = 1 << 31,
  /** Allows for requesting to speak in stage channels. (This permission is under active development and may be changed or removed.) */
  REQUEST_TO_SPEAK = 1 << 32,
  /** Allows for deleting and archiving threads, and viewing all private threads */
  MANAGE_THREADS = 1 << 34,
  /** Allows for creating threads */
  CREATE_PUBLIC_THREADS = 1 << 35,
  /** Allows for creating private threads */
  CREATE_PRIVATE_THREADS = 1 << 36,
  /** Allows the usage of custom stickers from other servers */
  USE_EXTERNAL_STICKERS = 1 << 37,
  /** Allows for sending messages in threads */
  SEND_MESSAGES_IN_THREADS = 1 << 38,
  /** Allows for launching activities (applications with the EMBEDDED flag) in a voice channel */
  START_EMBEDDED_ACTIVITIES = 1 << 39,
}

/** https://discord.com/developers/docs/topics/permissions#role-object-role-structure */
export interface Role {
  /** role id */
  id: snowflake
  /** role name */
  name: string
  /** integer representation of hexadecimal color code */
  color: integer
  /** if this role is pinned in the user listing */
  hoist: boolean
  /** role icon hash */
  icon?: string
  /** role unicode emoji */
  unicode_emoji?: string
  /** position of this role */
  position: integer
  /** permission bit set */
  permissions: string
  /** whether this role is managed by an integration */
  managed: boolean
  /** whether this role is mentionable */
  mentionable: boolean
  /** the tags this role has */
  tags?: RoleTags
}

export namespace Role {
  export namespace Params {
    /** https://discord.com/developers/docs/resources/guild#create-guild-role-json-params */
    export interface Create {
      /** name of the role */
      name: string
      /** bitwise value of the enabled/disabled permissions */
      permissions: string
      /** RGB color value */
      color: integer
      /** whether the role should be displayed separately in the sidebar */
      hoist: boolean
      /** the role's icon image (if the guild has the ROLE_ICONS feature) */
      icon: string
      /** the role's unicode emoji as a standard emoji (if the guild has the ROLE_ICONS feature) */
      unicode_emoji: string
      /** whether the role should be mentionable */
      mentionable: boolean
    }

    /** https://discord.com/developers/docs/resources/guild#modify-guild-role-positions-json-params */
    export interface ModifyPositions {
      /** role */
      id: snowflake
      /** sorting position of the role */
      position?: integer
    }

    /** https://discord.com/developers/docs/resources/guild#modify-guild-role-json-params */
    export interface Modify {
      /** name of the role */
      name: string
      /** bitwise value of the enabled/disabled permissions */
      permissions: string
      /** RGB color value */
      color: integer
      /** whether the role should be displayed separately in the sidebar */
      hoist: boolean
      /** the role's icon image (if the guild has the ROLE_ICONS feature) */
      icon: string
      /** the role's unicode emoji as a standard emoji (if the guild has the ROLE_ICONS feature) */
      unicode_emoji: string
      /** whether the role should be mentionable */
      mentionable: boolean
    }
  }
}

/** https://discord.com/developers/docs/topics/permissions#role-object-role-tags-structure */
export interface RoleTags {
  /** the id of the bot this role belongs to */
  bot_id?: snowflake
  /** the id of the integration this role belongs to */
  integration_id?: snowflake
  /** whether this is the guild's premium subscriber role */
  premium_subscriber?: null
}

/** https://discord.com/developers/docs/topics/gateway#guild-role-create-guild-role-create-event-fields */
export interface GuildRoleCreateEvent {
  /** the id of the guild */
  guild_id: snowflake
  /** the role created */
  role: Role
}

/** https://discord.com/developers/docs/topics/gateway#guild-role-update-guild-role-update-event-fields */
export interface GuildRoleUpdateEvent {
  /** the id of the guild */
  guild_id: snowflake
  /** the role updated */
  role: Role
}

/** https://discord.com/developers/docs/topics/gateway#guild-role-delete-guild-role-delete-event-fields */
export interface GuildRoleDeleteEvent {
  /** id of the guild */
  guild_id: snowflake
  /** id of the role */
  role_id: snowflake
}

declare module './gateway' {
  interface GatewayEvents {
    /** guild role was created */
    GUILD_ROLE_CREATE: GuildRoleCreateEvent
    /** guild role was updated */
    GUILD_ROLE_UPDATE: GuildRoleUpdateEvent
    /** guild role was deleted */
    GUILD_ROLE_DELETE: GuildRoleDeleteEvent
  }
}

declare module './internal' {
  interface Internal {
    /**
     * Returns a list of role objects for the guild.
     * @see https://discord.com/developers/docs/resources/guild#get-guild-roles
     */
    getGuildRoles(guild_id: snowflake): Promise<Role[]>
    /**
     * Create a new role for the guild. Requires the MANAGE_ROLES permission. Returns the new role object on success. Fires a Guild Role Create Gateway event. All JSON params are optional.
     * @see https://discord.com/developers/docs/resources/guild#create-guild-role
     */
    createGuildRole(guild_id: snowflake, param: Role.Params.Create): Promise<Role>
    /**
     * Modify the positions of a set of role objects for the guild. Requires the MANAGE_ROLES permission. Returns a list of all of the guild's role objects on success. Fires multiple Guild Role Update Gateway events.
     * @see https://discord.com/developers/docs/resources/guild#modify-guild-role-positions
     */
    modifyGuildRolePositions(guild_id: snowflake, param: Role.Params.ModifyPositions): Promise<Role[]>
    /**
     * Modify a guild role. Requires the MANAGE_ROLES permission. Returns the updated role on success. Fires a Guild Role Update Gateway event.
     * @see https://discord.com/developers/docs/resources/guild#modify-guild-role
     */
    modifyGuildRole(guild_id: snowflake, role_id: snowflake, param: Role.Params.Modify): Promise<Role>
    /**
     * Delete a guild role. Requires the MANAGE_ROLES permission. Returns a 204 empty response on success. Fires a Guild Role Delete Gateway event.
     * @see https://discord.com/developers/docs/resources/guild#delete-guild-role
     */
    deleteGuildRole(guild_id: snowflake, role_id: snowflake): Promise<void>
  }
}

Internal.define({
  '/guilds/{guild.id}/roles': {
    GET: 'getGuildRoles',
    POST: 'createGuildRole',
    PATCH: 'modifyGuildRolePositions',
  },
  '/guilds/{guild.id}/roles/{role.id}': {
    PATCH: 'modifyGuildRole',
    DELETE: 'deleteGuildRole',
  },
})
