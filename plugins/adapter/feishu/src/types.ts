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
export interface BaseEventBody<T = string> {}
// #endregion event body / event.event

export interface BaseEvent<T = string> {
  schema: '1.0' | '2.0'
  header: BaseEventHeader<T>
  event: BaseEventBody<T>
}
