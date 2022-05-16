export * from './internal'

export * from './auth'
export * from './event'

export namespace Feishu {
  export interface UserIds {
    union_id: string
    user_id?: string
    open_id: string
  }
}
