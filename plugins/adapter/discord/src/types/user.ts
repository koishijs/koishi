import { integer, Integration, snowflake } from '.'

/** https://discord.com/developers/docs/resources/user#user-object-user-structure */
export interface User {
  /** the user's id */
  id: snowflake
  /** the user's username, not unique across the platform */
  username: string
  /** the user's 4-digit discord-tag */
  discriminator: string
  /** the user's avatar hash */
  avatar?: string
  /** whether the user belongs to an OAuth2 application */
  bot?: boolean
  /** whether the user is an Official Discord System user (part of the urgent message system) */
  system?: boolean
  /** whether the user has two factor enabled on their account */
  mfa_enabled?: boolean
  /** the user's banner hash */
  banner?: string
  /** the user's banner color encoded as an integer representation of hexadecimal color code */
  accent_color?: integer
  /** the user's chosen language option */
  locale?: string
  /** whether the email on this account has been verified */
  verified?: boolean
  /** the user's email */
  email?: string
  /** the flags on a user's account */
  flags?: integer
  /** the type of Nitro subscription on a user's account */
  premium_type?: integer
  /** the public flags on a user's account */
  public_flags?: integer
}

/** https://discord.com/developers/docs/resources/user#user-object-user-flags */
export enum UserFlag {
  NONE = 0,
  DISCORD_EMPLOYEE = 1 << 0,
  PARTNERED_SERVER_OWNER = 1 << 1,
  HYPESQUAD_EVENTS = 1 << 2,
  BUG_HUNTER_LEVEL_1 = 1 << 3,
  HOUSE_BRAVERY = 1 << 6,
  HOUSE_BRILLIANCE = 1 << 7,
  HOUSE_BALANCE = 1 << 8,
  EARLY_SUPPORTER = 1 << 9,
  TEAM_USER = 1 << 10,
  BUG_HUNTER_LEVEL_2 = 1 << 14,
  VERIFIED_BOT = 1 << 16,
  EARLY_VERIFIED_BOT_DEVELOPER = 1 << 17,
  DISCORD_CERTIFIED_MODERATOR = 1 << 18,
}

/** https://discord.com/developers/docs/resources/user#connection-object-connection-structure */
export interface Connection {
  /** id of the connection account */
  id: string
  /** the username of the connection account */
  name: string
  /** the service of the connection (twitch, youtube) */
  type: string
  /** whether the connection is revoked */
  revoked?: boolean
  /** an array of partial server integrations */
  integrations?: Partial<Integration>[]
  /** whether the connection is verified */
  verified: boolean
  /** whether friend sync is enabled for this connection */
  friend_sync: boolean
  /** whether activities related to this connection will be shown in presence updates */
  show_activity: boolean
  /** visibility of this connection */
  visibility: integer
}

/** https://discord.com/developers/docs/resources/user#connection-object-visibility-types */
export enum VisibilityType {
  /** invisible to everyone except the user themselves */
  NONE = 0,
  /** visible to everyone */
  EVERYONE = 1,
}

export interface UserUpdateEvent extends User {}

declare module './gateway' {
  interface GatewayEvents {
    /** properties about the user changed */
    USER_UPDATE: UserUpdateEvent
  }
}
