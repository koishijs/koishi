import { ChannelType, snowflake } from '.'

/** https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-structure */
export interface ApplicationCommand {
  /** unique id of the command */
  id: snowflake
  /** the type of command, defaults 1 if not set */
  type?: ApplicationCommandType
  /** unique id of the parent application */
  application_id: snowflake
  /** guild id of the command, if not global */
  guild_id?: snowflake
  /** 1-32 character name */
  name: string
  /** 1-100 character description for CHAT_INPUT commands, empty string for USER and MESSAGE commands */
  description: string
  /** the parameters for the command, max 25 */
  options?: ApplicationCommandOption[]
  /** whether the command is enabled by default when the app is added to a guild */
  default_permission?: boolean
  /** autoincrementing version identifier updated during substantial record changes */
  version: snowflake
}

/** https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-types */
export enum ApplicationCommandType {
  /** Slash commands; a text-based command that shows up when a user types / */
  CHAT_INPUT = 1,
  /** A UI-based command that shows up when you right click or tap on a user */
  USER = 2,
  /** A UI-based command that shows up when you right click or tap on a message */
  MESSAGE = 3,
}

/** https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-structure */
export interface ApplicationCommandOption {
  /** the type of option */
  type: ApplicationCommandOptionType
  /** 1-32 character name */
  name: string
  /** 1-100 character description */
  description: string
  /** if the parameter is required or optional--default false */
  required?: boolean
  /** choices for STRING, INTEGER, and NUMBER types for the user to pick from, max 25 */
  choices?: ApplicationCommandOptionChoice[]
  /** if the option is a subcommand or subcommand group type, this nested options will be the parameters */
  options?: ApplicationCommandOption[]
  /** if the option is a channel type, the channels shown will be restricted to these types */
  channel_types?: ChannelType[]
}

/** https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-type */
export enum ApplicationCommandOptionType {
  SUB_COMMAND = 1,
  SUB_COMMAND_GROUP = 2,
  STRING = 3,
  /** Any integer between -2^53 and 2^53 */
  INTEGER = 4,
  BOOLEAN = 5,
  USER = 6,
  /** Includes all channel types + categories */
  CHANNEL = 7,
  ROLE = 8,
  /** Includes users and roles */
  MENTIONABLE = 9,
  /** Any double between -2^53 and 2^53 */
  NUMBER = 10,
}

/** https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-choice-structure */
export interface ApplicationCommandOptionChoice {
  /** 1-100 character choice name */
  name: string
  /** value of the choice, up to 100 characters if string */
  value: string | number
}

/** https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-interaction-data-option-structure */
export interface ApplicationCommandInteractionDataOption {
  /** the name of the parameter */
  name: string
  /** value of application command option type */
  type: ApplicationCommandOptionType
  /** the value of the pair */
  value?: ApplicationCommandOptionType
  /** present if this option is a group or subcommand */
  options?: ApplicationCommandInteractionDataOption[]
}

/** https://discord.com/developers/docs/interactions/application-commands#application-command-permissions-object-guild-application-command-permissions-structure */
export interface GuildApplicationCommandPermissions {
  /** the id of the command */
  id: snowflake
  /** the id of the application the command belongs to */
  application_id: snowflake
  /** the id of the guild */
  guild_id: snowflake
  /** the permissions for the command in the guild */
  permissions: ApplicationCommandPermissions[]
}

/** https://discord.com/developers/docs/interactions/application-commands#application-command-permissions-object-application-command-permissions-structure */
export interface ApplicationCommandPermissions {
  /** the id of the role or user */
  id: snowflake
  /** role or user */
  type: ApplicationCommandPermissionType
  /** true to allow, false, to disallow */
  permission: boolean
}

/** https://discord.com/developers/docs/interactions/application-commands#application-command-permissions-object-application-command-permission-type */
export enum ApplicationCommandPermissionType {
  ROLE = 1,
  USER = 2,
}

declare module '.' {
  interface Internal {
    getGlobalApplicationCommands(application_id: snowflake): Promise<ApplicationCommand[]>
    createGlobalApplicationCommand(application_id: snowflake, command: Partial<ApplicationCommand>): Promise<ApplicationCommand>
    bulkOverwriteGlobalApplicationCommands(application_id: snowflake): Promise<ApplicationCommand[]>
    getGlobalApplicationCommand(application_id: snowflake, command_id: snowflake): Promise<ApplicationCommand>
    editGlobalApplicationCommand(application_id: snowflake, command_id: snowflake, command: Partial<ApplicationCommand>): Promise<ApplicationCommand>
    deleteGlobalApplicationCommand(application_id: snowflake, command_id: snowflake): Promise<void>
    getGuildApplicationCommands(application_id: snowflake, guild_id: snowflake): Promise<ApplicationCommand[]>
    createGuildApplicationCommand(application_id: snowflake, guild_id: snowflake, command: Partial<ApplicationCommand>): Promise<ApplicationCommand>
    bulkOverwriteGuildApplicationCommands(application_id: snowflake, guild_id: snowflake): Promise<void>
    getGuildApplicationCommandPermissions(application_id: snowflake, guild_id: snowflake): Promise<GuildApplicationCommandPermissions[]>
    batchEditApplicationCommandPermissions(application_id: snowflake, guild_id: snowflake, permissions: Partial<GuildApplicationCommandPermissions>[]): Promise<void>
    getGuildApplicationCommand(application_id: snowflake, guild_id: snowflake, command_id: snowflake): Promise<ApplicationCommand>
    editGuildApplicationCommand(application_id: snowflake, guild_id: snowflake, command_id: snowflake, command: Partial<ApplicationCommand>): Promise<ApplicationCommand>
    deleteGuildApplicationCommand(application_id: snowflake, guild_id: snowflake, command_id: snowflake): Promise<void>
    getApplicationCommandPermissions(application_id: snowflake, guild_id: snowflake, command_id: snowflake): Promise<GuildApplicationCommandPermissions>
    editApplicationCommandPermissions(application_id: snowflake, guild_id: snowflake, command_id: snowflake, permissions: ApplicationCommandPermissions[]): Promise<GuildApplicationCommandPermissions>
  }
}
