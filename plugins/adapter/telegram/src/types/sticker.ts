import { Float, ForceReply, InlineKeyboardMarkup, InputFile, Integer, Internal, Message, PhotoSize, ReplyKeyboardMarkup, ReplyKeyboardRemove } from '.'

/**
 * This object represents a sticker.
 * @see https://core.telegram.org/bots/api#sticker
 */
export interface Sticker {
  /** Identifier for this file, which can be used to download or reuse the file */
  file_id?: string
  /** Unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
  file_unique_id?: string
  /** Sticker width */
  width?: Integer
  /** Sticker height */
  height?: Integer
  /** True, if the sticker is animated */
  is_animated?: boolean
  /** True, if the sticker is a video sticker */
  is_video?: boolean
  /** Optional. Sticker thumbnail in the .WEBP or .JPG format */
  thumb?: PhotoSize
  /** Optional. Emoji associated with the sticker */
  emoji?: string
  /** Optional. Name of the sticker set to which the sticker belongs */
  set_name?: string
  /** Optional. For mask stickers, the position where the mask should be placed */
  mask_position?: MaskPosition
  /** Optional. File size in bytes */
  file_size?: Integer
}

/**
 * This object represents a sticker set.
 * @see https://core.telegram.org/bots/api#stickerset
 */
export interface StickerSet {
  /** Sticker set name */
  name?: string
  /** Sticker set title */
  title?: string
  /** True, if the sticker set contains animated stickers */
  is_animated?: boolean
  /** True, if the sticker set contains video stickers */
  is_video?: boolean
  /** True, if the sticker set contains masks */
  contains_masks?: boolean
  /** List of all set stickers */
  stickers?: Sticker[]
  /** Optional. Sticker set thumbnail in the .WEBP, .TGS, or .WEBM format */
  thumb?: PhotoSize
}

/**
 * This object describes the position on faces where a mask should be placed by default.
 * @see https://core.telegram.org/bots/api#maskposition
 */
export interface MaskPosition {
  /** The part of the face relative to which the mask should be placed. One of "forehead", "eyes", "mouth", or "chin". */
  point?: string
  /** Shift by X-axis measured in widths of the mask scaled to the face size, from left to right. For example, choosing -1.0 will place mask just to the left of the default mask position. */
  x_shift?: Float
  /** Shift by Y-axis measured in heights of the mask scaled to the face size, from top to bottom. For example, 1.0 will place the mask just below the default mask position. */
  y_shift?: Float
  /** Mask scaling coefficient. For example, 2.0 means double size. */
  scale?: Float
}

export interface SendStickerPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Sticker to send. Pass a file_id as String to send a file that exists on the Telegram servers (recommended), pass an HTTP URL as a String for Telegram to get a .WEBP file from the Internet, or upload a new one using multipart/form-data. More info on Sending Files » */
  sticker?: InputFile | string
  /** Sends the message silently. Users will receive a notification with no sound. */
  disable_notification?: boolean
  /** Protects the contents of the sent message from forwarding and saving */
  protect_content?: boolean
  /** If the message is a reply, ID of the original message */
  reply_to_message_id?: Integer
  /** Pass True, if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: boolean
  /** Additional interface options. A JSON-serialized object for an inline keyboard, custom reply keyboard, instructions to remove reply keyboard or to force a reply from the user. */
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply
}

export interface GetStickerSetPayload {
  /** Name of the sticker set */
  name?: string
}

export interface UploadStickerFilePayload {
  /** User identifier of sticker file owner */
  user_id?: Integer
  /** PNG image with the sticker, must be up to 512 kilobytes in size, dimensions must not exceed 512px, and either width or height must be exactly 512px. More info on Sending Files » */
  png_sticker?: InputFile
}

export interface CreateNewStickerSetPayload {
  /** User identifier of created sticker set owner */
  user_id?: Integer
  /** Short name of sticker set, to be used in t.me/addstickers/ URLs (e.g., animals). Can contain only english letters, digits and underscores. Must begin with a letter, can't contain consecutive underscores and must end in "by<bot username>". <bot_username> is case insensitive. 1-64 characters. */
  name?: string
  /** Sticker set title, 1-64 characters */
  title?: string
  /** PNG image with the sticker, must be up to 512 kilobytes in size, dimensions must not exceed 512px, and either width or height must be exactly 512px. Pass a file_id as a String to send a file that already exists on the Telegram servers, pass an HTTP URL as a String for Telegram to get a file from the Internet, or upload a new one using multipart/form-data. More info on Sending Files » */
  png_sticker?: InputFile | string
  /** TGS animation with the sticker, uploaded using multipart/form-data. See https://core.telegram.org/stickers#animated-sticker-requirements for technical requirements */
  tgs_sticker?: InputFile
  /** WEBM video with the sticker, uploaded using multipart/form-data. See https://core.telegram.org/stickers#video-sticker-requirements for technical requirements */
  webm_sticker?: InputFile
  /** One or more emoji corresponding to the sticker */
  emojis?: string
  /** Pass True, if a set of mask stickers should be created */
  contains_masks?: boolean
  /** A JSON-serialized object for position where the mask should be placed on faces */
  mask_position?: MaskPosition
}

export interface AddStickerToSetPayload {
  /** User identifier of sticker set owner */
  user_id?: Integer
  /** Sticker set name */
  name?: string
  /** PNG image with the sticker, must be up to 512 kilobytes in size, dimensions must not exceed 512px, and either width or height must be exactly 512px. Pass a file_id as a String to send a file that already exists on the Telegram servers, pass an HTTP URL as a String for Telegram to get a file from the Internet, or upload a new one using multipart/form-data. More info on Sending Files » */
  png_sticker?: InputFile | string
  /** TGS animation with the sticker, uploaded using multipart/form-data. See https://core.telegram.org/stickers#animated-sticker-requirements for technical requirements */
  tgs_sticker?: InputFile
  /** WEBM video with the sticker, uploaded using multipart/form-data. See https://core.telegram.org/stickers#video-sticker-requirements for technical requirements */
  webm_sticker?: InputFile
  /** One or more emoji corresponding to the sticker */
  emojis?: string
  /** A JSON-serialized object for position where the mask should be placed on faces */
  mask_position?: MaskPosition
}

export interface SetStickerPositionInSetPayload {
  /** File identifier of the sticker */
  sticker?: string
  /** New sticker position in the set, zero-based */
  position?: Integer
}

export interface DeleteStickerFromSetPayload {
  /** File identifier of the sticker */
  sticker?: string
}

export interface SetStickerSetThumbPayload {
  /** Sticker set name */
  name?: string
  /** User identifier of the sticker set owner */
  user_id?: Integer
  /** A PNG image with the thumbnail, must be up to 128 kilobytes in size and have width and height exactly 100px, or a TGS animation with the thumbnail up to 32 kilobytes in size; see https://core.telegram.org/stickers#animated-sticker-requirements for animated sticker technical requirements, or a WEBM video with the thumbnail up to 32 kilobytes in size; see https://core.telegram.org/stickers#video-sticker-requirements for video sticker technical requirements. Pass a file_id as a String to send a file that already exists on the Telegram servers, pass an HTTP URL as a String for Telegram to get a file from the Internet, or upload a new one using multipart/form-data. More info on Sending Files ». Animated sticker set thumbnails can't be uploaded via HTTP URL. */
  thumb?: InputFile | string
}

declare module '.' {
  interface Message {
    /** Optional. Message is a sticker, information about the sticker */
    sticker?: Sticker
  }
}

declare module './internal' {
  interface Internal {
    /**
     * Use this method to send static .WEBP, animated .TGS, or video .WEBM stickers. On success, the sent Message is returned.
     * @see https://core.telegram.org/bots/api#sendsticker
     */
    sendSticker(payload: SendStickerPayload): Promise<Message>
    /**
     * Use this method to get a sticker set. On success, a StickerSet object is returned.
     * @see https://core.telegram.org/bots/api#getstickerset
     */
    getStickerSet(payload: GetStickerSetPayload): Promise<StickerSet>
    /**
     * Use this method to upload a .PNG file with a sticker for later use in createNewStickerSet and addStickerToSet methods (can be used multiple times). Returns the uploaded File on success.
     * @see https://core.telegram.org/bots/api#uploadstickerfile
     */
    uploadStickerFile(payload: UploadStickerFilePayload): Promise<File>
    /**
     * Use this method to create a new sticker set owned by a user. The bot will be able to edit the sticker set thus created. You must use exactly one of the fields png_sticker, tgs_sticker, or webm_sticker. Returns True on success.
     * @see https://core.telegram.org/bots/api#createnewstickerset
     */
    createNewStickerSet(payload: CreateNewStickerSetPayload): Promise<boolean>
    /**
     * Use this method to add a new sticker to a set created by the bot. You must use exactly one of the fields png_sticker, tgs_sticker, or webm_sticker. Animated stickers can be added to animated sticker sets and only to them. Animated sticker sets can have up to 50 stickers. Static sticker sets can have up to 120 stickers. Returns True on success.
     * @see https://core.telegram.org/bots/api#addstickertoset
     */
    addStickerToSet(payload: AddStickerToSetPayload): Promise<boolean>
    /**
     * Use this method to move a sticker in a set created by the bot to a specific position. Returns True on success.
     * @see https://core.telegram.org/bots/api#setstickerpositioninset
     */
    setStickerPositionInSet(payload: SetStickerPositionInSetPayload): Promise<boolean>
    /**
     * Use this method to delete a sticker from a set created by the bot. Returns True on success.
     * @see https://core.telegram.org/bots/api#deletestickerfromset
     */
    deleteStickerFromSet(payload: DeleteStickerFromSetPayload): Promise<boolean>
    /**
     * Use this method to set the thumbnail of a sticker set. Animated thumbnails can be set for animated sticker sets only. Video thumbnails can be set only for video sticker sets only. Returns True on success.
     * @see https://core.telegram.org/bots/api#setstickersetthumb
     */
    setStickerSetThumb(payload: SetStickerSetThumbPayload): Promise<boolean>
  }
}

Internal.define('sendSticker')
Internal.define('getStickerSet')
Internal.define('uploadStickerFile')
Internal.define('createNewStickerSet')
Internal.define('addStickerToSet')
Internal.define('setStickerPositionInSet')
Internal.define('deleteStickerFromSet')
Internal.define('setStickerSetThumb')
