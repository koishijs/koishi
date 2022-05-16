import { Feishu } from '.'

declare module './event' {
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
