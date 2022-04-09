import { Internal } from './internal'
import { CallbackGame, Game } from './game'

export * from './internal'

export * from './inline'
export * from './game'
export * from './passport'
export * from './payment'
export * from './sticker'
export * from './update'

export type Integer = number
export type Float = number

declare module './update' {
  interface Update {
    /** Optional. New incoming message of any kind — text, photo, sticker, etc. */
    message?: Message
    /** Optional. New version of a message that is known to the bot and was edited */
    edited_message?: Message
    /** Optional. New incoming channel post of any kind — text, photo, sticker, etc. */
    channel_post?: Message
    /** Optional. New version of a channel post that is known to the bot and was edited */
    edited_channel_post?: Message
    /** Optional. New incoming callback query */
    callback_query?: CallbackQuery
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
}

/**
 * This object represents a Telegram user or bot.
 * @see https://core.telegram.org/bots/api#user
 */
export interface User {
  /** Unique identifier for this user or bot. This number may have more than 32 significant bits and some programming languages may have difficulty/silent defects in interpreting it. But it has at most 52 significant bits, so a 64-bit integer or double-precision float type are safe for storing this identifier. */
  id?: Integer
  /** True, if this user is a bot */
  is_bot?: boolean
  /** User's or bot's first name */
  first_name?: string
  /** Optional. User's or bot's last name */
  last_name?: string
  /** Optional. User's or bot's username */
  username?: string
  /** Optional. IETF language tag of the user's language */
  language_code?: string
  /** Optional. True, if the bot can be invited to groups. Returned only in getMe. */
  can_join_groups?: boolean
  /** Optional. True, if privacy mode is disabled for the bot. Returned only in getMe. */
  can_read_all_group_messages?: boolean
  /** Optional. True, if the bot supports inline queries. Returned only in getMe. */
  supports_inline_queries?: boolean
}

/**
 * This object represents a chat.
 * @see https://core.telegram.org/bots/api#chat
 */
export interface Chat {
  /** Unique identifier for this chat. This number may have more than 32 significant bits and some programming languages may have difficulty/silent defects in interpreting it. But it has at most 52 significant bits, so a signed 64-bit integer or double-precision float type are safe for storing this identifier. */
  id?: Integer
  /** Type of chat, can be either "private", "group", "supergroup" or "channel" */
  type?: string
  /** Optional. Title, for supergroups, channels and group chats */
  title?: string
  /** Optional. Username, for private chats, supergroups and channels if available */
  username?: string
  /** Optional. First name of the other party in a private chat */
  first_name?: string
  /** Optional. Last name of the other party in a private chat */
  last_name?: string
  /** Optional. Chat photo. Returned only in getChat. */
  photo?: ChatPhoto
  /** Optional. Bio of the other party in a private chat. Returned only in getChat. */
  bio?: string
  /** Optional. True, if privacy settings of the other party in the private chat allows to use tg://user?id=<user_id> links only in chats with the user. Returned only in getChat. */
  has_private_forwards?: boolean
  /** Optional. Description, for groups, supergroups and channel chats. Returned only in getChat. */
  description?: string
  /** Optional. Primary invite link, for groups, supergroups and channel chats. Returned only in getChat. */
  invite_link?: string
  /** Optional. The most recent pinned message (by sending date). Returned only in getChat. */
  pinned_message?: Message
  /** Optional. Default chat member permissions, for groups and supergroups. Returned only in getChat. */
  permissions?: ChatPermissions
  /** Optional. For supergroups, the minimum allowed delay between consecutive messages sent by each unpriviledged user; in seconds. Returned only in getChat. */
  slow_mode_delay?: Integer
  /** Optional. The time after which all messages sent to the chat will be automatically deleted; in seconds. Returned only in getChat. */
  message_auto_delete_time?: Integer
  /** Optional. True, if messages from the chat can't be forwarded to other chats. Returned only in getChat. */
  has_protected_content?: boolean
  /** Optional. For supergroups, name of group sticker set. Returned only in getChat. */
  sticker_set_name?: string
  /** Optional. True, if the bot can change the group sticker set. Returned only in getChat. */
  can_set_sticker_set?: boolean
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
  forward_signature?: string
  /** Optional. Sender's name for messages forwarded from users who disallow adding a link to their account in forwarded messages */
  forward_sender_name?: string
  /** Optional. For forwarded messages, date the original message was sent in Unix time */
  forward_date?: Integer
  /** Optional. True, if the message is a channel post that was automatically forwarded to the connected discussion group */
  is_automatic_forward?: boolean
  /** Optional. For replies, the original message. Note that the Message object in this field will not contain further reply_to_message fields even if it itself is a reply. */
  reply_to_message?: Message
  /** Optional. Bot through which the message was sent */
  via_bot?: User
  /** Optional. Date the message was last edited in Unix time */
  edit_date?: Integer
  /** Optional. True, if the message can't be forwarded */
  has_protected_content?: boolean
  /** Optional. The unique identifier of a media message group this message belongs to */
  media_group_id?: string
  /** Optional. Signature of the post author for messages in channels, or the custom title of an anonymous group administrator */
  author_signature?: string
  /** Optional. For text messages, the actual UTF-8 text of the message, 0-4096 characters */
  text?: string
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
  /** Optional. Message is a video, information about the video */
  video?: Video
  /** Optional. Message is a video note, information about the video message */
  video_note?: VideoNote
  /** Optional. Message is a voice message, information about the file */
  voice?: Voice
  /** Optional. Caption for the animation, audio, document, photo, video or voice, 0-1024 characters */
  caption?: string
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
  new_chat_title?: string
  /** Optional. A chat photo was change to this value */
  new_chat_photo?: PhotoSize[]
  /** Optional. Service message: the chat photo was deleted */
  delete_chat_photo?: boolean
  /** Optional. Service message: the group has been created */
  group_chat_created?: boolean
  /** Optional. Service message: the supergroup has been created. This field can't be received in a message coming through updates, because bot can't be a member of a supergroup when it is created. It can only be found in reply_to_message if someone replies to a very first message in a directly created supergroup. */
  supergroup_chat_created?: boolean
  /** Optional. Service message: the channel has been created. This field can't be received in a message coming through updates, because bot can't be a member of a channel when it is created. It can only be found in reply_to_message if someone replies to a very first message in a channel. */
  channel_chat_created?: boolean
  /** Optional. Service message: auto-delete timer settings changed in the chat */
  message_auto_delete_timer_changed?: MessageAutoDeleteTimerChanged
  /** Optional. The group has been migrated to a supergroup with the specified identifier. This number may have more than 32 significant bits and some programming languages may have difficulty/silent defects in interpreting it. But it has at most 52 significant bits, so a signed 64-bit integer or double-precision float type are safe for storing this identifier. */
  migrate_to_chat_id?: Integer
  /** Optional. The supergroup has been migrated from a group with the specified identifier. This number may have more than 32 significant bits and some programming languages may have difficulty/silent defects in interpreting it. But it has at most 52 significant bits, so a signed 64-bit integer or double-precision float type are safe for storing this identifier. */
  migrate_from_chat_id?: Integer
  /** Optional. Specified message was pinned. Note that the Message object in this field will not contain further reply_to_message fields even if it is itself a reply. */
  pinned_message?: Message
  /** Optional. The domain name of the website on which the user has logged in. More about Telegram Login » */
  connected_website?: string
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
  type?: string
  /** Offset in UTF-16 code units to the start of the entity */
  offset?: Integer
  /** Length of the entity in UTF-16 code units */
  length?: Integer
  /** Optional. For "text_link" only, url that will be opened after user taps on the text */
  url?: string
  /** Optional. For "text_mention" only, the mentioned user */
  user?: User
  /** Optional. For "pre" only, the programming language of the entity text */
  language?: string
}

/**
 * This object represents one size of a photo or a file / sticker thumbnail.
 * @see https://core.telegram.org/bots/api#photosize
 */
export interface PhotoSize {
  /** Identifier for this file, which can be used to download or reuse the file */
  file_id?: string
  /** Unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
  file_unique_id?: string
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
  file_id?: string
  /** Unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
  file_unique_id?: string
  /** Video width as defined by sender */
  width?: Integer
  /** Video height as defined by sender */
  height?: Integer
  /** Duration of the video in seconds as defined by sender */
  duration?: Integer
  /** Optional. Animation thumbnail as defined by sender */
  thumb?: PhotoSize
  /** Optional. Original animation filename as defined by sender */
  file_name?: string
  /** Optional. MIME type of the file as defined by sender */
  mime_type?: string
  /** Optional. File size in bytes */
  file_size?: Integer
}

/**
 * This object represents an audio file to be treated as music by the Telegram clients.
 * @see https://core.telegram.org/bots/api#audio
 */
export interface Audio {
  /** Identifier for this file, which can be used to download or reuse the file */
  file_id?: string
  /** Unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
  file_unique_id?: string
  /** Duration of the audio in seconds as defined by sender */
  duration?: Integer
  /** Optional. Performer of the audio as defined by sender or by audio tags */
  performer?: string
  /** Optional. Title of the audio as defined by sender or by audio tags */
  title?: string
  /** Optional. Original filename as defined by sender */
  file_name?: string
  /** Optional. MIME type of the file as defined by sender */
  mime_type?: string
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
  file_id?: string
  /** Unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
  file_unique_id?: string
  /** Optional. Document thumbnail as defined by sender */
  thumb?: PhotoSize
  /** Optional. Original filename as defined by sender */
  file_name?: string
  /** Optional. MIME type of the file as defined by sender */
  mime_type?: string
  /** Optional. File size in bytes */
  file_size?: Integer
}

/**
 * This object represents a video file.
 * @see https://core.telegram.org/bots/api#video
 */
export interface Video {
  /** Identifier for this file, which can be used to download or reuse the file */
  file_id?: string
  /** Unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
  file_unique_id?: string
  /** Video width as defined by sender */
  width?: Integer
  /** Video height as defined by sender */
  height?: Integer
  /** Duration of the video in seconds as defined by sender */
  duration?: Integer
  /** Optional. Video thumbnail */
  thumb?: PhotoSize
  /** Optional. Original filename as defined by sender */
  file_name?: string
  /** Optional. Mime type of a file as defined by sender */
  mime_type?: string
  /** Optional. File size in bytes */
  file_size?: Integer
}

/**
 * This object represents a video message (available in Telegram apps as of v.4.0).
 * @see https://core.telegram.org/bots/api#videonote
 */
export interface VideoNote {
  /** Identifier for this file, which can be used to download or reuse the file */
  file_id?: string
  /** Unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
  file_unique_id?: string
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
  file_id?: string
  /** Unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
  file_unique_id?: string
  /** Duration of the audio in seconds as defined by sender */
  duration?: Integer
  /** Optional. MIME type of the file as defined by sender */
  mime_type?: string
  /** Optional. File size in bytes */
  file_size?: Integer
}

/**
 * This object represents a phone contact.
 * @see https://core.telegram.org/bots/api#contact
 */
export interface Contact {
  /** Contact's phone number */
  phone_number?: string
  /** Contact's first name */
  first_name?: string
  /** Optional. Contact's last name */
  last_name?: string
  /** Optional. Contact's user identifier in Telegram. This number may have more than 32 significant bits and some programming languages may have difficulty/silent defects in interpreting it. But it has at most 52 significant bits, so a 64-bit integer or double-precision float type are safe for storing this identifier. */
  user_id?: Integer
  /** Optional. Additional data about the contact in the form of a vCard */
  vcard?: string
}

/**
 * This object represents an animated emoji that displays a random value.
 * @see https://core.telegram.org/bots/api#dice
 */
export interface Dice {
  /** Emoji on which the dice throw animation is based */
  emoji?: string
  /** Value of the dice, 1-6 for "", "" and "" base emoji, 1-5 for "" and "" base emoji, 1-64 for "" base emoji */
  value?: Integer
}

/**
 * This object contains information about one answer option in a poll.
 * @see https://core.telegram.org/bots/api#polloption
 */
export interface PollOption {
  /** Option text, 1-100 characters */
  text?: string
  /** Number of users that voted for this option */
  voter_count?: Integer
}

/**
 * This object represents an answer of a user in a non-anonymous poll.
 * @see https://core.telegram.org/bots/api#pollanswer
 */
export interface PollAnswer {
  /** Unique poll identifier */
  poll_id?: string
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
  id?: string
  /** Poll question, 1-300 characters */
  question?: string
  /** List of poll options */
  options?: PollOption[]
  /** Total number of users that voted in the poll */
  total_voter_count?: Integer
  /** True, if the poll is closed */
  is_closed?: boolean
  /** True, if the poll is anonymous */
  is_anonymous?: boolean
  /** Poll type, currently can be "regular" or "quiz" */
  type?: string
  /** True, if the poll allows multiple answers */
  allows_multiple_answers?: boolean
  /** Optional. 0-based identifier of the correct answer option. Available only for polls in the quiz mode, which are closed, or was sent (not forwarded) by the bot or to the private chat with the bot. */
  correct_option_id?: Integer
  /** Optional. Text that is shown when a user chooses an incorrect answer or taps on the lamp icon in a quiz-style poll, 0-200 characters */
  explanation?: string
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
  title?: string
  /** Address of the venue */
  address?: string
  /** Optional. Foursquare identifier of the venue */
  foursquare_id?: string
  /** Optional. Foursquare type of the venue. (For example, "arts_entertainment/default", "arts_entertainment/aquarium" or "food/icecream".) */
  foursquare_type?: string
  /** Optional. Google Places identifier of the venue */
  google_place_id?: string
  /** Optional. Google Places type of the venue. (See supported types.) */
  google_place_type?: string
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
  file_id?: string
  /** Unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
  file_unique_id?: string
  /** Optional. File size in bytes, if known */
  file_size?: Integer
  /** Optional. File path. Use https://api.telegram.org/file/bot<token>/<file_path> to get the file. */
  file_path?: string
}

/**
 * This object represents a custom keyboard with reply options (see Introduction to bots for details and examples).
 * @see https://core.telegram.org/bots/api#replykeyboardmarkup
 */
export interface ReplyKeyboardMarkup {
  /** button rows, each represented by an Array of KeyboardButton objects */
  keyboard?: KeyboardButton[][]
  /** Optional. Requests clients to resize the keyboard vertically for optimal fit (e.g., make the keyboard smaller if there are just two rows of buttons). Defaults to false, in which case the custom keyboard is always of the same height as the app's standard keyboard. */
  resize_keyboard?: boolean
  /** Optional. Requests clients to hide the keyboard as soon as it's been used. The keyboard will still be available, but clients will automatically display the usual letter-keyboard in the chat – the user can press a special button in the input field to see the custom keyboard again. Defaults to false. */
  one_time_keyboard?: boolean
  /** Optional. The placeholder to be shown in the input field when the keyboard is active; 1-64 characters */
  input_field_placeholder?: string
  /** Optional. Use this parameter if you want to show the keyboard to specific users only. Targets: 1) users that are @mentioned in the text of the Message object; 2) if the bot's message is a reply (has reply_to_message_id), sender of the original message.

Example: A user requests to change the bot's language, bot replies to the request with a keyboard to select the new language. Other users in the group don't see the keyboard. */
  selective?: boolean
}

/**
 * This object represents one button of the reply keyboard. For simple text buttons String can be used instead of this object to specify text of the button. Optional fields request_contact, request_location, and request_poll are mutually exclusive.
 * @see https://core.telegram.org/bots/api#keyboardbutton
 */
export interface KeyboardButton {
  /** Text of the button. If none of the optional fields are used, it will be sent as a message when the button is pressed */
  text?: string
  /** Optional. If True, the user's phone number will be sent as a contact when the button is pressed. Available in private chats only */
  request_contact?: boolean
  /** Optional. If True, the user's current location will be sent when the button is pressed. Available in private chats only */
  request_location?: boolean
  /** Optional. If specified, the user will be asked to create a poll and send it to the bot when the button is pressed. Available in private chats only */
  request_poll?: KeyboardButtonPollType
}

/**
 * This object represents type of a poll, which is allowed to be created and sent when the corresponding button is pressed.
 * @see https://core.telegram.org/bots/api#keyboardbuttonpolltype
 */
export interface KeyboardButtonPollType {
  /** Optional. If quiz is passed, the user will be allowed to create only polls in the quiz mode. If regular is passed, only regular polls will be allowed. Otherwise, the user will be allowed to create a poll of any type. */
  type?: string
}

/**
 * Upon receiving a message with this object, Telegram clients will remove the current custom keyboard and display the default letter-keyboard. By default, custom keyboards are displayed until a new keyboard is sent by a bot. An exception is made for one-time keyboards that are hidden immediately after the user presses a button (see ReplyKeyboardMarkup).
 * @see https://core.telegram.org/bots/api#replykeyboardremove
 */
export interface ReplyKeyboardRemove {
  /** Requests clients to remove the custom keyboard (user will not be able to summon this keyboard; if you want to hide the keyboard from sight but keep it accessible, use one_time_keyboard in ReplyKeyboardMarkup) */
  remove_keyboard?: boolean
  /** Optional. Use this parameter if you want to remove the keyboard for specific users only. Targets: 1) users that are @mentioned in the text of the Message object; 2) if the bot's message is a reply (has reply_to_message_id), sender of the original message.

Example: A user votes in a poll, bot returns confirmation message in reply to the vote and removes the keyboard for that user, while still showing the keyboard with poll options to users who haven't voted yet. */
  selective?: boolean
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
  text?: string
  /** Optional. HTTP or tg:// url to be opened when the button is pressed. Links tg://user?id=<user_id> can be used to mention a user by their ID without using a username, if this is allowed by their privacy settings. */
  url?: string
  /** Optional. An HTTP URL used to automatically authorize the user. Can be used as a replacement for the Telegram Login Widget. */
  login_url?: LoginUrl
  /** Optional. Data to be sent in a callback query to the bot when button is pressed, 1-64 bytes */
  callback_data?: string
  /**
   * Optional. If set, pressing the button will prompt the user to select one of their chats, open that chat and insert the bot's username and the specified inline query in the input field. Can be empty, in which case just the bot's username will be inserted.
   *
   * Note: This offers an easy way for users to start using your bot in inline mode when they are currently in a private chat with it. Especially useful when combined with switch_pm... actions – in this case the user will be automatically returned to the chat they switched from, skipping the chat selection screen.
   */
  switch_inline_query?: string
  /**
   * Optional. If set, pressing the button will insert the bot's username and the specified inline query in the current chat's input field. Can be empty, in which case only the bot's username will be inserted.
   *
   * This offers a quick way for the user to open your bot in inline mode in the same chat – good for selecting something from multiple options.
   */
  switch_inline_query_current_chat?: string
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
  pay?: boolean
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
  url?: string
  /** Optional. New text of the button in forwarded messages. */
  forward_text?: string
  /** Optional. Username of a bot, which will be used for user authorization. See Setting up a bot for more details. If not specified, the current bot's username will be assumed. The url's domain must be the same as the domain linked with the bot. See Linking your domain to the bot for more details. */
  bot_username?: string
  /** Optional. Pass True to request the permission for your bot to send messages to the user. */
  request_write_access?: boolean
}

/**
 * This object represents an incoming callback query from a callback button in an inline keyboard. If the button that originated the query was attached to a message sent by the bot, the field message will be present. If the button was attached to a message sent via the bot (in inline mode), the field inline_message_id will be present. Exactly one of the fields data or game_short_name will be present.
 * @see https://core.telegram.org/bots/api#callbackquery
 */
export interface CallbackQuery {
  /** Unique identifier for this query */
  id?: string
  /** Sender */
  from?: User
  /** Optional. Message with the callback button that originated the query. Note that message content and message date will not be available if the message is too old */
  message?: Message
  /** Optional. Identifier of the message sent via the bot in inline mode, that originated the query. */
  inline_message_id?: string
  /** Global identifier, uniquely corresponding to the chat to which the message with the callback button was sent. Useful for high scores in games. */
  chat_instance?: string
  /** Optional. Data associated with the callback button. Be aware that a bad client can send arbitrary data in this field. */
  data?: string
  /** Optional. Short name of a Game to be returned, serves as the unique identifier for the game */
  game_short_name?: string
}

/**
 * Upon receiving a message with this object, Telegram clients will display a reply interface to the user (act as if the user has selected the bot's message and tapped 'Reply'). This can be extremely useful if you want to create user-friendly step-by-step interfaces without having to sacrifice privacy mode.
 * @see https://core.telegram.org/bots/api#forcereply
 */
export interface ForceReply {
  /** Shows reply interface to the user, as if they manually selected the bot's message and tapped 'Reply' */
  force_reply?: boolean
  /** Optional. The placeholder to be shown in the input field when the reply is active; 1-64 characters */
  input_field_placeholder?: string
  /** Optional. Use this parameter if you want to force reply from specific users only. Targets: 1) users that are @mentioned in the text of the Message object; 2) if the bot's message is a reply (has reply_to_message_id), sender of the original message. */
  selective?: boolean
}

/**
 * This object represents a chat photo.
 * @see https://core.telegram.org/bots/api#chatphoto
 */
export interface ChatPhoto {
  /** File identifier of small (160x160) chat photo. This file_id can be used only for photo download and only for as long as the photo is not changed. */
  small_file_id?: string
  /** Unique file identifier of small (160x160) chat photo, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
  small_file_unique_id?: string
  /** File identifier of big (640x640) chat photo. This file_id can be used only for photo download and only for as long as the photo is not changed. */
  big_file_id?: string
  /** Unique file identifier of big (640x640) chat photo, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
  big_file_unique_id?: string
}

/**
 * Represents an invite link for a chat.
 * @see https://core.telegram.org/bots/api#chatinvitelink
 */
export interface ChatInviteLink {
  /** The invite link. If the link was created by another chat administrator, then the second part of the link will be replaced with "...". */
  invite_link?: string
  /** Creator of the link */
  creator?: User
  /** True, if users joining the chat via the link need to be approved by chat administrators */
  creates_join_request?: boolean
  /** True, if the link is primary */
  is_primary?: boolean
  /** True, if the link is revoked */
  is_revoked?: boolean
  /** Optional. Invite link name */
  name?: string
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
  status?: 'creator'
  /** Information about the user */
  user?: User
  /** True, if the user's presence in the chat is hidden */
  is_anonymous?: boolean
  /** Optional. Custom title for this user */
  custom_title?: string
}

/**
 * Represents a chat member that has some additional privileges.
 * @see https://core.telegram.org/bots/api#chatmemberadministrator
 */
export interface ChatMemberAdministrator {
  /** The member's status in the chat, always "administrator" */
  status?: 'administrator'
  /** Information about the user */
  user?: User
  /** True, if the bot is allowed to edit administrator privileges of that user */
  can_be_edited?: boolean
  /** True, if the user's presence in the chat is hidden */
  is_anonymous?: boolean
  /** True, if the administrator can access the chat event log, chat statistics, message statistics in channels, see channel members, see anonymous administrators in supergroups and ignore slow mode. Implied by any other administrator privilege */
  can_manage_chat?: boolean
  /** True, if the administrator can delete messages of other users */
  can_delete_messages?: boolean
  /** True, if the administrator can manage voice chats */
  can_manage_voice_chats?: boolean
  /** True, if the administrator can restrict, ban or unban chat members */
  can_restrict_members?: boolean
  /** True, if the administrator can add new administrators with a subset of their own privileges or demote administrators that he has promoted, directly or indirectly (promoted by administrators that were appointed by the user) */
  can_promote_members?: boolean
  /** True, if the user is allowed to change the chat title, photo and other settings */
  can_change_info?: boolean
  /** True, if the user is allowed to invite new users to the chat */
  can_invite_users?: boolean
  /** Optional. True, if the administrator can post in the channel; channels only */
  can_post_messages?: boolean
  /** Optional. True, if the administrator can edit messages of other users and can pin messages; channels only */
  can_edit_messages?: boolean
  /** Optional. True, if the user is allowed to pin messages; groups and supergroups only */
  can_pin_messages?: boolean
  /** Optional. Custom title for this user */
  custom_title?: string
}

/**
 * Represents a chat member that has no additional privileges or restrictions.
 * @see https://core.telegram.org/bots/api#chatmembermember
 */
export interface ChatMemberMember {
  /** The member's status in the chat, always "member" */
  status?: 'member'
  /** Information about the user */
  user?: User
}

/**
 * Represents a chat member that is under certain restrictions in the chat. Supergroups only.
 * @see https://core.telegram.org/bots/api#chatmemberrestricted
 */
export interface ChatMemberRestricted {
  /** The member's status in the chat, always "restricted" */
  status?: 'restricted'
  /** Information about the user */
  user?: User
  /** True, if the user is a member of the chat at the moment of the request */
  is_member?: boolean
  /** True, if the user is allowed to change the chat title, photo and other settings */
  can_change_info?: boolean
  /** True, if the user is allowed to invite new users to the chat */
  can_invite_users?: boolean
  /** True, if the user is allowed to pin messages */
  can_pin_messages?: boolean
  /** True, if the user is allowed to send text messages, contacts, locations and venues */
  can_send_messages?: boolean
  /** True, if the user is allowed to send audios, documents, photos, videos, video notes and voice notes */
  can_send_media_messages?: boolean
  /** True, if the user is allowed to send polls */
  can_send_polls?: boolean
  /** True, if the user is allowed to send animations, games, stickers and use inline bots */
  can_send_other_messages?: boolean
  /** True, if the user is allowed to add web page previews to their messages */
  can_add_web_page_previews?: boolean
  /** Date when restrictions will be lifted for this user; unix time. If 0, then the user is restricted forever */
  until_date?: Integer
}

/**
 * Represents a chat member that isn't currently a member of the chat, but may join it themselves.
 * @see https://core.telegram.org/bots/api#chatmemberleft
 */
export interface ChatMemberLeft {
  /** The member's status in the chat, always "left" */
  status?: 'left'
  /** Information about the user */
  user?: User
}

/**
 * Represents a chat member that was banned in the chat and can't return to the chat or view chat messages.
 * @see https://core.telegram.org/bots/api#chatmemberbanned
 */
export interface ChatMemberBanned {
  /** The member's status in the chat, always "kicked" */
  status?: 'kicked'
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
  bio?: string
  /** Optional. Chat invite link that was used by the user to send the join request */
  invite_link?: ChatInviteLink
}

/**
 * Describes actions that a non-administrator user is allowed to take in a chat.
 * @see https://core.telegram.org/bots/api#chatpermissions
 */
export interface ChatPermissions {
  /** Optional. True, if the user is allowed to send text messages, contacts, locations and venues */
  can_send_messages?: boolean
  /** Optional. True, if the user is allowed to send audios, documents, photos, videos, video notes and voice notes, implies can_send_messages */
  can_send_media_messages?: boolean
  /** Optional. True, if the user is allowed to send polls, implies can_send_messages */
  can_send_polls?: boolean
  /** Optional. True, if the user is allowed to send animations, games, stickers and use inline bots, implies can_send_media_messages */
  can_send_other_messages?: boolean
  /** Optional. True, if the user is allowed to add web page previews to their messages, implies can_send_media_messages */
  can_add_web_page_previews?: boolean
  /** Optional. True, if the user is allowed to change the chat title, photo and other settings. Ignored in public supergroups */
  can_change_info?: boolean
  /** Optional. True, if the user is allowed to invite new users to the chat */
  can_invite_users?: boolean
  /** Optional. True, if the user is allowed to pin messages. Ignored in public supergroups */
  can_pin_messages?: boolean
}

/**
 * Represents a location to which a chat is connected.
 * @see https://core.telegram.org/bots/api#chatlocation
 */
export interface ChatLocation {
  /** The location to which the supergroup is connected. Can't be a live location. */
  location?: Location
  /** Location address; 1-64 characters, as defined by the chat owner */
  address?: string
}

/**
 * This object represents a bot command.
 * @see https://core.telegram.org/bots/api#botcommand
 */
export interface BotCommand {
  /** Text of the command; 1-32 characters. Can contain only lowercase English letters, digits and underscores. */
  command?: string
  /** Description of the command; 1-256 characters. */
  description?: string
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
  type?: string
}

/**
 * Represents the scope of bot commands, covering all private chats.
 * @see https://core.telegram.org/bots/api#botcommandscopeallprivatechats
 */
export interface BotCommandScopeAllPrivateChats {
  /** Scope type, must be all_private_chats */
  type?: string
}

/**
 * Represents the scope of bot commands, covering all group and supergroup chats.
 * @see https://core.telegram.org/bots/api#botcommandscopeallgroupchats
 */
export interface BotCommandScopeAllGroupChats {
  /** Scope type, must be all_group_chats */
  type?: string
}

/**
 * Represents the scope of bot commands, covering all group and supergroup chat administrators.
 * @see https://core.telegram.org/bots/api#botcommandscopeallchatadministrators
 */
export interface BotCommandScopeAllChatAdministrators {
  /** Scope type, must be all_chat_administrators */
  type?: string
}

/**
 * Represents the scope of bot commands, covering a specific chat.
 * @see https://core.telegram.org/bots/api#botcommandscopechat
 */
export interface BotCommandScopeChat {
  /** Scope type, must be chat */
  type?: string
  /** Unique identifier for the target chat or username of the target supergroup (in the format @supergroupusername) */
  chat_id?: Integer | string
}

/**
 * Represents the scope of bot commands, covering all administrators of a specific group or supergroup chat.
 * @see https://core.telegram.org/bots/api#botcommandscopechatadministrators
 */
export interface BotCommandScopeChatAdministrators {
  /** Scope type, must be chat_administrators */
  type?: string
  /** Unique identifier for the target chat or username of the target supergroup (in the format @supergroupusername) */
  chat_id?: Integer | string
}

/**
 * Represents the scope of bot commands, covering a specific member of a group or supergroup chat.
 * @see https://core.telegram.org/bots/api#botcommandscopechatmember
 */
export interface BotCommandScopeChatMember {
  /** Scope type, must be chat_member */
  type?: string
  /** Unique identifier for the target chat or username of the target supergroup (in the format @supergroupusername) */
  chat_id?: Integer | string
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
  type?: string
  /** File to send. Pass a file_id to send a file that exists on the Telegram servers (recommended), pass an HTTP URL for Telegram to get a file from the Internet, or pass "attach://<file_attach_name>" to upload a new one using multipart/form-data under <file_attach_name> name. More info on Sending Files » */
  media?: string
  /** Optional. Caption of the photo to be sent, 0-1024 characters after entities parsing */
  caption?: string
  /** Optional. Mode for parsing entities in the photo caption. See formatting options for more details. */
  parse_mode?: string
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
}

/**
 * Represents a video to be sent.
 * @see https://core.telegram.org/bots/api#inputmediavideo
 */
export interface InputMediaVideo {
  /** Type of the result, must be video */
  type?: string
  /** File to send. Pass a file_id to send a file that exists on the Telegram servers (recommended), pass an HTTP URL for Telegram to get a file from the Internet, or pass "attach://<file_attach_name>" to upload a new one using multipart/form-data under <file_attach_name> name. More info on Sending Files » */
  media?: string
  /** Optional. Thumbnail of the file sent; can be ignored if thumbnail generation for the file is supported server-side. The thumbnail should be in JPEG format and less than 200 kB in size. A thumbnail's width and height should not exceed 320. Ignored if the file is not uploaded using multipart/form-data. Thumbnails can't be reused and can be only uploaded as a new file, so you can pass "attach://<file_attach_name>" if the thumbnail was uploaded using multipart/form-data under <file_attach_name>. More info on Sending Files » */
  thumb?: InputFile | string
  /** Optional. Caption of the video to be sent, 0-1024 characters after entities parsing */
  caption?: string
  /** Optional. Mode for parsing entities in the video caption. See formatting options for more details. */
  parse_mode?: string
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Optional. Video width */
  width?: Integer
  /** Optional. Video height */
  height?: Integer
  /** Optional. Video duration in seconds */
  duration?: Integer
  /** Optional. Pass True, if the uploaded video is suitable for streaming */
  supports_streaming?: boolean
}

/**
 * Represents an animation file (GIF or H.264/MPEG-4 AVC video without sound) to be sent.
 * @see https://core.telegram.org/bots/api#inputmediaanimation
 */
export interface InputMediaAnimation {
  /** Type of the result, must be animation */
  type?: string
  /** File to send. Pass a file_id to send a file that exists on the Telegram servers (recommended), pass an HTTP URL for Telegram to get a file from the Internet, or pass "attach://<file_attach_name>" to upload a new one using multipart/form-data under <file_attach_name> name. More info on Sending Files » */
  media?: string
  /** Optional. Thumbnail of the file sent; can be ignored if thumbnail generation for the file is supported server-side. The thumbnail should be in JPEG format and less than 200 kB in size. A thumbnail's width and height should not exceed 320. Ignored if the file is not uploaded using multipart/form-data. Thumbnails can't be reused and can be only uploaded as a new file, so you can pass "attach://<file_attach_name>" if the thumbnail was uploaded using multipart/form-data under <file_attach_name>. More info on Sending Files » */
  thumb?: InputFile | string
  /** Optional. Caption of the animation to be sent, 0-1024 characters after entities parsing */
  caption?: string
  /** Optional. Mode for parsing entities in the animation caption. See formatting options for more details. */
  parse_mode?: string
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
  type?: string
  /** File to send. Pass a file_id to send a file that exists on the Telegram servers (recommended), pass an HTTP URL for Telegram to get a file from the Internet, or pass "attach://<file_attach_name>" to upload a new one using multipart/form-data under <file_attach_name> name. More info on Sending Files » */
  media?: string
  /** Optional. Thumbnail of the file sent; can be ignored if thumbnail generation for the file is supported server-side. The thumbnail should be in JPEG format and less than 200 kB in size. A thumbnail's width and height should not exceed 320. Ignored if the file is not uploaded using multipart/form-data. Thumbnails can't be reused and can be only uploaded as a new file, so you can pass "attach://<file_attach_name>" if the thumbnail was uploaded using multipart/form-data under <file_attach_name>. More info on Sending Files » */
  thumb?: InputFile | string
  /** Optional. Caption of the audio to be sent, 0-1024 characters after entities parsing */
  caption?: string
  /** Optional. Mode for parsing entities in the audio caption. See formatting options for more details. */
  parse_mode?: string
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Optional. Duration of the audio in seconds */
  duration?: Integer
  /** Optional. Performer of the audio */
  performer?: string
  /** Optional. Title of the audio */
  title?: string
}

/**
 * Represents a general file to be sent.
 * @see https://core.telegram.org/bots/api#inputmediadocument
 */
export interface InputMediaDocument {
  /** Type of the result, must be document */
  type?: string
  /** File to send. Pass a file_id to send a file that exists on the Telegram servers (recommended), pass an HTTP URL for Telegram to get a file from the Internet, or pass "attach://<file_attach_name>" to upload a new one using multipart/form-data under <file_attach_name> name. More info on Sending Files » */
  media?: string
  /** Optional. Thumbnail of the file sent; can be ignored if thumbnail generation for the file is supported server-side. The thumbnail should be in JPEG format and less than 200 kB in size. A thumbnail's width and height should not exceed 320. Ignored if the file is not uploaded using multipart/form-data. Thumbnails can't be reused and can be only uploaded as a new file, so you can pass "attach://<file_attach_name>" if the thumbnail was uploaded using multipart/form-data under <file_attach_name>. More info on Sending Files » */
  thumb?: InputFile | string
  /** Optional. Caption of the document to be sent, 0-1024 characters after entities parsing */
  caption?: string
  /** Optional. Mode for parsing entities in the document caption. See formatting options for more details. */
  parse_mode?: string
  /** Optional. List of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Optional. Disables automatic server-side content type detection for files uploaded using multipart/form-data. Always True, if the document is sent as part of an album. */
  disable_content_type_detection?: boolean
}

/**
 * This object represents the contents of a file to be uploaded. Must be posted using multipart/form-data in the usual way that files are uploaded via the browser.
 * @see https://core.telegram.org/bots/api#inputfile
 */
export type InputFile = any

export interface SendMessagePayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Text of the message to be sent, 1-4096 characters after entities parsing */
  text?: string
  /** Mode for parsing entities in the message text. See formatting options for more details. */
  parse_mode?: string
  /** A JSON-serialized list of special entities that appear in message text, which can be specified instead of parse_mode */
  entities?: MessageEntity[]
  /** Disables link previews for links in this message */
  disable_web_page_preview?: boolean
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

export interface ForwardMessagePayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Unique identifier for the chat where the original message was sent (or channel username in the format @channelusername) */
  from_chat_id?: Integer | string
  /** Sends the message silently. Users will receive a notification with no sound. */
  disable_notification?: boolean
  /** Protects the contents of the forwarded message from forwarding and saving */
  protect_content?: boolean
  /** Message identifier in the chat specified in from_chat_id */
  message_id?: Integer
}

export interface CopyMessagePayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Unique identifier for the chat where the original message was sent (or channel username in the format @channelusername) */
  from_chat_id?: Integer | string
  /** Message identifier in the chat specified in from_chat_id */
  message_id?: Integer
  /** New caption for media, 0-1024 characters after entities parsing. If not specified, the original caption is kept */
  caption?: string
  /** Mode for parsing entities in the new caption. See formatting options for more details. */
  parse_mode?: string
  /** A JSON-serialized list of special entities that appear in the new caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
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

export interface SendPhotoPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Photo to send. Pass a file_id as String to send a photo that exists on the Telegram servers (recommended), pass an HTTP URL as a String for Telegram to get a photo from the Internet, or upload a new photo using multipart/form-data. The photo must be at most 10 MB in size. The photo's width and height must not exceed 10000 in total. Width and height ratio must be at most 20. More info on Sending Files » */
  photo?: InputFile | string
  /** Photo caption (may also be used when resending photos by file_id), 0-1024 characters after entities parsing */
  caption?: string
  /** Mode for parsing entities in the photo caption. See formatting options for more details. */
  parse_mode?: string
  /** A JSON-serialized list of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
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

export interface SendAudioPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Audio file to send. Pass a file_id as String to send an audio file that exists on the Telegram servers (recommended), pass an HTTP URL as a String for Telegram to get an audio file from the Internet, or upload a new one using multipart/form-data. More info on Sending Files » */
  audio?: InputFile | string
  /** Audio caption, 0-1024 characters after entities parsing */
  caption?: string
  /** Mode for parsing entities in the audio caption. See formatting options for more details. */
  parse_mode?: string
  /** A JSON-serialized list of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Duration of the audio in seconds */
  duration?: Integer
  /** Performer */
  performer?: string
  /** Track name */
  title?: string
  /** Thumbnail of the file sent; can be ignored if thumbnail generation for the file is supported server-side. The thumbnail should be in JPEG format and less than 200 kB in size. A thumbnail's width and height should not exceed 320. Ignored if the file is not uploaded using multipart/form-data. Thumbnails can't be reused and can be only uploaded as a new file, so you can pass "attach://<file_attach_name>" if the thumbnail was uploaded using multipart/form-data under <file_attach_name>. More info on Sending Files » */
  thumb?: InputFile | string
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

export interface SendDocumentPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** File to send. Pass a file_id as String to send a file that exists on the Telegram servers (recommended), pass an HTTP URL as a String for Telegram to get a file from the Internet, or upload a new one using multipart/form-data. More info on Sending Files » */
  document?: InputFile | string
  /** Thumbnail of the file sent; can be ignored if thumbnail generation for the file is supported server-side. The thumbnail should be in JPEG format and less than 200 kB in size. A thumbnail's width and height should not exceed 320. Ignored if the file is not uploaded using multipart/form-data. Thumbnails can't be reused and can be only uploaded as a new file, so you can pass "attach://<file_attach_name>" if the thumbnail was uploaded using multipart/form-data under <file_attach_name>. More info on Sending Files » */
  thumb?: InputFile | string
  /** Document caption (may also be used when resending documents by file_id), 0-1024 characters after entities parsing */
  caption?: string
  /** Mode for parsing entities in the document caption. See formatting options for more details. */
  parse_mode?: string
  /** A JSON-serialized list of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Disables automatic server-side content type detection for files uploaded using multipart/form-data */
  disable_content_type_detection?: boolean
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

export interface SendVideoPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Video to send. Pass a file_id as String to send a video that exists on the Telegram servers (recommended), pass an HTTP URL as a String for Telegram to get a video from the Internet, or upload a new video using multipart/form-data. More info on Sending Files » */
  video?: InputFile | string
  /** Duration of sent video in seconds */
  duration?: Integer
  /** Video width */
  width?: Integer
  /** Video height */
  height?: Integer
  /** Thumbnail of the file sent; can be ignored if thumbnail generation for the file is supported server-side. The thumbnail should be in JPEG format and less than 200 kB in size. A thumbnail's width and height should not exceed 320. Ignored if the file is not uploaded using multipart/form-data. Thumbnails can't be reused and can be only uploaded as a new file, so you can pass "attach://<file_attach_name>" if the thumbnail was uploaded using multipart/form-data under <file_attach_name>. More info on Sending Files » */
  thumb?: InputFile | string
  /** Video caption (may also be used when resending videos by file_id), 0-1024 characters after entities parsing */
  caption?: string
  /** Mode for parsing entities in the video caption. See formatting options for more details. */
  parse_mode?: string
  /** A JSON-serialized list of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Pass True, if the uploaded video is suitable for streaming */
  supports_streaming?: boolean
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

export interface SendAnimationPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Animation to send. Pass a file_id as String to send an animation that exists on the Telegram servers (recommended), pass an HTTP URL as a String for Telegram to get an animation from the Internet, or upload a new animation using multipart/form-data. More info on Sending Files » */
  animation?: InputFile | string
  /** Duration of sent animation in seconds */
  duration?: Integer
  /** Animation width */
  width?: Integer
  /** Animation height */
  height?: Integer
  /** Thumbnail of the file sent; can be ignored if thumbnail generation for the file is supported server-side. The thumbnail should be in JPEG format and less than 200 kB in size. A thumbnail's width and height should not exceed 320. Ignored if the file is not uploaded using multipart/form-data. Thumbnails can't be reused and can be only uploaded as a new file, so you can pass "attach://<file_attach_name>" if the thumbnail was uploaded using multipart/form-data under <file_attach_name>. More info on Sending Files » */
  thumb?: InputFile | string
  /** Animation caption (may also be used when resending animation by file_id), 0-1024 characters after entities parsing */
  caption?: string
  /** Mode for parsing entities in the animation caption. See formatting options for more details. */
  parse_mode?: string
  /** A JSON-serialized list of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
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

export interface SendVoicePayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Audio file to send. Pass a file_id as String to send a file that exists on the Telegram servers (recommended), pass an HTTP URL as a String for Telegram to get a file from the Internet, or upload a new one using multipart/form-data. More info on Sending Files » */
  voice?: InputFile | string
  /** Voice message caption, 0-1024 characters after entities parsing */
  caption?: string
  /** Mode for parsing entities in the voice message caption. See formatting options for more details. */
  parse_mode?: string
  /** A JSON-serialized list of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** Duration of the voice message in seconds */
  duration?: Integer
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

export interface SendVideoNotePayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Video note to send. Pass a file_id as String to send a video note that exists on the Telegram servers (recommended) or upload a new video using multipart/form-data. More info on Sending Files ». Sending video notes by a URL is currently unsupported */
  video_note?: InputFile | string
  /** Duration of sent video in seconds */
  duration?: Integer
  /** Video width and height, i.e. diameter of the video message */
  length?: Integer
  /** Thumbnail of the file sent; can be ignored if thumbnail generation for the file is supported server-side. The thumbnail should be in JPEG format and less than 200 kB in size. A thumbnail's width and height should not exceed 320. Ignored if the file is not uploaded using multipart/form-data. Thumbnails can't be reused and can be only uploaded as a new file, so you can pass "attach://<file_attach_name>" if the thumbnail was uploaded using multipart/form-data under <file_attach_name>. More info on Sending Files » */
  thumb?: InputFile | string
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

export interface SendMediaGroupPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** A JSON-serialized array describing messages to be sent, must include 2-10 items */
  media?: (InputMediaAudio | InputMediaDocument | InputMediaPhoto | InputMediaVideo)[]
  /** Sends messages silently. Users will receive a notification with no sound. */
  disable_notification?: boolean
  /** Protects the contents of the sent messages from forwarding and saving */
  protect_content?: boolean
  /** If the messages are a reply, ID of the original message */
  reply_to_message_id?: Integer
  /** Pass True, if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: boolean
}

export interface SendLocationPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
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

export interface EditMessageLiveLocationPayload {
  /** Required if inline_message_id is not specified. Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Required if inline_message_id is not specified. Identifier of the message to edit */
  message_id?: Integer
  /** Required if chat_id and message_id are not specified. Identifier of the inline message */
  inline_message_id?: string
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
  chat_id?: Integer | string
  /** Required if inline_message_id is not specified. Identifier of the message with live location to stop */
  message_id?: Integer
  /** Required if chat_id and message_id are not specified. Identifier of the inline message */
  inline_message_id?: string
  /** A JSON-serialized object for a new inline keyboard. */
  reply_markup?: InlineKeyboardMarkup
}

export interface SendVenuePayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Latitude of the venue */
  latitude?: Float
  /** Longitude of the venue */
  longitude?: Float
  /** Name of the venue */
  title?: string
  /** Address of the venue */
  address?: string
  /** Foursquare identifier of the venue */
  foursquare_id?: string
  /** Foursquare type of the venue, if known. (For example, "arts_entertainment/default", "arts_entertainment/aquarium" or "food/icecream".) */
  foursquare_type?: string
  /** Google Places identifier of the venue */
  google_place_id?: string
  /** Google Places type of the venue. (See supported types.) */
  google_place_type?: string
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

export interface SendContactPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Contact's phone number */
  phone_number?: string
  /** Contact's first name */
  first_name?: string
  /** Contact's last name */
  last_name?: string
  /** Additional data about the contact in the form of a vCard, 0-2048 bytes */
  vcard?: string
  /** Sends the message silently. Users will receive a notification with no sound. */
  disable_notification?: boolean
  /** Protects the contents of the sent message from forwarding and saving */
  protect_content?: boolean
  /** If the message is a reply, ID of the original message */
  reply_to_message_id?: Integer
  /** Pass True, if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: boolean
  /** Additional interface options. A JSON-serialized object for an inline keyboard, custom reply keyboard, instructions to remove keyboard or to force a reply from the user. */
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply
}

export interface SendPollPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Poll question, 1-300 characters */
  question?: string
  /** A JSON-serialized list of answer options, 2-10 strings 1-100 characters each */
  options?: string[]
  /** True, if the poll needs to be anonymous, defaults to True */
  is_anonymous?: boolean
  /** Poll type, "quiz" or "regular", defaults to "regular" */
  type?: string
  /** True, if the poll allows multiple answers, ignored for polls in quiz mode, defaults to False */
  allows_multiple_answers?: boolean
  /** 0-based identifier of the correct answer option, required for polls in quiz mode */
  correct_option_id?: Integer
  /** Text that is shown when a user chooses an incorrect answer or taps on the lamp icon in a quiz-style poll, 0-200 characters with at most 2 line feeds after entities parsing */
  explanation?: string
  /** Mode for parsing entities in the explanation. See formatting options for more details. */
  explanation_parse_mode?: string
  /** A JSON-serialized list of special entities that appear in the poll explanation, which can be specified instead of parse_mode */
  explanation_entities?: MessageEntity[]
  /** Amount of time in seconds the poll will be active after creation, 5-600. Can't be used together with close_date. */
  open_period?: Integer
  /** Point in time (Unix timestamp) when the poll will be automatically closed. Must be at least 5 and no more than 600 seconds in the future. Can't be used together with open_period. */
  close_date?: Integer
  /** Pass True, if the poll needs to be immediately closed. This can be useful for poll preview. */
  is_closed?: boolean
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

export interface SendDicePayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Emoji on which the dice throw animation is based. Currently, must be one of "", "", "", "", "", or "". Dice can have values 1-6 for "", "" and "", values 1-5 for "" and "", and values 1-64 for "". Defaults to "" */
  emoji?: string
  /** Sends the message silently. Users will receive a notification with no sound. */
  disable_notification?: boolean
  /** Protects the contents of the sent message from forwarding */
  protect_content?: boolean
  /** If the message is a reply, ID of the original message */
  reply_to_message_id?: Integer
  /** Pass True, if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: boolean
  /** Additional interface options. A JSON-serialized object for an inline keyboard, custom reply keyboard, instructions to remove reply keyboard or to force a reply from the user. */
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply
}

export interface SendChatActionPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Type of action to broadcast. Choose one, depending on what the user is about to receive: typing for text messages, upload_photo for photos, record_video or upload_video for videos, record_voice or upload_voice for voice notes, upload_document for general files, choose_sticker for stickers, find_location for location data, record_video_note or upload_video_note for video notes. */
  action?: string
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
  file_id?: string
}

export interface BanChatMemberPayload {
  /** Unique identifier for the target group or username of the target supergroup or channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Unique identifier of the target user */
  user_id?: Integer
  /** Date when the user will be unbanned, unix time. If user is banned for more than 366 days or less than 30 seconds from the current time they are considered to be banned forever. Applied for supergroups and channels only. */
  until_date?: Integer
  /** Pass True to delete all messages from the chat for the user that is being removed. If False, the user will be able to see messages in the group that were sent before the user was removed. Always True for supergroups and channels. */
  revoke_messages?: boolean
}

export interface UnbanChatMemberPayload {
  /** Unique identifier for the target group or username of the target supergroup or channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Unique identifier of the target user */
  user_id?: Integer
  /** Do nothing if the user is not banned */
  only_if_banned?: boolean
}

export interface RestrictChatMemberPayload {
  /** Unique identifier for the target chat or username of the target supergroup (in the format @supergroupusername) */
  chat_id?: Integer | string
  /** Unique identifier of the target user */
  user_id?: Integer
  /** A JSON-serialized object for new user permissions */
  permissions?: ChatPermissions
  /** Date when restrictions will be lifted for the user, unix time. If user is restricted for more than 366 days or less than 30 seconds from the current time, they are considered to be restricted forever */
  until_date?: Integer
}

export interface PromoteChatMemberPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Unique identifier of the target user */
  user_id?: Integer
  /** Pass True, if the administrator's presence in the chat is hidden */
  is_anonymous?: boolean
  /** Pass True, if the administrator can access the chat event log, chat statistics, message statistics in channels, see channel members, see anonymous administrators in supergroups and ignore slow mode. Implied by any other administrator privilege */
  can_manage_chat?: boolean
  /** Pass True, if the administrator can create channel posts, channels only */
  can_post_messages?: boolean
  /** Pass True, if the administrator can edit messages of other users and can pin messages, channels only */
  can_edit_messages?: boolean
  /** Pass True, if the administrator can delete messages of other users */
  can_delete_messages?: boolean
  /** Pass True, if the administrator can manage voice chats */
  can_manage_voice_chats?: boolean
  /** Pass True, if the administrator can restrict, ban or unban chat members */
  can_restrict_members?: boolean
  /** Pass True, if the administrator can add new administrators with a subset of their own privileges or demote administrators that he has promoted, directly or indirectly (promoted by administrators that were appointed by him) */
  can_promote_members?: boolean
  /** Pass True, if the administrator can change chat title, photo and other settings */
  can_change_info?: boolean
  /** Pass True, if the administrator can invite new users to the chat */
  can_invite_users?: boolean
  /** Pass True, if the administrator can pin messages, supergroups only */
  can_pin_messages?: boolean
}

export interface SetChatAdministratorCustomTitlePayload {
  /** Unique identifier for the target chat or username of the target supergroup (in the format @supergroupusername) */
  chat_id?: Integer | string
  /** Unique identifier of the target user */
  user_id?: Integer
  /** New custom title for the administrator; 0-16 characters, emoji are not allowed */
  custom_title?: string
}

export interface BanChatSenderChatPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Unique identifier of the target sender chat */
  sender_chat_id?: Integer
}

export interface UnbanChatSenderChatPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Unique identifier of the target sender chat */
  sender_chat_id?: Integer
}

export interface SetChatPermissionsPayload {
  /** Unique identifier for the target chat or username of the target supergroup (in the format @supergroupusername) */
  chat_id?: Integer | string
  /** A JSON-serialized object for new default chat permissions */
  permissions?: ChatPermissions
}

export interface ExportChatInviteLinkPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
}

export interface CreateChatInviteLinkPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Invite link name; 0-32 characters */
  name?: string
  /** Point in time (Unix timestamp) when the link will expire */
  expire_date?: Integer
  /** Maximum number of users that can be members of the chat simultaneously after joining the chat via this invite link; 1-99999 */
  member_limit?: Integer
  /** True, if users joining the chat via the link need to be approved by chat administrators. If True, member_limit can't be specified */
  creates_join_request?: boolean
}

export interface EditChatInviteLinkPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** The invite link to edit */
  invite_link?: string
  /** Invite link name; 0-32 characters */
  name?: string
  /** Point in time (Unix timestamp) when the link will expire */
  expire_date?: Integer
  /** Maximum number of users that can be members of the chat simultaneously after joining the chat via this invite link; 1-99999 */
  member_limit?: Integer
  /** True, if users joining the chat via the link need to be approved by chat administrators. If True, member_limit can't be specified */
  creates_join_request?: boolean
}

export interface RevokeChatInviteLinkPayload {
  /** Unique identifier of the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** The invite link to revoke */
  invite_link?: string
}

export interface ApproveChatJoinRequestPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Unique identifier of the target user */
  user_id?: Integer
}

export interface DeclineChatJoinRequestPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Unique identifier of the target user */
  user_id?: Integer
}

export interface SetChatPhotoPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** New chat photo, uploaded using multipart/form-data */
  photo?: InputFile
}

export interface DeleteChatPhotoPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
}

export interface SetChatTitlePayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** New chat title, 1-255 characters */
  title?: string
}

export interface SetChatDescriptionPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** New chat description, 0-255 characters */
  description?: string
}

export interface PinChatMessagePayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Identifier of a message to pin */
  message_id?: Integer
  /** Pass True, if it is not necessary to send a notification to all chat members about the new pinned message. Notifications are always disabled in channels and private chats. */
  disable_notification?: boolean
}

export interface UnpinChatMessagePayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Identifier of a message to unpin. If not specified, the most recent pinned message (by sending date) will be unpinned. */
  message_id?: Integer
}

export interface UnpinAllChatMessagesPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
}

export interface LeaveChatPayload {
  /** Unique identifier for the target chat or username of the target supergroup or channel (in the format @channelusername) */
  chat_id?: Integer | string
}

export interface GetChatPayload {
  /** Unique identifier for the target chat or username of the target supergroup or channel (in the format @channelusername) */
  chat_id?: Integer | string
}

export interface GetChatAdministratorsPayload {
  /** Unique identifier for the target chat or username of the target supergroup or channel (in the format @channelusername) */
  chat_id?: Integer | string
}

export interface GetChatMemberCountPayload {
  /** Unique identifier for the target chat or username of the target supergroup or channel (in the format @channelusername) */
  chat_id?: Integer | string
}

export interface GetChatMemberPayload {
  /** Unique identifier for the target chat or username of the target supergroup or channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Unique identifier of the target user */
  user_id?: Integer
}

export interface SetChatStickerSetPayload {
  /** Unique identifier for the target chat or username of the target supergroup (in the format @supergroupusername) */
  chat_id?: Integer | string
  /** Name of the sticker set to be set as the group sticker set */
  sticker_set_name?: string
}

export interface DeleteChatStickerSetPayload {
  /** Unique identifier for the target chat or username of the target supergroup (in the format @supergroupusername) */
  chat_id?: Integer | string
}

export interface AnswerCallbackQueryPayload {
  /** Unique identifier for the query to be answered */
  callback_query_id?: string
  /** Text of the notification. If not specified, nothing will be shown to the user, 0-200 characters */
  text?: string
  /** If True, an alert will be shown by the client instead of a notification at the top of the chat screen. Defaults to false. */
  show_alert?: boolean
  /**
   * URL that will be opened by the user's client. If you have created a Game and accepted the conditions via @Botfather, specify the URL that opens your game — note that this will only work if the query comes from a callback_game button.
   *
   * Otherwise, you may use links like t.me/your_bot?start=XXXX that open your bot with a parameter.
   */
  url?: string
  /** The maximum amount of time in seconds that the result of the callback query may be cached client-side. Telegram apps will support caching starting in version 3.14. Defaults to 0. */
  cache_time?: Integer
}

export interface SetMyCommandsPayload {
  /** A JSON-serialized list of bot commands to be set as the list of the bot's commands. At most 100 commands can be specified. */
  commands?: BotCommand[]
  /** A JSON-serialized object, describing scope of users for which the commands are relevant. Defaults to BotCommandScopeDefault. */
  scope?: BotCommandScope
  /** A two-letter ISO 639-1 language code. If empty, commands will be applied to all users from the given scope, for whose language there are no dedicated commands */
  language_code?: string
}

export interface DeleteMyCommandsPayload {
  /** A JSON-serialized object, describing scope of users for which the commands are relevant. Defaults to BotCommandScopeDefault. */
  scope?: BotCommandScope
  /** A two-letter ISO 639-1 language code. If empty, commands will be applied to all users from the given scope, for whose language there are no dedicated commands */
  language_code?: string
}

export interface GetMyCommandsPayload {
  /** A JSON-serialized object, describing scope of users. Defaults to BotCommandScopeDefault. */
  scope?: BotCommandScope
  /** A two-letter ISO 639-1 language code or an empty string */
  language_code?: string
}

export interface EditMessageTextPayload {
  /** Required if inline_message_id is not specified. Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Required if inline_message_id is not specified. Identifier of the message to edit */
  message_id?: Integer
  /** Required if chat_id and message_id are not specified. Identifier of the inline message */
  inline_message_id?: string
  /** New text of the message, 1-4096 characters after entities parsing */
  text?: string
  /** Mode for parsing entities in the message text. See formatting options for more details. */
  parse_mode?: string
  /** A JSON-serialized list of special entities that appear in message text, which can be specified instead of parse_mode */
  entities?: MessageEntity[]
  /** Disables link previews for links in this message */
  disable_web_page_preview?: boolean
  /** A JSON-serialized object for an inline keyboard. */
  reply_markup?: InlineKeyboardMarkup
}

export interface EditMessageCaptionPayload {
  /** Required if inline_message_id is not specified. Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Required if inline_message_id is not specified. Identifier of the message to edit */
  message_id?: Integer
  /** Required if chat_id and message_id are not specified. Identifier of the inline message */
  inline_message_id?: string
  /** New caption of the message, 0-1024 characters after entities parsing */
  caption?: string
  /** Mode for parsing entities in the message caption. See formatting options for more details. */
  parse_mode?: string
  /** A JSON-serialized list of special entities that appear in the caption, which can be specified instead of parse_mode */
  caption_entities?: MessageEntity[]
  /** A JSON-serialized object for an inline keyboard. */
  reply_markup?: InlineKeyboardMarkup
}

export interface EditMessageMediaPayload {
  /** Required if inline_message_id is not specified. Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Required if inline_message_id is not specified. Identifier of the message to edit */
  message_id?: Integer
  /** Required if chat_id and message_id are not specified. Identifier of the inline message */
  inline_message_id?: string
  /** A JSON-serialized object for a new media content of the message */
  media?: InputMedia
  /** A JSON-serialized object for a new inline keyboard. */
  reply_markup?: InlineKeyboardMarkup
}

export interface EditMessageReplyMarkupPayload {
  /** Required if inline_message_id is not specified. Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Required if inline_message_id is not specified. Identifier of the message to edit */
  message_id?: Integer
  /** Required if chat_id and message_id are not specified. Identifier of the inline message */
  inline_message_id?: string
  /** A JSON-serialized object for an inline keyboard. */
  reply_markup?: InlineKeyboardMarkup
}

export interface StopPollPayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Identifier of the original message with the poll */
  message_id?: Integer
  /** A JSON-serialized object for a new message inline keyboard. */
  reply_markup?: InlineKeyboardMarkup
}

export interface DeleteMessagePayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Identifier of the message to delete */
  message_id?: Integer
}

declare module './internal' {
  export interface Internal {
    /**
     * A simple method for testing your bot's authentication token. Requires no parameters. Returns basic information about the bot in form of a User object.
     * @see https://core.telegram.org/bots/api#getme
     */
    getMe(): Promise<User>
    /**
     * Use this method to log out from the cloud Bot API server before launching the bot locally. You must log out the bot before running it locally, otherwise there is no guarantee that the bot will receive updates. After a successful call, you can immediately log in on a local server, but will not be able to log in back to the cloud Bot API server for 10 minutes. Returns True on success. Requires no parameters.
     * @see https://core.telegram.org/bots/api#logout
     */
    logOut(): Promise<boolean>
    /**
     * Use this method to close the bot instance before moving it from one local server to another. You need to delete the webhook before calling this method to ensure that the bot isn't launched again after server restart. The method will return error 429 in the first 10 minutes after the bot is launched. Returns True on success. Requires no parameters.
     * @see https://core.telegram.org/bots/api#close
     */
    close(): Promise<boolean>
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
    editMessageLiveLocation(payload: EditMessageLiveLocationPayload): Promise<Message | boolean>
    /**
     * Use this method to stop updating a live location message before live_period expires. On success, if the message is not an inline message, the edited Message is returned, otherwise True is returned.
     * @see https://core.telegram.org/bots/api#stopmessagelivelocation
     */
    stopMessageLiveLocation(payload: StopMessageLiveLocationPayload): Promise<Message | boolean>
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
    sendChatAction(payload: SendChatActionPayload): Promise<boolean>
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
    banChatMember(payload: BanChatMemberPayload): Promise<boolean>
    /**
     * Use this method to unban a previously banned user in a supergroup or channel. The user will not return to the group or channel automatically, but will be able to join via link, etc. The bot must be an administrator for this to work. By default, this method guarantees that after the call the user is not a member of the chat, but will be able to join it. So if the user is a member of the chat they will also be removed from the chat. If you don't want this, use the parameter only_if_banned. Returns True on success.
     * @see https://core.telegram.org/bots/api#unbanchatmember
     */
    unbanChatMember(payload: UnbanChatMemberPayload): Promise<boolean>
    /**
     * Use this method to restrict a user in a supergroup. The bot must be an administrator in the supergroup for this to work and must have the appropriate administrator rights. Pass True for all permissions to lift restrictions from a user. Returns True on success.
     * @see https://core.telegram.org/bots/api#restrictchatmember
     */
    restrictChatMember(payload: RestrictChatMemberPayload): Promise<boolean>
    /**
     * Use this method to promote or demote a user in a supergroup or a channel. The bot must be an administrator in the chat for this to work and must have the appropriate administrator rights. Pass False for all boolean parameters to demote a user. Returns True on success.
     * @see https://core.telegram.org/bots/api#promotechatmember
     */
    promoteChatMember(payload: PromoteChatMemberPayload): Promise<boolean>
    /**
     * Use this method to set a custom title for an administrator in a supergroup promoted by the bot. Returns True on success.
     * @see https://core.telegram.org/bots/api#setchatadministratorcustomtitle
     */
    setChatAdministratorCustomTitle(payload: SetChatAdministratorCustomTitlePayload): Promise<boolean>
    /**
     * Use this method to ban a channel chat in a supergroup or a channel. Until the chat is unbanned, the owner of the banned chat won't be able to send messages on behalf of any of their channels. The bot must be an administrator in the supergroup or channel for this to work and must have the appropriate administrator rights. Returns True on success.
     * @see https://core.telegram.org/bots/api#banchatsenderchat
     */
    banChatSenderChat(payload: BanChatSenderChatPayload): Promise<boolean>
    /**
     * Use this method to unban a previously banned channel chat in a supergroup or channel. The bot must be an administrator for this to work and must have the appropriate administrator rights. Returns True on success.
     * @see https://core.telegram.org/bots/api#unbanchatsenderchat
     */
    unbanChatSenderChat(payload: UnbanChatSenderChatPayload): Promise<boolean>
    /**
     * Use this method to set default chat permissions for all members. The bot must be an administrator in the group or a supergroup for this to work and must have the can_restrict_members administrator rights. Returns True on success.
     * @see https://core.telegram.org/bots/api#setchatpermissions
     */
    setChatPermissions(payload: SetChatPermissionsPayload): Promise<boolean>
    /**
     * Use this method to generate a new primary invite link for a chat; any previously generated primary link is revoked. The bot must be an administrator in the chat for this to work and must have the appropriate administrator rights. Returns the new invite link as String on success.
     * @see https://core.telegram.org/bots/api#exportchatinvitelink
     */
    exportChatInviteLink(payload: ExportChatInviteLinkPayload): Promise<string>
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
    approveChatJoinRequest(payload: ApproveChatJoinRequestPayload): Promise<boolean>
    /**
     * Use this method to decline a chat join request. The bot must be an administrator in the chat for this to work and must have the can_invite_users administrator right. Returns True on success.
     * @see https://core.telegram.org/bots/api#declinechatjoinrequest
     */
    declineChatJoinRequest(payload: DeclineChatJoinRequestPayload): Promise<boolean>
    /**
     * Use this method to set a new profile photo for the chat. Photos can't be changed for private chats. The bot must be an administrator in the chat for this to work and must have the appropriate administrator rights. Returns True on success.
     * @see https://core.telegram.org/bots/api#setchatphoto
     */
    setChatPhoto(payload: SetChatPhotoPayload): Promise<boolean>
    /**
     * Use this method to delete a chat photo. Photos can't be changed for private chats. The bot must be an administrator in the chat for this to work and must have the appropriate administrator rights. Returns True on success.
     * @see https://core.telegram.org/bots/api#deletechatphoto
     */
    deleteChatPhoto(payload: DeleteChatPhotoPayload): Promise<boolean>
    /**
     * Use this method to change the title of a chat. Titles can't be changed for private chats. The bot must be an administrator in the chat for this to work and must have the appropriate administrator rights. Returns True on success.
     * @see https://core.telegram.org/bots/api#setchattitle
     */
    setChatTitle(payload: SetChatTitlePayload): Promise<boolean>
    /**
     * Use this method to change the description of a group, a supergroup or a channel. The bot must be an administrator in the chat for this to work and must have the appropriate administrator rights. Returns True on success.
     * @see https://core.telegram.org/bots/api#setchatdescription
     */
    setChatDescription(payload: SetChatDescriptionPayload): Promise<boolean>
    /**
     * Use this method to add a message to the list of pinned messages in a chat. If the chat is not a private chat, the bot must be an administrator in the chat for this to work and must have the 'can_pin_messages' administrator right in a supergroup or 'can_edit_messages' administrator right in a channel. Returns True on success.
     * @see https://core.telegram.org/bots/api#pinchatmessage
     */
    pinChatMessage(payload: PinChatMessagePayload): Promise<boolean>
    /**
     * Use this method to remove a message from the list of pinned messages in a chat. If the chat is not a private chat, the bot must be an administrator in the chat for this to work and must have the 'can_pin_messages' administrator right in a supergroup or 'can_edit_messages' administrator right in a channel. Returns True on success.
     * @see https://core.telegram.org/bots/api#unpinchatmessage
     */
    unpinChatMessage(payload: UnpinChatMessagePayload): Promise<boolean>
    /**
     * Use this method to clear the list of pinned messages in a chat. If the chat is not a private chat, the bot must be an administrator in the chat for this to work and must have the 'can_pin_messages' administrator right in a supergroup or 'can_edit_messages' administrator right in a channel. Returns True on success.
     * @see https://core.telegram.org/bots/api#unpinallchatmessages
     */
    unpinAllChatMessages(payload: UnpinAllChatMessagesPayload): Promise<boolean>
    /**
     * Use this method for your bot to leave a group, supergroup or channel. Returns True on success.
     * @see https://core.telegram.org/bots/api#leavechat
     */
    leaveChat(payload: LeaveChatPayload): Promise<boolean>
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
    setChatStickerSet(payload: SetChatStickerSetPayload): Promise<boolean>
    /**
     * Use this method to delete a group sticker set from a supergroup. The bot must be an administrator in the chat for this to work and must have the appropriate administrator rights. Use the field can_set_sticker_set optionally returned in getChat requests to check if the bot can use this method. Returns True on success.
     * @see https://core.telegram.org/bots/api#deletechatstickerset
     */
    deleteChatStickerSet(payload: DeleteChatStickerSetPayload): Promise<boolean>
    /**
     * Use this method to send answers to callback queries sent from inline keyboards. The answer will be displayed to the user as a notification at the top of the chat screen or as an alert. On success, True is returned.
     *
     * Alternatively, the user can be redirected to the specified Game URL. For this option to work, you must first create a game for your bot via @Botfather and accept the terms. Otherwise, you may use links like t.me/your_bot?start=XXXX that open your bot with a parameter.
     * @see https://core.telegram.org/bots/api#answercallbackquery
     */
    answerCallbackQuery(payload: AnswerCallbackQueryPayload): Promise<boolean>
    /**
     * Use this method to change the list of the bot's commands. See https://core.telegram.org/bots#commands for more details about bot commands. Returns True on success.
     * @see https://core.telegram.org/bots/api#setmycommands
     */
    setMyCommands(payload: SetMyCommandsPayload): Promise<boolean>
    /**
     * Use this method to delete the list of the bot's commands for the given scope and user language. After deletion, higher level commands will be shown to affected users. Returns True on success.
     * @see https://core.telegram.org/bots/api#deletemycommands
     */
    deleteMyCommands(payload: DeleteMyCommandsPayload): Promise<boolean>
    /**
     * Use this method to get the current list of the bot's commands for the given scope and user language. Returns BotCommand on success. If commands aren't set, an empty list is returned.
     * @see https://core.telegram.org/bots/api#getmycommands
     */
    getMyCommands(payload: GetMyCommandsPayload): Promise<BotCommand[]>
    /**
     * Use this method to edit text and game messages. On success, if the edited message is not an inline message, the edited Message is returned, otherwise True is returned.
     * @see https://core.telegram.org/bots/api#editmessagetext
     */
    editMessageText(payload: EditMessageTextPayload): Promise<Message | boolean>
    /**
     * Use this method to edit captions of messages. On success, if the edited message is not an inline message, the edited Message is returned, otherwise True is returned.
     * @see https://core.telegram.org/bots/api#editmessagecaption
     */
    editMessageCaption(payload: EditMessageCaptionPayload): Promise<Message | boolean>
    /**
     * Use this method to edit animation, audio, document, photo, or video messages. If a message is part of a message album, then it can be edited only to an audio for audio albums, only to a document for document albums and to a photo or a video otherwise. When an inline message is edited, a new file can't be uploaded; use a previously uploaded file via its file_id or specify a URL. On success, if the edited message is not an inline message, the edited Message is returned, otherwise True is returned.
     * @see https://core.telegram.org/bots/api#editmessagemedia
     */
    editMessageMedia(payload: EditMessageMediaPayload): Promise<Message | boolean>
    /**
     * Use this method to edit only the reply markup of messages. On success, if the edited message is not an inline message, the edited Message is returned, otherwise True is returned.
     * @see https://core.telegram.org/bots/api#editmessagereplymarkup
     */
    editMessageReplyMarkup(payload: EditMessageReplyMarkupPayload): Promise<Message | boolean>
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
    deleteMessage(payload: DeleteMessagePayload): Promise<boolean>
  }
}

Internal.define('getMe')
Internal.define('logOut')
Internal.define('close')
Internal.define('sendMessage')
Internal.define('forwardMessage')
Internal.define('copyMessage')
Internal.define('sendPhoto')
Internal.define('sendAudio')
Internal.define('sendDocument')
Internal.define('sendVideo')
Internal.define('sendAnimation')
Internal.define('sendVoice')
Internal.define('sendVideoNote')
Internal.define('sendMediaGroup')
Internal.define('sendLocation')
Internal.define('editMessageLiveLocation')
Internal.define('stopMessageLiveLocation')
Internal.define('sendVenue')
Internal.define('sendContact')
Internal.define('sendPoll')
Internal.define('sendDice')
Internal.define('sendChatAction')
Internal.define('getUserProfilePhotos')
Internal.define('getFile')
Internal.define('banChatMember')
Internal.define('unbanChatMember')
Internal.define('restrictChatMember')
Internal.define('promoteChatMember')
Internal.define('setChatAdministratorCustomTitle')
Internal.define('banChatSenderChat')
Internal.define('unbanChatSenderChat')
Internal.define('setChatPermissions')
Internal.define('exportChatInviteLink')
Internal.define('createChatInviteLink')
Internal.define('editChatInviteLink')
Internal.define('revokeChatInviteLink')
Internal.define('approveChatJoinRequest')
Internal.define('declineChatJoinRequest')
Internal.define('setChatPhoto')
Internal.define('deleteChatPhoto')
Internal.define('setChatTitle')
Internal.define('setChatDescription')
Internal.define('pinChatMessage')
Internal.define('unpinChatMessage')
Internal.define('unpinAllChatMessages')
Internal.define('leaveChat')
Internal.define('getChat')
Internal.define('getChatAdministrators')
Internal.define('getChatMemberCount')
Internal.define('getChatMember')
Internal.define('setChatStickerSet')
Internal.define('deleteChatStickerSet')
Internal.define('answerCallbackQuery')
Internal.define('setMyCommands')
Internal.define('deleteMyCommands')
Internal.define('getMyCommands')
Internal.define('editMessageText')
Internal.define('editMessageCaption')
Internal.define('editMessageMedia')
Internal.define('editMessageReplyMarkup')
Internal.define('stopPoll')
Internal.define('deleteMessage')
