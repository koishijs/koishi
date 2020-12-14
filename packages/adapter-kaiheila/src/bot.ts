import { App, Bot, Session } from 'koishi-core'

export class KaiheilaBot extends Bot {}

export function createSession(app: App, data: any) {
  const session = new Session(app, data)
  return session
}
