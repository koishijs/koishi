import { AppOptions, App, Server, Session, Bot } from 'koishi-core'
import { TestSession, createMessageMeta } from './session'
import { fn, Mock } from 'jest-mock'

type MethodsOf<O> = {
  [P in keyof O]: O[P] extends (...args: any[]) => any ? P : never
}[keyof O]

declare module 'koishi-core/dist/server' {
  interface Bot {
    mock<T extends MethodsOf<Bot>>(method: T): Bot[T] extends (...args: infer R) => T ? Mock<T, R> : never
  }
}

export const BASE_SELF_ID = 514

Bot.prototype.mock = function (this: Bot, method) {
  return this[method] = fn<any, any[]>(this[method]) as any
}

class MockedAppServer extends Server {
  constructor(app: App) {
    super(app)
    this.bots.forEach(bot => bot.ready = true)
  }

  _close() {}
  async _listen() {}
}

Server.types.mock = MockedAppServer

export class MockedApp extends App {
  server: MockedAppServer

  constructor(options: AppOptions = {}) {
    super({ selfId: BASE_SELF_ID, type: 'mock', ...options })
  }

  receive(meta: Partial<Session>) {
    this.server.dispatch(new Session(this, {
      selfId: this.bots[0].selfId,
      ...meta,
    }))
  }

  receiveMessage(meta: Session): Promise<void>
  receiveMessage(type: 'user', message: string, userId: number): Promise<void>
  receiveMessage(type: 'group', message: string, userId: number, groupId: number): Promise<void>
  receiveMessage(type: 'user' | 'group' | Session, message?: string, userId?: number, ctxId: number = userId) {
    return new Promise((resolve) => {
      this.once('after-middleware', () => resolve())
      this.receive(typeof type === 'string' ? createMessageMeta(this, type, message, userId, ctxId) : type)
    })
  }

  createSession(type: 'user', userId: number): TestSession
  createSession(type: 'group', userId: number, groupId: number): TestSession
  createSession(type: 'user' | 'group', userId: number, ctxId: number = userId) {
    return new TestSession(this, type, userId, ctxId)
  }
}

export { MockedApp as App }
