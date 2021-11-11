import { Emoji, integer, snowflake, User } from '.'

/** https://discord.com/developers/docs/topics/gateway#presence-update-presence-update-event-fields */
export interface PresenceUpdateEvent {
  /** the user presence is being updated for */
  user: User
  /** id of the guild */
  guild_id: snowflake
  /** either "idle", "dnd", "online", or "offline" */
  status: StatusType
  /** user's current activities */
  activities: Activity[]
  /** user's platform-dependent status */
  client_status: ClientStatus
}

/** https://discord.com/developers/docs/topics/gateway#update-presence-status-types */
export enum StatusType {
  /** Online */
  ONLINE = 'ONLINE',
  /** Do Not Disturb */
  DND = 'DND',
  /** AFK */
  IDLE = 'IDLE',
  /** Invisible and shown as offline */
  INVISIBLE = 'INVISIBLE',
  /** Offline */
  OFFLINE = 'OFFLINE',
}

/** https://discord.com/developers/docs/topics/gateway#client-status-object */
export interface ClientStatus {
  /** the user's status set for an active desktop (Windows, Linux, Mac) application session */
  desktop?: string
  /** the user's status set for an active mobile (iOS, Android) application session */
  mobile?: string
  /** the user's status set for an active web (browser, bot account) application session */
  web?: string
}

/** https://discord.com/developers/docs/topics/gateway#activity-object-activity-structure */
export interface Activity {
  /** the activity's name */
  name: string
  /** activity type */
  type: integer
  /** stream url, is validated when type is 1 */
  url?: string
  /** unix timestamp (in milliseconds) of when the activity was added to the user's session */
  created_at: integer
  /** unix timestamps for start and/or end of the game */
  timestamps?: ActivityTimestamps
  /** application id for the game */
  application_id?: snowflake
  /** what the player is currently doing */
  details?: string
  /** the user's current party status */
  state?: string
  /** the emoji used for a custom status */
  emoji?: Emoji
  /** information for the current party of the player */
  party?: ActivityParty
  /** images for the presence and their hover texts */
  assets?: ActivityAssets
  /** secrets for Rich Presence joining and spectating */
  secrets?: ActivitySecrets
  /** whether or not the activity is an instanced game session */
  instance?: boolean
  /** activity flags ORd together, describes what the payload includes */
  flags?: integer
  /** the custom buttons shown in the Rich Presence (max 2) */
  buttons?: ActivityButton[]
}

/** https://discord.com/developers/docs/topics/gateway#activity-object-activity-timestamps */
export interface ActivityTimestamps {
  /** unix time (in milliseconds) of when the activity started */
  start?: integer
  /** unix time (in milliseconds) of when the activity ends */
  end?: integer
}

/** https://discord.com/developers/docs/topics/gateway#activity-object-activity-emoji */
export interface ActivityEmoji {
  /** the name of the emoji */
  name: string
  /** the id of the emoji */
  id?: snowflake
  /** whether this emoji is animated */
  animated?: boolean
}

/** https://discord.com/developers/docs/topics/gateway#activity-object-activity-party */
export interface ActivityParty {
  /** the id of the party */
  id?: string
  /** used to show the party's current and maximum size */
  size?: [current_size: integer, max_size: integer]
}

/** https://discord.com/developers/docs/topics/gateway#activity-object-activity-assets */
export interface ActivityAssets {
  /** the id for a large asset of the activity, usually a snowflake */
  large_image?: string
  /** text displayed when hovering over the large image of the activity */
  large_text?: string
  /** the id for a small asset of the activity, usually a snowflake */
  small_image?: string
  /** text displayed when hovering over the small image of the activity */
  small_text?: string
}

/** https://discord.com/developers/docs/topics/gateway#activity-object-activity-secrets */
export interface ActivitySecrets {
  /** the id for a large asset of the activity, usually a snowflake */
  large_image?: string
  /** text displayed when hovering over the large image of the activity */
  large_text?: string
  /** the id for a small asset of the activity, usually a snowflake */
  small_image?: string
  /** text displayed when hovering over the small image of the activity */
  small_text?: string
}

/** https://discord.com/developers/docs/topics/gateway#activity-object-activity-button */
export interface ActivityButton {
  /** the text shown on the button (1-32 characters) */
  label: string
  /** the url opened when clicking the button (1-512 characters) */
  url: string
}

/** https://discord.com/developers/docs/topics/gateway#activity-object-activity-types */
export enum ActivityType {
  /** Playing {name} */
  GAME = 0,
  /** Streaming {details} */
  STREAMING = 1,
  /** Listening to {name} */
  LISTENING = 2,
  /** Watching {name} */
  WATCHING = 3,
  /** {emoji} {name} */
  CUSTOM = 4,
  /** Competing in {name} */
  COMPETING = 5,
}

/** https://discord.com/developers/docs/topics/gateway#activity-object-activity-flags */
export enum ActivityFlag {
  INSTANCE = 1 << 0,
  JOIN = 1 << 1,
  SPECTATE = 1 << 2,
  JOIN_REQUEST = 1 << 3,
  SYNC = 1 << 4,
  PLAY = 1 << 5,
}

declare module './gateway' {
  interface GatewayEvents {
    /** user was updated */
    PRESENCE_UPDATE: PresenceUpdateEvent
  }
}
