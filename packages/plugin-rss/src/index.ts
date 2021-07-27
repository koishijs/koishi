import { Channel, Context, Database, Session } from 'koishi-core'
import { } from 'koishi-plugin-mysql'
import { Logger, Time } from 'koishi-utils'
import RssFeedEmitter from 'rss-feed-emitter'

declare module 'koishi-core' {
  interface Channel {
    rss?: string[]
  }
}

Channel.extend(() => ({
  rss: [],
}))

Database.extend('koishi-plugin-mysql', ({ Domain, tables }) => {
  tables.channel.rss = new Domain.Array()
})

export interface Config {
  timeout?: number
  refresh?: number
  delay?: number
  userAgent?: string
}

const logger = new Logger('rss')

export const name = 'rss'

export function apply(ctx: Context, config: Config = {}) {
  const { timeout = 10 * Time.second, refresh = Time.minute, userAgent } = config
  const feedMap: Record<string, Set<string>> = {}
  const feeder = new RssFeedEmitter({ skipFirstLoad: true, userAgent })

  function subscribe(url: string, groupId: string) {
    if (url in feedMap) {
      feedMap[url].add(groupId)
    } else {
      feedMap[url] = new Set([groupId])
      feeder.add({ url, refresh })
      logger.debug('subscribe', url)
    }
  }

  function unsubscribe(url: string, groupId: string) {
    feedMap[url].delete(groupId)
    if (!feedMap[url].size) {
      delete feedMap[url]
      feeder.remove(url)
      logger.debug('unsubscribe', url)
    }
  }

  ctx.before('disconnect', () => {
    feeder.destroy()
  })

  ctx.on('connect', async () => {
    feeder.on('error', (err: Error) => {
      logger.debug(err.message)
    })

    const channels = await ctx.database.getAssignedChannels(['id', 'rss'])
    for (const channel of channels) {
      for (const url of channel.rss) {
        subscribe(url, channel.id)
      }
    }

    feeder.on('new-item', async (payload) => {
      logger.debug('receive', payload.title)
      const source = payload.meta.link
      if (!feedMap[source]) return
      const message = `${payload.meta.title} (${payload.author})\n${payload.title}`
      ctx.bots.forEach(async bot => await bot.broadcast([...feedMap[source]], message, config.delay))
    })
  })

  const validators: Record<string, Promise<unknown>> = {}
  async function validate(url: string, session: Session) {
    if (validators[url]) {
      await session.send('正在尝试连接……')
      return validators[url]
    }

    let timer: NodeJS.Timeout
    const feeder = new RssFeedEmitter({ userAgent })
    return validators[url] = new Promise((resolve, reject) => {
      // rss-feed-emitter's typings suck
      feeder.add({ url, refresh: 1 << 30 })
      feeder.on('new-item', resolve)
      feeder.on('error', reject)
      timer = setTimeout(() => reject(new Error('connect timeout')), timeout)
    }).finally(() => {
      feeder.destroy()
      clearTimeout(timer)
      delete validators[url]
    })
  }

  ctx.group()
    .command('rss <url:text>', '订阅 RSS 链接')
    .channelFields(['rss', 'id'])
    .option('list', '-l 查看订阅列表')
    .option('remove', '-r 取消订阅')
    .action(async ({ session, options }, url) => {
      const { rss, id } = session.channel
      if (options.list) {
        if (!rss.length) return '未订阅任何链接。'
        return rss.join('\n')
      }

      const index = rss.indexOf(url)

      if (options.remove) {
        if (index < 0) return '未订阅此链接。'
        rss.splice(index, 1)
        unsubscribe(url, id)
        return '取消订阅成功！'
      }

      if (index >= 0) return '已订阅此链接。'
      return validate(url, session).then(() => {
        subscribe(url, id)
        if (!rss.includes(url)) {
          rss.push(url)
          return '添加订阅成功！'
        }
      }, (error) => {
        logger.debug(error)
        return '无法订阅此链接。'
      })
    })
}
