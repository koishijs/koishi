import { Activity, integer, Internal, snowflake, StatusType } from '.'

/** https://discord.com/developers/docs/topics/gateway#payloads-gateway-payload-structure */
export interface GatewayPayloadStructure<O extends GatewayOpcode, T extends keyof GatewayEvents, D> {
  /** opcode for the payload */
  op: O
  /** event data */
  d?: D
  /** the event name for this payload */
  t?: T
  /** sequence number, used for resuming sessions and heartbeats */
  s?: number
}

export type GatewayPayload = {
  [O in GatewayOpcode]: O extends GatewayOpcode.DISPATCH
    ? {
      [T in keyof GatewayEvents]: GatewayPayloadStructure<GatewayOpcode.DISPATCH, T, GatewayEvents[T]>
    }[keyof GatewayEvents]
    : GatewayPayloadStructure<O, never, O extends keyof GatewayParams ? GatewayParams[O] : never>
}[GatewayOpcode]

/** https://discord.com/developers/docs/topics/opcodes-and-status-codes#gateway-gateway-opcodes */
export enum GatewayOpcode {
  /** An event was dispatched. */
  DISPATCH = 0,
  /** Fired periodically by the client to keep the connection alive. */
  HEARTBEAT = 1,
  /** Starts a new session during the initial handshake. */
  IDENTIFY = 2,
  /** Update the client's presence. */
  PRESENCE_UPDATE = 3,
  /** Used to join/leave or move between voice channels. */
  VOICE_STATE_UPDATE = 4,
  /** Resume a previous session that was disconnected. */
  RESUME = 6,
  /** You should attempt to reconnect and resume immediately. */
  RECONNECT = 7,
  /** Request information about offline guild members in a large guild. */
  REQUEST_GUILD_MEMBERS = 8,
  /** The session has been invalidated. You should reconnect and identify/resume accordingly. */
  INVALID_SESSION = 9,
  /** Sent immediately after connecting, contains the `heartbeat_interval` to use. */
  HELLO = 10,
  /** Sent in response to receiving a heartbeat to acknowledge that it has been received. */
  HEARTBEAT_ACK = 11,
}

/** https://discord.com/developers/docs/topics/gateway#gateway-intents */
export enum GatewayIntent {
  /**
   * - GUILD_CREATE
   * - GUILD_UPDATE
   * - GUILD_DELETE
   * - GUILD_ROLE_CREATE
   * - GUILD_ROLE_UPDATE
   * - GUILD_ROLE_DELETE
   * - CHANNEL_CREATE
   * - CHANNEL_UPDATE
   * - CHANNEL_DELETE
   * - CHANNEL_PINS_UPDATE
   * - THREAD_CREATE
   * - THREAD_UPDATE
   * - THREAD_DELETE
   * - THREAD_LIST_SYNC
   * - THREAD_MEMBER_UPDATE
   * - THREAD_MEMBERS_UPDATE
   * - STAGE_INSTANCE_CREATE
   * - STAGE_INSTANCE_UPDATE
   * - STAGE_INSTANCE_DELETE
   */
  GUILDS = 1 << 0,
  /**
   * - GUILD_MEMBER_ADD
   * - GUILD_MEMBER_UPDATE
   * - GUILD_MEMBER_REMOVE
   * - THREAD_MEMBERS_UPDATE
   */
  GUILD_MEMBERS = 1 << 1,
  /**
   * - GUILD_BAN_ADD
   * - GUILD_BAN_REMOVE
   */
  GUILD_BANS = 1 << 2,
  /**
   * - GUILD_EMOJIS_UPDATE
   * - GUILD_STICKERS_UPDATE
   */
  GUILD_EMOJIS_AND_STICKERS = 1 << 3,
  /**
   * - GUILD_INTEGRATIONS_UPDATE
   * - INTEGRATION_CREATE
   * - INTEGRATION_UPDATE
   * - INTEGRATION_DELETE
   */
  GUILD_INTEGRATIONS = 1 << 4,
  /**
   * - WEBHOOKS_UPDATE
   */
  GUILD_WEBHOOKS = 1 << 5,
  /**
   * - INVITE_CREATE
   * - INVITE_DELETE
   */
  GUILD_INVITES = 1 << 6,
  /**
   * - VOICE_STATE_UPDATE
   */
  GUILD_VOICE_STATES = 1 << 7,
  /**
   * - PRESENCE_UPDATE
   */
  GUILD_PRESENCES = 1 << 8,
  /**
   * - MESSAGE_CREATE
   * - MESSAGE_UPDATE
   * - MESSAGE_DELETE
   * - MESSAGE_DELETE_BULK
   */
  GUILD_MESSAGES = 1 << 9,
  /**
   * - MESSAGE_REACTION_ADD
   * - MESSAGE_REACTION_REMOVE
   * - MESSAGE_REACTION_REMOVE_ALL
   * - MESSAGE_REACTION_REMOVE_EMOJI
   */
  GUILD_MESSAGE_REACTIONS = 1 << 10,
  /**
   * - TYPING_START
   */
  GUILD_MESSAGE_TYPING = 1 << 11,
  /**
   * - MESSAGE_CREATE
   * - MESSAGE_UPDATE
   * - MESSAGE_DELETE
   * - CHANNEL_PINS_UPDATE
   */
  DIRECT_MESSAGES = 1 << 12,
  /**
   * - MESSAGE_REACTION_ADD
   * - MESSAGE_REACTION_REMOVE
   * - MESSAGE_REACTION_REMOVE_ALL
   * - MESSAGE_REACTION_REMOVE_EMOJI
   */
  DIRECT_MESSAGE_REACTIONS = 1 << 13,
  /**
   * - TYPING_START
   */
  DIRECT_MESSAGE_TYPING = 1 << 14,
}

export interface GatewayParams {
  [GatewayOpcode.HELLO]: HelloParams
  [GatewayOpcode.IDENTIFY]: IdentifyParams
  [GatewayOpcode.RESUME]: ResumeParams
  [GatewayOpcode.REQUEST_GUILD_MEMBERS]: RequestGuildMembersParams
  [GatewayOpcode.VOICE_STATE_UPDATE]: VoiceStateUpdateParams
  [GatewayOpcode.PRESENCE_UPDATE]: PresenceUpdateParams
}

/** https://discord.com/developers/docs/topics/gateway#commands-and-events-gateway-events */
export interface GatewayEvents {}

/** https://discord.com/developers/docs/topics/gateway#identify-identify-structure */
export interface IdentifyParams {
  /** authentication token */
  token: string
  /** connection properties */
  properties: object
  /** whether this connection supports compression of packets */
  compress?: boolean
  /** value between 50 and 250, total number of members where the gateway will stop sending offline members in the guild member list */
  large_threshold?: integer
  /** used for Guild Sharding */
  shard?: [shard_id: integer, num_shards: integer]
  /** presence structure for initial presence information */
  presence?: PresenceUpdateParams
  /** the Gateway Intents you wish to receive */
  intents: integer
}

/** https://discord.com/developers/docs/topics/gateway#resume-resume-structure */
export interface ResumeParams {
  /** session token */
  token: string
  /** session id */
  session_id: string
  /** last sequence number received */
  seq: integer
}

/** https://discord.com/developers/docs/topics/gateway#request-guild-members-guild-request-members-structure */
export interface RequestGuildMembersParams {
  /** id of the guild to get members for */
  guild_id: snowflake
  /** string that username starts with, or an empty string to return all members */
  query?: string
  /** maximum number of members to send matching the query; a limit of 0 can be used with an empty string query to return all members */
  limit: integer
  /** used to specify if we want the presences of the matched members */
  presences?: boolean
  /** used to specify which users you wish to fetch */
  user_ids?: snowflake | snowflake[]
  /** nonce to identify the Guild Members Chunk response */
  nonce?: string
}

/** https://discord.com/developers/docs/topics/gateway#update-voice-state-gateway-voice-state-update-structure */
export interface VoiceStateUpdateParams {
  /** id of the guild */
  guild_id: snowflake
  /** id of the voice channel client wants to join (null if disconnecting) */
  channel_id?: snowflake
  /** is the client muted */
  self_mute: boolean
  /** is the client deafened */
  self_deaf: boolean
}

/** https://discord.com/developers/docs/topics/gateway#update-presence-gateway-presence-update-structure */
export interface PresenceUpdateParams {
  /** unix time (in milliseconds) of when the client went idle, or null if the client is not idle */
  since?: integer
  /** the user's activities */
  activities: Activity[]
  /** the user's new status */
  status: StatusType
  /** whether or not the client is afk */
  afk: boolean
}

/** https://discord.com/developers/docs/topics/gateway#hello-hello-structure */
export interface HelloParams {
  /** the interval (in milliseconds) the client should heartbeat with */
  heartbeat_interval: integer
}

/** https://discord.com/developers/docs/topics/gateway#session-start-limit-object-session-start-limit-structure */
export interface SessionStartLimit {
  /** The total number of session starts the current user is allowed */
  total: integer
  /** The remaining number of session starts the current user is allowed */
  remaining: integer
  /** The number of milliseconds after which the limit resets */
  reset_after: integer
  /** The number of identify requests allowed per 5 seconds */
  max_concurrency: integer
}

declare module './internal' {
  interface Internal {
    /**
     * Returns an object with a single valid WSS URL, which the client can use for Connecting. Clients should cache this value and only call this endpoint to retrieve a new URL if they are unable to properly establish a connection using the cached version of the URL.
     * @see https://discord.com/developers/docs/topics/gateway#get-gateway
     */
    getGateway(): Promise<any>
    /**
     * Returns an object based on the information in Get Gateway, plus additional metadata that can help during the operation of large or sharded bots. Unlike the Get Gateway, this route should not be cached for extended periods of time as the value is not guaranteed to be the same per-call, and changes as the bot joins/leaves guilds.
     * @see https://discord.com/developers/docs/topics/gateway#get-gateway-bot
     */
    getGatewayBot(): Promise<any>
  }
}

Internal.define({
  '/gateway': {
    GET: 'getGateway',
  },
  '/gateway/bot': {
    GET: 'getGatewayBot',
  },
})
