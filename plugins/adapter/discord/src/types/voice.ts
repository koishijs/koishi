import { GuildMember, snowflake, timestamp } from '.'

/** https://discord.com/developers/docs/resources/voice#voice-state-object-voice-state-structure */
export interface VoiceState {
  /** the guild id this voice state is for */
  guild_id?: snowflake
  /** the channel id this user is connected to */
  channel_id?: snowflake
  /** the user id this voice state is for */
  user_id: snowflake
  /** the guild member this voice state is for */
  member?: GuildMember
  /** the session id for this voice state */
  session_id: string
  /** whether this user is deafened by the server */
  deaf: boolean
  /** whether this user is muted by the server */
  mute: boolean
  /** whether this user is locally deafened */
  self_deaf: boolean
  /** whether this user is locally muted */
  self_mute: boolean
  /** whether this user is streaming using "Go Live" */
  self_stream?: boolean
  /** whether this user's camera is enabled */
  self_video: boolean
  /** whether this user is muted by the current user */
  suppress: boolean
  /** the time at which the user requested to speak */
  request_to_speak_timestamp?: timestamp
}

/** https://discord.com/developers/docs/resources/voice#voice-region-object-voice-region-structure */
export interface VoiceRegion {
  /** unique ID for the region */
  id: string
  /** name of the region */
  name: string
  /** true for a single server that is closest to the current user's client */
  optimal: boolean
  /** whether this is a deprecated voice region (avoid switching to these) */
  deprecated: boolean
  /** whether this is a custom voice region (used for events/etc) */
  custom: boolean
}

export interface VoiceStateUpdateEvent extends VoiceState {}

/** https://discord.com/developers/docs/topics/gateway#voice-server-update-voice-server-update-event-fields */
export interface VoiceServerUpdateEvent {
  /** voice connection token */
  token: string
  /** the guild this voice server update is for */
  guild_id: snowflake
  /** the voice server host */
  endpoint?: string
}

declare module './gateway' {
  interface GatewayEvents {
    /** someone joined, left, or moved a voice channel */
    VOICE_STATE_UPDATE: VoiceStateUpdateEvent
    /** guild's voice server was updated */
    VOICE_SERVER_UPDATE: VoiceServerUpdateEvent
  }
}
