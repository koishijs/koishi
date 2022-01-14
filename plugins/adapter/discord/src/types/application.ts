import { Guild, integer, Internal, snowflake, Team, User } from '.'

/** https://discord.com/developers/docs/resources/application#application-object-application-structure */
export interface Application {
  /** the id of the app */
  id: snowflake
  /** the name of the app */
  name: string
  /** the icon hash of the app */
  icon?: string
  /** the description of the app */
  description: string
  /** an array of rpc origin urls, if rpc is enabled */
  rpc_origins?: string[]
  /** when false only app owner can join the app's bot to guilds */
  bot_public: boolean
  /** when true the app's bot will only join upon completion of the full oauth2 code grant flow */
  bot_require_code_grant: boolean
  /** the url of the app's terms of service */
  terms_of_service_url?: string
  /** the url of the app's privacy policy */
  privacy_policy_url?: string
  /** partial user object containing info on the owner of the application */
  owner?: Partial<User>
  /** if this application is a game sold on Discord, this field will be the summary field for the store page of its primary sku */
  summary: string
  /** the hex encoded key for verification in interactions and the GameSDK's GetTicket */
  verify_key: string
  /** if the application belongs to a team, this will be a list of the members of that team */
  team?: Team
  /** if this application is a game sold on Discord, this field will be the guild to which it has been linked */
  guild_id?: snowflake
  /** if this application is a game sold on Discord, this field will be the id of the "Game SKU" that is created, if exists */
  primary_sku_id?: snowflake
  /** if this application is a game sold on Discord, this field will be the URL slug that links to the store page */
  slug?: string
  /** the application's default rich presence invite cover image hash */
  cover_image?: string
  /** the application's public flags */
  flags?: integer
}

/** https://discord.com/developers/docs/resources/application#application-object-application-flags */
export enum ApplicationFlag {
  GATEWAY_PRESENCE = 1 << 12,
  GATEWAY_PRESENCE_LIMITED = 1 << 13,
  GATEWAY_GUILD_MEMBERS = 1 << 14,
  GATEWAY_GUILD_MEMBERS_LIMITED = 1 << 15,
  VERIFICATION_PENDING_GUILD_LIMIT = 1 << 16,
  EMBEDDED = 1 << 17,
}

/** https://discord.com/developers/docs/topics/gateway#ready-ready-event-fields */
export interface ReadyEvent {
  /** gateway version */
  v: integer
  /** information about the user including email */
  user: User
  /** the guilds the user is in */
  guilds: Partial<Guild>[]
  /** used for resuming connections */
  session_id: string
  /** the shard information associated with this session, if sent when identifying */
  shard?: [shard_id: integer, num_shards: integer]
  /** contains id and flags */
  application: Partial<Application>
}

declare module './gateway' {
  interface GatewayEvents {
    /** contains the initial state information */
    READY: ReadyEvent
  }
}

declare module './internal' {
  interface Internal {
    /**
     * Returns the bot's application object.
     * @see https://discord.com/developers/docs/topics/oauth2#get-current-bot-application-information
     */
    getCurrentBotApplicationInformation(): Promise<Application>
    /**
     * Returns info about the current authorization. Requires authentication with a bearer token.
     * @see https://discord.com/developers/docs/topics/oauth2#get-current-authorization-information
     */
    getCurrentAuthorizationInformation(): Promise<any>
  }
}

Internal.define({
  '/oauth2/applications/@me': {
    GET: 'getCurrentBotApplicationInformation',
  },
  '/oauth2/@me': {
    GET: 'getCurrentAuthorizationInformation',
  },
})
