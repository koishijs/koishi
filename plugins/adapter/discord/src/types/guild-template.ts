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
