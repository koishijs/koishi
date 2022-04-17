export namespace Feishu {
  export interface UserIds {
    union_id: string
    user_id?: string
    open_id: string
  }
}

// #region event header
export interface BaseEventHeader<T = string> {
  event_id: string
  event_type: T
  create_time: string
  token: string
  app_id: string
  tenant_key: string
}
// #endregion event header

// #region event body / event.event
// FIXME: find out common part between events
export interface EventBody {
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
  'im.message.message_read_v1': {
    reader: {
      reader_id: Feishu.UserIds
      read_time: string
      tenant_key: string
    }
    message_id_list: string[]
  }
}
// #endregion event body / event.event

// In fact, this is the 2.0 version of the event sent by Feishu.
// And only the 2.0 version has the `schema` field.
export interface BaseEvent<T = string> {
  schema: '2.0'
  header: BaseEventHeader<T>
  event: T extends keyof EventBody ? EventBody[T] : any
}
