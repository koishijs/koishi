import { InlineKeyboardMarkup, Integer, Internal, Message, MessageEntity, PhotoSize, User } from '.'

export interface SendGamePayload {
  /** Unique identifier for the target chat */
  chat_id?: Integer
  /** Short name of the game, serves as the unique identifier for the game. Set up your games via Botfather. */
  game_short_name?: string
  /** Sends the message silently. Users will receive a notification with no sound. */
  disable_notification?: boolean
  /** Protects the contents of the sent message from forwarding and saving */
  protect_content?: boolean
  /** If the message is a reply, ID of the original message */
  reply_to_message_id?: Integer
  /** Pass True, if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: boolean
  /** A JSON-serialized object for an inline keyboard. If empty, one 'Play game_title' button will be shown. If not empty, the first button must launch the game. */
  reply_markup?: InlineKeyboardMarkup
}

/**
 * This object represents a game. Use BotFather to create and edit games, their short names will act as unique identifiers.
 * @see https://core.telegram.org/bots/api#game
 */
export interface Game {
  /** Title of the game */
  title?: string
  /** Description of the game */
  description?: string
  /** Photo that will be displayed in the game message in chats. */
  photo?: PhotoSize[]
  /** Optional. Brief description of the game or high scores included in the game message. Can be automatically edited to include current high scores for the game when the bot calls setGameScore, or manually edited using editMessageText. 0-4096 characters. */
  text?: string
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
  force?: boolean
  /** Pass True, if the game message should not be automatically edited to include the current scoreboard */
  disable_edit_message?: boolean
  /** Required if inline_message_id is not specified. Unique identifier for the target chat */
  chat_id?: Integer
  /** Required if inline_message_id is not specified. Identifier of the sent message */
  message_id?: Integer
  /** Required if chat_id and message_id are not specified. Identifier of the inline message */
  inline_message_id?: string
}

export interface GetGameHighScoresPayload {
  /** Target user id */
  user_id?: Integer
  /** Required if inline_message_id is not specified. Unique identifier for the target chat */
  chat_id?: Integer
  /** Required if inline_message_id is not specified. Identifier of the sent message */
  message_id?: Integer
  /** Required if chat_id and message_id are not specified. Identifier of the inline message */
  inline_message_id?: string
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

declare module './internal' {
  interface Internal {
    /**
     * Use this method to send a game. On success, the sent Message is returned.
     * @see https://core.telegram.org/bots/api#sendgame
     */
    sendGame(payload: SendGamePayload): Promise<Message>
    /**
     * Use this method to set the score of the specified user in a game message. On success, if the message is not an inline message, the Message is returned, otherwise True is returned. Returns an error, if the new score is not greater than the user's current score in the chat and force is False.
     * @see https://core.telegram.org/bots/api#setgamescore
     */
    setGameScore(payload: SetGameScorePayload): Promise<Message | boolean>
    /**
     * Use this method to get data for high score tables. Will return the score of the specified user and several of their neighbors in a game. On success, returns an GameHighScore objects.
     *
     * This method will currently return scores for the target user, plus two of their closest neighbors on each side. Will also return the top three users if the user and his neighbors are not among them. Please note that this behavior is subject to change.
     * @see https://core.telegram.org/bots/api#getgamehighscores
     */
    getGameHighScores(payload: GetGameHighScoresPayload): Promise<GameHighScore>
  }
}

Internal.define('sendGame')
Internal.define('setGameScore')
Internal.define('getGameHighScores')
