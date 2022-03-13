export type Integer = number
export type Float = number
export type String = string
export type Boolean = boolean
export type True = true

/**
 * This object represents an incoming update. At most one of the optional parameters can be present in any given update.
 * @see https://core.telegram.org/bots/api#update
 */
export interface Update {
  /** The update's unique identifier. Update identifiers start from a certain positive number and increase sequentially. This ID becomes especially handy if you're using Webhooks, since it allows you to ignore repeated updates or to restore the correct update sequence, should they get out of order. If there are no new updates for at least a week, then identifier of the next update will be chosen randomly instead of sequentially. */
  update_id?: Integer
  /** Optional. New incoming message of any kind — text, photo, sticker, etc. */
  message?: Message
  /** Optional. New version of a message that is known to the bot and was edited */
  edited_message?: Message
  /** Optional. New incoming channel post of any kind — text, photo, sticker, etc. */
  channel_post?: Message
  /** Optional. New version of a channel post that is known to the bot and was edited */
  edited_channel_post?: Message
  /** Optional. New incoming inline query */
  inline_query?: InlineQuery
  /** Optional. The result of an inline query that was chosen by a user and sent to their chat partner. Please see our documentation on the feedback collecting for details on how to enable these updates for your bot. */
  chosen_inline_result?: ChosenInlineResult
  /** Optional. New incoming callback query */
  callback_query?: CallbackQuery
  /** Optional. New incoming shipping query. Only for invoices with flexible price */
  shipping_query?: ShippingQuery
  /** Optional. New incoming pre-checkout query. Contains full information about checkout */
  pre_checkout_query?: PreCheckoutQuery
  /** Optional. New poll state. Bots receive only updates about stopped polls and polls, which are sent by the bot */
  poll?: Poll
  /** Optional. A user changed their answer in a non-anonymous poll. Bots receive new votes only in polls that were sent by the bot itself. */
  poll_answer?: PollAnswer
  /** Optional. The bot's chat member status was updated in a chat. For private chats, this update is received only when the bot is blocked or unblocked by the user. */
  my_chat_member?: ChatMemberUpdated
  /** Optional. A chat member's status was updated in a chat. The bot must be an administrator in the chat and must explicitly specify "chat_member" in the list of allowed_updates to receive these updates. */
  chat_member?: ChatMemberUpdated
  /** Optional. A request to join the chat has been sent. The bot must have the can_invite_users administrator right in the chat to receive these updates. */
  chat_join_request?: ChatJoinRequest
}

export interface GetUpdatesPayload {
  /** Identifier of the first update to be returned. Must be greater by one than the highest among the identifiers of previously received updates. By default, updates starting with the earliest unconfirmed update are returned. An update is considered confirmed as soon as getUpdates is called with an offset higher than its update_id. The negative offset can be specified to retrieve updates starting from -offset update from the end of the updates queue. All previous updates will forgotten. */
  offset?: Integer
  /** Limits the number of updates to be retrieved. Values between 1-100 are accepted. Defaults to 100. */
  limit?: Integer
  /** Timeout in seconds for long polling. Defaults to 0, i.e. usual short polling. Should be positive, short polling should be used for testing purposes only. */
  timeout?: Integer
  /**
   * A JSON-serialized list of the update types you want your bot to receive. For example, specify ["message", "edited_channel_post", "callback_query"] to only receive updates of these types. See Update for a complete list of available update types. Specify an empty list to receive all update types except chat_member (default). If not specified, the previous setting will be used.
   * Please note that this parameter doesn't affect updates created before the call to the getUpdates, so unwanted updates may be received for a short period of time.
   */
  allowed_updates?: String[]
}

export interface SetWebhookPayload {
  /** HTTPS url to send updates to. Use an empty string to remove webhook integration */
  url?: String
  /** Upload your public key certificate so that the root certificate in use can be checked. See our self-signed guide for details. */
  certificate?: InputFile
  /** The fixed IP address which will be used to send webhook requests instead of the IP address resolved through DNS */
  ip_address?: String
  /** Maximum allowed number of simultaneous HTTPS connections to the webhook for update delivery, 1-100. Defaults to 40. Use lower values to limit the load on your bot's server, and higher values to increase your bot's throughput. */
  max_connections?: Integer
  /**
   * A JSON-serialized list of the update types you want your bot to receive. For example, specify ["message", "edited_channel_post", "callback_query"] to only receive updates of these types. See Update for a complete list of available update types. Specify an empty list to receive all update types except chat_member (default). If not specified, the previous setting will be used.
   *
   * Please note that this parameter doesn't affect updates created before the call to the setWebhook, so unwanted updates may be received for a short period of time.
   */
  allowed_updates?: String[]
  /** Pass True to drop all pending updates */
  drop_pending_updates?: Boolean
}

export interface DeleteWebhookPayload {
  /** Pass True to drop all pending updates */
  drop_pending_updates?: Boolean
}

/**
 * Contains information about the current status of a webhook.
 * @see https://core.telegram.org/bots/api#webhookinfo
 */
export interface WebhookInfo {
  /** Webhook URL, may be empty if webhook is not set up */
  url?: String
  /** True, if a custom certificate was provided for webhook certificate checks */
  has_custom_certificate?: Boolean
  /** Number of updates awaiting delivery */
  pending_update_count?: Integer
  /** Optional. Currently used webhook IP address */
  ip_address?: String
  /** Optional. Unix time for the most recent error that happened when trying to deliver an update via webhook */
  last_error_date?: Integer
  /** Optional. Error message in human-readable format for the most recent error that happened when trying to deliver an update via webhook */
  last_error_message?: String
  /** Optional. Maximum allowed number of simultaneous HTTPS connections to the webhook for update delivery */
  max_connections?: Integer
  /** Optional. A list of update types the bot is subscribed to. Defaults to all update types except chat_member */
  allowed_updates?: String[]
}

/**
 * This object represents a Telegram user or bot.
 * @see https://core.telegram.org/bots/api#user
 */
export interface User {
  /** Unique identifier for this user or bot. This number may have more than 32 significant bits and some programming languages may have difficulty/silent defects in interpreting it. But it has at most 52 significant bits, so a 64-bit integer or double-precision float type are safe for storing this identifier. */
  id?: Integer
  /** True, if this user is a bot */
  is_bot?: Boolean
  /** User's or bot's first name */
  first_name?: String
  /** Optional. User's or bot's last name */
  last_name?: String
  /** Optional. User's or bot's username */
  username?: String
  /** Optional. IETF language tag of the user's language */
  language_code?: String
  /** Optional. True, if the bot can be invited to groups. Returned only in getMe. */
  can_join_groups?: Boolean
  /** Optional. True, if privacy mode is disabled for the bot. Returned only in getMe. */
  can_read_all_group_messages?: Boolean
  /** Optional. True, if the bot supports inline queries. Returned only in getMe. */
  supports_inline_queries?: Boolean
}

/**
 * This object represents a chat.
 * @see https://core.telegram.org/bots/api#chat
 */
export interface Chat {
  /** Unique identifier for this chat. This number may have more than 32 significant bits and some programming languages may have difficulty/silent defects in interpreting it. But it has at most 52 significant bits, so a signed 64-bit integer or double-precision float type are safe for storing this identifier. */
  id?: Integer
  /** Type of chat, can be either "private", "group", "supergroup" or "channel" */
  type?: String
  /** Optional. Title, for supergroups, channels and group chats */
  title?: String
  /** Optional. Username, for private chats, supergroups and channels if available */
  username?: String
  /** Optional. First name of the other party in a private chat */
  first_name?: String
  /** Optional. Last name of the other party in a private chat */
  last_name?: String
  /** Optional. Chat photo. Returned only in getChat. */
  photo?: ChatPhoto
  /** Optional. Bio of the other party in a private chat. Returned only in getChat. */
  bio?: String
  /** Optional. True, if privacy settings of the other party in the private chat allows to use tg://user?id=<user_id> links only in chats with the user. Returned only in getChat. */
  has_private_forwards?: True
  /** Optional. Description, for groups, supergroups and channel chats. Returned only in getChat. */
  description?: String
  /** Optional. Primary invite link, for groups, supergroups and channel chats. Returned only in getChat. */
  invite_link?: String
  /** Optional. The most recent pinned message (by sending date). Returned only in getChat. */
  pinned_message?: Message
  /** Optional. Default chat member permissions, for groups and supergroups. Returned only in getChat. */
  permissions?: ChatPermissions
  /** Optional. For supergroups, the minimum allowed delay between consecutive messages sent by each unpriviledged user; in seconds. Returned only in getChat. */
  slow_mode_delay?: Integer
  /** Optional. The time after which all messages sent to the chat will be automatically deleted; in seconds. Returned only in getChat. */
  message_auto_delete_time?: Integer
  /** Optional. True, if messages from the chat can't be forwarded to other chats. Returned only in getChat. */
  has_protected_content?: True
  /** Optional. For supergroups, name of group sticker set. Returned only in getChat. */
  sticker_set_name?: String
  /** Optional. True, if the bot can change the group sticker set. Returned only in getChat. */
  can_set_sticker_set?: True
  /** Optional. Unique identifier for the linked chat, i.e. the discussion group identifier for a channel and vice versa; for supergroups and channel chats. This identifier may be greater than 32 bits and some programming languages may have difficulty/silent defects in interpreting it. But it is smaller than 52 bits, so a signed 64 bit integer or double-precision float type are safe for storing this identifier. Returned only in getChat. */
  linked_chat_id?: Integer
  /** Optional. For supergroups, the location to which the supergroup is connected. Returned only in getChat. */
  location?: ChatLocation
}

/**
 * This object represents a message.
 * @see https://core.telegram.org/bots/api#message
 */
export interface Message {
  /** Unique message identifier inside this chat */
  message_id?: Integer
  /** Optional. Sender of the message; empty for messages sent to channels. For backward compatibility, the field contains a fake sender user in non-channel chats, if the message was sent on behalf of a chat. */
  from?: User
  /** Optional. Sender of the message, sent on behalf of a chat. For example, the channel itself for channel posts, the supergroup itself for messages from anonymous group administrators, the linked channel for messages automatically forwarded to the discussion group. For backward compatibility, the field from contains a fake sender user in non-channel chats, if the message was sent on behalf of a chat. */
  sender_chat?: Chat
  /** Date the message was sent in Unix time */
  date?: Integer
  /** Conversation the message belongs to */
  chat?: Chat
  /** Optional. For forwarded messages, sender of the original message */
  forward_from?: User
  /** Optional. For messages forwarded from channels or from anonymous administrators, information about the original sender chat */
  forward_from_chat?: Chat
  /** Optional. For messages forwarded from channels, identifier of the original message in the channel */
  forward_from_message_id?: Integer
  /** Optional. For forwarded messages that were originally sent in channels or by an anonymous chat administrator, signature of the message sender if present */
  forward_signature?: String
  /** Optional. Sender's name for messages forwarded from users who disallow adding a link to their account in forwarded messages */
  forward_sender_name?: String
  /** Optional. For forwarded messages, date the original message was sent in Unix time */
  forward_date?: Integer
  /** Optional. True, if the message is a channel post that was automatically forwarded to the connected discussion group */
  is_automatic_forward?: True
  /** Optional. For replies, the original message. Note that the Message object in this field will not contain further reply_to_message fields even if it itself is a reply. */
  reply_to_message?: Message
  /** Optional. Bot through which the message was sent */
  via_bot?: User
  /** Optional. Date the message was last edited in Unix time */
  edit_date?: Integer
  /** Optional. True, if the message can't be forwarded */
  has_protected_content?: True
  /** Optional. The unique identifier of a media message group this message belongs to */
  media_group_id?: String
  /** Optional. Signature of the post author for messages in channels, or the custom title of an anonymous group administrator */
  author_signature?: String
  /** Optional. For text messages, the actual UTF-8 text of the message, 0-4096 characters */
  text?: String
  /** Optional. For text messages, special entities like usernames, URLs, bot commands, etc. that appear in the text */
  entities?: MessageEntity[]
  /** Optional. Message is an animation, information about the animation. For backward compatibility, when this field is set, the document field will also be set */
  animation?: Animation
  /** Optional. Message is an audio file, information about the file */
  audio?: Audio
  /** Optional. Message is a general file, information about the file */
  document?: Document
  /** Optional. Message is a photo, available sizes of the photo */
  photo?: PhotoSize[]
  /** Optional. Message is a sticker, information about the sticker */
  sticker?: Sticker
  /** Optional. Message is a video, information about the video */
  video?: Video
  /** Optional. Message is a video note, information about the video message */
  video_note?: VideoNote
  /** Optional. Message is a voice message, information about the file */
  voice?: Voice
  /** Optional. Caption for the animation, audio, document, photo, video or voice, 0-1024 characters */
  caption?: String
  /** Optional. For messages with a caption, special entities like usernames, URLs, bot commands, etc. that appear in the caption */
  caption_entities?: MessageEntity[]
  /** Optional. Message is a shared contact, information about the contact */
  contact?: Contact
  /** Optional. Message is a dice with random value */
  dice?: Dice
  /** Optional. Message is a game, information about the game. More about games » */
  game?: Game
  /** Optional. Message is a native poll, information about the poll */
  poll?: Poll
  /** Optional. Message is a venue, information about the venue. For backward compatibility, when this field is set, the location field will also be set */
  venue?: Venue
  /** Optional. Message is a shared location, information about the location */
  location?: Location
  /** Optional. New members that were added to the group or supergroup and information about them (the bot itself may be one of these members) */
  new_chat_members?: User[]
  /** Optional. A member was removed from the group, information about them (this member may be the bot itself) */
  left_chat_member?: User
  /** Optional. A chat title was changed to this value */
  new_chat_title?: String
  /** Optional. A chat photo was change to this value */
  new_chat_photo?: PhotoSize[]
  /** Optional. Service message: the chat photo was deleted */
  delete_chat_photo?: True
  /** Optional. Service message: the group has been created */
  group_chat_created?: True
  /** Optional. Service message: the supergroup has been created. This field can't be received in a message coming through updates, because bot can't be a member of a supergroup when it is created. It can only be found in reply_to_message if someone replies to a very first message in a directly created supergroup. */
  supergroup_chat_created?: True
  /** Optional. Service message: the channel has been created. This field can't be received in a message coming through updates, because bot can't be a member of a channel when it is created. It can only be found in reply_to_message if someone replies to a very first message in a channel. */
  channel_chat_created?: True
  /** Optional. Service message: auto-delete timer settings changed in the chat */
  message_auto_delete_timer_changed?: MessageAutoDeleteTimerChanged
  /** Optional. The group has been migrated to a supergroup with the specified identifier. This number may have more than 32 significant bits and some programming languages may have difficulty/silent defects in interpreting it. But it has at most 52 significant bits, so a signed 64-bit integer or double-precision float type are safe for storing this identifier. */
  migrate_to_chat_id?: Integer
  /** Optional. The supergroup has been migrated from a group with the specified identifier. This number may have more than 32 significant bits and some programming languages may have difficulty/silent defects in interpreting it. But it has at most 52 significant bits, so a signed 64-bit integer or double-precision float type are safe for storing this identifier. */
  migrate_from_chat_id?: Integer
  /** Optional. Specified message was pinned. Note that the Message object in this field will not contain further reply_to_message fields even if it is itself a reply. */
  pinned_message?: Message
  /** Optional. Message is an invoice for a payment, information about the invoice. More about payments » */
  invoice?: Invoice
  /** Optional. Message is a service message about a successful payment, information about the payment. More about payments » */
  successful_payment?: SuccessfulPayment
  /** Optional. The domain name of the website on which the user has logged in. More about Telegram Login » */
  connected_website?: String
  /** Optional. Telegram Passport data */
  passport_data?: PassportData
  /** Optional. Service message. A user in the chat triggered another user's proximity alert while sharing Live Location. */
  proximity_alert_triggered?: ProximityAlertTriggered
  /** Optional. Service message: voice chat scheduled */
  voice_chat_scheduled?: VoiceChatScheduled
  /** Optional. Service message: voice chat started */
  voice_chat_started?: VoiceChatStarted
  /** Optional. Service message: voice chat ended */
  voice_chat_ended?: VoiceChatEnded
  /** Optional. Service message: new participants invited to a voice chat */
  voice_chat_participants_invited?: VoiceChatParticipantsInvited
  /** Optional. Inline keyboard attached to the message. login_url buttons are represented as ordinary url buttons. */
  reply_markup?: InlineKeyboardMarkup
}

/**
 * This object represents a unique message identifier.
 * @see https://core.telegram.org/bots/api#messageid
 */
export interface MessageId {
  /** Unique message identifier */
  message_id?: Integer
}

/**
 * This object represents one special entity in a text message. For example, hashtags, usernames, URLs, etc.
 * @see https://core.telegram.org/bots/api#messageentity
 */
export interface MessageEntity {
  /** Type of the entity. Currently, can be "mention" (@username), "hashtag" (#hashtag), "cashtag" ($USD), "bot_command" (/start@jobs_bot), "url" (https://telegram.org), "email" (do-not-reply@telegram.org), "phone_number" (+1-212-555-0123), "bold" (bold text), "italic" (italic text), "underline" (underlined text), "strikethrough" (strikethrough text), "spoiler" (spoiler message), "code" (monowidth string), "pre" (monowidth block), "text_link" (for clickable text URLs), "text_mention" (for users without usernames) */
  type?: String
  /** Offset in UTF-16 code units to the start of the entity */
  offset?: Integer
  /** Length of the entity in UTF-16 code units */
  length?: Integer
  /** Optional. For "text_link" only, url that will be opened after user taps on the text */
  url?: String
  /** Optional. For "text_mention" only, the mentioned user */
  user?: User
  /** Optional. For "pre" only, the programming language of the entity text */
  language?: String
}

/**
 * This object represents one size of a photo or a file / sticker thumbnail.
 * @see https://core.telegram.org/bots/api#photosize
 */
export interface PhotoSize {
  /** Identifier for this file, which can be used to download or reuse the file */
  file_id?: String
  /** Unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
  file_unique_id?: String
  /** Photo width */
  width?: Integer
  /** Photo height */
  height?: Integer
  /** Optional. File size in bytes */
  file_size?: Integer
}

/**
 * This object represents an animation file (GIF or H.264/MPEG-4 AVC video without sound).
 * @see https://core.telegram.org/bots/api#animation
 */
export interface Animation {
  /** Identifier for this file, which can be used to download or reuse the file */
  file_id?: String
  /** Unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
  file_unique_id?: String
  /** Video width as defined by sender */
  width?: Integer
  /** Video height as defined by sender */
  height?: Integer
  /** Duration of the video in seconds as defined by sender */
  duration?: Integer
  /** Optional. Animation thumbnail as defined by sender */
  thumb?: PhotoSize
  /** Optional. Original animation filename as defined by sender */
  file_name?: String
  /** Optional. MIME type of the file as defined by sender */
  mime_type?: String
  /** Optional. File size in bytes */
  file_size?: Integer
}

/**
 * This object represents an audio file to be treated as music by the Telegram clients.
 * @see https://core.telegram.org/bots/api#audio
 */
export interface Audio {
  /** Identifier for this file, which can be used to download or reuse the file */
  file_id?: String
  /** Unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
  file_unique_id?: String
  /** Duration of the audio in seconds as defined by sender */
  duration?: Integer
  /** Optional. Performer of the audio as defined by sender or by audio tags */
  performer?: String
  /** Optional. Title of the audio as defined by sender or by audio tags */
  title?: String
  /** Optional. Original filename as defined by sender */
  file_name?: String
  /** Optional. MIME type of the file as defined by sender */
  mime_type?: String
  /** Optional. File size in bytes */
  file_size?: Integer
  /** Optional. Thumbnail of the album cover to which the music file belongs */
  thumb?: PhotoSize
}

/**
 * This object represents a general file (as opposed to photos, voice messages and audio files).
 * @see https://core.telegram.org/bots/api#document
 */
export interface Document {
  /** Identifier for this file, which can be used to download or reuse the file */
  file_id?: String
  /** Unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
  file_unique_id?: String
  /** Optional. Document thumbnail as defined by sender */
  thumb?: PhotoSize
  /** Optional. Original filename as defined by sender */
  file_name?: String
  /** Optional. MIME type of the file as defined by sender */
  mime_type?: String
  /** Optional. File size in bytes */
  file_size?: Integer
}

/**
 * This object represents a video file.
 * @see https://core.telegram.org/bots/api#video
 */
export interface Video {
  /** Identifier for this file, which can be used to download or reuse the file */
  file_id?: String
  /** Unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
  file_unique_id?: String
  /** Video width as defined by sender */
  width?: Integer
  /** Video height as defined by sender */
  height?: Integer
  /** Duration of the video in seconds as defined by sender */
  duration?: Integer
  /** Optional. Video thumbnail */
  thumb?: PhotoSize
  /** Optional. Original filename as defined by sender */
  file_name?: String
  /** Optional. Mime type of a file as defined by sender */
  mime_type?: String
  /** Optional. File size in bytes */
  file_size?: Integer
}

/**
 * This object represents a video message (available in Telegram apps as of v.4.0).
 * @see https://core.telegram.org/bots/api#videonote
 */
export interface VideoNote {
  /** Identifier for this file, which can be used to download or reuse the file */
  file_id?: String
  /** Unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
  file_unique_id?: String
  /** Video width and height (diameter of the video message) as defined by sender */
  length?: Integer
  /** Duration of the video in seconds as defined by sender */
  duration?: Integer
  /** Optional. Video thumbnail */
  thumb?: PhotoSize
  /** Optional. File size in bytes */
  file_size?: Integer
}

/**
 * This object represents a voice note.
 * @see https://core.telegram.org/bots/api#voice
 */
export interface Voice {
  /** Identifier for this file, which can be used to download or reuse the file */
  file_id?: String
  /** Unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
  file_unique_id?: String
  /** Duration of the audio in seconds as defined by sender */
  duration?: Integer
  /** Optional. MIME type of the file as defined by sender */
  mime_type?: String
  /** Optional. File size in bytes */
  file_size?: Integer
}

/**
 * This object represents a phone contact.
 * @see https://core.telegram.org/bots/api#contact
 */
export interface Contact {
  /** Contact's phone number */
  phone_number?: String
  /** Contact's first name */
  first_name?: String
  /** Optional. Contact's last name */
  last_name?: String
  /** Optional. Contact's user identifier in Telegram. This number may have more than 32 significant bits and some programming languages may have difficulty/silent defects in interpreting it. But it has at most 52 significant bits, so a 64-bit integer or double-precision float type are safe for storing this identifier. */
  user_id?: Integer
  /** Optional. Additional data about the contact in the form of a vCard */
  vcard?: String
}

/**
 * This object represents an animated emoji that displays a random value.
 * @see https://core.telegram.org/bots/api#dice
 */
export interface Dice {
  /** Emoji on which the dice throw animation is based */
  emoji?: String
  /** Value of the dice, 1-6 for "", "" and "" base emoji, 1-5 for "" and "" base emoji, 1-64 for "" base emoji */
  value?: Integer
}

/**
 * This object contains information about one answer option in a poll.
 * @see https://core.telegram.org/bots/api#polloption
 */
export interface PollOption {
  /** Option text, 1-100 characters */
  text?: String
  /** Number of users that voted for this option */
  voter_count?: Integer
}

/**
 * This object represents an answer of a user in a non-anonymous poll.
 * @see https://core.telegram.org/bots/api#pollanswer
 */
export interface PollAnswer {
  /** Unique poll identifier */
  poll_id?: String
  /** The user, who changed the answer to the poll */
  user?: User
  /** 0-based identifiers of answer options, chosen by the user. May be empty if the user retracted their vote. */
  option_ids?: Integer[]
}

/**
 * This object contains information about a poll.
 * @see https://core.telegram.org/bots/api#poll
 */
export interface Poll {
  /** Unique poll identifier */
  id?: String
  /** Poll question, 1-300 characters */
  question?: String
  /** List of poll options */
  options?: PollOption[]
  /** Total number of users that voted in the poll */
  total_voter_count?: Integer
  /** True, if the poll is closed */
  is_closed?: Boolean
  /** True, if the poll is anonymous */
  is_anonymous?: Boolean
  /** Poll type, currently can be "regular" or "quiz" */
  type?: String
  /** True, if the poll allows multiple answers */
  allows_multiple_answers?: Boolean
  /** Optional. 0-based identifier of the correct answer option. Available only for polls in the quiz mode, which are closed, or was sent (not forwarded) by the bot or to the private chat with the bot. */
  correct_option_id?: Integer
  /** Optional. Text that is shown when a user chooses an incorrect answer or taps on the lamp icon in a quiz-style poll, 0-200 characters */
  explanation?: String
  /** Optional. Special entities like usernames, URLs, bot commands, etc. that appear in the explanation */
  explanation_entities?: MessageEntity[]
  /** Optional. Amount of time in seconds the poll will be active after creation */
  open_period?: Integer
  /** Optional. Point in time (Unix timestamp) when the poll will be automatically closed */
  close_date?: Integer
}

/**
 * This object represents a point on the map.
 * @see https://core.telegram.org/bots/api#location
 */
export interface Location {
  /** Longitude as defined by sender */
  longitude?: Float
  /** Latitude as defined by sender */
  latitude?: Float
  /** Optional. The radius of uncertainty for the location, measured in meters; 0-1500 */
  horizontal_accuracy?: Float
  /** Optional. Time relative to the message sending date, during which the location can be updated; in seconds. For active live locations only. */
  live_period?: Integer
  /** Optional. The direction in which user is moving, in degrees; 1-360. For active live locations only. */
  heading?: Integer
  /** Optional. Maximum distance for proximity alerts about approaching another chat member, in meters. For sent live locations only. */
  proximity_alert_radius?: Integer
}

/**
 * This object represents a venue.
 * @see https://core.telegram.org/bots/api#venue
 */
export interface Venue {
  /** Venue location. Can't be a live location */
  location?: Location
  /** Name of the venue */
  title?: String
  /** Address of the venue */
  address?: String
  /** Optional. Foursquare identifier of the venue */
  foursquare_id?: String
  /** Optional. Foursquare type of the venue. (For example, "arts_entertainment/default", "arts_entertainment/aquarium" or "food/icecream".) */
  foursquare_type?: String
  /** Optional. Google Places identifier of the venue */
  google_place_id?: String
  /** Optional. Google Places type of the venue. (See supported types.) */
  google_place_type?: String
}

/**
 * This object represents the content of a service message, sent whenever a user in the chat triggers a proximity alert set by another user.
 * @see https://core.telegram.org/bots/api#proximityalerttriggered
 */
export interface ProximityAlertTriggered {
  /** User that triggered the alert */
  traveler?: User
  /** User that set the alert */
  watcher?: User
  /** The distance between the users */
  distance?: Integer
}

/**
 * This object represents a service message about a change in auto-delete timer settings.
 * @see https://core.telegram.org/bots/api#messageautodeletetimerchanged
 */
export interface MessageAutoDeleteTimerChanged {
  /** New auto-delete time for messages in the chat; in seconds */
  message_auto_delete_time?: Integer
}

/**
 * This object represents a service message about a voice chat scheduled in the chat.
 * @see https://core.telegram.org/bots/api#voicechatscheduled
 */
export interface VoiceChatScheduled {
  /** Point in time (Unix timestamp) when the voice chat is supposed to be started by a chat administrator */
  start_date?: Integer
}

/**
 * This object represents a service message about a voice chat started in the chat. Currently holds no information.
 * @see https://core.telegram.org/bots/api#voicechatstarted
 */
export type VoiceChatStarted = any

/**
 * This object represents a service message about a voice chat ended in the chat.
 * @see https://core.telegram.org/bots/api#voicechatended
 */
export interface VoiceChatEnded {
  /** Voice chat duration in seconds */
  duration?: Integer
}

/**
 * This object represents a service message about new members invited to a voice chat.
 * @see https://core.telegram.org/bots/api#voicechatparticipantsinvited
 */
export interface VoiceChatParticipantsInvited {
  /** Optional. New members that were invited to the voice chat */
  users?: User[]
}

/**
 * This object represent a user's profile pictures.
 * @see https://core.telegram.org/bots/api#userprofilephotos
 */
export interface UserProfilePhotos {
  /** Total number of profile pictures the target user has */
  total_count?: Integer
  /** Requested profile pictures (in up to 4 sizes each) */
  photos?: PhotoSize[][]
}

/**
 * This object represents a file ready to be downloaded. The file can be downloaded via the link https://api.telegram.org/file/bot<token>/<file_path>. It is guaranteed that the link will be valid for at least 1 hour. When the link expires, a new one can be requested by calling getFile.
 * Maximum file size to download is 20 MB
 * @see https://core.telegram.org/bots/api#file
 */
export interface File {
  /** Identifier for this file, which can be used to download or reuse the file */
  file_id?: String
  /** Unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
  file_unique_id?: String
  /** Optional. File size in bytes, if known */
  file_size?: Integer
  /** Optional. File path. Use https://api.telegram.org/file/bot<token>/<file_path> to get the file. */
  file_path?: String
}

/**
 * This object represents a custom keyboard with reply options (see Introduction to bots for details and examples).
 * @see https://core.telegram.org/bots/api#replykeyboardmarkup
 */
export interface ReplyKeyboardMarkup {
  /** button rows, each represented by an Array of KeyboardButton objects */
  keyboard?: KeyboardButton[][]
  /** Optional. Requests clients to resize the keyboard vertically for optimal fit (e.g., make the keyboard smaller if there are just two rows of buttons). Defaults to false, in which case the custom keyboard is always of the same height as the app's standard keyboard. */
  resize_keyboard?: Boolean
  /** Optional. Requests clients to hide the keyboard as soon as it's been used. The keyboard will still be available, but clients will automatically display the usual letter-keyboard in the chat – the user can press a special button in the input field to see the custom keyboard again. Defaults to false. */
  one_time_keyboard?: Boolean
  /** Optional. The placeholder to be shown in the input field when the keyboard is active; 1-64 characters */
  input_field_placeholder?: String
  /** Optional. Use this parameter if you want to show the keyboard to specific users only. Targets: 1) users that are @mentioned in the text of the Message object; 2) if the bot's message is a reply (has reply_to_message_id), sender of the original message.

Example: A user requests to change the bot's language, bot replies to the request with a keyboard to select the new language. Other users in the group don't see the keyboard. */
  selective?: Boolean
}

/**
 * This object represents one button of the reply keyboard. For simple text buttons String can be used instead of this object to specify text of the button. Optional fields request_contact, request_location, and request_poll are mutually exclusive.
 * @see https://core.telegram.org/bots/api#keyboardbutton
 */
export interface KeyboardButton {
  /** Text of the button. If none of the optional fields are used, it will be sent as a message when the button is pressed */
  text?: String
  /** Optional. If True, the user's phone number will be sent as a contact when the button is pressed. Available in private chats only */
  request_contact?: Boolean
  /** Optional. If True, the user's current location will be sent when the button is pressed. Available in private chats only */
  request_location?: Boolean
  /** Optional. If specified, the user will be asked to create a poll and send it to the bot when the button is pressed. Available in private chats only */
  request_poll?: KeyboardButtonPollType
}

/**
 * This object represents type of a poll, which is allowed to be created and sent when the corresponding button is pressed.
 * @see https://core.telegram.org/bots/api#keyboardbuttonpolltype
 */
export interface KeyboardButtonPollType {
  /** Optional. If quiz is passed, the user will be allowed to create only polls in the quiz mode. If regular is passed, only regular polls will be allowed. Otherwise, the user will be allowed to create a poll of any type. */
  type?: String
}

/**
 * Upon receiving a message with this object, Telegram clients will remove the current custom keyboard and display the default letter-keyboard. By default, custom keyboards are displayed until a new keyboard is sent by a bot. An exception is made for one-time keyboards that are hidden immediately after the user presses a button (see ReplyKeyboardMarkup).
 * @see https://core.telegram.org/bots/api#replykeyboardremove
 */
export interface ReplyKeyboardRemove {
  /** Requests clients to remove the custom keyboard (user will not be able to summon this keyboard; if you want to hide the keyboard from sight but keep it accessible, use one_time_keyboard in ReplyKeyboardMarkup) */
  remove_keyboard?: True
  /** Optional. Use this parameter if you want to remove the keyboard for specific users only. Targets: 1) users that are @mentioned in the text of the Message object; 2) if the bot's message is a reply (has reply_to_message_id), sender of the original message.

Example: A user votes in a poll, bot returns confirmation message in reply to the vote and removes the keyboard for that user, while still showing the keyboard with poll options to users who haven't voted yet. */
  selective?: Boolean
}

/**
 * This object represents an inline keyboard that appears right next to the message it belongs to.
 * @see https://core.telegram.org/bots/api#inlinekeyboardmarkup
 */
export interface InlineKeyboardMarkup {
  /** button rows, each represented by an Array of InlineKeyboardButton objects */
  inline_keyboard?: InlineKeyboardButton[][]
}

/**
 * This object represents one button of an inline keyboard. You must use exactly one of the optional fields.
 * @see https://core.telegram.org/bots/api#inlinekeyboardbutton
 */
export interface InlineKeyboardButton {
  /** Label text on the button */
  text?: String
  /** Optional. HTTP or tg:// url to be opened when the button is pressed. Links tg://user?id=<user_id> can be used to mention a user by their ID without using a username, if this is allowed by their privacy settings. */
  url?: String
  /** Optional. An HTTP URL used to automatically authorize the user. Can be used as a replacement for the Telegram Login Widget. */
  login_url?: LoginUrl
  /** Optional. Data to be sent in a callback query to the bot when button is pressed, 1-64 bytes */
  callback_data?: String
  /**
   * Optional. If set, pressing the button will prompt the user to select one of their chats, open that chat and insert the bot's username and the specified inline query in the input field. Can be empty, in which case just the bot's username will be inserted.
   *
   * Note: This offers an easy way for users to start using your bot in inline mode when they are currently in a private chat with it. Especially useful when combined with switch_pm... actions – in this case the user will be automatically returned to the chat they switched from, skipping the chat selection screen.
   */
  switch_inline_query?: String
  /**
   * Optional. If set, pressing the button will insert the bot's username and the specified inline query in the current chat's input field. Can be empty, in which case only the bot's username will be inserted.
   *
   * This offers a quick way for the user to open your bot in inline mode in the same chat – good for selecting something from multiple options.
   */
  switch_inline_query_current_chat?: String
  /**
   * Optional. Description of the game that will be launched when the user presses the button.
   *
   * NOTE: This type of button must always be the first button in the first row.
   */
  callback_game?: CallbackGame
  /**
   * Optional. Specify True, to send a Pay button.
   *
   * NOTE: This type of button must always be the first button in the first row and can only be used in invoice messages.
   */
  pay?: Boolean
}

/**
 * This object represents a parameter of the inline keyboard button used to automatically authorize a user. Serves as a great replacement for the Telegram Login Widget when the user is coming from Telegram. All the user needs to do is tap/click a button and confirm that they want to log in:
 *
 * Telegram apps support these buttons as of version 5.7.
 * Sample bot: @discussbot
 * @see https://core.telegram.org/bots/api#loginurl
 */
export interface LoginUrl {
  /**
   * An HTTP URL to be opened with user authorization data added to the query string when the button is pressed. If the user refuses to provide authorization data, the original URL without information about the user will be opened. The data added is the same as described in Receiving authorization data.
   *
   * NOTE: You must always check the hash of the received data to verify the authentication and the integrity of the data as described in Checking authorization.
   */
  url?: String
  /** Optional. New text of the button in forwarded messages. */
  forward_text?: String
  /** Optional. Username of a bot, which will be used for user authorization. See Setting up a bot for more details. If not specified, the current bot's username will be assumed. The url's domain must be the same as the domain linked with the bot. See Linking your domain to the bot for more details. */
  bot_username?: String
  /** Optional. Pass True to request the permission for your bot to send messages to the user. */
  request_write_access?: Boolean
}

/**
 * This object represents an incoming callback query from a callback button in an inline keyboard. If the button that originated the query was attached to a message sent by the bot, the field message will be present. If the button was attached to a message sent via the bot (in inline mode), the field inline_message_id will be present. Exactly one of the fields data or game_short_name will be present.
 * @see https://core.telegram.org/bots/api#callbackquery
 */
export interface CallbackQuery {
  /** Unique identifier for this query */
  id?: String
  /** Sender */
  from?: User
  /** Optional. Message with the callback button that originated the query. Note that message content and message date will not be available if the message is too old */
  message?: Message
  /** Optional. Identifier of the message sent via the bot in inline mode, that originated the query. */
  inline_message_id?: String
  /** Global identifier, uniquely corresponding to the chat to which the message with the callback button was sent. Useful for high scores in games. */
  chat_instance?: String
  /** Optional. Data associated with the callback button. Be aware that a bad client can send arbitrary data in this field. */
  data?: String
  /** Optional. Short name of a Game to be returned, serves as the unique identifier for the game */
  game_short_name?: String
}

/**
 * Upon receiving a message with this object, Telegram clients will display a reply interface to the user (act as if the user has selected the bot's message and tapped 'Reply'). This can be extremely useful if you want to create user-friendly step-by-step interfaces without having to sacrifice privacy mode.
 * @see https://core.telegram.org/bots/api#forcereply
 */
export interface ForceReply {
  /** Shows reply interface to the user, as if they manually selected the bot's message and tapped 'Reply' */
  force_reply?: True
  /** Optional. The placeholder to be shown in the input field when the reply is active; 1-64 characters */
  input_field_placeholder?: String
  /** Optional. Use this parameter if you want to force reply from specific users only. Targets: 1) users that are @mentioned in the text of the Message object; 2) if the bot's message is a reply (has reply_to_message_id), sender of the original message. */
  selective?: Boolean
}

/**
 * This object represents a chat photo.
 * @see https://core.telegram.org/bots/api#chatphoto
 */
export interface ChatPhoto {
  /** File identifier of small (160x160) chat photo. This file_id can be used only for photo download and only for as long as the photo is not changed. */
  small_file_id?: String
  /** Unique file identifier of small (160x160) chat photo, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
  small_file_unique_id?: String
  /** File identifier of big (640x640) chat photo. This file_id can be used only for photo download and only for as long as the photo is not changed. */
  big_file_id?: String
  /** Unique file identifier of big (640x640) chat photo, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
  big_file_unique_id?: String
}

/**
 * Represents an invite link for a chat.
 * @see https://core.telegram.org/bots/api#chatinvitelink
 */
export interface ChatInviteLink {
  /** The invite link. If the link was created by another chat administrator, then the second part of the link will be replaced with "...". */
  invite_link?: String
  /** Creator of the link */
  creator?: User
  /** True, if users joining the chat via the link need to be approved by chat administrators */
  creates_join_request?: Boolean
  /** True, if the link is primary */
  is_primary?: Boolean
  /** True, if the link is revoked */
  is_revoked?: Boolean
  /** Optional. Invite link name */
  name?: String
  /** Optional. Point in time (Unix timestamp) when the link will expire or has been expired */
  expire_date?: Integer
  /** Optional. Maximum number of users that can be members of the chat simultaneously after joining the chat via this invite link; 1-99999 */
  member_limit?: Integer
  /** Optional. Number of pending join requests created using this link */
  pending_join_request_count?: Integer
}

/**
 * This object contains information about one member of a chat. Currently, the following 6 types of chat members are supported:
 * - ChatMemberOwner
 * - ChatMemberAdministrator
 * - ChatMemberMember
 * - ChatMemberRestricted
 * - ChatMemberLeft
 * - ChatMemberBanned
 * @see https://core.telegram.org/bots/api#chatmember
 */
export type ChatMember =
  | ChatMemberOwner
  | ChatMemberAdministrator
  | ChatMemberMember
  | ChatMemberRestricted
  | ChatMemberLeft
  | ChatMemberBanned

/**
 * Represents a chat member that owns the chat and has all administrator privileges.
 * @see https://core.telegram.org/bots/api#chatmemberowner
 */
export interface ChatMemberOwner {
  /** The member's status in the chat, always "creator" */
  status?: String
  /** Information about the user */
  user?: User
  /** True, if the user's presence in the chat is hidden */
  is_anonymous?: Boolean
  /** Optional. Custom title for this user */
  custom_title?: String
}

/**
 * Represents a chat member that has some additional privileges.
 * @see https://core.telegram.org/bots/api#chatmemberadministrator
 */
export interface ChatMemberAdministrator {
  /** The member's status in the chat, always "administrator" */
  status?: String
  /** Information about the user */
  user?: User
  /** True, if the bot is allowed to edit administrator privileges of that user */
  can_be_edited?: Boolean
  /** True, if the user's presence in the chat is hidden */
  is_anonymous?: Boolean
  /** True, if the administrator can access the chat event log, chat statistics, message statistics in channels, see channel members, see anonymous administrators in supergroups and ignore slow mode. Implied by any other administrator privilege */
  can_manage_chat?: Boolean
  /** True, if the administrator can delete messages of other users */
  can_delete_messages?: Boolean
  /** True, if the administrator can manage voice chats */
  can_manage_voice_chats?: Boolean
  /** True, if the administrator can restrict, ban or unban chat members */
  can_restrict_members?: Boolean
  /** True, if the administrator can add new administrators with a subset of their own privileges or demote administrators that he has promoted, directly or indirectly (promoted by administrators that were appointed by the user) */
  can_promote_members?: Boolean
  /** True, if the user is allowed to change the chat title, photo and other settings */
  can_change_info?: Boolean
  /** True, if the user is allowed to invite new users to the chat */
  can_invite_users?: Boolean
  /** Optional. True, if the administrator can post in the channel; channels only */
  can_post_messages?: Boolean
  /** Optional. True, if the administrator can edit messages of other users and can pin messages; channels only */
  can_edit_messages?: Boolean
  /** Optional. True, if the user is allowed to pin messages; groups and supergroups only */
  can_pin_messages?: Boolean
  /** Optional. Custom title for this user */
  custom_title?: String
}

/**
 * Represents a chat member that has no additional privileges or restrictions.
 * @see https://core.telegram.org/bots/api#chatmembermember
 */
export interface ChatMemberMember {
  /** The member's status in the chat, always "member" */
  status?: String
  /** Information about the user */
  user?: User
}

/**
 * Represents a chat member that is under certain restrictions in the chat. Supergroups only.
 * @see https://core.telegram.org/bots/api#chatmemberrestricted
 */
export interface ChatMemberRestricted {
  /** The member's status in the chat, always "restricted" */
  status?: String
  /** Information about the user */
  user?: User
  /** True, if the user is a member of the chat at the moment of the request */
  is_member?: Boolean
  /** True, if the user is allowed to change the chat title, photo and other settings */
  can_change_info?: Boolean
  /** True, if the user is allowed to invite new users to the chat */
  can_invite_users?: Boolean
  /** True, if the user is allowed to pin messages */
  can_pin_messages?: Boolean
  /** True, if the user is allowed to send text messages, contacts, locations and venues */
  can_send_messages?: Boolean
  /** True, if the user is allowed to send audios, documents, photos, videos, video notes and voice notes */
  can_send_media_messages?: Boolean
  /** True, if the user is allowed to send polls */
  can_send_polls?: Boolean
  /** True, if the user is allowed to send animations, games, stickers and use inline bots */
  can_send_other_messages?: Boolean
  /** True, if the user is allowed to add web page previews to their messages */
  can_add_web_page_previews?: Boolean
  /** Date when restrictions will be lifted for this user; unix time. If 0, then the user is restricted forever */
  until_date?: Integer
}

/**
 * Represents a chat member that isn't currently a member of the chat, but may join it themselves.
 * @see https://core.telegram.org/bots/api#chatmemberleft
 */
export interface ChatMemberLeft {
  /** The member's status in the chat, always "left" */
  status?: String
  /** Information about the user */
  user?: User
}

/**
 * Represents a chat member that was banned in the chat and can't return to the chat or view chat messages.
 * @see https://core.telegram.org/bots/api#chatmemberbanned
 */
export interface ChatMemberBanned {
  /** The member's status in the chat, always "kicked" */
  status?: String
  /** Information about the user */
  user?: User
  /** Date when restrictions will be lifted for this user; unix time. If 0, then the user is banned forever */
  until_date?: Integer
}

/**
 * This object represents changes in the status of a chat member.
 * @see https://core.telegram.org/bots/api#chatmemberupdated
 */
export interface ChatMemberUpdated {
  /** Chat the user belongs to */
  chat?: Chat
  /** Performer of the action, which resulted in the change */
  from?: User
  /** Date the change was done in Unix time */
  date?: Integer
  /** Previous information about the chat member */
  old_chat_member?: ChatMember
  /** New information about the chat member */
  new_chat_member?: ChatMember
  /** Optional. Chat invite link, which was used by the user to join the chat; for joining by invite link events only. */
  invite_link?: ChatInviteLink
}

/**
 * Represents a join request sent to a chat.
 * @see https://core.telegram.org/bots/api#chatjoinrequest
 */
export interface ChatJoinRequest {
  /** Chat to which the request was sent */
  chat?: Chat
  /** User that sent the join request */
  from?: User
  /** Date the request was sent in Unix time */
  date?: Integer
  /** Optional. Bio of the user. */
  bio?: String
  /** Optional. Chat invite link that was used by the user to send the join request */
  invite_link?: ChatInviteLink
}

/**
 * Describes actions that a non-administrator user is allowed to take in a chat.
 * @see https://core.telegram.org/bots/api#chatpermissions
 */
export interface ChatPermissions {
  /** Optional. True, if the user is allowed to send text messages, contacts, locations and venues */
  can_send_messages?: Boolean
  /** Optional. True, if the user is allowed to send audios, documents, photos, videos, video notes and voice notes, implies can_send_messages */
  can_send_media_messages?: Boolean
  /** Optional. True, if the user is allowed to send polls, implies can_send_messages */
  can_send_polls?: Boolean
  /** Optional. True, if the user is allowed to send animations, games, stickers and use inline bots, implies can_send_media_messages */
  can_send_other_messages?: Boolean
  /** Optional. True, if the user is allowed to add web page previews to their messages, implies can_send_media_messages */
  can_add_web_page_previews?: Boolean
  /** Optional. True, if the user is allowed to change the chat title, photo and other settings. Ignored in public supergroups */
  can_change_info?: Boolean
  /** Optional. True, if the user is allowed to invite new users to the chat */
  can_invite_users?: Boolean
  /** Optional. True, if the user is allowed to pin messages. Ignored in public supergroups */
  can_pin_messages?: Boolean
}

/**
 * Represents a location to which a chat is connected.
 * @see https://core.telegram.org/bots/api#chatlocation
 */
export interface ChatLocation {
  /** The location to which the supergroup is connected. Can't be a live location. */
  location?: Location
  /** Location address; 1-64 characters, as defined by the chat owner */
  address?: String
}

/**
 * This object represents a bot command.
 * @see https://core.telegram.org/bots/api#botcommand
 */
export interface BotCommand {
  /** Text of the command; 1-32 characters. Can contain only lowercase English letters, digits and underscores. */
  command?: String
  /** Description of the command; 1-256 characters. */
  description?: String
}

/**
 * This object represents the scope to which bot commands are applied. Currently, the following 7 scopes are supported:
 * - BotCommandScopeDefault
 * - BotCommandScopeAllPrivateChats
 * - BotCommandScopeAllGroupChats
 * - BotCommandScopeAllChatAdministrators
 * - BotCommandScopeChat
 * - BotCommandScopeChatAdministrators
 * - BotCommandScopeChatMember
 * @see https://core.telegram.org/bots/api#botcommandscope
 */
export type BotCommandScope =
  | BotCommandScopeDefault
  | BotCommandScopeAllPrivateChats
  | BotCommandScopeAllGroupChats
  | BotCommandScopeAllChatAdministrators
  | BotCommandScopeChat
  | BotCommandScopeChatAdministrators
  | BotCommandScopeChatMember

/**
 * Represents the default scope of bot commands. Default commands are used if no commands with a narrower scope are specified for the user.
 * @see https://core.telegram.org/bots/api#botcommandscopedefault
 */
export interface BotCommandScopeDefault {
  /** Scope type, must be default */
  type?: String
}

/**
 * Represents the scope of bot commands, covering all private chats.
 * @see https://core.telegram.org/bots/api#botcommandscopeallprivatechats
 */
export interface BotCommandScopeAllPrivateChats {
  /** Scope type, must be all_private_chats */
  type?: String
}

/**
 * Represents the scope of bot commands, covering all group and supergroup chats.
 * @see https://core.telegram.org/bots/api#botcommandscopeallgroupchats
 */
export interface BotCommandScopeAllGroupChats {
  /** Scope type, must be all_group_chats */
  type?: String
}

/**
 * Represents the scope of bot commands, covering all group and supergroup chat administrators.
 * @see https://core.telegram.org/bots/api#botcommandscopeallchatadministrators
 */
export interface BotCommandScopeAllChatAdministrators {
  /** Scope type, must be all_chat_administrators */
  type?: String
}

/**
 * Represents the scope of bot commands, covering a specific chat.
 * @see https://core.telegram.org/bots/api#botcommandscopechat
 */
export interface BotCommandScopeChat {
  /** Scope type, must be chat */
  type?: String
  /** Unique identifier for the target chat or username of the target supergroup (in the format @supergroupusername) */
  chat_id?: Integer | String
}

/**
 * Represents the scope of bot commands, covering all administrators of a specific group or supergroup chat.
 * @see https://core.telegram.org/bots/api#botcommandscopechatadministrators
 */
export interface BotCommandScopeChatAdministrators {
  /** Scope type, must be chat_administrators */
  type?: String
  /** Unique identifier for the target chat or username of the target supergroup (in the format @supergroupusername) */
  chat_id?: Integer | String
}

/**
 * Represents the scope of bot commands, covering a specific member of a group or supergroup chat.
 * @see https://core.telegram.org/bots/api#botcommandscopechatmember
 */
export interface BotCommandScopeChatMember {
  /** Scope type, must be chat_member */
  type?: String
  /** Unique identifier for the target chat or username of the target supergroup (in the format @supergroupusername) */
  chat_id?: Integer | String
  /** Unique identifier of the target user */
  user_id?: Integer
}

/**
 * Contains information about why a request was unsuccessful.
 * @see https://core.telegram.org/bots/api#responseparameters
 */
export interface ResponseParameters {
  /** Optional. The group has been migrated to a supergroup with the specified identifier. This number may have more than 32 significant bits and some programming languages may have difficulty/silent defects in interpreting it. But it has at most 52 significant bits, so a signed 64-bit integer or double-precision float type are safe for storing this identifier. */
  migrate_to_chat_id?: Integer
  /** Optional. In case of exceeding flood control, the number of seconds left to wait before the request can be repeated */
  retry_after?: Integer
}

/**
 * This object represents the content of a media message to be sent. It should be one of
 * - InputMediaAnimation
 * - InputMediaDocument
 * - InputMediaAudio
 * - InputMediaPhoto
 * - InputMediaVideo
 * @see https://core.telegram.org/bots/api#inputmedia
 */
export type InputMedia =
  | InputMediaAnimation
  | InputMediaDocument
  | InputMediaAudio
  | InputMediaPhoto
  | InputMediaVideo

/**
 * Represents a photo to be sent.
 * @see https://core.telegram.org/bots/api#inputmediaphoto
 */
export interface InputMediaPhoto {
  /** Type of the result, must be photo */
  type?: String
  /** File to send. Pass a file_id to send a file that exists on the Telegram servers (recommended), pass an HTTP URL for Telegram to get a file from the Internet, or pass "attach://<file_attach_name>" to upload a new one using multipart/form-data under <file_attach_name> name. More info on Sending Files » */
  media?: String
  /** Optional. Caption of the photo to be sent, 0-1024 characters after entities parsing */
  caption?: String
  /** Optional. Mode for parsing entities in the photo caption. See formatting options for more details. */
  parse_mode?: String
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
}

/**
 * Represents a video to be sent.
 * @see https://core.telegram.org/bots/api#inputmediavideo
 */
export interface InputMediaVideo {
  /** Type of the result, must be video */
  type?: String
  /** File to send. Pass a file_id to send a file that exists on the Telegram servers (recommended), pass an HTTP URL for Telegram to get a file from the Internet, or pass "attach://<file_attach_name>" to upload a new one using multipart/form-data under <file_attach_name> name. More info on Sending Files » */
  media?: String
  /** Optional. Thumbnail of the file sent; can be ignored if thumbnail generation for the file is supported server-side. The thumbnail should be in JPEG format and less than 200 kB in size. A thumbnail's width and height should not exceed 320. Ignored if the file is not uploaded using multipart/form-data. Thumbnails can't be reused and can be only uploaded as a new file, so you can pass "attach://<file_attach_name>" if the thumbnail was uploaded using multipart/form-data under <file_attach_name>. More info on Sending Files » */
  thumb?: InputFile | String
  /** Optional. Caption of the video to be sent, 0-1024 characters after entities parsing */
  caption?: String
  /** Optional. Mode for parsing entities in the video caption. See formatting options for more details. */
  parse_mode?: String
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Optional. Video width */
  width?: Integer
  /** Optional. Video height */
  height?: Integer
  /** Optional. Video duration in seconds */
  duration?: Integer
  /** Optional. Pass True, if the uploaded video is suitable for streaming */
  supports_streaming?: Boolean
}

/**
 * Represents an animation file (GIF or H.264/MPEG-4 AVC video without sound) to be sent.
 * @see https://core.telegram.org/bots/api#inputmediaanimation
 */
export interface InputMediaAnimation {
  /** Type of the result, must be animation */
  type?: String
  /** File to send. Pass a file_id to send a file that exists on the Telegram servers (recommended), pass an HTTP URL for Telegram to get a file from the Internet, or pass "attach://<file_attach_name>" to upload a new one using multipart/form-data under <file_attach_name> name. More info on Sending Files » */
  media?: String
  /** Optional. Thumbnail of the file sent; can be ignored if thumbnail generation for the file is supported server-side. The thumbnail should be in JPEG format and less than 200 kB in size. A thumbnail's width and height should not exceed 320. Ignored if the file is not uploaded using multipart/form-data. Thumbnails can't be reused and can be only uploaded as a new file, so you can pass "attach://<file_attach_name>" if the thumbnail was uploaded using multipart/form-data under <file_attach_name>. More info on Sending Files » */
  thumb?: InputFile | String
  /** Optional. Caption of the animation to be sent, 0-1024 characters after entities parsing */
  caption?: String
  /** Optional. Mode for parsing entities in the animation caption. See formatting options for more details. */
  parse_mode?: String
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Optional. Animation width */
  width?: Integer
  /** Optional. Animation height */
  height?: Integer
  /** Optional. Animation duration in seconds */
  duration?: Integer
}

/**
 * Represents an audio file to be treated as music to be sent.
 * @see https://core.telegram.org/bots/api#inputmediaaudio
 */
export interface InputMediaAudio {
  /** Type of the result, must be audio */
  type?: String
  /** File to send. Pass a file_id to send a file that exists on the Telegram servers (recommended), pass an HTTP URL for Telegram to get a file from the Internet, or pass "attach://<file_attach_name>" to upload a new one using multipart/form-data under <file_attach_name> name. More info on Sending Files » */
  media?: String
  /** Optional. Thumbnail of the file sent; can be ignored if thumbnail generation for the file is supported server-side. The thumbnail should be in JPEG format and less than 200 kB in size. A thumbnail's width and height should not exceed 320. Ignored if the file is not uploaded using multipart/form-data. Thumbnails can't be reused and can be only uploaded as a new file, so you can pass "attach://<file_attach_name>" if the thumbnail was uploaded using multipart/form-data under <file_attach_name>. More info on Sending Files » */
  thumb?: InputFile | String
  /** Optional. Caption of the audio to be sent, 0-1024 characters after entities parsing */
  caption?: String
  /** Optional. Mode for parsing entities in the audio caption. See formatting options for more details. */
  parse_mode?: String
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Optional. Duration of the audio in seconds */
  duration?: Integer
  /** Optional. Performer of the audio */
  performer?: String
  /** Optional. Title of the audio */
  title?: String
}

/**
 * Represents a general file to be sent.
 * @see https://core.telegram.org/bots/api#inputmediadocument
 */
export interface InputMediaDocument {
  /** Type of the result, must be document */
  type?: String
  /** File to send. Pass a file_id to send a file that exists on the Telegram servers (recommended), pass an HTTP URL for Telegram to get a file from the Internet, or pass "attach://<file_attach_name>" to upload a new one using multipart/form-data under <file_attach_name> name. More info on Sending Files » */
  media?: String
  /** Optional. Thumbnail of the file sent; can be ignored if thumbnail generation for the file is supported server-side. The thumbnail should be in JPEG format and less than 200 kB in size. A thumbnail's width and height should not exceed 320. Ignored if the file is not uploaded using multipart/form-data. Thumbnails can't be reused and can be only uploaded as a new file, so you can pass "attach://<file_attach_name>" if the thumbnail was uploaded using multipart/form-data under <file_attach_name>. More info on Sending Files » */
  thumb?: InputFile | String
  /** Optional. Caption of the document to be sent, 0-1024 characters after entities parsing */
  caption?: String
  /** Optional. Mode for parsing entities in the document caption. See formatting options for more details. */
  parse_mode?: String
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Optional. Disables automatic server-side content type detection for files uploaded using multipart/form-data. Always True, if the document is sent as part of an album. */
  disable_content_type_detection?: Boolean
}

/**
 * This object represents the contents of a file to be uploaded. Must be posted using multipart/form-data in the usual way that files are uploaded via the browser.
 * @see https://core.telegram.org/bots/api#inputfile
 */
export type InputFile = any

export interface SendMessagePayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Text of the message to be sent, 1-4096 characters after entities parsing */
  text?: String
  /** Mode for parsing entities in the message text. See formatting options for more details. */
  parse_mode?: String
  /** A JSON-serialized list of special entities that appear in message text, which can be specified instead of parse_mode */
  entities?: MessageEntity[]
  /** Disables link previews for links in this message */
  disable_web_page_preview?: Boolean
  /** Sends the message silently. Users will receive a notification with no sound. */
  disable_notification?: Boolean
  /** Protects the contents of the sent message from forwarding and saving */
  protect_content?: Boolean
  /** If the message is a reply, ID of the original message */
  reply_to_message_id?: Integer
  /** Pass True, if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: Boolean
  /** Additional interface options. A JSON-serialized object for an inline keyboard, custom reply keyboard, instructions to remove reply keyboard or to force a reply from the user. */
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply
}

export interface ForwardMessagePayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Unique identifier for the chat where the original message was sent (or channel username in the format @channelusername) */
  from_chat_id?: Integer | String
  /** Sends the message silently. Users will receive a notification with no sound. */
  disable_notification?: Boolean
  /** Protects the contents of the forwarded message from forwarding and saving */
  protect_content?: Boolean
  /** Message identifier in the chat specified in from_chat_id */
  message_id?: Integer
}

export interface CopyMessagePayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Unique identifier for the chat where the original message was sent (or channel username in the format @channelusername) */
  from_chat_id?: Integer | String
  /** Message identifier in the chat specified in from_chat_id */
  message_id?: Integer
  /** New caption for media, 0-1024 characters after entities parsing. If not specified, the original caption is kept */
  caption?: String
  /** Mode for parsing entities in the new caption. See formatting options for more details. */
  parse_mode?: String
  /** A JSON-serialized list of special entities that appear in the new caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Sends the message silently. Users will receive a notification with no sound. */
  disable_notification?: Boolean
  /** Protects the contents of the sent message from forwarding and saving */
  protect_content?: Boolean
  /** If the message is a reply, ID of the original message */
  reply_to_message_id?: Integer
  /** Pass True, if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: Boolean
  /** Additional interface options. A JSON-serialized object for an inline keyboard, custom reply keyboard, instructions to remove reply keyboard or to force a reply from the user. */
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply
}

export interface SendPhotoPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Photo to send. Pass a file_id as String to send a photo that exists on the Telegram servers (recommended), pass an HTTP URL as a String for Telegram to get a photo from the Internet, or upload a new photo using multipart/form-data. The photo must be at most 10 MB in size. The photo's width and height must not exceed 10000 in total. Width and height ratio must be at most 20. More info on Sending Files » */
  photo?: InputFile | String
  /** Photo caption (may also be used when resending photos by file_id), 0-1024 characters after entities parsing */
  caption?: String
  /** Mode for parsing entities in the photo caption. See formatting options for more details. */
  parse_mode?: String
  /** A JSON-serialized list of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Sends the message silently. Users will receive a notification with no sound. */
  disable_notification?: Boolean
  /** Protects the contents of the sent message from forwarding and saving */
  protect_content?: Boolean
  /** If the message is a reply, ID of the original message */
  reply_to_message_id?: Integer
  /** Pass True, if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: Boolean
  /** Additional interface options. A JSON-serialized object for an inline keyboard, custom reply keyboard, instructions to remove reply keyboard or to force a reply from the user. */
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply
}

export interface SendAudioPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Audio file to send. Pass a file_id as String to send an audio file that exists on the Telegram servers (recommended), pass an HTTP URL as a String for Telegram to get an audio file from the Internet, or upload a new one using multipart/form-data. More info on Sending Files » */
  audio?: InputFile | String
  /** Audio caption, 0-1024 characters after entities parsing */
  caption?: String
  /** Mode for parsing entities in the audio caption. See formatting options for more details. */
  parse_mode?: String
  /** A JSON-serialized list of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Duration of the audio in seconds */
  duration?: Integer
  /** Performer */
  performer?: String
  /** Track name */
  title?: String
  /** Thumbnail of the file sent; can be ignored if thumbnail generation for the file is supported server-side. The thumbnail should be in JPEG format and less than 200 kB in size. A thumbnail's width and height should not exceed 320. Ignored if the file is not uploaded using multipart/form-data. Thumbnails can't be reused and can be only uploaded as a new file, so you can pass "attach://<file_attach_name>" if the thumbnail was uploaded using multipart/form-data under <file_attach_name>. More info on Sending Files » */
  thumb?: InputFile | String
  /** Sends the message silently. Users will receive a notification with no sound. */
  disable_notification?: Boolean
  /** Protects the contents of the sent message from forwarding and saving */
  protect_content?: Boolean
  /** If the message is a reply, ID of the original message */
  reply_to_message_id?: Integer
  /** Pass True, if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: Boolean
  /** Additional interface options. A JSON-serialized object for an inline keyboard, custom reply keyboard, instructions to remove reply keyboard or to force a reply from the user. */
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply
}

export interface SendDocumentPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** File to send. Pass a file_id as String to send a file that exists on the Telegram servers (recommended), pass an HTTP URL as a String for Telegram to get a file from the Internet, or upload a new one using multipart/form-data. More info on Sending Files » */
  document?: InputFile | String
  /** Thumbnail of the file sent; can be ignored if thumbnail generation for the file is supported server-side. The thumbnail should be in JPEG format and less than 200 kB in size. A thumbnail's width and height should not exceed 320. Ignored if the file is not uploaded using multipart/form-data. Thumbnails can't be reused and can be only uploaded as a new file, so you can pass "attach://<file_attach_name>" if the thumbnail was uploaded using multipart/form-data under <file_attach_name>. More info on Sending Files » */
  thumb?: InputFile | String
  /** Document caption (may also be used when resending documents by file_id), 0-1024 characters after entities parsing */
  caption?: String
  /** Mode for parsing entities in the document caption. See formatting options for more details. */
  parse_mode?: String
  /** A JSON-serialized list of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Disables automatic server-side content type detection for files uploaded using multipart/form-data */
  disable_content_type_detection?: Boolean
  /** Sends the message silently. Users will receive a notification with no sound. */
  disable_notification?: Boolean
  /** Protects the contents of the sent message from forwarding and saving */
  protect_content?: Boolean
  /** If the message is a reply, ID of the original message */
  reply_to_message_id?: Integer
  /** Pass True, if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: Boolean
  /** Additional interface options. A JSON-serialized object for an inline keyboard, custom reply keyboard, instructions to remove reply keyboard or to force a reply from the user. */
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply
}

export interface SendVideoPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Video to send. Pass a file_id as String to send a video that exists on the Telegram servers (recommended), pass an HTTP URL as a String for Telegram to get a video from the Internet, or upload a new video using multipart/form-data. More info on Sending Files » */
  video?: InputFile | String
  /** Duration of sent video in seconds */
  duration?: Integer
  /** Video width */
  width?: Integer
  /** Video height */
  height?: Integer
  /** Thumbnail of the file sent; can be ignored if thumbnail generation for the file is supported server-side. The thumbnail should be in JPEG format and less than 200 kB in size. A thumbnail's width and height should not exceed 320. Ignored if the file is not uploaded using multipart/form-data. Thumbnails can't be reused and can be only uploaded as a new file, so you can pass "attach://<file_attach_name>" if the thumbnail was uploaded using multipart/form-data under <file_attach_name>. More info on Sending Files » */
  thumb?: InputFile | String
  /** Video caption (may also be used when resending videos by file_id), 0-1024 characters after entities parsing */
  caption?: String
  /** Mode for parsing entities in the video caption. See formatting options for more details. */
  parse_mode?: String
  /** A JSON-serialized list of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Pass True, if the uploaded video is suitable for streaming */
  supports_streaming?: Boolean
  /** Sends the message silently. Users will receive a notification with no sound. */
  disable_notification?: Boolean
  /** Protects the contents of the sent message from forwarding and saving */
  protect_content?: Boolean
  /** If the message is a reply, ID of the original message */
  reply_to_message_id?: Integer
  /** Pass True, if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: Boolean
  /** Additional interface options. A JSON-serialized object for an inline keyboard, custom reply keyboard, instructions to remove reply keyboard or to force a reply from the user. */
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply
}

export interface SendAnimationPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Animation to send. Pass a file_id as String to send an animation that exists on the Telegram servers (recommended), pass an HTTP URL as a String for Telegram to get an animation from the Internet, or upload a new animation using multipart/form-data. More info on Sending Files » */
  animation?: InputFile | String
  /** Duration of sent animation in seconds */
  duration?: Integer
  /** Animation width */
  width?: Integer
  /** Animation height */
  height?: Integer
  /** Thumbnail of the file sent; can be ignored if thumbnail generation for the file is supported server-side. The thumbnail should be in JPEG format and less than 200 kB in size. A thumbnail's width and height should not exceed 320. Ignored if the file is not uploaded using multipart/form-data. Thumbnails can't be reused and can be only uploaded as a new file, so you can pass "attach://<file_attach_name>" if the thumbnail was uploaded using multipart/form-data under <file_attach_name>. More info on Sending Files » */
  thumb?: InputFile | String
  /** Animation caption (may also be used when resending animation by file_id), 0-1024 characters after entities parsing */
  caption?: String
  /** Mode for parsing entities in the animation caption. See formatting options for more details. */
  parse_mode?: String
  /** A JSON-serialized list of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Sends the message silently. Users will receive a notification with no sound. */
  disable_notification?: Boolean
  /** Protects the contents of the sent message from forwarding and saving */
  protect_content?: Boolean
  /** If the message is a reply, ID of the original message */
  reply_to_message_id?: Integer
  /** Pass True, if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: Boolean
  /** Additional interface options. A JSON-serialized object for an inline keyboard, custom reply keyboard, instructions to remove reply keyboard or to force a reply from the user. */
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply
}

export interface SendVoicePayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Audio file to send. Pass a file_id as String to send a file that exists on the Telegram servers (recommended), pass an HTTP URL as a String for Telegram to get a file from the Internet, or upload a new one using multipart/form-data. More info on Sending Files » */
  voice?: InputFile | String
  /** Voice message caption, 0-1024 characters after entities parsing */
  caption?: String
  /** Mode for parsing entities in the voice message caption. See formatting options for more details. */
  parse_mode?: String
  /** A JSON-serialized list of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Duration of the voice message in seconds */
  duration?: Integer
  /** Sends the message silently. Users will receive a notification with no sound. */
  disable_notification?: Boolean
  /** Protects the contents of the sent message from forwarding and saving */
  protect_content?: Boolean
  /** If the message is a reply, ID of the original message */
  reply_to_message_id?: Integer
  /** Pass True, if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: Boolean
  /** Additional interface options. A JSON-serialized object for an inline keyboard, custom reply keyboard, instructions to remove reply keyboard or to force a reply from the user. */
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply
}

export interface SendVideoNotePayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Video note to send. Pass a file_id as String to send a video note that exists on the Telegram servers (recommended) or upload a new video using multipart/form-data. More info on Sending Files ». Sending video notes by a URL is currently unsupported */
  video_note?: InputFile | String
  /** Duration of sent video in seconds */
  duration?: Integer
  /** Video width and height, i.e. diameter of the video message */
  length?: Integer
  /** Thumbnail of the file sent; can be ignored if thumbnail generation for the file is supported server-side. The thumbnail should be in JPEG format and less than 200 kB in size. A thumbnail's width and height should not exceed 320. Ignored if the file is not uploaded using multipart/form-data. Thumbnails can't be reused and can be only uploaded as a new file, so you can pass "attach://<file_attach_name>" if the thumbnail was uploaded using multipart/form-data under <file_attach_name>. More info on Sending Files » */
  thumb?: InputFile | String
  /** Sends the message silently. Users will receive a notification with no sound. */
  disable_notification?: Boolean
  /** Protects the contents of the sent message from forwarding and saving */
  protect_content?: Boolean
  /** If the message is a reply, ID of the original message */
  reply_to_message_id?: Integer
  /** Pass True, if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: Boolean
  /** Additional interface options. A JSON-serialized object for an inline keyboard, custom reply keyboard, instructions to remove reply keyboard or to force a reply from the user. */
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply
}

export interface SendMediaGroupPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** A JSON-serialized array describing messages to be sent, must include 2-10 items */
  media?: (InputMediaAudio | InputMediaDocument | InputMediaPhoto | InputMediaVideo)[]
  /** Sends messages silently. Users will receive a notification with no sound. */
  disable_notification?: Boolean
  /** Protects the contents of the sent messages from forwarding and saving */
  protect_content?: Boolean
  /** If the messages are a reply, ID of the original message */
  reply_to_message_id?: Integer
  /** Pass True, if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: Boolean
}

export interface SendLocationPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Latitude of the location */
  latitude?: Float
  /** Longitude of the location */
  longitude?: Float
  /** The radius of uncertainty for the location, measured in meters; 0-1500 */
  horizontal_accuracy?: Float
  /** Period in seconds for which the location will be updated (see Live Locations, should be between 60 and 86400. */
  live_period?: Integer
  /** For live locations, a direction in which the user is moving, in degrees. Must be between 1 and 360 if specified. */
  heading?: Integer
  /** For live locations, a maximum distance for proximity alerts about approaching another chat member, in meters. Must be between 1 and 100000 if specified. */
  proximity_alert_radius?: Integer
  /** Sends the message silently. Users will receive a notification with no sound. */
  disable_notification?: Boolean
  /** Protects the contents of the sent message from forwarding and saving */
  protect_content?: Boolean
  /** If the message is a reply, ID of the original message */
  reply_to_message_id?: Integer
  /** Pass True, if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: Boolean
  /** Additional interface options. A JSON-serialized object for an inline keyboard, custom reply keyboard, instructions to remove reply keyboard or to force a reply from the user. */
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply
}

export interface EditMessageLiveLocationPayload {
  /** Required if inline_message_id is not specified. Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Required if inline_message_id is not specified. Identifier of the message to edit */
  message_id?: Integer
  /** Required if chat_id and message_id are not specified. Identifier of the inline message */
  inline_message_id?: String
  /** Latitude of new location */
  latitude?: Float
  /** Longitude of new location */
  longitude?: Float
  /** The radius of uncertainty for the location, measured in meters; 0-1500 */
  horizontal_accuracy?: Float
  /** Direction in which the user is moving, in degrees. Must be between 1 and 360 if specified. */
  heading?: Integer
  /** Maximum distance for proximity alerts about approaching another chat member, in meters. Must be between 1 and 100000 if specified. */
  proximity_alert_radius?: Integer
  /** A JSON-serialized object for a new inline keyboard. */
  reply_markup?: InlineKeyboardMarkup
}

export interface StopMessageLiveLocationPayload {
  /** Required if inline_message_id is not specified. Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Required if inline_message_id is not specified. Identifier of the message with live location to stop */
  message_id?: Integer
  /** Required if chat_id and message_id are not specified. Identifier of the inline message */
  inline_message_id?: String
  /** A JSON-serialized object for a new inline keyboard. */
  reply_markup?: InlineKeyboardMarkup
}

export interface SendVenuePayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Latitude of the venue */
  latitude?: Float
  /** Longitude of the venue */
  longitude?: Float
  /** Name of the venue */
  title?: String
  /** Address of the venue */
  address?: String
  /** Foursquare identifier of the venue */
  foursquare_id?: String
  /** Foursquare type of the venue, if known. (For example, "arts_entertainment/default", "arts_entertainment/aquarium" or "food/icecream".) */
  foursquare_type?: String
  /** Google Places identifier of the venue */
  google_place_id?: String
  /** Google Places type of the venue. (See supported types.) */
  google_place_type?: String
  /** Sends the message silently. Users will receive a notification with no sound. */
  disable_notification?: Boolean
  /** Protects the contents of the sent message from forwarding and saving */
  protect_content?: Boolean
  /** If the message is a reply, ID of the original message */
  reply_to_message_id?: Integer
  /** Pass True, if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: Boolean
  /** Additional interface options. A JSON-serialized object for an inline keyboard, custom reply keyboard, instructions to remove reply keyboard or to force a reply from the user. */
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply
}

export interface SendContactPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Contact's phone number */
  phone_number?: String
  /** Contact's first name */
  first_name?: String
  /** Contact's last name */
  last_name?: String
  /** Additional data about the contact in the form of a vCard, 0-2048 bytes */
  vcard?: String
  /** Sends the message silently. Users will receive a notification with no sound. */
  disable_notification?: Boolean
  /** Protects the contents of the sent message from forwarding and saving */
  protect_content?: Boolean
  /** If the message is a reply, ID of the original message */
  reply_to_message_id?: Integer
  /** Pass True, if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: Boolean
  /** Additional interface options. A JSON-serialized object for an inline keyboard, custom reply keyboard, instructions to remove keyboard or to force a reply from the user. */
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply
}

export interface SendPollPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Poll question, 1-300 characters */
  question?: String
  /** A JSON-serialized list of answer options, 2-10 strings 1-100 characters each */
  options?: String[]
  /** True, if the poll needs to be anonymous, defaults to True */
  is_anonymous?: Boolean
  /** Poll type, "quiz" or "regular", defaults to "regular" */
  type?: String
  /** True, if the poll allows multiple answers, ignored for polls in quiz mode, defaults to False */
  allows_multiple_answers?: Boolean
  /** 0-based identifier of the correct answer option, required for polls in quiz mode */
  correct_option_id?: Integer
  /** Text that is shown when a user chooses an incorrect answer or taps on the lamp icon in a quiz-style poll, 0-200 characters with at most 2 line feeds after entities parsing */
  explanation?: String
  /** Mode for parsing entities in the explanation. See formatting options for more details. */
  explanation_parse_mode?: String
  /** A JSON-serialized list of special entities that appear in the poll explanation, which can be specified instead of parse_mode */
  explanation_entities?: MessageEntity[]
  /** Amount of time in seconds the poll will be active after creation, 5-600. Can't be used together with close_date. */
  open_period?: Integer
  /** Point in time (Unix timestamp) when the poll will be automatically closed. Must be at least 5 and no more than 600 seconds in the future. Can't be used together with open_period. */
  close_date?: Integer
  /** Pass True, if the poll needs to be immediately closed. This can be useful for poll preview. */
  is_closed?: Boolean
  /** Sends the message silently. Users will receive a notification with no sound. */
  disable_notification?: Boolean
  /** Protects the contents of the sent message from forwarding and saving */
  protect_content?: Boolean
  /** If the message is a reply, ID of the original message */
  reply_to_message_id?: Integer
  /** Pass True, if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: Boolean
  /** Additional interface options. A JSON-serialized object for an inline keyboard, custom reply keyboard, instructions to remove reply keyboard or to force a reply from the user. */
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply
}

export interface SendDicePayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Emoji on which the dice throw animation is based. Currently, must be one of "", "", "", "", "", or "". Dice can have values 1-6 for "", "" and "", values 1-5 for "" and "", and values 1-64 for "". Defaults to "" */
  emoji?: String
  /** Sends the message silently. Users will receive a notification with no sound. */
  disable_notification?: Boolean
  /** Protects the contents of the sent message from forwarding */
  protect_content?: Boolean
  /** If the message is a reply, ID of the original message */
  reply_to_message_id?: Integer
  /** Pass True, if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: Boolean
  /** Additional interface options. A JSON-serialized object for an inline keyboard, custom reply keyboard, instructions to remove reply keyboard or to force a reply from the user. */
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply
}

export interface SendChatActionPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Type of action to broadcast. Choose one, depending on what the user is about to receive: typing for text messages, upload_photo for photos, record_video or upload_video for videos, record_voice or upload_voice for voice notes, upload_document for general files, choose_sticker for stickers, find_location for location data, record_video_note or upload_video_note for video notes. */
  action?: String
}

export interface GetUserProfilePhotosPayload {
  /** Unique identifier of the target user */
  user_id?: Integer
  /** Sequential number of the first photo to be returned. By default, all photos are returned. */
  offset?: Integer
  /** Limits the number of photos to be retrieved. Values between 1-100 are accepted. Defaults to 100. */
  limit?: Integer
}

export interface GetFilePayload {
  /** File identifier to get info about */
  file_id?: String
}

export interface BanChatMemberPayload {
  /** Unique identifier for the target group or username of the target supergroup or channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Unique identifier of the target user */
  user_id?: Integer
  /** Date when the user will be unbanned, unix time. If user is banned for more than 366 days or less than 30 seconds from the current time they are considered to be banned forever. Applied for supergroups and channels only. */
  until_date?: Integer
  /** Pass True to delete all messages from the chat for the user that is being removed. If False, the user will be able to see messages in the group that were sent before the user was removed. Always True for supergroups and channels. */
  revoke_messages?: Boolean
}

export interface UnbanChatMemberPayload {
  /** Unique identifier for the target group or username of the target supergroup or channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Unique identifier of the target user */
  user_id?: Integer
  /** Do nothing if the user is not banned */
  only_if_banned?: Boolean
}

export interface RestrictChatMemberPayload {
  /** Unique identifier for the target chat or username of the target supergroup (in the format @supergroupusername) */
  chat_id?: Integer | String
  /** Unique identifier of the target user */
  user_id?: Integer
  /** A JSON-serialized object for new user permissions */
  permissions?: ChatPermissions
  /** Date when restrictions will be lifted for the user, unix time. If user is restricted for more than 366 days or less than 30 seconds from the current time, they are considered to be restricted forever */
  until_date?: Integer
}

export interface PromoteChatMemberPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Unique identifier of the target user */
  user_id?: Integer
  /** Pass True, if the administrator's presence in the chat is hidden */
  is_anonymous?: Boolean
  /** Pass True, if the administrator can access the chat event log, chat statistics, message statistics in channels, see channel members, see anonymous administrators in supergroups and ignore slow mode. Implied by any other administrator privilege */
  can_manage_chat?: Boolean
  /** Pass True, if the administrator can create channel posts, channels only */
  can_post_messages?: Boolean
  /** Pass True, if the administrator can edit messages of other users and can pin messages, channels only */
  can_edit_messages?: Boolean
  /** Pass True, if the administrator can delete messages of other users */
  can_delete_messages?: Boolean
  /** Pass True, if the administrator can manage voice chats */
  can_manage_voice_chats?: Boolean
  /** Pass True, if the administrator can restrict, ban or unban chat members */
  can_restrict_members?: Boolean
  /** Pass True, if the administrator can add new administrators with a subset of their own privileges or demote administrators that he has promoted, directly or indirectly (promoted by administrators that were appointed by him) */
  can_promote_members?: Boolean
  /** Pass True, if the administrator can change chat title, photo and other settings */
  can_change_info?: Boolean
  /** Pass True, if the administrator can invite new users to the chat */
  can_invite_users?: Boolean
  /** Pass True, if the administrator can pin messages, supergroups only */
  can_pin_messages?: Boolean
}

export interface SetChatAdministratorCustomTitlePayload {
  /** Unique identifier for the target chat or username of the target supergroup (in the format @supergroupusername) */
  chat_id?: Integer | String
  /** Unique identifier of the target user */
  user_id?: Integer
  /** New custom title for the administrator; 0-16 characters, emoji are not allowed */
  custom_title?: String
}

export interface BanChatSenderChatPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Unique identifier of the target sender chat */
  sender_chat_id?: Integer
}

export interface UnbanChatSenderChatPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Unique identifier of the target sender chat */
  sender_chat_id?: Integer
}

export interface SetChatPermissionsPayload {
  /** Unique identifier for the target chat or username of the target supergroup (in the format @supergroupusername) */
  chat_id?: Integer | String
  /** A JSON-serialized object for new default chat permissions */
  permissions?: ChatPermissions
}

export interface ExportChatInviteLinkPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
}

export interface CreateChatInviteLinkPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Invite link name; 0-32 characters */
  name?: String
  /** Point in time (Unix timestamp) when the link will expire */
  expire_date?: Integer
  /** Maximum number of users that can be members of the chat simultaneously after joining the chat via this invite link; 1-99999 */
  member_limit?: Integer
  /** True, if users joining the chat via the link need to be approved by chat administrators. If True, member_limit can't be specified */
  creates_join_request?: Boolean
}

export interface EditChatInviteLinkPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** The invite link to edit */
  invite_link?: String
  /** Invite link name; 0-32 characters */
  name?: String
  /** Point in time (Unix timestamp) when the link will expire */
  expire_date?: Integer
  /** Maximum number of users that can be members of the chat simultaneously after joining the chat via this invite link; 1-99999 */
  member_limit?: Integer
  /** True, if users joining the chat via the link need to be approved by chat administrators. If True, member_limit can't be specified */
  creates_join_request?: Boolean
}

export interface RevokeChatInviteLinkPayload {
  /** Unique identifier of the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** The invite link to revoke */
  invite_link?: String
}

export interface ApproveChatJoinRequestPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Unique identifier of the target user */
  user_id?: Integer
}

export interface DeclineChatJoinRequestPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Unique identifier of the target user */
  user_id?: Integer
}

export interface SetChatPhotoPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** New chat photo, uploaded using multipart/form-data */
  photo?: InputFile
}

export interface DeleteChatPhotoPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
}

export interface SetChatTitlePayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** New chat title, 1-255 characters */
  title?: String
}

export interface SetChatDescriptionPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** New chat description, 0-255 characters */
  description?: String
}

export interface PinChatMessagePayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Identifier of a message to pin */
  message_id?: Integer
  /** Pass True, if it is not necessary to send a notification to all chat members about the new pinned message. Notifications are always disabled in channels and private chats. */
  disable_notification?: Boolean
}

export interface UnpinChatMessagePayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Identifier of a message to unpin. If not specified, the most recent pinned message (by sending date) will be unpinned. */
  message_id?: Integer
}

export interface UnpinAllChatMessagesPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
}

export interface LeaveChatPayload {
  /** Unique identifier for the target chat or username of the target supergroup or channel (in the format @channelusername) */
  chat_id?: Integer | String
}

export interface GetChatPayload {
  /** Unique identifier for the target chat or username of the target supergroup or channel (in the format @channelusername) */
  chat_id?: Integer | String
}

export interface GetChatAdministratorsPayload {
  /** Unique identifier for the target chat or username of the target supergroup or channel (in the format @channelusername) */
  chat_id?: Integer | String
}

export interface GetChatMemberCountPayload {
  /** Unique identifier for the target chat or username of the target supergroup or channel (in the format @channelusername) */
  chat_id?: Integer | String
}

export interface GetChatMemberPayload {
  /** Unique identifier for the target chat or username of the target supergroup or channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Unique identifier of the target user */
  user_id?: Integer
}

export interface SetChatStickerSetPayload {
  /** Unique identifier for the target chat or username of the target supergroup (in the format @supergroupusername) */
  chat_id?: Integer | String
  /** Name of the sticker set to be set as the group sticker set */
  sticker_set_name?: String
}

export interface DeleteChatStickerSetPayload {
  /** Unique identifier for the target chat or username of the target supergroup (in the format @supergroupusername) */
  chat_id?: Integer | String
}

export interface AnswerCallbackQueryPayload {
  /** Unique identifier for the query to be answered */
  callback_query_id?: String
  /** Text of the notification. If not specified, nothing will be shown to the user, 0-200 characters */
  text?: String
  /** If True, an alert will be shown by the client instead of a notification at the top of the chat screen. Defaults to false. */
  show_alert?: Boolean
  /**
   * URL that will be opened by the user's client. If you have created a Game and accepted the conditions via @Botfather, specify the URL that opens your game — note that this will only work if the query comes from a callback_game button.
   *
   * Otherwise, you may use links like t.me/your_bot?start=XXXX that open your bot with a parameter.
   */
  url?: String
  /** The maximum amount of time in seconds that the result of the callback query may be cached client-side. Telegram apps will support caching starting in version 3.14. Defaults to 0. */
  cache_time?: Integer
}

export interface SetMyCommandsPayload {
  /** A JSON-serialized list of bot commands to be set as the list of the bot's commands. At most 100 commands can be specified. */
  commands?: BotCommand[]
  /** A JSON-serialized object, describing scope of users for which the commands are relevant. Defaults to BotCommandScopeDefault. */
  scope?: BotCommandScope
  /** A two-letter ISO 639-1 language code. If empty, commands will be applied to all users from the given scope, for whose language there are no dedicated commands */
  language_code?: String
}

export interface DeleteMyCommandsPayload {
  /** A JSON-serialized object, describing scope of users for which the commands are relevant. Defaults to BotCommandScopeDefault. */
  scope?: BotCommandScope
  /** A two-letter ISO 639-1 language code. If empty, commands will be applied to all users from the given scope, for whose language there are no dedicated commands */
  language_code?: String
}

export interface GetMyCommandsPayload {
  /** A JSON-serialized object, describing scope of users. Defaults to BotCommandScopeDefault. */
  scope?: BotCommandScope
  /** A two-letter ISO 639-1 language code or an empty string */
  language_code?: String
}

export interface EditMessageTextPayload {
  /** Required if inline_message_id is not specified. Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Required if inline_message_id is not specified. Identifier of the message to edit */
  message_id?: Integer
  /** Required if chat_id and message_id are not specified. Identifier of the inline message */
  inline_message_id?: String
  /** New text of the message, 1-4096 characters after entities parsing */
  text?: String
  /** Mode for parsing entities in the message text. See formatting options for more details. */
  parse_mode?: String
  /** A JSON-serialized list of special entities that appear in message text, which can be specified instead of parse_mode */
  entities?: MessageEntity[]
  /** Disables link previews for links in this message */
  disable_web_page_preview?: Boolean
  /** A JSON-serialized object for an inline keyboard. */
  reply_markup?: InlineKeyboardMarkup
}

export interface EditMessageCaptionPayload {
  /** Required if inline_message_id is not specified. Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Required if inline_message_id is not specified. Identifier of the message to edit */
  message_id?: Integer
  /** Required if chat_id and message_id are not specified. Identifier of the inline message */
  inline_message_id?: String
  /** New caption of the message, 0-1024 characters after entities parsing */
  caption?: String
  /** Mode for parsing entities in the message caption. See formatting options for more details. */
  parse_mode?: String
  /** A JSON-serialized list of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** A JSON-serialized object for an inline keyboard. */
  reply_markup?: InlineKeyboardMarkup
}

export interface EditMessageMediaPayload {
  /** Required if inline_message_id is not specified. Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Required if inline_message_id is not specified. Identifier of the message to edit */
  message_id?: Integer
  /** Required if chat_id and message_id are not specified. Identifier of the inline message */
  inline_message_id?: String
  /** A JSON-serialized object for a new media content of the message */
  media?: InputMedia
  /** A JSON-serialized object for a new inline keyboard. */
  reply_markup?: InlineKeyboardMarkup
}

export interface EditMessageReplyMarkupPayload {
  /** Required if inline_message_id is not specified. Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Required if inline_message_id is not specified. Identifier of the message to edit */
  message_id?: Integer
  /** Required if chat_id and message_id are not specified. Identifier of the inline message */
  inline_message_id?: String
  /** A JSON-serialized object for an inline keyboard. */
  reply_markup?: InlineKeyboardMarkup
}

export interface StopPollPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Identifier of the original message with the poll */
  message_id?: Integer
  /** A JSON-serialized object for a new message inline keyboard. */
  reply_markup?: InlineKeyboardMarkup
}

export interface DeleteMessagePayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Identifier of the message to delete */
  message_id?: Integer
}

/**
 * This object represents a sticker.
 * @see https://core.telegram.org/bots/api#sticker
 */
export interface Sticker {
  /** Identifier for this file, which can be used to download or reuse the file */
  file_id?: String
  /** Unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
  file_unique_id?: String
  /** Sticker width */
  width?: Integer
  /** Sticker height */
  height?: Integer
  /** True, if the sticker is animated */
  is_animated?: Boolean
  /** True, if the sticker is a video sticker */
  is_video?: Boolean
  /** Optional. Sticker thumbnail in the .WEBP or .JPG format */
  thumb?: PhotoSize
  /** Optional. Emoji associated with the sticker */
  emoji?: String
  /** Optional. Name of the sticker set to which the sticker belongs */
  set_name?: String
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
  name?: String
  /** Sticker set title */
  title?: String
  /** True, if the sticker set contains animated stickers */
  is_animated?: Boolean
  /** True, if the sticker set contains video stickers */
  is_video?: Boolean
  /** True, if the sticker set contains masks */
  contains_masks?: Boolean
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
  point?: String
  /** Shift by X-axis measured in widths of the mask scaled to the face size, from left to right. For example, choosing -1.0 will place mask just to the left of the default mask position. */
  x_shift?: Float
  /** Shift by Y-axis measured in heights of the mask scaled to the face size, from top to bottom. For example, 1.0 will place the mask just below the default mask position. */
  y_shift?: Float
  /** Mask scaling coefficient. For example, 2.0 means double size. */
  scale?: Float
}

export interface SendStickerPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Sticker to send. Pass a file_id as String to send a file that exists on the Telegram servers (recommended), pass an HTTP URL as a String for Telegram to get a .WEBP file from the Internet, or upload a new one using multipart/form-data. More info on Sending Files » */
  sticker?: InputFile | String
  /** Sends the message silently. Users will receive a notification with no sound. */
  disable_notification?: Boolean
  /** Protects the contents of the sent message from forwarding and saving */
  protect_content?: Boolean
  /** If the message is a reply, ID of the original message */
  reply_to_message_id?: Integer
  /** Pass True, if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: Boolean
  /** Additional interface options. A JSON-serialized object for an inline keyboard, custom reply keyboard, instructions to remove reply keyboard or to force a reply from the user. */
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply
}

export interface GetStickerSetPayload {
  /** Name of the sticker set */
  name?: String
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
  name?: String
  /** Sticker set title, 1-64 characters */
  title?: String
  /** PNG image with the sticker, must be up to 512 kilobytes in size, dimensions must not exceed 512px, and either width or height must be exactly 512px. Pass a file_id as a String to send a file that already exists on the Telegram servers, pass an HTTP URL as a String for Telegram to get a file from the Internet, or upload a new one using multipart/form-data. More info on Sending Files » */
  png_sticker?: InputFile | String
  /** TGS animation with the sticker, uploaded using multipart/form-data. See https://core.telegram.org/stickers#animated-sticker-requirements for technical requirements */
  tgs_sticker?: InputFile
  /** WEBM video with the sticker, uploaded using multipart/form-data. See https://core.telegram.org/stickers#video-sticker-requirements for technical requirements */
  webm_sticker?: InputFile
  /** One or more emoji corresponding to the sticker */
  emojis?: String
  /** Pass True, if a set of mask stickers should be created */
  contains_masks?: Boolean
  /** A JSON-serialized object for position where the mask should be placed on faces */
  mask_position?: MaskPosition
}

export interface AddStickerToSetPayload {
  /** User identifier of sticker set owner */
  user_id?: Integer
  /** Sticker set name */
  name?: String
  /** PNG image with the sticker, must be up to 512 kilobytes in size, dimensions must not exceed 512px, and either width or height must be exactly 512px. Pass a file_id as a String to send a file that already exists on the Telegram servers, pass an HTTP URL as a String for Telegram to get a file from the Internet, or upload a new one using multipart/form-data. More info on Sending Files » */
  png_sticker?: InputFile | String
  /** TGS animation with the sticker, uploaded using multipart/form-data. See https://core.telegram.org/stickers#animated-sticker-requirements for technical requirements */
  tgs_sticker?: InputFile
  /** WEBM video with the sticker, uploaded using multipart/form-data. See https://core.telegram.org/stickers#video-sticker-requirements for technical requirements */
  webm_sticker?: InputFile
  /** One or more emoji corresponding to the sticker */
  emojis?: String
  /** A JSON-serialized object for position where the mask should be placed on faces */
  mask_position?: MaskPosition
}

export interface SetStickerPositionInSetPayload {
  /** File identifier of the sticker */
  sticker?: String
  /** New sticker position in the set, zero-based */
  position?: Integer
}

export interface DeleteStickerFromSetPayload {
  /** File identifier of the sticker */
  sticker?: String
}

export interface SetStickerSetThumbPayload {
  /** Sticker set name */
  name?: String
  /** User identifier of the sticker set owner */
  user_id?: Integer
  /** A PNG image with the thumbnail, must be up to 128 kilobytes in size and have width and height exactly 100px, or a TGS animation with the thumbnail up to 32 kilobytes in size; see https://core.telegram.org/stickers#animated-sticker-requirements for animated sticker technical requirements, or a WEBM video with the thumbnail up to 32 kilobytes in size; see https://core.telegram.org/stickers#video-sticker-requirements for video sticker technical requirements. Pass a file_id as a String to send a file that already exists on the Telegram servers, pass an HTTP URL as a String for Telegram to get a file from the Internet, or upload a new one using multipart/form-data. More info on Sending Files ». Animated sticker set thumbnails can't be uploaded via HTTP URL. */
  thumb?: InputFile | String
}

/**
 * This object represents an incoming inline query. When the user sends an empty query, your bot could return some default or trending results.
 * @see https://core.telegram.org/bots/api#inlinequery
 */
export interface InlineQuery {
  /** Unique identifier for this query */
  id?: String
  /** Sender */
  from?: User
  /** Text of the query (up to 256 characters) */
  query?: String
  /** Offset of the results to be returned, can be controlled by the bot */
  offset?: String
  /** Optional. Type of the chat, from which the inline query was sent. Can be either "sender" for a private chat with the inline query sender, "private", "group", "supergroup", or "channel". The chat type should be always known for requests sent from official clients and most third-party clients, unless the request was sent from a secret chat */
  chat_type?: String
  /** Optional. Sender location, only for bots that request user location */
  location?: Location
}

export interface AnswerInlineQueryPayload {
  /** Unique identifier for the answered query */
  inline_query_id?: String
  /** A JSON-serialized array of results for the inline query */
  results?: InlineQueryResult[]
  /** The maximum amount of time in seconds that the result of the inline query may be cached on the server. Defaults to 300. */
  cache_time?: Integer
  /** Pass True, if results may be cached on the server side only for the user that sent the query. By default, results may be returned to any user who sends the same query */
  is_personal?: Boolean
  /** Pass the offset that a client should send in the next query with the same text to receive more results. Pass an empty string if there are no more results or if you don't support pagination. Offset length can't exceed 64 bytes. */
  next_offset?: String
  /** If passed, clients will display a button with specified text that switches the user to a private chat with the bot and sends the bot a start message with the parameter switch_pm_parameter */
  switch_pm_text?: String
  /**
   * Deep-linking parameter for the /start message sent to the bot when user presses the switch button. 1-64 characters, only A-Z, a-z, 0-9, _ and - are allowed.
   *
   * Example: An inline bot that sends YouTube videos can ask the user to connect the bot to their YouTube account to adapt search results accordingly. To do this, it displays a 'Connect your YouTube account' button above the results, or even before showing any. The user presses the button, switches to a private chat with the bot and, in doing so, passes a start parameter that instructs the bot to return an OAuth link. Once done, the bot can offer a switch_inline button so that the user can easily return to the chat where they wanted to use the bot's inline capabilities.
   */
  switch_pm_parameter?: String
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
  type?: String
  /** Unique identifier for this result, 1-64 Bytes */
  id?: String
  /** Title of the result */
  title?: String
  /** Content of the message to be sent */
  input_message_content?: InputMessageContent
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
  /** Optional. URL of the result */
  url?: String
  /** Optional. Pass True, if you don't want the URL to be shown in the message */
  hide_url?: Boolean
  /** Optional. Short description of the result */
  description?: String
  /** Optional. Url of the thumbnail for the result */
  thumb_url?: String
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
  type?: String
  /** Unique identifier for this result, 1-64 bytes */
  id?: String
  /** A valid URL of the photo. Photo must be in JPEG format. Photo size must not exceed 5MB */
  photo_url?: String
  /** URL of the thumbnail for the photo */
  thumb_url?: String
  /** Optional. Width of the photo */
  photo_width?: Integer
  /** Optional. Height of the photo */
  photo_height?: Integer
  /** Optional. Title for the result */
  title?: String
  /** Optional. Short description of the result */
  description?: String
  /** Optional. Caption of the photo to be sent, 0-1024 characters after entities parsing */
  caption?: String
  /** Optional. Mode for parsing entities in the photo caption. See formatting options for more details. */
  parse_mode?: String
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
  type?: String
  /** Unique identifier for this result, 1-64 bytes */
  id?: String
  /** A valid URL for the GIF file. File size must not exceed 1MB */
  gif_url?: String
  /** Optional. Width of the GIF */
  gif_width?: Integer
  /** Optional. Height of the GIF */
  gif_height?: Integer
  /** Optional. Duration of the GIF in seconds */
  gif_duration?: Integer
  /** URL of the static (JPEG or GIF) or animated (MPEG4) thumbnail for the result */
  thumb_url?: String
  /** Optional. MIME type of the thumbnail, must be one of "image/jpeg", "image/gif", or "video/mp4". Defaults to "image/jpeg" */
  thumb_mime_type?: String
  /** Optional. Title for the result */
  title?: String
  /** Optional. Caption of the GIF file to be sent, 0-1024 characters after entities parsing */
  caption?: String
  /** Optional. Mode for parsing entities in the caption. See formatting options for more details. */
  parse_mode?: String
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
  type?: String
  /** Unique identifier for this result, 1-64 bytes */
  id?: String
  /** A valid URL for the MP4 file. File size must not exceed 1MB */
  mpeg4_url?: String
  /** Optional. Video width */
  mpeg4_width?: Integer
  /** Optional. Video height */
  mpeg4_height?: Integer
  /** Optional. Video duration in seconds */
  mpeg4_duration?: Integer
  /** URL of the static (JPEG or GIF) or animated (MPEG4) thumbnail for the result */
  thumb_url?: String
  /** Optional. MIME type of the thumbnail, must be one of "image/jpeg", "image/gif", or "video/mp4". Defaults to "image/jpeg" */
  thumb_mime_type?: String
  /** Optional. Title for the result */
  title?: String
  /** Optional. Caption of the MPEG-4 file to be sent, 0-1024 characters after entities parsing */
  caption?: String
  /** Optional. Mode for parsing entities in the caption. See formatting options for more details. */
  parse_mode?: String
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
  type?: String
  /** Unique identifier for this result, 1-64 bytes */
  id?: String
  /** A valid URL for the embedded video player or video file */
  video_url?: String
  /** Mime type of the content of video url, "text/html" or "video/mp4" */
  mime_type?: String
  /** URL of the thumbnail (JPEG only) for the video */
  thumb_url?: String
  /** Title for the result */
  title?: String
  /** Optional. Caption of the video to be sent, 0-1024 characters after entities parsing */
  caption?: String
  /** Optional. Mode for parsing entities in the video caption. See formatting options for more details. */
  parse_mode?: String
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Optional. Video width */
  video_width?: Integer
  /** Optional. Video height */
  video_height?: Integer
  /** Optional. Video duration in seconds */
  video_duration?: Integer
  /** Optional. Short description of the result */
  description?: String
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
  type?: String
  /** Unique identifier for this result, 1-64 bytes */
  id?: String
  /** A valid URL for the audio file */
  audio_url?: String
  /** Title */
  title?: String
  /** Optional. Caption, 0-1024 characters after entities parsing */
  caption?: String
  /** Optional. Mode for parsing entities in the audio caption. See formatting options for more details. */
  parse_mode?: String
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Optional. Performer */
  performer?: String
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
  type?: String
  /** Unique identifier for this result, 1-64 bytes */
  id?: String
  /** A valid URL for the voice recording */
  voice_url?: String
  /** Recording title */
  title?: String
  /** Optional. Caption, 0-1024 characters after entities parsing */
  caption?: String
  /** Optional. Mode for parsing entities in the voice message caption. See formatting options for more details. */
  parse_mode?: String
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
  type?: String
  /** Unique identifier for this result, 1-64 bytes */
  id?: String
  /** Title for the result */
  title?: String
  /** Optional. Caption of the document to be sent, 0-1024 characters after entities parsing */
  caption?: String
  /** Optional. Mode for parsing entities in the document caption. See formatting options for more details. */
  parse_mode?: String
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** A valid URL for the file */
  document_url?: String
  /** Mime type of the content of the file, either "application/pdf" or "application/zip" */
  mime_type?: String
  /** Optional. Short description of the result */
  description?: String
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
  /** Optional. Content of the message to be sent instead of the file */
  input_message_content?: InputMessageContent
  /** Optional. URL of the thumbnail (JPEG only) for the file */
  thumb_url?: String
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
  type?: String
  /** Unique identifier for this result, 1-64 Bytes */
  id?: String
  /** Location latitude in degrees */
  latitude?: Float
  /** Location longitude in degrees */
  longitude?: Float
  /** Location title */
  title?: String
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
  thumb_url?: String
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
  type?: String
  /** Unique identifier for this result, 1-64 Bytes */
  id?: String
  /** Latitude of the venue location in degrees */
  latitude?: Float
  /** Longitude of the venue location in degrees */
  longitude?: Float
  /** Title of the venue */
  title?: String
  /** Address of the venue */
  address?: String
  /** Optional. Foursquare identifier of the venue if known */
  foursquare_id?: String
  /** Optional. Foursquare type of the venue, if known. (For example, "arts_entertainment/default", "arts_entertainment/aquarium" or "food/icecream".) */
  foursquare_type?: String
  /** Optional. Google Places identifier of the venue */
  google_place_id?: String
  /** Optional. Google Places type of the venue. (See supported types.) */
  google_place_type?: String
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
  /** Optional. Content of the message to be sent instead of the venue */
  input_message_content?: InputMessageContent
  /** Optional. Url of the thumbnail for the result */
  thumb_url?: String
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
  type?: String
  /** Unique identifier for this result, 1-64 Bytes */
  id?: String
  /** Contact's phone number */
  phone_number?: String
  /** Contact's first name */
  first_name?: String
  /** Optional. Contact's last name */
  last_name?: String
  /** Optional. Additional data about the contact in the form of a vCard, 0-2048 bytes */
  vcard?: String
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
  /** Optional. Content of the message to be sent instead of the contact */
  input_message_content?: InputMessageContent
  /** Optional. Url of the thumbnail for the result */
  thumb_url?: String
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
  type?: String
  /** Unique identifier for this result, 1-64 bytes */
  id?: String
  /** Short name of the game */
  game_short_name?: String
  /** Optional. Inline keyboard attached to the message */
  reply_markup?: InlineKeyboardMarkup
}

/**
 * Represents a link to a photo stored on the Telegram servers. By default, this photo will be sent by the user with an optional caption. Alternatively, you can use input_message_content to send a message with the specified content instead of the photo.
 * @see https://core.telegram.org/bots/api#inlinequeryresultcachedphoto
 */
export interface InlineQueryResultCachedPhoto {
  /** Type of the result, must be photo */
  type?: String
  /** Unique identifier for this result, 1-64 bytes */
  id?: String
  /** A valid file identifier of the photo */
  photo_file_id?: String
  /** Optional. Title for the result */
  title?: String
  /** Optional. Short description of the result */
  description?: String
  /** Optional. Caption of the photo to be sent, 0-1024 characters after entities parsing */
  caption?: String
  /** Optional. Mode for parsing entities in the photo caption. See formatting options for more details. */
  parse_mode?: String
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
  type?: String
  /** Unique identifier for this result, 1-64 bytes */
  id?: String
  /** A valid file identifier for the GIF file */
  gif_file_id?: String
  /** Optional. Title for the result */
  title?: String
  /** Optional. Caption of the GIF file to be sent, 0-1024 characters after entities parsing */
  caption?: String
  /** Optional. Mode for parsing entities in the caption. See formatting options for more details. */
  parse_mode?: String
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
  type?: String
  /** Unique identifier for this result, 1-64 bytes */
  id?: String
  /** A valid file identifier for the MP4 file */
  mpeg4_file_id?: String
  /** Optional. Title for the result */
  title?: String
  /** Optional. Caption of the MPEG-4 file to be sent, 0-1024 characters after entities parsing */
  caption?: String
  /** Optional. Mode for parsing entities in the caption. See formatting options for more details. */
  parse_mode?: String
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
  type?: String
  /** Unique identifier for this result, 1-64 bytes */
  id?: String
  /** A valid file identifier of the sticker */
  sticker_file_id?: String
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
  type?: String
  /** Unique identifier for this result, 1-64 bytes */
  id?: String
  /** Title for the result */
  title?: String
  /** A valid file identifier for the file */
  document_file_id?: String
  /** Optional. Short description of the result */
  description?: String
  /** Optional. Caption of the document to be sent, 0-1024 characters after entities parsing */
  caption?: String
  /** Optional. Mode for parsing entities in the document caption. See formatting options for more details. */
  parse_mode?: String
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
  type?: String
  /** Unique identifier for this result, 1-64 bytes */
  id?: String
  /** A valid file identifier for the video file */
  video_file_id?: String
  /** Title for the result */
  title?: String
  /** Optional. Short description of the result */
  description?: String
  /** Optional. Caption of the video to be sent, 0-1024 characters after entities parsing */
  caption?: String
  /** Optional. Mode for parsing entities in the video caption. See formatting options for more details. */
  parse_mode?: String
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
  type?: String
  /** Unique identifier for this result, 1-64 bytes */
  id?: String
  /** A valid file identifier for the voice message */
  voice_file_id?: String
  /** Voice message title */
  title?: String
  /** Optional. Caption, 0-1024 characters after entities parsing */
  caption?: String
  /** Optional. Mode for parsing entities in the voice message caption. See formatting options for more details. */
  parse_mode?: String
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
  type?: String
  /** Unique identifier for this result, 1-64 bytes */
  id?: String
  /** A valid file identifier for the audio file */
  audio_file_id?: String
  /** Optional. Caption, 0-1024 characters after entities parsing */
  caption?: String
  /** Optional. Mode for parsing entities in the audio caption. See formatting options for more details. */
  parse_mode?: String
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
  message_text?: String
  /** Optional. Mode for parsing entities in the message text. See formatting options for more details. */
  parse_mode?: String
  /** Optional. List of special entities that appear in message text, which can be specified instead of parse_mode */
  entities?: MessageEntity[]
  /** Optional. Disables link previews for links in the sent message */
  disable_web_page_preview?: Boolean
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
  title?: String
  /** Address of the venue */
  address?: String
  /** Optional. Foursquare identifier of the venue, if known */
  foursquare_id?: String
  /** Optional. Foursquare type of the venue, if known. (For example, "arts_entertainment/default", "arts_entertainment/aquarium" or "food/icecream".) */
  foursquare_type?: String
  /** Optional. Google Places identifier of the venue */
  google_place_id?: String
  /** Optional. Google Places type of the venue. (See supported types.) */
  google_place_type?: String
}

/**
 * Represents the content of a contact message to be sent as the result of an inline query.
 * @see https://core.telegram.org/bots/api#inputcontactmessagecontent
 */
export interface InputContactMessageContent {
  /** Contact's phone number */
  phone_number?: String
  /** Contact's first name */
  first_name?: String
  /** Optional. Contact's last name */
  last_name?: String
  /** Optional. Additional data about the contact in the form of a vCard, 0-2048 bytes */
  vcard?: String
}

/**
 * Represents the content of an invoice message to be sent as the result of an inline query.
 * @see https://core.telegram.org/bots/api#inputinvoicemessagecontent
 */
export interface InputInvoiceMessageContent {
  /** Product name, 1-32 characters */
  title?: String
  /** Product description, 1-255 characters */
  description?: String
  /** Bot-defined invoice payload, 1-128 bytes. This will not be displayed to the user, use for your internal processes. */
  payload?: String
  /** Payment provider token, obtained via Botfather */
  provider_token?: String
  /** Three-letter ISO 4217 currency code, see more on currencies */
  currency?: String
  /** Price breakdown, a JSON-serialized list of components (e.g. product price, tax, discount, delivery cost, delivery tax, bonus, etc.) */
  prices?: LabeledPrice[]
  /** Optional. The maximum accepted amount for tips in the smallest units of the currency (integer, not float/double). For example, for a maximum tip of US$ 1.45 pass max_tip_amount = 145. See the exp parameter in currencies.json, it shows the number of digits past the decimal point for each currency (2 for the majority of currencies). Defaults to 0 */
  max_tip_amount?: Integer
  /** Optional. A JSON-serialized array of suggested amounts of tip in the smallest units of the currency (integer, not float/double). At most 4 suggested tip amounts can be specified. The suggested tip amounts must be positive, passed in a strictly increased order and must not exceed max_tip_amount. */
  suggested_tip_amounts?: Integer[]
  /** Optional. A JSON-serialized object for data about the invoice, which will be shared with the payment provider. A detailed description of the required fields should be provided by the payment provider. */
  provider_data?: String
  /** Optional. URL of the product photo for the invoice. Can be a photo of the goods or a marketing image for a service. People like it better when they see what they are paying for. */
  photo_url?: String
  /** Optional. Photo size */
  photo_size?: Integer
  /** Optional. Photo width */
  photo_width?: Integer
  /** Optional. Photo height */
  photo_height?: Integer
  /** Optional. Pass True, if you require the user's full name to complete the order */
  need_name?: Boolean
  /** Optional. Pass True, if you require the user's phone number to complete the order */
  need_phone_number?: Boolean
  /** Optional. Pass True, if you require the user's email address to complete the order */
  need_email?: Boolean
  /** Optional. Pass True, if you require the user's shipping address to complete the order */
  need_shipping_address?: Boolean
  /** Optional. Pass True, if user's phone number should be sent to provider */
  send_phone_number_to_provider?: Boolean
  /** Optional. Pass True, if user's email address should be sent to provider */
  send_email_to_provider?: Boolean
  /** Optional. Pass True, if the final price depends on the shipping method */
  is_flexible?: Boolean
}

/**
 * Represents a result of an inline query that was chosen by the user and sent to their chat partner.
 * @see https://core.telegram.org/bots/api#choseninlineresult
 */
export interface ChosenInlineResult {
  /** The unique identifier for the result that was chosen */
  result_id?: String
  /** The user that chose the result */
  from?: User
  /** Optional. Sender location, only for bots that require user location */
  location?: Location
  /** Optional. Identifier of the sent inline message. Available only if there is an inline keyboard attached to the message. Will be also received in callback queries and can be used to edit the message. */
  inline_message_id?: String
  /** The query that was used to obtain the result */
  query?: String
}

export interface SendInvoicePayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | String
  /** Product name, 1-32 characters */
  title?: String
  /** Product description, 1-255 characters */
  description?: String
  /** Bot-defined invoice payload, 1-128 bytes. This will not be displayed to the user, use for your internal processes. */
  payload?: String
  /** Payments provider token, obtained via Botfather */
  provider_token?: String
  /** Three-letter ISO 4217 currency code, see more on currencies */
  currency?: String
  /** Price breakdown, a JSON-serialized list of components (e.g. product price, tax, discount, delivery cost, delivery tax, bonus, etc.) */
  prices?: LabeledPrice[]
  /** The maximum accepted amount for tips in the smallest units of the currency (integer, not float/double). For example, for a maximum tip of US$ 1.45 pass max_tip_amount = 145. See the exp parameter in currencies.json, it shows the number of digits past the decimal point for each currency (2 for the majority of currencies). Defaults to 0 */
  max_tip_amount?: Integer
  /** A JSON-serialized array of suggested amounts of tips in the smallest units of the currency (integer, not float/double). At most 4 suggested tip amounts can be specified. The suggested tip amounts must be positive, passed in a strictly increased order and must not exceed max_tip_amount. */
  suggested_tip_amounts?: Integer[]
  /** Unique deep-linking parameter. If left empty, forwarded copies of the sent message will have a Pay button, allowing multiple users to pay directly from the forwarded message, using the same invoice. If non-empty, forwarded copies of the sent message will have a URL button with a deep link to the bot (instead of a Pay button), with the value used as the start parameter */
  start_parameter?: String
  /** A JSON-serialized data about the invoice, which will be shared with the payment provider. A detailed description of required fields should be provided by the payment provider. */
  provider_data?: String
  /** URL of the product photo for the invoice. Can be a photo of the goods or a marketing image for a service. People like it better when they see what they are paying for. */
  photo_url?: String
  /** Photo size */
  photo_size?: Integer
  /** Photo width */
  photo_width?: Integer
  /** Photo height */
  photo_height?: Integer
  /** Pass True, if you require the user's full name to complete the order */
  need_name?: Boolean
  /** Pass True, if you require the user's phone number to complete the order */
  need_phone_number?: Boolean
  /** Pass True, if you require the user's email address to complete the order */
  need_email?: Boolean
  /** Pass True, if you require the user's shipping address to complete the order */
  need_shipping_address?: Boolean
  /** Pass True, if user's phone number should be sent to provider */
  send_phone_number_to_provider?: Boolean
  /** Pass True, if user's email address should be sent to provider */
  send_email_to_provider?: Boolean
  /** Pass True, if the final price depends on the shipping method */
  is_flexible?: Boolean
  /** Sends the message silently. Users will receive a notification with no sound. */
  disable_notification?: Boolean
  /** Protects the contents of the sent message from forwarding and saving */
  protect_content?: Boolean
  /** If the message is a reply, ID of the original message */
  reply_to_message_id?: Integer
  /** Pass True, if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: Boolean
  /** A JSON-serialized object for an inline keyboard. If empty, one 'Pay total price' button will be shown. If not empty, the first button must be a Pay button. */
  reply_markup?: InlineKeyboardMarkup
}

export interface AnswerShippingQueryPayload {
  /** Unique identifier for the query to be answered */
  shipping_query_id?: String
  /** Specify True if delivery to the specified address is possible and False if there are any problems (for example, if delivery to the specified address is not possible) */
  ok?: Boolean
  /** Required if ok is True. A JSON-serialized array of available shipping options. */
  shipping_options?: ShippingOption[]
  /** Required if ok is False. Error message in human readable form that explains why it is impossible to complete the order (e.g. "Sorry, delivery to your desired address is unavailable'). Telegram will display this message to the user. */
  error_message?: String
}

export interface AnswerPreCheckoutQueryPayload {
  /** Unique identifier for the query to be answered */
  pre_checkout_query_id?: String
  /** Specify True if everything is alright (goods are available, etc.) and the bot is ready to proceed with the order. Use False if there are any problems. */
  ok?: Boolean
  /** Required if ok is False. Error message in human readable form that explains the reason for failure to proceed with the checkout (e.g. "Sorry, somebody just bought the last of our amazing black T-shirts while you were busy filling out your payment details. Please choose a different color or garment!"). Telegram will display this message to the user. */
  error_message?: String
}

/**
 * This object represents a portion of the price for goods or services.
 * @see https://core.telegram.org/bots/api#labeledprice
 */
export interface LabeledPrice {
  /** Portion label */
  label?: String
  /** Price of the product in the smallest units of the currency (integer, not float/double). For example, for a price of US$ 1.45 pass amount = 145. See the exp parameter in currencies.json, it shows the number of digits past the decimal point for each currency (2 for the majority of currencies). */
  amount?: Integer
}

/**
 * This object contains basic information about an invoice.
 * @see https://core.telegram.org/bots/api#invoice
 */
export interface Invoice {
  /** Product name */
  title?: String
  /** Product description */
  description?: String
  /** Unique bot deep-linking parameter that can be used to generate this invoice */
  start_parameter?: String
  /** Three-letter ISO 4217 currency code */
  currency?: String
  /** Total price in the smallest units of the currency (integer, not float/double). For example, for a price of US$ 1.45 pass amount = 145. See the exp parameter in currencies.json, it shows the number of digits past the decimal point for each currency (2 for the majority of currencies). */
  total_amount?: Integer
}

/**
 * This object represents a shipping address.
 * @see https://core.telegram.org/bots/api#shippingaddress
 */
export interface ShippingAddress {
  /** ISO 3166-1 alpha-2 country code */
  country_code?: String
  /** State, if applicable */
  state?: String
  /** City */
  city?: String
  /** First line for the address */
  street_line1?: String
  /** Second line for the address */
  street_line2?: String
  /** Address post code */
  post_code?: String
}

/**
 * This object represents information about an order.
 * @see https://core.telegram.org/bots/api#orderinfo
 */
export interface OrderInfo {
  /** Optional. User name */
  name?: String
  /** Optional. User's phone number */
  phone_number?: String
  /** Optional. User email */
  email?: String
  /** Optional. User shipping address */
  shipping_address?: ShippingAddress
}

/**
 * This object represents one shipping option.
 * @see https://core.telegram.org/bots/api#shippingoption
 */
export interface ShippingOption {
  /** Shipping option identifier */
  id?: String
  /** Option title */
  title?: String
  /** List of price portions */
  prices?: LabeledPrice[]
}

/**
 * This object contains basic information about a successful payment.
 * @see https://core.telegram.org/bots/api#successfulpayment
 */
export interface SuccessfulPayment {
  /** Three-letter ISO 4217 currency code */
  currency?: String
  /** Total price in the smallest units of the currency (integer, not float/double). For example, for a price of US$ 1.45 pass amount = 145. See the exp parameter in currencies.json, it shows the number of digits past the decimal point for each currency (2 for the majority of currencies). */
  total_amount?: Integer
  /** Bot specified invoice payload */
  invoice_payload?: String
  /** Optional. Identifier of the shipping option chosen by the user */
  shipping_option_id?: String
  /** Optional. Order info provided by the user */
  order_info?: OrderInfo
  /** Telegram payment identifier */
  telegram_payment_charge_id?: String
  /** Provider payment identifier */
  provider_payment_charge_id?: String
}

/**
 * This object contains information about an incoming shipping query.
 * @see https://core.telegram.org/bots/api#shippingquery
 */
export interface ShippingQuery {
  /** Unique query identifier */
  id?: String
  /** User who sent the query */
  from?: User
  /** Bot specified invoice payload */
  invoice_payload?: String
  /** User specified shipping address */
  shipping_address?: ShippingAddress
}

/**
 * This object contains information about an incoming pre-checkout query.
 * @see https://core.telegram.org/bots/api#precheckoutquery
 */
export interface PreCheckoutQuery {
  /** Unique query identifier */
  id?: String
  /** User who sent the query */
  from?: User
  /** Three-letter ISO 4217 currency code */
  currency?: String
  /** Total price in the smallest units of the currency (integer, not float/double). For example, for a price of US$ 1.45 pass amount = 145. See the exp parameter in currencies.json, it shows the number of digits past the decimal point for each currency (2 for the majority of currencies). */
  total_amount?: Integer
  /** Bot specified invoice payload */
  invoice_payload?: String
  /** Optional. Identifier of the shipping option chosen by the user */
  shipping_option_id?: String
  /** Optional. Order info provided by the user */
  order_info?: OrderInfo
}

/**
 * Contains information about Telegram Passport data shared with the bot by the user.
 * @see https://core.telegram.org/bots/api#passportdata
 */
export interface PassportData {
  /** Array with information about documents and other Telegram Passport elements that was shared with the bot */
  data?: EncryptedPassportElement[]
  /** Encrypted credentials required to decrypt the data */
  credentials?: EncryptedCredentials
}

/**
 * This object represents a file uploaded to Telegram Passport. Currently all Telegram Passport files are in JPEG format when decrypted and don't exceed 10MB.
 * @see https://core.telegram.org/bots/api#passportfile
 */
export interface PassportFile {
  /** Identifier for this file, which can be used to download or reuse the file */
  file_id?: String
  /** Unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
  file_unique_id?: String
  /** File size in bytes */
  file_size?: Integer
  /** Unix time when the file was uploaded */
  file_date?: Integer
}

/**
 * Contains information about documents or other Telegram Passport elements shared with the bot by the user.
 * @see https://core.telegram.org/bots/api#encryptedpassportelement
 */
export interface EncryptedPassportElement {
  /** Element type. One of "personal_details", "passport", "driver_license", "identity_card", "internal_passport", "address", "utility_bill", "bank_statement", "rental_agreement", "passport_registration", "temporary_registration", "phone_number", "email". */
  type?: String
  /** Optional. Base64-encoded encrypted Telegram Passport element data provided by the user, available for "personal_details", "passport", "driver_license", "identity_card", "internal_passport" and "address" types. Can be decrypted and verified using the accompanying EncryptedCredentials. */
  data?: String
  /** Optional. User's verified phone number, available only for "phone_number" type */
  phone_number?: String
  /** Optional. User's verified email address, available only for "email" type */
  email?: String
  /** Optional. encrypted files with documents provided by the user, available for "utility_bill", "bank_statement", "rental_agreement", "passport_registration" and "temporary_registration" types. Files can be decrypted and verified using the accompanying EncryptedCredentials. */
  files?: PassportFile[]
  /** Optional. Encrypted file with the front side of the document, provided by the user. Available for "passport", "driver_license", "identity_card" and "internal_passport". The file can be decrypted and verified using the accompanying EncryptedCredentials. */
  front_side?: PassportFile
  /** Optional. Encrypted file with the reverse side of the document, provided by the user. Available for "driver_license" and "identity_card". The file can be decrypted and verified using the accompanying EncryptedCredentials. */
  reverse_side?: PassportFile
  /** Optional. Encrypted file with the selfie of the user holding a document, provided by the user; available for "passport", "driver_license", "identity_card" and "internal_passport". The file can be decrypted and verified using the accompanying EncryptedCredentials. */
  selfie?: PassportFile
  /** Optional. encrypted files with translated versions of documents provided by the user. Available if requested for "passport", "driver_license", "identity_card", "internal_passport", "utility_bill", "bank_statement", "rental_agreement", "passport_registration" and "temporary_registration" types. Files can be decrypted and verified using the accompanying EncryptedCredentials. */
  translation?: PassportFile[]
  /** Base64-encoded element hash for using in PassportElementErrorUnspecified */
  hash?: String
}

/**
 * Contains data required for decrypting and authenticating EncryptedPassportElement. See the Telegram Passport Documentation for a complete description of the data decryption and authentication processes.
 * @see https://core.telegram.org/bots/api#encryptedcredentials
 */
export interface EncryptedCredentials {
  /** Base64-encoded encrypted JSON-serialized data with unique user's payload, data hashes and secrets required for EncryptedPassportElement decryption and authentication */
  data?: String
  /** Base64-encoded data hash for data authentication */
  hash?: String
  /** Base64-encoded secret, encrypted with the bot's public RSA key, required for data decryption */
  secret?: String
}

export interface SetPassportDataErrorsPayload {
  /** User identifier */
  user_id?: Integer
  /** A JSON-serialized array describing the errors */
  errors?: PassportElementError[]
}

/**
 * This object represents an error in the Telegram Passport element which was submitted that should be resolved by the user. It should be one of:
 * - PassportElementErrorDataField
 * - PassportElementErrorFrontSide
 * - PassportElementErrorReverseSide
 * - PassportElementErrorSelfie
 * - PassportElementErrorFile
 * - PassportElementErrorFiles
 * - PassportElementErrorTranslationFile
 * - PassportElementErrorTranslationFiles
 * - PassportElementErrorUnspecified
 * @see https://core.telegram.org/bots/api#passportelementerror
 */
export type PassportElementError =
  | PassportElementErrorDataField
  | PassportElementErrorFrontSide
  | PassportElementErrorReverseSide
  | PassportElementErrorSelfie
  | PassportElementErrorFile
  | PassportElementErrorFiles
  | PassportElementErrorTranslationFile
  | PassportElementErrorTranslationFiles
  | PassportElementErrorUnspecified

/**
 * Represents an issue in one of the data fields that was provided by the user. The error is considered resolved when the field's value changes.
 * @see https://core.telegram.org/bots/api#passportelementerrordatafield
 */
export interface PassportElementErrorDataField {
  /** Error source, must be data */
  source?: String
  /** The section of the user's Telegram Passport which has the error, one of "personal_details", "passport", "driver_license", "identity_card", "internal_passport", "address" */
  type?: String
  /** Name of the data field which has the error */
  field_name?: String
  /** Base64-encoded data hash */
  data_hash?: String
  /** Error message */
  message?: String
}

/**
 * Represents an issue with the front side of a document. The error is considered resolved when the file with the front side of the document changes.
 * @see https://core.telegram.org/bots/api#passportelementerrorfrontside
 */
export interface PassportElementErrorFrontSide {
  /** Error source, must be front_side */
  source?: String
  /** The section of the user's Telegram Passport which has the issue, one of "passport", "driver_license", "identity_card", "internal_passport" */
  type?: String
  /** Base64-encoded hash of the file with the front side of the document */
  file_hash?: String
  /** Error message */
  message?: String
}

/**
 * Represents an issue with the reverse side of a document. The error is considered resolved when the file with reverse side of the document changes.
 * @see https://core.telegram.org/bots/api#passportelementerrorreverseside
 */
export interface PassportElementErrorReverseSide {
  /** Error source, must be reverse_side */
  source?: String
  /** The section of the user's Telegram Passport which has the issue, one of "driver_license", "identity_card" */
  type?: String
  /** Base64-encoded hash of the file with the reverse side of the document */
  file_hash?: String
  /** Error message */
  message?: String
}

/**
 * Represents an issue with the selfie with a document. The error is considered resolved when the file with the selfie changes.
 * @see https://core.telegram.org/bots/api#passportelementerrorselfie
 */
export interface PassportElementErrorSelfie {
  /** Error source, must be selfie */
  source?: String
  /** The section of the user's Telegram Passport which has the issue, one of "passport", "driver_license", "identity_card", "internal_passport" */
  type?: String
  /** Base64-encoded hash of the file with the selfie */
  file_hash?: String
  /** Error message */
  message?: String
}

/**
 * Represents an issue with a document scan. The error is considered resolved when the file with the document scan changes.
 * @see https://core.telegram.org/bots/api#passportelementerrorfile
 */
export interface PassportElementErrorFile {
  /** Error source, must be file */
  source?: String
  /** The section of the user's Telegram Passport which has the issue, one of "utility_bill", "bank_statement", "rental_agreement", "passport_registration", "temporary_registration" */
  type?: String
  /** Base64-encoded file hash */
  file_hash?: String
  /** Error message */
  message?: String
}

/**
 * Represents an issue with a list of scans. The error is considered resolved when the list of files containing the scans changes.
 * @see https://core.telegram.org/bots/api#passportelementerrorfiles
 */
export interface PassportElementErrorFiles {
  /** Error source, must be files */
  source?: String
  /** The section of the user's Telegram Passport which has the issue, one of "utility_bill", "bank_statement", "rental_agreement", "passport_registration", "temporary_registration" */
  type?: String
  /** List of base64-encoded file hashes */
  file_hashes?: String[]
  /** Error message */
  message?: String
}

/**
 * Represents an issue with one of the files that constitute the translation of a document. The error is considered resolved when the file changes.
 * @see https://core.telegram.org/bots/api#passportelementerrortranslationfile
 */
export interface PassportElementErrorTranslationFile {
  /** Error source, must be translation_file */
  source?: String
  /** Type of element of the user's Telegram Passport which has the issue, one of "passport", "driver_license", "identity_card", "internal_passport", "utility_bill", "bank_statement", "rental_agreement", "passport_registration", "temporary_registration" */
  type?: String
  /** Base64-encoded file hash */
  file_hash?: String
  /** Error message */
  message?: String
}

/**
 * Represents an issue with the translated version of a document. The error is considered resolved when a file with the document translation change.
 * @see https://core.telegram.org/bots/api#passportelementerrortranslationfiles
 */
export interface PassportElementErrorTranslationFiles {
  /** Error source, must be translation_files */
  source?: String
  /** Type of element of the user's Telegram Passport which has the issue, one of "passport", "driver_license", "identity_card", "internal_passport", "utility_bill", "bank_statement", "rental_agreement", "passport_registration", "temporary_registration" */
  type?: String
  /** List of base64-encoded file hashes */
  file_hashes?: String[]
  /** Error message */
  message?: String
}

/**
 * Represents an issue in an unspecified place. The error is considered resolved when new data is added.
 * @see https://core.telegram.org/bots/api#passportelementerrorunspecified
 */
export interface PassportElementErrorUnspecified {
  /** Error source, must be unspecified */
  source?: String
  /** Type of element of the user's Telegram Passport which has the issue */
  type?: String
  /** Base64-encoded element hash */
  element_hash?: String
  /** Error message */
  message?: String
}

export interface SendGamePayload {
  /** Unique identifier for the target chat */
  chat_id?: Integer
  /** Short name of the game, serves as the unique identifier for the game. Set up your games via Botfather. */
  game_short_name?: String
  /** Sends the message silently. Users will receive a notification with no sound. */
  disable_notification?: Boolean
  /** Protects the contents of the sent message from forwarding and saving */
  protect_content?: Boolean
  /** If the message is a reply, ID of the original message */
  reply_to_message_id?: Integer
  /** Pass True, if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: Boolean
  /** A JSON-serialized object for an inline keyboard. If empty, one 'Play game_title' button will be shown. If not empty, the first button must launch the game. */
  reply_markup?: InlineKeyboardMarkup
}

/**
 * This object represents a game. Use BotFather to create and edit games, their short names will act as unique identifiers.
 * @see https://core.telegram.org/bots/api#game
 */
export interface Game {
  /** Title of the game */
  title?: String
  /** Description of the game */
  description?: String
  /** Photo that will be displayed in the game message in chats. */
  photo?: PhotoSize[]
  /** Optional. Brief description of the game or high scores included in the game message. Can be automatically edited to include current high scores for the game when the bot calls setGameScore, or manually edited using editMessageText. 0-4096 characters. */
  text?: String
  /** Optional. Special entities that appear in text, such as usernames, URLs, bot commands, etc. */
  text_entities?: MessageEntity[]
  /** Optional. Animation that will be displayed in the game message in chats. Upload via BotFather */
  animation?: Animation
}

/**
 * A placeholder, currently holds no information. Use BotFather to set up your game.
 * @see https://core.telegram.org/bots/api#callbackgame
 */
export type CallbackGame = any

export interface SetGameScorePayload {
  /** User identifier */
  user_id?: Integer
  /** New score, must be non-negative */
  score?: Integer
  /** Pass True, if the high score is allowed to decrease. This can be useful when fixing mistakes or banning cheaters */
  force?: Boolean
  /** Pass True, if the game message should not be automatically edited to include the current scoreboard */
  disable_edit_message?: Boolean
  /** Required if inline_message_id is not specified. Unique identifier for the target chat */
  chat_id?: Integer
  /** Required if inline_message_id is not specified. Identifier of the sent message */
  message_id?: Integer
  /** Required if chat_id and message_id are not specified. Identifier of the inline message */
  inline_message_id?: String
}

export interface GetGameHighScoresPayload {
  /** Target user id */
  user_id?: Integer
  /** Required if inline_message_id is not specified. Unique identifier for the target chat */
  chat_id?: Integer
  /** Required if inline_message_id is not specified. Identifier of the sent message */
  message_id?: Integer
  /** Required if chat_id and message_id are not specified. Identifier of the inline message */
  inline_message_id?: String
}

/**
 * This object represents one row of the high scores table for a game.
 * @see https://core.telegram.org/bots/api#gamehighscore
 */
export interface GameHighScore {
  /** Position in high score table for the game */
  position?: Integer
  /** User */
  user?: User
  /** Score */
  score?: Integer
}

export interface Internal {
  /**
   * Use this method to receive incoming updates using long polling (wiki). An Array of Update objects is returned.
   * @see https://core.telegram.org/bots/api#getupdates
   */
  getUpdates(payload: GetUpdatesPayload): Promise<Update[]>
  /**
   * Use this method to specify a url and receive incoming updates via an outgoing webhook. Whenever there is an update for the bot, we will send an HTTPS POST request to the specified url, containing a JSON-serialized Update. In case of an unsuccessful request, we will give up after a reasonable amount of attempts. Returns True on success.
   *
   * If you'd like to make sure that the Webhook request comes from Telegram, we recommend using a secret path in the URL, e.g. https://www.example.com/<token>. Since nobody else knows your bot's token, you can be pretty sure it's us.
   * @see https://core.telegram.org/bots/api#setwebhook
   */
  setWebhook(payload: SetWebhookPayload): Promise<True>
  /**
   * Use this method to remove webhook integration if you decide to switch back to getUpdates. Returns True on success.
   * @see https://core.telegram.org/bots/api#deletewebhook
   */
  deleteWebhook(payload: DeleteWebhookPayload): Promise<True>
  /**
   * Use this method to get current webhook status. Requires no parameters. On success, returns a WebhookInfo object. If the bot is using getUpdates, will return an object with the url field empty.
   * @see https://core.telegram.org/bots/api#getwebhookinfo
   */
  getWebhookInfo(): Promise<WebhookInfo>
  /**
   * A simple method for testing your bot's authentication token. Requires no parameters. Returns basic information about the bot in form of a User object.
   * @see https://core.telegram.org/bots/api#getme
   */
  getMe(): Promise<User>
  /**
   * Use this method to log out from the cloud Bot API server before launching the bot locally. You must log out the bot before running it locally, otherwise there is no guarantee that the bot will receive updates. After a successful call, you can immediately log in on a local server, but will not be able to log in back to the cloud Bot API server for 10 minutes. Returns True on success. Requires no parameters.
   * @see https://core.telegram.org/bots/api#logout
   */
  logOut(): Promise<True>
  /**
   * Use this method to close the bot instance before moving it from one local server to another. You need to delete the webhook before calling this method to ensure that the bot isn't launched again after server restart. The method will return error 429 in the first 10 minutes after the bot is launched. Returns True on success. Requires no parameters.
   * @see https://core.telegram.org/bots/api#close
   */
  close(): Promise<True>
  /**
   * Use this method to send text messages. On success, the sent Message is returned.
   * @see https://core.telegram.org/bots/api#sendmessage
   */
  sendMessage(payload: SendMessagePayload): Promise<Message>
  /**
   * Use this method to forward messages of any kind. Service messages can't be forwarded. On success, the sent Message is returned.
   * @see https://core.telegram.org/bots/api#forwardmessage
   */
  forwardMessage(payload: ForwardMessagePayload): Promise<Message>
  /**
   * Use this method to copy messages of any kind. Service messages and invoice messages can't be copied. The method is analogous to the method forwardMessage, but the copied message doesn't have a link to the original message. Returns the MessageId of the sent message on success.
   * @see https://core.telegram.org/bots/api#copymessage
   */
  copyMessage(payload: CopyMessagePayload): Promise<Integer>
  /**
   * Use this method to send photos. On success, the sent Message is returned.
   * @see https://core.telegram.org/bots/api#sendphoto
   */
  sendPhoto(payload: SendPhotoPayload): Promise<Message>
  /**
   * Use this method to send audio files, if you want Telegram clients to display them in the music player. Your audio must be in the .MP3 or .M4A format. On success, the sent Message is returned. Bots can currently send audio files of up to 50 MB in size, this limit may be changed in the future.
   *
   * For sending voice messages, use the sendVoice method instead.
   * @see https://core.telegram.org/bots/api#sendaudio
   */
  sendAudio(payload: SendAudioPayload): Promise<Message>
  /**
   * Use this method to send general files. On success, the sent Message is returned. Bots can currently send files of any type of up to 50 MB in size, this limit may be changed in the future.
   * @see https://core.telegram.org/bots/api#senddocument
   */
  sendDocument(payload: SendDocumentPayload): Promise<Message>
  /**
   * Use this method to send video files, Telegram clients support mp4 videos (other formats may be sent as Document). On success, the sent Message is returned. Bots can currently send video files of up to 50 MB in size, this limit may be changed in the future.
   * @see https://core.telegram.org/bots/api#sendvideo
   */
  sendVideo(payload: SendVideoPayload): Promise<Message>
  /**
   * Use this method to send animation files (GIF or H.264/MPEG-4 AVC video without sound). On success, the sent Message is returned. Bots can currently send animation files of up to 50 MB in size, this limit may be changed in the future.
   * @see https://core.telegram.org/bots/api#sendanimation
   */
  sendAnimation(payload: SendAnimationPayload): Promise<Message>
  /**
   * Use this method to send audio files, if you want Telegram clients to display the file as a playable voice message. For this to work, your audio must be in an .OGG file encoded with OPUS (other formats may be sent as Audio or Document). On success, the sent Message is returned. Bots can currently send voice messages of up to 50 MB in size, this limit may be changed in the future.
   * @see https://core.telegram.org/bots/api#sendvoice
   */
  sendVoice(payload: SendVoicePayload): Promise<Message>
  /**
   * As of v.4.0, Telegram clients support rounded square mp4 videos of up to 1 minute long. Use this method to send video messages. On success, the sent Message is returned.
   * @see https://core.telegram.org/bots/api#sendvideonote
   */
  sendVideoNote(payload: SendVideoNotePayload): Promise<Message>
  /**
   * Use this method to send a group of photos, videos, documents or audios as an album. Documents and audio files can be only grouped in an album with messages of the same type. On success, an array of Messages that were sent is returned.
   * @see https://core.telegram.org/bots/api#sendmediagroup
   */
  sendMediaGroup(payload: SendMediaGroupPayload): Promise<Message[]>
  /**
   * Use this method to send point on the map. On success, the sent Message is returned.
   * @see https://core.telegram.org/bots/api#sendlocation
   */
  sendLocation(payload: SendLocationPayload): Promise<Message>
  /**
   * Use this method to edit live location messages. A location can be edited until its live_period expires or editing is explicitly disabled by a call to stopMessageLiveLocation. On success, if the edited message is not an inline message, the edited Message is returned, otherwise True is returned.
   * @see https://core.telegram.org/bots/api#editmessagelivelocation
   */
  editMessageLiveLocation(payload: EditMessageLiveLocationPayload): Promise<Message | True>
  /**
   * Use this method to stop updating a live location message before live_period expires. On success, if the message is not an inline message, the edited Message is returned, otherwise True is returned.
   * @see https://core.telegram.org/bots/api#stopmessagelivelocation
   */
  stopMessageLiveLocation(payload: StopMessageLiveLocationPayload): Promise<Message | True>
  /**
   * Use this method to send information about a venue. On success, the sent Message is returned.
   * @see https://core.telegram.org/bots/api#sendvenue
   */
  sendVenue(payload: SendVenuePayload): Promise<Message>
  /**
   * Use this method to send phone contacts. On success, the sent Message is returned.
   * @see https://core.telegram.org/bots/api#sendcontact
   */
  sendContact(payload: SendContactPayload): Promise<Message>
  /**
   * Use this method to send a native poll. On success, the sent Message is returned.
   * @see https://core.telegram.org/bots/api#sendpoll
   */
  sendPoll(payload: SendPollPayload): Promise<Message>
  /**
   * Use this method to send an animated emoji that will display a random value. On success, the sent Message is returned.
   * @see https://core.telegram.org/bots/api#senddice
   */
  sendDice(payload: SendDicePayload): Promise<Message>
  /**
   * Use this method when you need to tell the user that something is happening on the bot's side. The status is set for 5 seconds or less (when a message arrives from your bot, Telegram clients clear its typing status). Returns True on success.
   *
   * Example: The ImageBot needs some time to process a request and upload the image. Instead of sending a text message along the lines of "Retrieving image, please wait...", the bot may use sendChatAction with action = upload_photo. The user will see a "sending photo" status for the bot.
   *
   * We only recommend using this method when a response from the bot will take a noticeable amount of time to arrive.
   * @see https://core.telegram.org/bots/api#sendchataction
   */
  sendChatAction(payload: SendChatActionPayload): Promise<True>
  /**
   * Use this method to get a list of profile pictures for a user. Returns a UserProfilePhotos object.
   * @see https://core.telegram.org/bots/api#getuserprofilephotos
   */
  getUserProfilePhotos(payload: GetUserProfilePhotosPayload): Promise<UserProfilePhotos>
  /**
   * Use this method to get basic info about a file and prepare it for downloading. For the moment, bots can download files of up to 20MB in size. On success, a File object is returned. The file can then be downloaded via the link https://api.telegram.org/file/bot<token>/<file_path>, where <file_path> is taken from the response. It is guaranteed that the link will be valid for at least 1 hour. When the link expires, a new one can be requested by calling getFile again.
   * @see https://core.telegram.org/bots/api#getfile
   */
  getFile(payload: GetFilePayload): Promise<File>
  /**
   * Use this method to ban a user in a group, a supergroup or a channel. In the case of supergroups and channels, the user will not be able to return to the chat on their own using invite links, etc., unless unbanned first. The bot must be an administrator in the chat for this to work and must have the appropriate administrator rights. Returns True on success.
   * @see https://core.telegram.org/bots/api#banchatmember
   */
  banChatMember(payload: BanChatMemberPayload): Promise<True>
  /**
   * Use this method to unban a previously banned user in a supergroup or channel. The user will not return to the group or channel automatically, but will be able to join via link, etc. The bot must be an administrator for this to work. By default, this method guarantees that after the call the user is not a member of the chat, but will be able to join it. So if the user is a member of the chat they will also be removed from the chat. If you don't want this, use the parameter only_if_banned. Returns True on success.
   * @see https://core.telegram.org/bots/api#unbanchatmember
   */
  unbanChatMember(payload: UnbanChatMemberPayload): Promise<True>
  /**
   * Use this method to restrict a user in a supergroup. The bot must be an administrator in the supergroup for this to work and must have the appropriate administrator rights. Pass True for all permissions to lift restrictions from a user. Returns True on success.
   * @see https://core.telegram.org/bots/api#restrictchatmember
   */
  restrictChatMember(payload: RestrictChatMemberPayload): Promise<True>
  /**
   * Use this method to promote or demote a user in a supergroup or a channel. The bot must be an administrator in the chat for this to work and must have the appropriate administrator rights. Pass False for all boolean parameters to demote a user. Returns True on success.
   * @see https://core.telegram.org/bots/api#promotechatmember
   */
  promoteChatMember(payload: PromoteChatMemberPayload): Promise<True>
  /**
   * Use this method to set a custom title for an administrator in a supergroup promoted by the bot. Returns True on success.
   * @see https://core.telegram.org/bots/api#setchatadministratorcustomtitle
   */
  setChatAdministratorCustomTitle(payload: SetChatAdministratorCustomTitlePayload): Promise<True>
  /**
   * Use this method to ban a channel chat in a supergroup or a channel. Until the chat is unbanned, the owner of the banned chat won't be able to send messages on behalf of any of their channels. The bot must be an administrator in the supergroup or channel for this to work and must have the appropriate administrator rights. Returns True on success.
   * @see https://core.telegram.org/bots/api#banchatsenderchat
   */
  banChatSenderChat(payload: BanChatSenderChatPayload): Promise<True>
  /**
   * Use this method to unban a previously banned channel chat in a supergroup or channel. The bot must be an administrator for this to work and must have the appropriate administrator rights. Returns True on success.
   * @see https://core.telegram.org/bots/api#unbanchatsenderchat
   */
  unbanChatSenderChat(payload: UnbanChatSenderChatPayload): Promise<True>
  /**
   * Use this method to set default chat permissions for all members. The bot must be an administrator in the group or a supergroup for this to work and must have the can_restrict_members administrator rights. Returns True on success.
   * @see https://core.telegram.org/bots/api#setchatpermissions
   */
  setChatPermissions(payload: SetChatPermissionsPayload): Promise<True>
  /**
   * Use this method to generate a new primary invite link for a chat; any previously generated primary link is revoked. The bot must be an administrator in the chat for this to work and must have the appropriate administrator rights. Returns the new invite link as String on success.
   * @see https://core.telegram.org/bots/api#exportchatinvitelink
   */
  exportChatInviteLink(payload: ExportChatInviteLinkPayload): Promise<String>
  /**
   * Use this method to create an additional invite link for a chat. The bot must be an administrator in the chat for this to work and must have the appropriate administrator rights. The link can be revoked using the method revokeChatInviteLink. Returns the new invite link as ChatInviteLink object.
   * @see https://core.telegram.org/bots/api#createchatinvitelink
   */
  createChatInviteLink(payload: CreateChatInviteLinkPayload): Promise<ChatInviteLink>
  /**
   * Use this method to edit a non-primary invite link created by the bot. The bot must be an administrator in the chat for this to work and must have the appropriate administrator rights. Returns the edited invite link as a ChatInviteLink object.
   * @see https://core.telegram.org/bots/api#editchatinvitelink
   */
  editChatInviteLink(payload: EditChatInviteLinkPayload): Promise<ChatInviteLink>
  /**
   * Use this method to revoke an invite link created by the bot. If the primary link is revoked, a new link is automatically generated. The bot must be an administrator in the chat for this to work and must have the appropriate administrator rights. Returns the revoked invite link as ChatInviteLink object.
   * @see https://core.telegram.org/bots/api#revokechatinvitelink
   */
  revokeChatInviteLink(payload: RevokeChatInviteLinkPayload): Promise<ChatInviteLink>
  /**
   * Use this method to approve a chat join request. The bot must be an administrator in the chat for this to work and must have the can_invite_users administrator right. Returns True on success.
   * @see https://core.telegram.org/bots/api#approvechatjoinrequest
   */
  approveChatJoinRequest(payload: ApproveChatJoinRequestPayload): Promise<True>
  /**
   * Use this method to decline a chat join request. The bot must be an administrator in the chat for this to work and must have the can_invite_users administrator right. Returns True on success.
   * @see https://core.telegram.org/bots/api#declinechatjoinrequest
   */
  declineChatJoinRequest(payload: DeclineChatJoinRequestPayload): Promise<True>
  /**
   * Use this method to set a new profile photo for the chat. Photos can't be changed for private chats. The bot must be an administrator in the chat for this to work and must have the appropriate administrator rights. Returns True on success.
   * @see https://core.telegram.org/bots/api#setchatphoto
   */
  setChatPhoto(payload: SetChatPhotoPayload): Promise<True>
  /**
   * Use this method to delete a chat photo. Photos can't be changed for private chats. The bot must be an administrator in the chat for this to work and must have the appropriate administrator rights. Returns True on success.
   * @see https://core.telegram.org/bots/api#deletechatphoto
   */
  deleteChatPhoto(payload: DeleteChatPhotoPayload): Promise<True>
  /**
   * Use this method to change the title of a chat. Titles can't be changed for private chats. The bot must be an administrator in the chat for this to work and must have the appropriate administrator rights. Returns True on success.
   * @see https://core.telegram.org/bots/api#setchattitle
   */
  setChatTitle(payload: SetChatTitlePayload): Promise<True>
  /**
   * Use this method to change the description of a group, a supergroup or a channel. The bot must be an administrator in the chat for this to work and must have the appropriate administrator rights. Returns True on success.
   * @see https://core.telegram.org/bots/api#setchatdescription
   */
  setChatDescription(payload: SetChatDescriptionPayload): Promise<True>
  /**
   * Use this method to add a message to the list of pinned messages in a chat. If the chat is not a private chat, the bot must be an administrator in the chat for this to work and must have the 'can_pin_messages' administrator right in a supergroup or 'can_edit_messages' administrator right in a channel. Returns True on success.
   * @see https://core.telegram.org/bots/api#pinchatmessage
   */
  pinChatMessage(payload: PinChatMessagePayload): Promise<True>
  /**
   * Use this method to remove a message from the list of pinned messages in a chat. If the chat is not a private chat, the bot must be an administrator in the chat for this to work and must have the 'can_pin_messages' administrator right in a supergroup or 'can_edit_messages' administrator right in a channel. Returns True on success.
   * @see https://core.telegram.org/bots/api#unpinchatmessage
   */
  unpinChatMessage(payload: UnpinChatMessagePayload): Promise<True>
  /**
   * Use this method to clear the list of pinned messages in a chat. If the chat is not a private chat, the bot must be an administrator in the chat for this to work and must have the 'can_pin_messages' administrator right in a supergroup or 'can_edit_messages' administrator right in a channel. Returns True on success.
   * @see https://core.telegram.org/bots/api#unpinallchatmessages
   */
  unpinAllChatMessages(payload: UnpinAllChatMessagesPayload): Promise<True>
  /**
   * Use this method for your bot to leave a group, supergroup or channel. Returns True on success.
   * @see https://core.telegram.org/bots/api#leavechat
   */
  leaveChat(payload: LeaveChatPayload): Promise<True>
  /**
   * Use this method to get up to date information about the chat (current name of the user for one-on-one conversations, current username of a user, group or channel, etc.). Returns a Chat object on success.
   * @see https://core.telegram.org/bots/api#getchat
   */
  getChat(payload: GetChatPayload): Promise<Chat>
  /**
   * Use this method to get a list of administrators in a chat. On success, returns an Array of ChatMember objects that contains information about all chat administrators except other bots. If the chat is a group or a supergroup and no administrators were appointed, only the creator will be returned.
   * @see https://core.telegram.org/bots/api#getchatadministrators
   */
  getChatAdministrators(payload: GetChatAdministratorsPayload): Promise<ChatMember[]>
  /**
   * Use this method to get the number of members in a chat. Returns Int on success.
   * @see https://core.telegram.org/bots/api#getchatmembercount
   */
  getChatMemberCount(payload: GetChatMemberCountPayload): Promise<Integer>
  /**
   * Use this method to get information about a member of a chat. Returns a ChatMember object on success.
   * @see https://core.telegram.org/bots/api#getchatmember
   */
  getChatMember(payload: GetChatMemberPayload): Promise<ChatMember>
  /**
   * Use this method to set a new group sticker set for a supergroup. The bot must be an administrator in the chat for this to work and must have the appropriate administrator rights. Use the field can_set_sticker_set optionally returned in getChat requests to check if the bot can use this method. Returns True on success.
   * @see https://core.telegram.org/bots/api#setchatstickerset
   */
  setChatStickerSet(payload: SetChatStickerSetPayload): Promise<True>
  /**
   * Use this method to delete a group sticker set from a supergroup. The bot must be an administrator in the chat for this to work and must have the appropriate administrator rights. Use the field can_set_sticker_set optionally returned in getChat requests to check if the bot can use this method. Returns True on success.
   * @see https://core.telegram.org/bots/api#deletechatstickerset
   */
  deleteChatStickerSet(payload: DeleteChatStickerSetPayload): Promise<True>
  /**
   * Use this method to send answers to callback queries sent from inline keyboards. The answer will be displayed to the user as a notification at the top of the chat screen or as an alert. On success, True is returned.
   *
   * Alternatively, the user can be redirected to the specified Game URL. For this option to work, you must first create a game for your bot via @Botfather and accept the terms. Otherwise, you may use links like t.me/your_bot?start=XXXX that open your bot with a parameter.
   * @see https://core.telegram.org/bots/api#answercallbackquery
   */
  answerCallbackQuery(payload: AnswerCallbackQueryPayload): Promise<True>
  /**
   * Use this method to change the list of the bot's commands. See https://core.telegram.org/bots#commands for more details about bot commands. Returns True on success.
   * @see https://core.telegram.org/bots/api#setmycommands
   */
  setMyCommands(payload: SetMyCommandsPayload): Promise<True>
  /**
   * Use this method to delete the list of the bot's commands for the given scope and user language. After deletion, higher level commands will be shown to affected users. Returns True on success.
   * @see https://core.telegram.org/bots/api#deletemycommands
   */
  deleteMyCommands(payload: DeleteMyCommandsPayload): Promise<True>
  /**
   * Use this method to get the current list of the bot's commands for the given scope and user language. Returns BotCommand on success. If commands aren't set, an empty list is returned.
   * @see https://core.telegram.org/bots/api#getmycommands
   */
  getMyCommands(payload: GetMyCommandsPayload): Promise<BotCommand[]>
  /**
   * Use this method to edit text and game messages. On success, if the edited message is not an inline message, the edited Message is returned, otherwise True is returned.
   * @see https://core.telegram.org/bots/api#editmessagetext
   */
  editMessageText(payload: EditMessageTextPayload): Promise<Message | True>
  /**
   * Use this method to edit captions of messages. On success, if the edited message is not an inline message, the edited Message is returned, otherwise True is returned.
   * @see https://core.telegram.org/bots/api#editmessagecaption
   */
  editMessageCaption(payload: EditMessageCaptionPayload): Promise<Message | True>
  /**
   * Use this method to edit animation, audio, document, photo, or video messages. If a message is part of a message album, then it can be edited only to an audio for audio albums, only to a document for document albums and to a photo or a video otherwise. When an inline message is edited, a new file can't be uploaded; use a previously uploaded file via its file_id or specify a URL. On success, if the edited message is not an inline message, the edited Message is returned, otherwise True is returned.
   * @see https://core.telegram.org/bots/api#editmessagemedia
   */
  editMessageMedia(payload: EditMessageMediaPayload): Promise<Message | True>
  /**
   * Use this method to edit only the reply markup of messages. On success, if the edited message is not an inline message, the edited Message is returned, otherwise True is returned.
   * @see https://core.telegram.org/bots/api#editmessagereplymarkup
   */
  editMessageReplyMarkup(payload: EditMessageReplyMarkupPayload): Promise<Message | True>
  /**
   * Use this method to stop a poll which was sent by the bot. On success, the stopped Poll is returned.
   * @see https://core.telegram.org/bots/api#stoppoll
   */
  stopPoll(payload: StopPollPayload): Promise<Poll>
  /**
   * Use this method to delete a message, including service messages, with the following limitations:
   * - A message can only be deleted if it was sent less than 48 hours ago.
   * - A dice message in a private chat can only be deleted if it was sent more than 24 hours ago.
   * - Bots can delete outgoing messages in private chats, groups, and supergroups.
   * - Bots can delete incoming messages in private chats.
   * - Bots granted can_post_messages permissions can delete outgoing messages in channels.
   * - If the bot is an administrator of a group, it can delete any message there.
   * - If the bot has can_delete_messages permission in a supergroup or a channel, it can delete any message there.
   * Returns True on success.
   * @see https://core.telegram.org/bots/api#deletemessage
   */
  deleteMessage(payload: DeleteMessagePayload): Promise<True>
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
  createNewStickerSet(payload: CreateNewStickerSetPayload): Promise<True>
  /**
   * Use this method to add a new sticker to a set created by the bot. You must use exactly one of the fields png_sticker, tgs_sticker, or webm_sticker. Animated stickers can be added to animated sticker sets and only to them. Animated sticker sets can have up to 50 stickers. Static sticker sets can have up to 120 stickers. Returns True on success.
   * @see https://core.telegram.org/bots/api#addstickertoset
   */
  addStickerToSet(payload: AddStickerToSetPayload): Promise<True>
  /**
   * Use this method to move a sticker in a set created by the bot to a specific position. Returns True on success.
   * @see https://core.telegram.org/bots/api#setstickerpositioninset
   */
  setStickerPositionInSet(payload: SetStickerPositionInSetPayload): Promise<True>
  /**
   * Use this method to delete a sticker from a set created by the bot. Returns True on success.
   * @see https://core.telegram.org/bots/api#deletestickerfromset
   */
  deleteStickerFromSet(payload: DeleteStickerFromSetPayload): Promise<True>
  /**
   * Use this method to set the thumbnail of a sticker set. Animated thumbnails can be set for animated sticker sets only. Video thumbnails can be set only for video sticker sets only. Returns True on success.
   * @see https://core.telegram.org/bots/api#setstickersetthumb
   */
  setStickerSetThumb(payload: SetStickerSetThumbPayload): Promise<True>
  /**
   * Use this method to send answers to an inline query. On success, True is returned. No more than 50 results per query are allowed.
   * @see https://core.telegram.org/bots/api#answerinlinequery
   */
  answerInlineQuery(payload: AnswerInlineQueryPayload): Promise<True>
  /**
   * Use this method to send invoices. On success, the sent Message is returned.
   * @see https://core.telegram.org/bots/api#sendinvoice
   */
  sendInvoice(payload: SendInvoicePayload): Promise<Message>
  /**
   * If you sent an invoice requesting a shipping address and the parameter is_flexible was specified, the Bot API will send an Update with a shipping_query field to the bot. Use this method to reply to shipping queries. On success, True is returned.
   * @see https://core.telegram.org/bots/api#answershippingquery
   */
  answerShippingQuery(payload: AnswerShippingQueryPayload): Promise<True>
  /**
   * Once the user has confirmed their payment and shipping details, the Bot API sends the final confirmation in the form of an Update with the field pre_checkout_query. Use this method to respond to such pre-checkout queries. On success, True is returned.
   * Note: The Bot API must receive an answer within 10 seconds after the pre-checkout query was sent.
   * @see https://core.telegram.org/bots/api#answerprecheckoutquery
   */
  answerPreCheckoutQuery(payload: AnswerPreCheckoutQueryPayload): Promise<True>
  /**
   * Informs a user that some of the Telegram Passport elements they provided contains errors. The user will not be able to re-submit their Passport to you until the errors are fixed (the contents of the field for which you returned the error must change). Returns True on success.
   *
   * Use this if the data submitted by the user doesn't satisfy the standards your service requires for any reason. For example, if a birthday date seems invalid, a submitted document is blurry, a scan shows evidence of tampering, etc. Supply some details in the error message to make sure the user knows how to correct the issues.
   * @see https://core.telegram.org/bots/api#setpassportdataerrors
   */
  setPassportDataErrors(payload: SetPassportDataErrorsPayload): Promise<True>
  /**
   * Use this method to send a game. On success, the sent Message is returned.
   * @see https://core.telegram.org/bots/api#sendgame
   */
  sendGame(payload: SendGamePayload): Promise<Message>
  /**
   * Use this method to set the score of the specified user in a game message. On success, if the message is not an inline message, the Message is returned, otherwise True is returned. Returns an error, if the new score is not greater than the user's current score in the chat and force is False.
   * @see https://core.telegram.org/bots/api#setgamescore
   */
  setGameScore(payload: SetGameScorePayload): Promise<Message | True>
  /**
   * Use this method to get data for high score tables. Will return the score of the specified user and several of their neighbors in a game. On success, returns an GameHighScore objects.
   *
   * This method will currently return scores for the target user, plus two of their closest neighbors on each side. Will also return the top three users if the user and his neighbors are not among them. Please note that this behavior is subject to change.
   * @see https://core.telegram.org/bots/api#getgamehighscores
   */
  getGameHighScores(payload: GetGameHighScoresPayload): Promise<GameHighScore>
}
