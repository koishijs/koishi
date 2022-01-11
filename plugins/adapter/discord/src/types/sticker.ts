import { integer, Internal, snowflake, User } from '.'

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
  type: Sticker.Type
  /** type of sticker format */
  format_type: Sticker.FormatType
  /** whether this guild sticker can be used, may be false due to loss of Server Boosts */
  available?: boolean
  /** id of the guild that owns this sticker */
  guild_id?: snowflake
  /** the user that uploaded the guild sticker */
  user?: User
  /** the standard sticker's sort order within its pack */
  sort_value?: integer
}

export namespace Sticker {
  /** https://discord.com/developers/docs/resources/sticker#sticker-object-sticker-types */
  export enum Type {
    /** an official sticker in a pack, part of Nitro or in a removed purchasable pack */
    STANDARD = 1,
    /** a sticker uploaded to a Boosted guild for the guild's members */
    GUILD = 2,
  }

  /** https://discord.com/developers/docs/resources/sticker#sticker-object-sticker-format-types */
  export enum FormatType {
    PNG = 1,
    APNG = 2,
    LOTTIE = 3,
  }

  /** https://discord.com/developers/docs/resources/sticker#sticker-item-object-sticker-item-structure */
  export interface Item {
    /** id of the sticker */
    id: snowflake
    /** name of the sticker */
    name: string
    /** type of sticker format */
    format_type: FormatType
  }

  /** https://discord.com/developers/docs/resources/sticker#sticker-pack-object-sticker-pack-structure */
  export interface Pack {
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

  export namespace Event {
    /** https://discord.com/developers/docs/topics/gateway#guild-stickers-update-guild-stickers-update-event-fields */
    export interface Update {
      /** id of the guild */
      guild_id: snowflake
      /** array of stickers */
      stickers: Sticker[]
    }
  }

  /** https://discord.com/developers/docs/resources/sticker#list-nitro-sticker-packs-response-structure */
  export interface PackResult {
    sticker_packs: Pack[]
  }

  export namespace Params {
    /** https://discord.com/developers/docs/resources/sticker#create-guild-sticker-form-params */
    export interface Create {
      /** name of the sticker (2-30 characters) */
      name: string
      /** description of the sticker (empty or 2-100 characters) */
      description: string
      /** autocomplete/suggestion tags for the sticker (max 200 characters) */
      tags: string
      /** the sticker file to upload, must be a PNG, APNG, or Lottie JSON file, max 500 KB */
      file: any
    }

    /** https://discord.com/developers/docs/resources/sticker#modify-guild-sticker-json-params */
    export interface Modify {
      /** name of the sticker (2-30 characters) */
      name: string
      /** description of the sticker (2-100 characters) */
      description?: string
      /** autocomplete/suggestion tags for the sticker (max 200 characters) */
      tags: string
    }
  }
}

declare module './gateway' {
  interface GatewayEvents {
    /** guild stickers were updated */
    GUILD_STICKERS_UPDATE: Sticker.Event.Update
  }
}

declare module './internal' {
  interface Internal {
    /**
     * Returns a sticker object for the given sticker ID.
     * @see https://discord.com/developers/docs/resources/sticker#get-sticker
     */
    getSticker(sticker_id: snowflake): Promise<Sticker>
    /**
     * Returns the list of sticker packs available to Nitro subscribers.
     * @see https://discord.com/developers/docs/resources/sticker#list-nitro-sticker-packs
     */
    listNitroStickerPacks(): Promise<Sticker.PackResult>
    /**
     * Returns an array of sticker objects for the given guild. Includes user fields if the bot has the MANAGE_EMOJIS_AND_STICKERS permission.
     * @see https://discord.com/developers/docs/resources/sticker#list-guild-stickers
     */
    listGuildStickers(guild_id: snowflake): Promise<Sticker[]>
    /**
     * Returns a sticker object for the given guild and sticker IDs. Includes the user field if the bot has the MANAGE_EMOJIS_AND_STICKERS permission.
     * @see https://discord.com/developers/docs/resources/sticker#get-guild-sticker
     */
    getGuildSticker(guild_id: snowflake, sticker_id: snowflake): Promise<Sticker>
    /**
     * Create a new sticker for the guild. Send a multipart/form-data body. Requires the MANAGE_EMOJIS_AND_STICKERS permission. Returns the new sticker object on success.
     * @see https://discord.com/developers/docs/resources/sticker#create-guild-sticker
     */
    createGuildSticker(guild_id: snowflake, params: Sticker.Params.Create): Promise<Sticker>
    /**
     * Modify the given sticker. Requires the MANAGE_EMOJIS_AND_STICKERS permission. Returns the updated sticker object on success.
     * @see https://discord.com/developers/docs/resources/sticker#modify-guild-sticker
     */
    modifyGuildSticker(guild_id: snowflake, sticker_id: snowflake, params: Sticker.Params.Modify): Promise<Sticker>
    /**
     * Delete the given sticker. Requires the MANAGE_EMOJIS_AND_STICKERS permission. Returns 204 No Content on success.
     * @see https://discord.com/developers/docs/resources/sticker#delete-guild-sticker
     */
    deleteGuildSticker(guild_id: snowflake, sticker_id: snowflake): Promise<void>
  }
}

Internal.define({
  '/stickers/{sticker.id}': {
    GET: 'getSticker',
  },
  '/sticker-packs': {
    GET: 'listNitroStickerPacks',
  },
  '/guilds/{guild.id}/stickers': {
    GET: 'listGuildStickers',
    POST: 'createGuildSticker',
  },
  '/guilds/{guild.id}/stickers/{sticker.id}': {
    GET: 'getGuildSticker',
    PATCH: 'modifyGuildSticker',
    DELETE: 'deleteGuildSticker',
  },
})
