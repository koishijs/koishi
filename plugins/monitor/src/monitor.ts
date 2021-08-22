import { Channel, App, segment, Logger } from 'koishi'
import { Subscribe } from './database'
import bilibili from './bilibili'
import twitcasting from './twitCasting'
import mirrativ from './mirrativ'
import axios from 'axios'

declare module 'koishi' {
  interface EventMap {
    'monitor/before-send'(info: LiveInfo, group: Pick<Channel, 'id' | 'flag' | 'assignee' | 'subscribe'>): void | boolean
  }
}

export const INTERVAL = 60000

const logger = new Logger('monitor')

const headers = {
  'Accept-Language': 'en-US,en;q=0.8',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:60.0) Gecko/20100101 Firefox/60.0',
}

export async function get<T>(url: string) {
  const { data } = await axios.get<T>(url, { headers })
  return data
}

const platforms = { bilibili, twitcasting, mirrativ } as const

type LiveType = keyof typeof platforms
type StatusKey = 'bilibiliStatus' | 'twitCastingStatus' | 'mirrativStatus'

export class Monitor {
  public running = false
  public daemons: Partial<Record<LiveType, Daemon>> = {}

  constructor(public config: Subscribe, public app: App) {
    for (const key in platforms) {
      if (key in config) {
        this.daemons[key] = new Daemon(key as LiveType, config, this)
      }
    }
  }

  start() {
    this.running = true
    for (const type in this.daemons) {
      this.daemons[type].start()
    }
  }

  stop() {
    this.running = false
    for (const type in this.daemons) {
      this.daemons[type].stop()
    }
  }
}

export interface LiveInfo {
  url: string
  title?: string
  image?: string
  content?: string
}

export class Daemon {
  private _status: boolean[] = []
  private _timer: NodeJS.Timeout
  private _statusKey: StatusKey
  private _displayType: string

  constructor(public readonly type: LiveType, public config: Subscribe, public monitor: Monitor) {}

  get id() {
    return this.config[this.type]
  }

  get isLive() {
    return this._status.some(s => s)
  }

  set isLive(value) {
    const [status] = this._status
    this._status.unshift(value)
    this._status = this._status.slice(0, 5)
    if (status !== value) {
      this.monitor.app.database.set('subscribe', this.config.id, {
        [this._statusKey]: value,
      })
    }
  }

  public start() {
    this._statusKey = this.type + 'Status' as any
    this._displayType = this.type[0].toUpperCase() + this.type.slice(1)
    this.isLive = this.config[this._statusKey]
    this.run()
  }

  private async run() {
    this.stop()
    this._timer = setTimeout(() => this.run(), INTERVAL)
    let result: LiveInfo
    try {
      result = await platforms[this.type](this)
      if (result) this.send(result)
      this.isLive = !!result
      logger.debug(this.config.id, this.type, result)
    } catch (error) {
      logger.debug(this.config.id, this.type, error)
    }
  }

  public stop() {
    clearTimeout(this._timer)
    this._timer = null
  }

  protected async send(info: LiveInfo) {
    if (this.isLive) return
    this.isLive = true
    const { url, content, image, title } = info
    const app = this.monitor.app
    const channels = await app.database.getAssignedChannels(['id', 'flag', 'assignee', 'subscribe'])
    channels.forEach(async (group) => {
      const { id, flag, assignee, subscribe } = group
      const [type, channelId] = id.split(':')
      if (!subscribe[this.config.id] || flag & Channel.Flag.silent) return
      const bot = app.bots[`${type}:${assignee}`]
      const output = [`[直播提示] ${this.config.names[0]} 正在 ${this._displayType} 上直播：${url}`]
      // at subscibers
      try {
        // @ts-ignore // FIXME
        const memberMap = await bot.getMemberMap(channelId)
        const subscribers = subscribe[this.config.id].filter(id => !id || id in memberMap)
        subscribe[this.config.id] = subscribers
      } catch {}
      const subscribers = subscribe[this.config.id].filter(x => x)
      if (subscribers.length) {
        output.push(subscribers.map(x => segment.at(x)).join(''))
      }
      const messages = [output.join('\n')]
      if (title || image) {
        messages.push(segment('share', { url, image, title, content }))
      }
      if (app.bail('monitor/before-send', info, group)) return
      for (const message of messages) {
        await bot.sendMessage(channelId, message, 'unknown')
      }
    })
  }
}
