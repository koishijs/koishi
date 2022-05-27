import { Feishu, Internal } from '..'

export * from './content'
export * from './asset'

export type MessageType = 'text' | 'post' | 'image' | 'file' | 'audio' | 'media' | 'sticker' | 'interactive' | 'share_chat' | 'share_user'

export interface Sender extends Feishu.UserIdentifiers {
  sender_type: string
  tenant_key: string
}
export interface Mention extends Feishu.UserIdentifiers {
  key: string
  name: string
  tenant_key: string
}

declare module '../event' {
  export interface EventBody {
    /**
     * Receive message event.
     * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/events/receive
     */
    'im.message.receive_v1': {
      sender: {
        sender_id: Feishu.UserIds
        sender_type?: string
        tenant_key: string
      }
      message: {
        message_id: string
        root_id: string
        parent_id: string
        create_time: string
        chat_id: string
        chat_type: string
        message_type: string
        content: string
        mentions: {
          key: string
          id: Feishu.UserIds
          name: string
          tenant_key: string
        }[]
      }
    }
    /**
     * Message read event.
     * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/events/message_read
     */
    'im.message.message_read_v1': {
      reader: {
        reader_id: Feishu.UserIds
        read_time: string
        tenant_key: string
      }
      message_id_list: string[]
    }
  }
}

export interface MessagePayload {
  receive_id: string
  content: string
  msg_type: string
}

export interface Message {
  /**
   * The id of current message
   *
   * Should be started with `om_`
   */
  message_id: string
  /**
   * The id of the *root* message in reply chains
   * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/intro#ac79c1c2
   */
  root_id: string

  /**
   * The id of the direct *parent* message in reply chains
   * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/intro#ac79c1c2
   */
  parent_id: string

  /**
   * The message type.
   * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/im-v1/message/create_json
   */
  msg_type: MessageType

  /**
   * The timestamp when the message is created in milliseconds.
   */
  create_time: string

  /**
   * The timestamp when the message is last updated in milliseconds.
   */
  update_time: string

  /**
   * Whether the message is deleted.
   */
  deleted: boolean

  /**
   * Whether the message is updated.
   */
  updated: boolean

  /**
   * The id of the group / channel the message is sent to.
   */
  chat_id: string

  /**
   * The sender of the message.
   * Can be a user or an app.
   */
  sender: Sender

  /**
   * The body of the message.
   */
  body: {
    /**
     * The content of the message.
     * Should be a string that represents the JSON object contains the message content.
     */
    content: string
  }

  /**
   * Users mentioned in the message.
   */
  mentions: Mention[]

  /**
   * The id of the direct *parent* message in `merge and repost` chains.
   */
  upper_message_id: string
}

declare module '../internal' {
  export interface Internal {
    /** @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create */
    sendMessage(receive_id_type: Feishu.ReceiveIdType, message: MessagePayload): Promise<BaseResponse & { data: Message }>
    /** @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/reply */
    replyMessage(message: MessagePayload): Promise<BaseResponse & { data: Message }>
  }
}

Internal.define({
  'im/v1/messages?receive_id_type={receive_id_type}': {
    POST: 'sendMessage',
  },
  'im/v1/messages/{message_id}/reply': {
    POST: 'relayMessage',
  },
})
