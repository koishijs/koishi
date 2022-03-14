import { User } from 'koishi'
import { Float, InlineKeyboardMarkup, Integer, Internal, LabeledPrice, MessageEntity } from '.'

/**
 * This object represents an incoming inline query. When the user sends an empty query, your bot could return some default or trending results.
 * @see https://core.telegram.org/bots/api#inlinequery
 */
export interface InlineQuery {
  /** Unique identifier for this query */
  id?: string
  /** Sender */
  from?: User
  /** Text of the query (up to 256 characters) */
  query?: string
  /** Offset of the results to be returned, can be controlled by the bot */
  offset?: string
  /** Optional. Type of the chat, from which the inline query was sent. Can be either "sender" for a private chat with the inline query sender, "private", "group", "supergroup", or "channel". The chat type should be always known for requests sent from official clients and most third-party clients, unless the request was sent from a secret chat */
  chat_type?: string
  /** Optional. Sender location, only for bots that request user location */
  location?: Location
}

export interface AnswerInlineQueryPayload {
  /** Unique identifier for the answered query */
  inline_query_id?: string
  /** A JSON-serialized array of results for the inline query */
  results?: InlineQueryResult[]
  /** The maximum amount of time in seconds that the result of the inline query may be cached on the server. Defaults to 300. */
  cache_time?: Integer
  /** Pass True, if results may be cached on the server side only for the user that sent the query. By default, results may be returned to any user who sends the same query */
  is_personal?: boolean
  /** Pass the offset that a client should send in the next query with the same text to receive more results. Pass an empty string if there are no more results or if you don't support pagination. Offset length can't exceed 64 bytes. */
  next_offset?: string
  /** If passed, clients will display a button with specified text that switches the user to a private chat with the bot and sends the bot a start message with the parameter switch_pm_parameter */
  switch_pm_text?: string
  /**
   * Deep-linking parameter for the /start message sent to the bot when user presses the switch button. 1-64 characters, only A-Z, a-z, 0-9, _ and - are allowed.
   *
   * Example: An inline bot that sends YouTube videos can ask the user to connect the bot to their YouTube account to adapt search results accordingly. To do this, it displays a 'Connect your YouTube account' button above the results, or even before showing any. The user presses the button, switches to a private chat with the bot and, in doing so, passes a start parameter that instructs the bot to return an OAuth link. Once done, the bot can offer a switch_inline button so that the user can easily return to the chat where they wanted to use the bot's inline capabilities.
   */
  switch_pm_parameter?: string
}

/**
 * This object represents one result of an inline query. Telegram clients currently support results of the following 20 types:
 * - InlineQueryResultCachedAudio
 * - InlineQueryResultCachedDocument
 * - InlineQueryResultCachedGif
 * - InlineQueryResultCachedMpeg4Gif
 * - InlineQueryResultCachedPhoto
 * - InlineQueryResultCachedSticker
 * - InlineQueryResultCachedVideo
 * - InlineQueryResultCachedVoice
 * - InlineQueryResultArticle
 * - InlineQueryResultAudio
 * - InlineQueryResultContact
 * - InlineQueryResultGame
 * - InlineQueryResultDocument
 * - InlineQueryResultGif
 * - InlineQueryResultLocation
 * - InlineQueryResultMpeg4Gif
 * - InlineQueryResultPhoto
 * - InlineQueryResultVenue
 * - InlineQueryResultVideo
 * - InlineQueryResultVoice
 * Note: All URLs passed in inline query results will be available to end users and therefore must be assumed to be public.
 * @see https://core.telegram.org/bots/api#inlinequeryresult
 */
export type InlineQueryResult =
  | InlineQueryResultCachedAudio
  | InlineQueryResultCachedDocument
  | InlineQueryResultCachedGif
  | InlineQueryResultCachedMpeg4Gif
  | InlineQueryResultCachedPhoto
  | InlineQueryResultCachedSticker
  | InlineQueryResultCachedVideo
  | InlineQueryResultCachedVoice
  | InlineQueryResultArticle
  | InlineQueryResultAudio
  | InlineQueryResultContact
  | InlineQueryResultGame
  | InlineQueryResultDocument
  | InlineQueryResultGif
  | InlineQueryResultLocation
  | InlineQueryResultMpeg4Gif
  | InlineQueryResultPhoto
  | InlineQueryResultVenue
  | InlineQueryResultVideo
  | InlineQueryResultVoice

/**
 * Represents a link to an article or web page.
 * @see https://core.telegram.org/bots/api#inlinequeryresultarticle
 */
export interface InlineQueryResultArticle {
  /** Type of the result, must be article */
  type?: string
  /** Unique identifier for this result, 1-64 Bytes */
  id?: string
  /** Title of the result */
  title?: string
  /** Content of the message to be sent */
  input_message_content?: InputMessageContent
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
  /** Optional. URL of the result */
  url?: string
  /** Optional. Pass True, if you don't want the URL to be shown in the message */
  hide_url?: boolean
  /** Optional. Short description of the result */
  description?: string
  /** Optional. Url of the thumbnail for the result */
  thumb_url?: string
  /** Optional. Thumbnail width */
  thumb_width?: Integer
  /** Optional. Thumbnail height */
  thumb_height?: Integer
}

/**
 * Represents a link to a photo. By default, this photo will be sent by the user with optional caption. Alternatively, you can use input_message_content to send a message with the specified content instead of the photo.
 * @see https://core.telegram.org/bots/api#inlinequeryresultphoto
 */
export interface InlineQueryResultPhoto {
  /** Type of the result, must be photo */
  type?: string
  /** Unique identifier for this result, 1-64 bytes */
  id?: string
  /** A valid URL of the photo. Photo must be in JPEG format. Photo size must not exceed 5MB */
  photo_url?: string
  /** URL of the thumbnail for the photo */
  thumb_url?: string
  /** Optional. Width of the photo */
  photo_width?: Integer
  /** Optional. Height of the photo */
  photo_height?: Integer
  /** Optional. Title for the result */
  title?: string
  /** Optional. Short description of the result */
  description?: string
  /** Optional. Caption of the photo to be sent, 0-1024 characters after entities parsing */
  caption?: string
  /** Optional. Mode for parsing entities in the photo caption. See formatting options for more details. */
  parse_mode?: string
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
  /** Optional. Content of the message to be sent instead of the photo */
  input_message_content?: InputMessageContent
}

/**
 * Represents a link to an animated GIF file. By default, this animated GIF file will be sent by the user with optional caption. Alternatively, you can use input_message_content to send a message with the specified content instead of the animation.
 * @see https://core.telegram.org/bots/api#inlinequeryresultgif
 */
export interface InlineQueryResultGif {
  /** Type of the result, must be gif */
  type?: string
  /** Unique identifier for this result, 1-64 bytes */
  id?: string
  /** A valid URL for the GIF file. File size must not exceed 1MB */
  gif_url?: string
  /** Optional. Width of the GIF */
  gif_width?: Integer
  /** Optional. Height of the GIF */
  gif_height?: Integer
  /** Optional. Duration of the GIF in seconds */
  gif_duration?: Integer
  /** URL of the static (JPEG or GIF) or animated (MPEG4) thumbnail for the result */
  thumb_url?: string
  /** Optional. MIME type of the thumbnail, must be one of "image/jpeg", "image/gif", or "video/mp4". Defaults to "image/jpeg" */
  thumb_mime_type?: string
  /** Optional. Title for the result */
  title?: string
  /** Optional. Caption of the GIF file to be sent, 0-1024 characters after entities parsing */
  caption?: string
  /** Optional. Mode for parsing entities in the caption. See formatting options for more details. */
  parse_mode?: string
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
  /** Optional. Content of the message to be sent instead of the GIF animation */
  input_message_content?: InputMessageContent
}

/**
 * Represents a link to a video animation (H.264/MPEG-4 AVC video without sound). By default, this animated MPEG-4 file will be sent by the user with optional caption. Alternatively, you can use input_message_content to send a message with the specified content instead of the animation.
 * @see https://core.telegram.org/bots/api#inlinequeryresultmpeg4gif
 */
export interface InlineQueryResultMpeg4Gif {
  /** Type of the result, must be mpeg4_gif */
  type?: string
  /** Unique identifier for this result, 1-64 bytes */
  id?: string
  /** A valid URL for the MP4 file. File size must not exceed 1MB */
  mpeg4_url?: string
  /** Optional. Video width */
  mpeg4_width?: Integer
  /** Optional. Video height */
  mpeg4_height?: Integer
  /** Optional. Video duration in seconds */
  mpeg4_duration?: Integer
  /** URL of the static (JPEG or GIF) or animated (MPEG4) thumbnail for the result */
  thumb_url?: string
  /** Optional. MIME type of the thumbnail, must be one of "image/jpeg", "image/gif", or "video/mp4". Defaults to "image/jpeg" */
  thumb_mime_type?: string
  /** Optional. Title for the result */
  title?: string
  /** Optional. Caption of the MPEG-4 file to be sent, 0-1024 characters after entities parsing */
  caption?: string
  /** Optional. Mode for parsing entities in the caption. See formatting options for more details. */
  parse_mode?: string
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
  /** Optional. Content of the message to be sent instead of the video animation */
  input_message_content?: InputMessageContent
}

/**
 * Represents a link to a page containing an embedded video player or a video file. By default, this video file will be sent by the user with an optional caption. Alternatively, you can use input_message_content to send a message with the specified content instead of the video.
 * If an InlineQueryResultVideo message contains an embedded video (e.g., YouTube), you must replace its content using input_message_content.
 * @see https://core.telegram.org/bots/api#inlinequeryresultvideo
 */
export interface InlineQueryResultVideo {
  /** Type of the result, must be video */
  type?: string
  /** Unique identifier for this result, 1-64 bytes */
  id?: string
  /** A valid URL for the embedded video player or video file */
  video_url?: string
  /** Mime type of the content of video url, "text/html" or "video/mp4" */
  mime_type?: string
  /** URL of the thumbnail (JPEG only) for the video */
  thumb_url?: string
  /** Title for the result */
  title?: string
  /** Optional. Caption of the video to be sent, 0-1024 characters after entities parsing */
  caption?: string
  /** Optional. Mode for parsing entities in the video caption. See formatting options for more details. */
  parse_mode?: string
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Optional. Video width */
  video_width?: Integer
  /** Optional. Video height */
  video_height?: Integer
  /** Optional. Video duration in seconds */
  video_duration?: Integer
  /** Optional. Short description of the result */
  description?: string
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
  /** Optional. Content of the message to be sent instead of the video. This field is required if InlineQueryResultVideo is used to send an HTML-page as a result (e.g., a YouTube video). */
  input_message_content?: InputMessageContent
}

/**
 * Represents a link to an MP3 audio file. By default, this audio file will be sent by the user. Alternatively, you can use input_message_content to send a message with the specified content instead of the audio.
 * @see https://core.telegram.org/bots/api#inlinequeryresultaudio
 */
export interface InlineQueryResultAudio {
  /** Type of the result, must be audio */
  type?: string
  /** Unique identifier for this result, 1-64 bytes */
  id?: string
  /** A valid URL for the audio file */
  audio_url?: string
  /** Title */
  title?: string
  /** Optional. Caption, 0-1024 characters after entities parsing */
  caption?: string
  /** Optional. Mode for parsing entities in the audio caption. See formatting options for more details. */
  parse_mode?: string
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Optional. Performer */
  performer?: string
  /** Optional. Audio duration in seconds */
  audio_duration?: Integer
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
  /** Optional. Content of the message to be sent instead of the audio */
  input_message_content?: InputMessageContent
}

/**
 * Represents a link to a voice recording in an .OGG container encoded with OPUS. By default, this voice recording will be sent by the user. Alternatively, you can use input_message_content to send a message with the specified content instead of the the voice message.
 * @see https://core.telegram.org/bots/api#inlinequeryresultvoice
 */
export interface InlineQueryResultVoice {
  /** Type of the result, must be voice */
  type?: string
  /** Unique identifier for this result, 1-64 bytes */
  id?: string
  /** A valid URL for the voice recording */
  voice_url?: string
  /** Recording title */
  title?: string
  /** Optional. Caption, 0-1024 characters after entities parsing */
  caption?: string
  /** Optional. Mode for parsing entities in the voice message caption. See formatting options for more details. */
  parse_mode?: string
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Optional. Recording duration in seconds */
  voice_duration?: Integer
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
  /** Optional. Content of the message to be sent instead of the voice recording */
  input_message_content?: InputMessageContent
}

/**
 * Represents a link to a file. By default, this file will be sent by the user with an optional caption. Alternatively, you can use input_message_content to send a message with the specified content instead of the file. Currently, only .PDF and .ZIP files can be sent using this method.
 * @see https://core.telegram.org/bots/api#inlinequeryresultdocument
 */
export interface InlineQueryResultDocument {
  /** Type of the result, must be document */
  type?: string
  /** Unique identifier for this result, 1-64 bytes */
  id?: string
  /** Title for the result */
  title?: string
  /** Optional. Caption of the document to be sent, 0-1024 characters after entities parsing */
  caption?: string
  /** Optional. Mode for parsing entities in the document caption. See formatting options for more details. */
  parse_mode?: string
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** A valid URL for the file */
  document_url?: string
  /** Mime type of the content of the file, either "application/pdf" or "application/zip" */
  mime_type?: string
  /** Optional. Short description of the result */
  description?: string
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
  /** Optional. Content of the message to be sent instead of the file */
  input_message_content?: InputMessageContent
  /** Optional. URL of the thumbnail (JPEG only) for the file */
  thumb_url?: string
  /** Optional. Thumbnail width */
  thumb_width?: Integer
  /** Optional. Thumbnail height */
  thumb_height?: Integer
}

/**
 * Represents a location on a map. By default, the location will be sent by the user. Alternatively, you can use input_message_content to send a message with the specified content instead of the location.
 * @see https://core.telegram.org/bots/api#inlinequeryresultlocation
 */
export interface InlineQueryResultLocation {
  /** Type of the result, must be location */
  type?: string
  /** Unique identifier for this result, 1-64 Bytes */
  id?: string
  /** Location latitude in degrees */
  latitude?: Float
  /** Location longitude in degrees */
  longitude?: Float
  /** Location title */
  title?: string
  /** Optional. The radius of uncertainty for the location, measured in meters; 0-1500 */
  horizontal_accuracy?: Float
  /** Optional. Period in seconds for which the location can be updated, should be between 60 and 86400. */
  live_period?: Integer
  /** Optional. For live locations, a direction in which the user is moving, in degrees. Must be between 1 and 360 if specified. */
  heading?: Integer
  /** Optional. For live locations, a maximum distance for proximity alerts about approaching another chat member, in meters. Must be between 1 and 100000 if specified. */
  proximity_alert_radius?: Integer
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
  /** Optional. Content of the message to be sent instead of the location */
  input_message_content?: InputMessageContent
  /** Optional. Url of the thumbnail for the result */
  thumb_url?: string
  /** Optional. Thumbnail width */
  thumb_width?: Integer
  /** Optional. Thumbnail height */
  thumb_height?: Integer
}

/**
 * Represents a venue. By default, the venue will be sent by the user. Alternatively, you can use input_message_content to send a message with the specified content instead of the venue.
 * @see https://core.telegram.org/bots/api#inlinequeryresultvenue
 */
export interface InlineQueryResultVenue {
  /** Type of the result, must be venue */
  type?: string
  /** Unique identifier for this result, 1-64 Bytes */
  id?: string
  /** Latitude of the venue location in degrees */
  latitude?: Float
  /** Longitude of the venue location in degrees */
  longitude?: Float
  /** Title of the venue */
  title?: string
  /** Address of the venue */
  address?: string
  /** Optional. Foursquare identifier of the venue if known */
  foursquare_id?: string
  /** Optional. Foursquare type of the venue, if known. (For example, "arts_entertainment/default", "arts_entertainment/aquarium" or "food/icecream".) */
  foursquare_type?: string
  /** Optional. Google Places identifier of the venue */
  google_place_id?: string
  /** Optional. Google Places type of the venue. (See supported types.) */
  google_place_type?: string
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
  /** Optional. Content of the message to be sent instead of the venue */
  input_message_content?: InputMessageContent
  /** Optional. Url of the thumbnail for the result */
  thumb_url?: string
  /** Optional. Thumbnail width */
  thumb_width?: Integer
  /** Optional. Thumbnail height */
  thumb_height?: Integer
}

/**
 * Represents a contact with a phone number. By default, this contact will be sent by the user. Alternatively, you can use input_message_content to send a message with the specified content instead of the contact.
 * @see https://core.telegram.org/bots/api#inlinequeryresultcontact
 */
export interface InlineQueryResultContact {
  /** Type of the result, must be contact */
  type?: string
  /** Unique identifier for this result, 1-64 Bytes */
  id?: string
  /** Contact's phone number */
  phone_number?: string
  /** Contact's first name */
  first_name?: string
  /** Optional. Contact's last name */
  last_name?: string
  /** Optional. Additional data about the contact in the form of a vCard, 0-2048 bytes */
  vcard?: string
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
  /** Optional. Content of the message to be sent instead of the contact */
  input_message_content?: InputMessageContent
  /** Optional. Url of the thumbnail for the result */
  thumb_url?: string
  /** Optional. Thumbnail width */
  thumb_width?: Integer
  /** Optional. Thumbnail height */
  thumb_height?: Integer
}

/**
 * Represents a Game.
 * @see https://core.telegram.org/bots/api#inlinequeryresultgame
 */
export interface InlineQueryResultGame {
  /** Type of the result, must be game */
  type?: string
  /** Unique identifier for this result, 1-64 bytes */
  id?: string
  /** Short name of the game */
  game_short_name?: string
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
}

/**
 * Represents a link to a photo stored on the Telegram servers. By default, this photo will be sent by the user with an optional caption. Alternatively, you can use input_message_content to send a message with the specified content instead of the photo.
 * @see https://core.telegram.org/bots/api#inlinequeryresultcachedphoto
 */
export interface InlineQueryResultCachedPhoto {
  /** Type of the result, must be photo */
  type?: string
  /** Unique identifier for this result, 1-64 bytes */
  id?: string
  /** A valid file identifier of the photo */
  photo_file_id?: string
  /** Optional. Title for the result */
  title?: string
  /** Optional. Short description of the result */
  description?: string
  /** Optional. Caption of the photo to be sent, 0-1024 characters after entities parsing */
  caption?: string
  /** Optional. Mode for parsing entities in the photo caption. See formatting options for more details. */
  parse_mode?: string
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
  /** Optional. Content of the message to be sent instead of the photo */
  input_message_content?: InputMessageContent
}

/**
 * Represents a link to an animated GIF file stored on the Telegram servers. By default, this animated GIF file will be sent by the user with an optional caption. Alternatively, you can use input_message_content to send a message with specified content instead of the animation.
 * @see https://core.telegram.org/bots/api#inlinequeryresultcachedgif
 */
export interface InlineQueryResultCachedGif {
  /** Type of the result, must be gif */
  type?: string
  /** Unique identifier for this result, 1-64 bytes */
  id?: string
  /** A valid file identifier for the GIF file */
  gif_file_id?: string
  /** Optional. Title for the result */
  title?: string
  /** Optional. Caption of the GIF file to be sent, 0-1024 characters after entities parsing */
  caption?: string
  /** Optional. Mode for parsing entities in the caption. See formatting options for more details. */
  parse_mode?: string
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
  /** Optional. Content of the message to be sent instead of the GIF animation */
  input_message_content?: InputMessageContent
}

/**
 * Represents a link to a video animation (H.264/MPEG-4 AVC video without sound) stored on the Telegram servers. By default, this animated MPEG-4 file will be sent by the user with an optional caption. Alternatively, you can use input_message_content to send a message with the specified content instead of the animation.
 * @see https://core.telegram.org/bots/api#inlinequeryresultcachedmpeg4gif
 */
export interface InlineQueryResultCachedMpeg4Gif {
  /** Type of the result, must be mpeg4_gif */
  type?: string
  /** Unique identifier for this result, 1-64 bytes */
  id?: string
  /** A valid file identifier for the MP4 file */
  mpeg4_file_id?: string
  /** Optional. Title for the result */
  title?: string
  /** Optional. Caption of the MPEG-4 file to be sent, 0-1024 characters after entities parsing */
  caption?: string
  /** Optional. Mode for parsing entities in the caption. See formatting options for more details. */
  parse_mode?: string
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
  /** Optional. Content of the message to be sent instead of the video animation */
  input_message_content?: InputMessageContent
}

/**
 * Represents a link to a sticker stored on the Telegram servers. By default, this sticker will be sent by the user. Alternatively, you can use input_message_content to send a message with the specified content instead of the sticker.
 * @see https://core.telegram.org/bots/api#inlinequeryresultcachedsticker
 */
export interface InlineQueryResultCachedSticker {
  /** Type of the result, must be sticker */
  type?: string
  /** Unique identifier for this result, 1-64 bytes */
  id?: string
  /** A valid file identifier of the sticker */
  sticker_file_id?: string
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
  /** Optional. Content of the message to be sent instead of the sticker */
  input_message_content?: InputMessageContent
}

/**
 * Represents a link to a file stored on the Telegram servers. By default, this file will be sent by the user with an optional caption. Alternatively, you can use input_message_content to send a message with the specified content instead of the file.
 * @see https://core.telegram.org/bots/api#inlinequeryresultcacheddocument
 */
export interface InlineQueryResultCachedDocument {
  /** Type of the result, must be document */
  type?: string
  /** Unique identifier for this result, 1-64 bytes */
  id?: string
  /** Title for the result */
  title?: string
  /** A valid file identifier for the file */
  document_file_id?: string
  /** Optional. Short description of the result */
  description?: string
  /** Optional. Caption of the document to be sent, 0-1024 characters after entities parsing */
  caption?: string
  /** Optional. Mode for parsing entities in the document caption. See formatting options for more details. */
  parse_mode?: string
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
  /** Optional. Content of the message to be sent instead of the file */
  input_message_content?: InputMessageContent
}

/**
 * Represents a link to a video file stored on the Telegram servers. By default, this video file will be sent by the user with an optional caption. Alternatively, you can use input_message_content to send a message with the specified content instead of the video.
 * @see https://core.telegram.org/bots/api#inlinequeryresultcachedvideo
 */
export interface InlineQueryResultCachedVideo {
  /** Type of the result, must be video */
  type?: string
  /** Unique identifier for this result, 1-64 bytes */
  id?: string
  /** A valid file identifier for the video file */
  video_file_id?: string
  /** Title for the result */
  title?: string
  /** Optional. Short description of the result */
  description?: string
  /** Optional. Caption of the video to be sent, 0-1024 characters after entities parsing */
  caption?: string
  /** Optional. Mode for parsing entities in the video caption. See formatting options for more details. */
  parse_mode?: string
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
  /** Optional. Content of the message to be sent instead of the video */
  input_message_content?: InputMessageContent
}

/**
 * Represents a link to a voice message stored on the Telegram servers. By default, this voice message will be sent by the user. Alternatively, you can use input_message_content to send a message with the specified content instead of the voice message.
 * @see https://core.telegram.org/bots/api#inlinequeryresultcachedvoice
 */
export interface InlineQueryResultCachedVoice {
  /** Type of the result, must be voice */
  type?: string
  /** Unique identifier for this result, 1-64 bytes */
  id?: string
  /** A valid file identifier for the voice message */
  voice_file_id?: string
  /** Voice message title */
  title?: string
  /** Optional. Caption, 0-1024 characters after entities parsing */
  caption?: string
  /** Optional. Mode for parsing entities in the voice message caption. See formatting options for more details. */
  parse_mode?: string
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
  /** Optional. Content of the message to be sent instead of the voice message */
  input_message_content?: InputMessageContent
}

/**
 * Represents a link to an MP3 audio file stored on the Telegram servers. By default, this audio file will be sent by the user. Alternatively, you can use input_message_content to send a message with the specified content instead of the audio.
 * @see https://core.telegram.org/bots/api#inlinequeryresultcachedaudio
 */
export interface InlineQueryResultCachedAudio {
  /** Type of the result, must be audio */
  type?: string
  /** Unique identifier for this result, 1-64 bytes */
  id?: string
  /** A valid file identifier for the audio file */
  audio_file_id?: string
  /** Optional. Caption, 0-1024 characters after entities parsing */
  caption?: string
  /** Optional. Mode for parsing entities in the audio caption. See formatting options for more details. */
  parse_mode?: string
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
  /** Optional. Content of the message to be sent instead of the audio */
  input_message_content?: InputMessageContent
}

/**
 * This object represents the content of a message to be sent as a result of an inline query.
 * Telegram clients currently support the following 5 types:
 * - InputTextMessageContent
 * - InputLocationMessageContent
 * - InputVenueMessageContent
 * - InputContactMessageContent
 * - InputInvoiceMessageContent
 * @see https://core.telegram.org/bots/api#inputmessagecontent
 */
export type InputMessageContent =
  | InputTextMessageContent
  | InputLocationMessageContent
  | InputVenueMessageContent
  | InputContactMessageContent
  | InputInvoiceMessageContent

/**
 * Represents the content of a text message to be sent as the result of an inline query.
 * @see https://core.telegram.org/bots/api#inputtextmessagecontent
 */
export interface InputTextMessageContent {
  /** Text of the message to be sent, 1-4096 characters */
  message_text?: string
  /** Optional. Mode for parsing entities in the message text. See formatting options for more details. */
  parse_mode?: string
  /** Optional. List of special entities that appear in message text, which can be specified instead of parse_mode */
  entities?: MessageEntity[]
  /** Optional. Disables link previews for links in the sent message */
  disable_web_page_preview?: boolean
}

/**
 * Represents the content of a location message to be sent as the result of an inline query.
 * @see https://core.telegram.org/bots/api#inputlocationmessagecontent
 */
export interface InputLocationMessageContent {
  /** Latitude of the location in degrees */
  latitude?: Float
  /** Longitude of the location in degrees */
  longitude?: Float
  /** Optional. The radius of uncertainty for the location, measured in meters; 0-1500 */
  horizontal_accuracy?: Float
  /** Optional. Period in seconds for which the location can be updated, should be between 60 and 86400. */
  live_period?: Integer
  /** Optional. For live locations, a direction in which the user is moving, in degrees. Must be between 1 and 360 if specified. */
  heading?: Integer
  /** Optional. For live locations, a maximum distance for proximity alerts about approaching another chat member, in meters. Must be between 1 and 100000 if specified. */
  proximity_alert_radius?: Integer
}

/**
 * Represents the content of a venue message to be sent as the result of an inline query.
 * @see https://core.telegram.org/bots/api#inputvenuemessagecontent
 */
export interface InputVenueMessageContent {
  /** Latitude of the venue in degrees */
  latitude?: Float
  /** Longitude of the venue in degrees */
  longitude?: Float
  /** Name of the venue */
  title?: string
  /** Address of the venue */
  address?: string
  /** Optional. Foursquare identifier of the venue, if known */
  foursquare_id?: string
  /** Optional. Foursquare type of the venue, if known. (For example, "arts_entertainment/default", "arts_entertainment/aquarium" or "food/icecream".) */
  foursquare_type?: string
  /** Optional. Google Places identifier of the venue */
  google_place_id?: string
  /** Optional. Google Places type of the venue. (See supported types.) */
  google_place_type?: string
}

/**
 * Represents the content of a contact message to be sent as the result of an inline query.
 * @see https://core.telegram.org/bots/api#inputcontactmessagecontent
 */
export interface InputContactMessageContent {
  /** Contact's phone number */
  phone_number?: string
  /** Contact's first name */
  first_name?: string
  /** Optional. Contact's last name */
  last_name?: string
  /** Optional. Additional data about the contact in the form of a vCard, 0-2048 bytes */
  vcard?: string
}

/**
 * Represents the content of an invoice message to be sent as the result of an inline query.
 * @see https://core.telegram.org/bots/api#inputinvoicemessagecontent
 */
export interface InputInvoiceMessageContent {
  /** Product name, 1-32 characters */
  title?: string
  /** Product description, 1-255 characters */
  description?: string
  /** Bot-defined invoice payload, 1-128 bytes. This will not be displayed to the user, use for your internal processes. */
  payload?: string
  /** Payment provider token, obtained via Botfather */
  provider_token?: string
  /** Three-letter ISO 4217 currency code, see more on currencies */
  currency?: string
  /** Price breakdown, a JSON-serialized list of components (e.g. product price, tax, discount, delivery cost, delivery tax, bonus, etc.) */
  prices?: LabeledPrice[]
  /** Optional. The maximum accepted amount for tips in the smallest units of the currency (integer, not float/double). For example, for a maximum tip of US$ 1.45 pass max_tip_amount = 145. See the exp parameter in currencies.json, it shows the number of digits past the decimal point for each currency (2 for the majority of currencies). Defaults to 0 */
  max_tip_amount?: Integer
  /** Optional. A JSON-serialized array of suggested amounts of tip in the smallest units of the currency (integer, not float/double). At most 4 suggested tip amounts can be specified. The suggested tip amounts must be positive, passed in a strictly increased order and must not exceed max_tip_amount. */
  suggested_tip_amounts?: Integer[]
  /** Optional. A JSON-serialized object for data about the invoice, which will be shared with the payment provider. A detailed description of the required fields should be provided by the payment provider. */
  provider_data?: string
  /** Optional. URL of the product photo for the invoice. Can be a photo of the goods or a marketing image for a service. People like it better when they see what they are paying for. */
  photo_url?: string
  /** Optional. Photo size */
  photo_size?: Integer
  /** Optional. Photo width */
  photo_width?: Integer
  /** Optional. Photo height */
  photo_height?: Integer
  /** Optional. Pass True, if you require the user's full name to complete the order */
  need_name?: boolean
  /** Optional. Pass True, if you require the user's phone number to complete the order */
  need_phone_number?: boolean
  /** Optional. Pass True, if you require the user's email address to complete the order */
  need_email?: boolean
  /** Optional. Pass True, if you require the user's shipping address to complete the order */
  need_shipping_address?: boolean
  /** Optional. Pass True, if user's phone number should be sent to provider */
  send_phone_number_to_provider?: boolean
  /** Optional. Pass True, if user's email address should be sent to provider */
  send_email_to_provider?: boolean
  /** Optional. Pass True, if the final price depends on the shipping method */
  is_flexible?: boolean
}

/**
 * Represents a result of an inline query that was chosen by the user and sent to their chat partner.
 * @see https://core.telegram.org/bots/api#choseninlineresult
 */
export interface ChosenInlineResult {
  /** The unique identifier for the result that was chosen */
  result_id?: string
  /** The user that chose the result */
  from?: User
  /** Optional. Sender location, only for bots that require user location */
  location?: Location
  /** Optional. Identifier of the sent inline message. Available only if there is an inline keyboard attached to the message. Will be also received in callback queries and can be used to edit the message. */
  inline_message_id?: string
  /** The query that was used to obtain the result */
  query?: string
}

declare module './update' {
  interface Update {
    /** Optional. New incoming inline query */
    inline_query?: InlineQuery
    /** Optional. The result of an inline query that was chosen by a user and sent to their chat partner. Please see our documentation on the feedback collecting for details on how to enable these updates for your bot. */
    chosen_inline_result?: ChosenInlineResult
  }
}

declare module './internal' {
  interface Internal {
    /**
     * Use this method to send answers to an inline query. On success, True is returned. No more than 50 results per query are allowed.
     * @see https://core.telegram.org/bots/api#answerinlinequery
     */
    answerInlineQuery(payload: AnswerInlineQueryPayload): Promise<boolean>
  }
}

Internal.define('answerInlineQuery')
