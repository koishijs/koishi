export interface EventHeader<T = string> {
  event_id: string
  event_type: T
  create_time: string
  token: string
  app_id: string
  tenant_key: string
}

export interface EventBody {}

// In fact, this is the 2.0 version of the event sent by Feishu.
// And only the 2.0 version has the `schema` field.
export interface Event<T = string> {
  schema: '2.0'
  header: EventHeader<T>
  event: T extends keyof EventBody ? EventBody[T] : any
}
