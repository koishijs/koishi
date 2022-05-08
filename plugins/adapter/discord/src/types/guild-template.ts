import { Guild, integer, Internal, snowflake, timestamp, User } from '.'

/** https://discord.com/developers/docs/resources/guild-template#guild-template-object-guild-template-structure */
export interface GuildTemplate {
  /** the template code (unique ID) */
  code: string
  /** template name */
  name: string
  /** the description for the template */
  description?: string
  /** number of times this template has been used */
  usage_count: integer
  /** the ID of the user who created the template */
  creator_id: snowflake
  /** the user who created the template */
  creator: User
  /** when this template was created */
  created_at: timestamp
  /** when this template was last synced to the source guild */
  updated_at: timestamp
  /** the ID of the guild this template is based on */
  source_guild_id: snowflake
  /** the guild snapshot this template contains */
  serialized_source_guild: Partial<Guild>
  /** whether the template has unsynced changes */
  is_dirty?: boolean
}

export namespace GuildTemplate {
  /** https://discord.com/developers/docs/resources/guild-template#create-guild-from-guild-template-json-params */
  export interface CreateGuildParams {
    /** name of the guild (2-100 characters) */
    name: string
    /** base64 128x128 image for the guild icon */
    icon?: string
  }

  /** https://discord.com/developers/docs/resources/guild-template#create-guild-template-json-params */
  export interface CreateParams {
    /** name of the template (1-100 characters) */
    name: string
    /** description for the template (0-120 characters) */
    description?: string
  }

  /** https://discord.com/developers/docs/resources/guild-template#modify-guild-template-json-params */
  export interface ModifyParams {
    /** name of the template (1-100 characters) */
    name?: string
    /** description for the template (0-120 characters) */
    description?: string
  }
}

declare module './internal' {
  interface Internal {
    /**
     * Returns a guild template object for the given code.
     * @see https://discord.com/developers/docs/resources/guild-template#get-guild-template
     */
    getGuildTemplate(code: string): Promise<GuildTemplate>
    /**
     * Create a new guild based on a template. Returns a guild object on success. Fires a Guild Create Gateway event.
     * @see https://discord.com/developers/docs/resources/guild-template#create-guild-from-guild-template
     */
    createGuildfromGuildTemplate(code: string, params: GuildTemplate.CreateGuildParams): Promise<Guild>
    /**
     * Returns an array of guild template objects. Requires the MANAGE_GUILD permission.
     * @see https://discord.com/developers/docs/resources/guild-template#get-guild-templates
     */
    getGuildTemplates(guild_id: snowflake): Promise<GuildTemplate[]>
    /**
     * Creates a template for the guild. Requires the MANAGE_GUILD permission. Returns the created guild template object on success.
     * @see https://discord.com/developers/docs/resources/guild-template#create-guild-template
     */
    createGuildTemplate(guild_id: snowflake, params: GuildTemplate.CreateParams): Promise<GuildTemplate>
    /**
     * Syncs the template to the guild's current state. Requires the MANAGE_GUILD permission. Returns the guild template object on success.
     * @see https://discord.com/developers/docs/resources/guild-template#sync-guild-template
     */
    syncGuildTemplate(guild_id: snowflake, code: string): Promise<GuildTemplate>
    /**
     * Modifies the template's metadata. Requires the MANAGE_GUILD permission. Returns the guild template object on success.
     * @see https://discord.com/developers/docs/resources/guild-template#modify-guild-template
     */
    modifyGuildTemplate(guild_id: snowflake, code: string, params: GuildTemplate.ModifyParams): Promise<GuildTemplate>
    /**
     * Deletes the template. Requires the MANAGE_GUILD permission. Returns the deleted guild template object on success.
     * @see https://discord.com/developers/docs/resources/guild-template#delete-guild-template
     */
    deleteGuildTemplate(guild_id: snowflake, code: string): Promise<GuildTemplate>
  }
}

Internal.define({
  '/guilds/templates/{template.code}': {
    GET: 'getGuildTemplate',
    POST: 'createGuildfromGuildTemplate',
  },
  '/guilds/{guild.id}/templates': {
    GET: 'getGuildTemplates',
    POST: 'createGuildTemplate',
  },
  '/guilds/{guild.id}/templates/{template.code}': {
    PUT: 'syncGuildTemplate',
    PATCH: 'modifyGuildTemplate',
    DELETE: 'deleteGuildTemplate',
  },
})
