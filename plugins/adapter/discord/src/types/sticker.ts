import { integer, snowflake, User } from '.'

/** https://discord.com/developers/docs/resources/sticker#sticker-object-sticker-structure */
export interface Sticker {
  /** id of the sticker */
  id: snowflake
  /** for standard stickers, id of the pack the sticker is from */
  pack_id?: snowflake
  /** name of the sticker */
  name: string
  /** description of the sticker */
  description?: string
  /** autocomplete/suggestion tags for the sticker (max 200 characters) */
  tags: string
  /** Deprecated previously the sticker asset hash, now an empty string */
  asset: string
  /** type of sticker */
  type: integer
  /** type of sticker format */
  format_type: integer
  /** whether this guild sticker can be used, may be false due to loss of Server Boosts */
  available?: boolean
  /** id of the guild that owns this sticker */
  guild_id?: snowflake
  /** the user that uploaded the guild sticker */
  user?: User
  /** the standard sticker's sort order within its pack */
  sort_value?: integer
}

/** https://discord.com/developers/docs/resources/sticker#sticker-object-sticker-types */
export enum StickerType {
  /** an official sticker in a pack, part of Nitro or in a removed purchasable pack */
  STANDARD = 1,
  /** a sticker uploaded to a Boosted guild for the guild's members */
  GUILD = 2,
}

/** https://discord.com/developers/docs/resources/sticker#sticker-object-sticker-format-types */
export enum StickerFormatType {
  PNG = 1,
  APNG = 2,
  LOTTIE = 3,
}

/** https://discord.com/developers/docs/resources/sticker#sticker-item-object-sticker-item-structure */
export interface StickerItem {
  /** id of the sticker */
  id: snowflake
  /** name of the sticker */
  name: string
  /** type of sticker format */
  format_type: integer
}

/** https://discord.com/developers/docs/resources/sticker#sticker-pack-object-sticker-pack-structure */
export interface StickerPack {
  /** id of the sticker pack */
  id: snowflake
  /** the stickers in the pack */
  stickers: Sticker[]
  /** name of the sticker pack */
  name: string
  /** id of the pack's SKU */
  sku_id: snowflake
  /** id of a sticker in the pack which is shown as the pack's icon */
  cover_sticker_id?: snowflake
  /** description of the sticker pack */
  description: string
  /** id of the sticker pack's banner image */
  banner_asset_id: snowflake
}

/** https://discord.com/developers/docs/topics/gateway#guild-stickers-update-guild-stickers-update-event-fields */
export interface GuildStickersUpdateEvent {
  /** id of the guild */
  guild_id: snowflake
  /** array of stickers */
  stickers: Sticker[]
}

declare module './gateway' {
  interface GatewayEvents {
    /** guild stickers were updated */
    GUILD_STICKERS_UPDATE: GuildStickersUpdateEvent
  }
}
