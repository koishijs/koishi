import * as koishi from './koishi'
import { EventEmitter } from 'events'
import { App } from './app'

export type _Koishi = typeof koishi

export interface ManagerEvents {
  'app' (app: App): any
  'all-open' (): any
  'all-closed' (): any
}

export interface Koishi extends _Koishi {
  on <K extends keyof ManagerEvents> (event: K, listener: ManagerEvents[K]): this
  once <K extends keyof ManagerEvents> (event: K, listener: ManagerEvents[K]): this
  off <K extends keyof ManagerEvents> (event: K, listener: ManagerEvents[K]): this
  emit <K extends keyof ManagerEvents> (event: K, ...args: Parameters<ManagerEvents[K]>): boolean
}

export class Koishi extends EventEmitter {
  public appMap: Record<number, App> = {}
  public appList: App[] = []
  public selfIds = new Set<number>()

  private _getSelfIdsPromise: Promise<any>

  async startAll () {
    await Promise.all(this.appList.map(async app => app.start()))
  }

  async stopAll () {
    await Promise.all(this.appList.map(async app => app.stop()))
  }

  async getSelfIds () {
    if (!this._getSelfIdsPromise) {
      this._getSelfIdsPromise = Promise.all(this.appList.map(async (app) => {
        if (app.selfId || !app.options.type) return
        const info = await app.sender.getLoginInfo()
        app.prepare(info.userId)
      }))
    }
    await this._getSelfIdsPromise
    return Array.from(this.selfIds)
  }
}

export default new Koishi()
