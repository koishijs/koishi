import { Channel, Emoji, GuildMember, integer, Internal, PresenceUpdateEvent, Role, snowflake, StageInstance, Sticker, timestamp, VoiceState } from '.'

/** https://discord.com/developers/docs/resources/guild#guild-object-guild-structure */
export interface Guild {
  /** guild id */
  id: snowflake
  /** guild name (2-100 characters, excluding trailing and leading whitespace) */
  name: string
  /** icon hash */
  icon?: string
  /** icon hash, returned when in the template object */
  icon_hash?: string
  /** splash hash */
  splash?: string
  /** discovery splash hash; only present for guilds with the "DISCOVERABLE" feature */
  discovery_splash?: string
  /** true if the user is the owner of the guild */
  owner?: boolean
  /** id of owner */
  owner_id: snowflake
  /** total permissions for the user in the guild (excludes overwrites) */
  permissions?: string
  /** voice region id for the guild (deprecated) */
  region?: string
  /** id of afk channel */
  afk_channel_id?: snowflake
  /** afk timeout in seconds */
  afk_timeout: integer
  /** true if the server widget is enabled */
  widget_enabled?: boolean
  /** the channel id that the widget will generate an invite to, or null if set to no invite */
  widget_channel_id?: snowflake
  /** verification level required for the guild */
  verification_level: integer
  /** default message notifications level */
  default_message_notifications: integer
  /** explicit content filter level */
  explicit_content_filter: integer
  /** roles in the guild */
  roles: Role[]
  /** custom guild emojis */
  emojis: Emoji[]
  /** enabled guild features */
  features: GuildFeature[]
  /** required MFA level for the guild */
  mfa_level: integer
  /** application id of the guild creator if it is bot-created */
  application_id?: snowflake
  /** the id of the channel where guild notices such as welcome messages and boost events are posted */
  system_channel_id?: snowflake
  /** system channel flags */
  system_channel_flags: integer
  /** the id of the channel where Community guilds can display rules and/or guidelines */
  rules_channel_id?: snowflake
  /** when this guild was joined at */
  joined_at?: timestamp
  /** true if this is considered a large guild */
  large?: boolean
  /** true if this guild is unavailable due to an outage */
  unavailable?: boolean
  /** total number of members in this guild */
  member_count?: integer
  /** states of members currently in voice channels; lacks the guild_id key */
  voice_states?: Partial<VoiceState>[]
  /** users in the guild */
  members?: GuildMember[]
  /** channels in the guild */
  channels?: Channel[]
  /** all active threads in the guild that current user has permission to view */
  threads?: Channel[]
  /** presences of the members in the guild, will only include non-offline members if the size is greater than large threshold */
  presences?: Partial<PresenceUpdateEvent>[]
  /** the maximum number of presences for the guild (null is always returned, apart from the largest of guilds) */
  max_presences?: integer
  /** the maximum number of members for the guild */
  max_members?: integer
  /** the vanity url code for the guild */
  vanity_url_code?: string
  /** the description of a Community guild */
  description?: string
  /** banner hash */
  banner?: string
  /** premium tier (Server Boost level) */
  premium_tier: integer
  /** the number of boosts this guild currently has */
  premium_subscription_count?: integer
  /** the preferred locale of a Community guild; used in server discovery and notices from Discord; defaults to "en-US" */
  preferred_locale: string
  /** the id of the channel where admins and moderators of Community guilds receive notices from Discord */
  public_updates_channel_id?: snowflake
  /** the maximum amount of users in a video channel */
  max_video_channel_users?: integer
  /** approximate number of members in this guild, returned from the GET /guilds/<id> endpoint when with_counts is true */
  approximate_member_count?: integer
  /** approximate number of non-offline members in this guild, returned from the GET /guilds/<id> endpoint when with_counts is true */
  approximate_presence_count?: integer
  /** the welcome screen of a Community guild, shown to new members, returned in an Invite's guild object */
  welcome_screen?: WelcomeScreen
  /** guild NSFW level */
  nsfw_level: integer
  /** Stage instances in the guild */
  stage_instances?: StageInstance[]
  /** custom guild stickers */
  stickers?: Sticker[]
}

export namespace Guild {
  export namespace Event {
    export interface Create extends Guild {}

    export interface Update extends Guild {}

    export interface Delete extends Guild {}
  }

  export namespace Params {
    /** https://discord.com/developers/docs/resources/user#get-current-user-guilds-query-string-params */
    export interface List {
      /** get guilds before this guild ID */
      before: snowflake
      /** get guilds after this guild ID */
      after: snowflake
      /** max number of guilds to return (1-200) */
      limit: integer
    }

    /** https://discord.com/developers/docs/resources/guild#create-guild-json-params */
    export interface Create {
      /** name of the guild (2-100 characters) */
      name: string
      /** voice region id (deprecated) */
      region?: string
      /** base64 128x128 image for the guild icon */
      icon?: string
      /** verification level */
      verification_level?: integer
      /** default message notification level */
      default_message_notifications?: integer
      /** explicit content filter level */
      explicit_content_filter?: integer
      /** new guild roles */
      roles?: Role[]
      /** new guild's channels */
      channels?: Partial<Channel>[]
      /** id for afk channel */
      afk_channel_id?: snowflake
      /** afk timeout in seconds */
      afk_timeout?: integer
      /** the id of the channel where guild notices such as welcome messages and boost events are posted */
      system_channel_id?: snowflake
      /** system channel flags */
      system_channel_flags?: integer
    }

    /** https://discord.com/developers/docs/resources/guild#get-guild-query-string-params */
    export interface Get {
      /** when true, will return approximate member and presence counts for the guild */
      with_counts?: boolean
    }

    /** https://discord.com/developers/docs/resources/guild#modify-guild-json-params */
    export interface Modify {
      /** guild name */
      name: string
      /** guild voice region id (deprecated) */
      region?: string
      /** verification level */
      verification_level?: integer
      /** default message notification level */
      default_message_notifications?: integer
      /** explicit content filter level */
      explicit_content_filter?: integer
      /** id for afk channel */
      afk_channel_id?: snowflake
      /** afk timeout in seconds */
      afk_timeout: integer
      /** base64 1024x1024 png/jpeg/gif image for the guild icon (can be animated gif when the server has the ANIMATED_ICON feature) */
      icon?: string
      /** user id to transfer guild ownership to (must be owner) */
      owner_id: snowflake
      /** base64 16:9 png/jpeg image for the guild splash (when the server has the INVITE_SPLASH feature) */
      splash?: string
      /** base64 16:9 png/jpeg image for the guild discovery splash (when the server has the DISCOVERABLE feature) */
      discovery_splash?: string
      /** base64 16:9 png/jpeg image for the guild banner (when the server has the BANNER feature) */
      banner?: string
      /** the id of the channel where guild notices such as welcome messages and boost events are posted */
      system_channel_id?: snowflake
      /** system channel flags */
      system_channel_flags: integer
      /** the id of the channel where Community guilds display rules and/or guidelines */
      rules_channel_id?: snowflake
      /** the id of the channel where admins and moderators of Community guilds receive notices from Discord */
      public_updates_channel_id?: snowflake
      /** the preferred locale of a Community guild used in server discovery and notices from Discord; defaults to "en-US" */
      preferred_locale?: string
      /** enabled guild features */
      features: GuildFeature[]
      /** the description for the guild, if the guild is discoverable */
      description?: string
      /** whether the guild's boost progress bar should be enabled. */
      premium_progress_bar_enabled: boolean
    }

    /** https://discord.com/developers/docs/resources/guild#get-guild-widget-image-query-string-params */
    export interface GetWidgetImage {
      /** style of the widget image returned (see below) */
      style: WidgetStyleOptions
    }

    /** https://discord.com/developers/docs/resources/guild#get-guild-widget-image-widget-style-options */
    export enum WidgetStyleOptions {
      /** shield style widget with Discord icon and guild members online count */
      shield = 'shield',
      /** large image with guild icon, name and online count. "POWERED BY DISCORD" as the footer of the widget */
      banner1 = 'banner1',
      /** smaller widget style with guild icon, name and online count. Split on the right with Discord logo */
      banner2 = 'banner2',
      /** large image with guild icon, name and online count. In the footer, Discord logo on the left and "Chat Now" on the right */
      banner3 = 'banner3',
      /** large Discord logo at the top of the widget. Guild icon, name and online count in the middle portion of the widget and a "JOIN MY SERVER" button at the bottom */
      banner4 = 'banner4',
    }

    /** https://discord.com/developers/docs/resources/guild#modify-guild-welcome-screen-json-params */
    export interface ModifyWelcomeScreen {
      /** whether the welcome screen is enabled */
      enabled: boolean
      /** channels linked in the welcome screen and their display options */
      welcome_channels: WelcomeScreenChannel[]
      /** the server description to show in the welcome screen */
      description: string
    }
  }
}

/** https://discord.com/developers/docs/resources/guild#guild-object-system-channel-flags */
export enum SystemChannelFlag {
  /** Suppress member join notifications */
  SUPPRESS_JOIN_NOTIFICATIONS = 1 << 0,
  /** Suppress server boost notifications */
  SUPPRESS_PREMIUM_SUBSCRIPTIONS = 1 << 1,
  /** Suppress server setup tips */
  SUPPRESS_GUILD_REMINDER_NOTIFICATIONS = 1 << 2,
}

/** https://discord.com/developers/docs/resources/guild#guild-object-guild-features */
export enum GuildFeature {
  /** guild has access to set an animated guild icon */
  ANIMATED_ICON = 'ANIMATED_ICON',
  /** guild has access to set a guild banner image */
  BANNER = 'BANNER',
  /** guild has access to use commerce features (i.e. create store channels) */
  COMMERCE = 'COMMERCE',
  /** guild can enable welcome screen, Membership Screening, stage channels and discovery, and receives community updates */
  COMMUNITY = 'COMMUNITY',
  /** guild is able to be discovered in the directory */
  DISCOVERABLE = 'DISCOVERABLE',
  /** guild is able to be featured in the directory */
  FEATURABLE = 'FEATURABLE',
  /** guild has access to set an invite splash background */
  INVITE_SPLASH = 'INVITE_SPLASH',
  /** guild has enabled Membership Screening */
  MEMBER_VERIFICATION_GATE_ENABLED = 'MEMBER_VERIFICATION_GATE_ENABLED',
  /** guild has enabled monetization */
  MONETIZATION_ENABLED = 'MONETIZATION_ENABLED',
  /** guild has increased custom sticker slots */
  MORE_STICKERS = 'MORE_STICKERS',
  /** guild has access to create news channels */
  NEWS = 'NEWS',
  /** guild is partnered */
  PARTNERED = 'PARTNERED',
  /** guild can be previewed before joining via Membership Screening or the directory */
  PREVIEW_ENABLED = 'PREVIEW_ENABLED',
  /** guild has access to create private threads */
  PRIVATE_THREADS = 'PRIVATE_THREADS',
  /** guild is able to set role icons */
  ROLE_ICONS = 'ROLE_ICONS',
  /** guild has access to the seven day archive time for threads */
  SEVEN_DAY_THREAD_ARCHIVE = 'SEVEN_DAY_THREAD_ARCHIVE',
  /** guild has access to the three day archive time for threads */
  THREE_DAY_THREAD_ARCHIVE = 'THREE_DAY_THREAD_ARCHIVE',
  /** guild has enabled ticketed events */
  TICKETED_EVENTS_ENABLED = 'TICKETED_EVENTS_ENABLED',
  /** guild has access to set a vanity URL */
  VANITY_URL = 'VANITY_URL',
  /** guild is verified */
  VERIFIED = 'VERIFIED',
  /** guild has access to set 384kbps bitrate in voice (previously VIP voice servers) */
  VIP_REGIONS = 'VIP_REGIONS',
  /** guild has enabled the welcome screen */
  WELCOME_SCREEN_ENABLED = 'WELCOME_SCREEN_ENABLED',
}

/** https://discord.com/developers/docs/resources/guild#guild-preview-object-guild-preview-structure */
export interface GuildPreview {
  /** guild id */
  id: snowflake
  /** guild name (2-100 characters) */
  name: string
  /** icon hash */
  icon?: string
  /** splash hash */
  splash?: string
  /** discovery splash hash */
  discovery_splash?: string
  /** custom guild emojis */
  emojis: Emoji[]
  /** enabled guild features */
  features: GuildFeature[]
  /** approximate number of members in this guild */
  approximate_member_count: integer
  /** approximate number of online members in this guild */
  approximate_presence_count: integer
  /** the description for the guild, if the guild is discoverable */
  description?: string
}

/** https://discord.com/developers/docs/resources/guild#guild-widget-object-guild-widget-structure */
export interface GuildWidget {
  /** whether the widget is enabled */
  enabled: boolean
  /** the widget channel id */
  channel_id?: snowflake
}

/** https://discord.com/developers/docs/resources/guild#welcome-screen-object-welcome-screen-structure */
export interface WelcomeScreen {
  /** the server description shown in the welcome screen */
  description?: string
  /** the channels shown in the welcome screen, up to 5 */
  welcome_channels: WelcomeScreenChannel[]
}

/** https://discord.com/developers/docs/resources/guild#welcome-screen-object-welcome-screen-channel-structure */
export interface WelcomeScreenChannel {
  /** the channel's id */
  channel_id: snowflake
  /** the description shown for the channel */
  description: string
  /** the emoji id, if the emoji is custom */
  emoji_id?: snowflake
  /** the emoji name if custom, the unicode character if standard, or null if no emoji is set */
  emoji_name?: string
}

declare module './gateway' {
  interface GatewayEvents {
    /** lazy-load for unavailable guild, guild became available, or user joined a new guild */
    GUILD_CREATE: Guild.Event.Create
    /** guild was updated */
    GUILD_UPDATE: Guild.Event.Update
    /** guild became unavailable, or user left/was removed from a guild */
    GUILD_DELETE: Guild.Event.Delete
  }
}

declare module './internal' {
  interface Internal {
    /**
     * Returns a list of partial guild objects the current user is a member of. Requires the guilds OAuth2 scope.
     * @see https://discord.com/developers/docs/resources/user#get-current-user-guilds
     */
    getCurrentUserGuilds(params?: Guild.Params.List): Promise<Guild[]>
    /**
     * Returns a guild member object for the current user. Requires the guilds.members.read OAuth2 scope.
     * @see https://discord.com/developers/docs/resources/user#get-current-user-guild-member
     */
    getCurrentUserGuildMember(guild_id: snowflake): Promise<GuildMember>
    /**
     * Leave a guild. Returns a 204 empty response on success.
     * @see https://discord.com/developers/docs/resources/user#leave-guild
     */
    leaveGuild(guild_id: snowflake): Promise<void>
  }
}

Internal.define({
  '/users/@me/guilds': {
    GET: 'getCurrentUserGuilds',
  },
  '/users/@me/guilds/{guild.id}/member': {
    GET: 'getCurrentUserGuildMember',
  },
  '/users/@me/guilds/{guild.id}': {
    DELETE: 'leaveGuild',
  },
})

declare module './internal' {
  interface Internal {
    /**
     * Create a new guild. Returns a guild object on success. Fires a Guild Create Gateway event.
     * @see https://discord.com/developers/docs/resources/guild#create-guild
     */
    createGuild(params: Guild.Params.Create): Promise<Guild>
    /**
     * Returns the guild object for the given id. If with_counts is set to true, this endpoint will also return approximate_member_count and approximate_presence_count for the guild.
     * @see https://discord.com/developers/docs/resources/guild#get-guild
     */
    getGuild(guild_id: snowflake, params?: Guild.Params.Get): Promise<Guild>
    /**
     * Returns the guild preview object for the given id. If the user is not in the guild, then the guild must be lurkable.
     * @see https://discord.com/developers/docs/resources/guild#get-guild-preview
     */
    getGuildPreview(guild_id: snowflake): Promise<GuildPreview>
    /**
     * Modify a guild's settings. Requires the MANAGE_GUILD permission. Returns the updated guild object on success. Fires a Guild Update Gateway event.
     * @see https://discord.com/developers/docs/resources/guild#modify-guild
     */
    modifyGuild(guild_id: snowflake, params: Guild.Params.Modify): Promise<void>
    /**
     * Delete a guild permanently. User must be owner. Returns 204 No Content on success. Fires a Guild Delete Gateway event.
     * @see https://discord.com/developers/docs/resources/guild#delete-guild
     */
    deleteGuild(guild_id: snowflake): Promise<void>
    /**
     * Returns a guild widget object. Requires the MANAGE_GUILD permission.
     * @see https://discord.com/developers/docs/resources/guild#get-guild-widget-settings
     */
    getGuildWidgetSettings(guild_id: snowflake): Promise<GuildWidget>
    /**
     * Modify a guild widget object for the guild. All attributes may be passed in with JSON and modified. Requires the MANAGE_GUILD permission. Returns the updated guild widget object.
     * @see https://discord.com/developers/docs/resources/guild#modify-guild-widget
     */
    modifyGuildWidget(guild_id: snowflake, params: Partial<GuildWidget>): Promise<GuildWidget>
    /**
     * Returns the widget for the guild.
     * @see https://discord.com/developers/docs/resources/guild#get-guild-widget
     */
    getGuildWidget(guild_id: snowflake): Promise<any>
    /**
     * Returns a PNG image widget for the guild. Requires no permissions or authentication.
     * @see https://discord.com/developers/docs/resources/guild#get-guild-widget-image
     */
    getGuildWidgetImage(guild_id: snowflake, params?: Guild.Params.GetWidgetImage): Promise<any>
    /**
     * Returns the Welcome Screen object for the guild.
     * @see https://discord.com/developers/docs/resources/guild#get-guild-welcome-screen
     */
    getGuildWelcomeScreen(guild_id: snowflake): Promise<WelcomeScreen>
    /**
     * Modify the guild's Welcome Screen. Requires the MANAGE_GUILD permission. Returns the updated Welcome Screen object.
     * @see https://discord.com/developers/docs/resources/guild#modify-guild-welcome-screen
     */
    modifyGuildWelcomeScreen(guild_id: snowflake, params: Guild.Params.ModifyWelcomeScreen): Promise<WelcomeScreen>
  }
}

Internal.define({
  '/guilds': {
    POST: 'createGuild',
  },
  '/guilds/{guild.id}': {
    GET: 'getGuild',
    PATCH: 'modifyGuild',
    DELETE: 'deleteGuild',
  },
  '/guilds/{guild.id}/preview': {
    GET: 'getGuildPreview',
  },
  '/guilds/{guild.id}/widget': {
    GET: 'getGuildWidgetSettings',
    PATCH: 'modifyGuildWidget',
  },
  '/guilds/{guild.id}/widget.json': {
    GET: 'getGuildWidget',
  },
  '/guilds/{guild.id}/widget.png': {
    GET: 'getGuildWidgetImage',
  },
  '/guilds/{guild.id}/welcome-screen': {
    GET: 'getGuildWelcomeScreen',
    PATCH: 'modifyGuildWelcomeScreen',
  },
})
