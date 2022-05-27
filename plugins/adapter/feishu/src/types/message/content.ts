// https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/im-v1/message/create_json

export namespace MessageContent {
  export type Contents =
    | Text
    | Image
    | ShareChat
    | ShareUser
    | Audio
    | Media
    | File
    | Sticker
    | RichText

  export interface Text {
    text: string
  }

  export interface Image {
    image_key: string
  }

  export interface ShareChat {
    chat_id: string
  }

  export interface ShareUser {
    user_id: string
  }

  export interface Audio {
    file_key: string
  }

  export interface Media {
    file_key: string
    image_key: string
  }

  export interface File {
    file_key: string
  }

  export interface Sticker {
    file_key: string
  }

  export interface RichText {
    [locale: string]: {
      title: string
      content: RichText.Paragraph[]
    }
  }

  export namespace RichText {
    export interface Paragraph extends Array<RichText.Content> {}

    export interface BaseContent {
      tag: string
    }

    export interface TextContent extends BaseContent {
      tag: 'text'
      text: string
      un_escape?: boolean
    }
    export interface LinkContent extends BaseContent {
      tag: 'a'
      href: string
    }
    export interface AtContent extends BaseContent {
      tag: 'at'
      user_id: string
      user_name?: string
    }
    export interface ImageContent extends BaseContent {
      tag: 'img'
      image_key: string
      height?: number
      width?: number
    }

    export type Content =
      | RichText.TextContent
      | RichText.LinkContent
      | RichText.AtContent
      | RichText.ImageContent
  }
}
