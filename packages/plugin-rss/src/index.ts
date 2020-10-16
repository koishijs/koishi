import { Context, Group, Session, extendDatabase } from 'koishi-core'
import { Logger, Time } from 'koishi-utils'
import MysqlDatabase from 'koishi-plugin-mysql/dist/database'
import RssFeedEmitter from 'rss-feed-emitter'

declare module 'koishi-core/dist/database' {
  interface Group {
    rss?: string[]
  }
}

Group.extend(() => ({
  rss: [],
}))

extendDatabase<typeof MysqlDatabase>('koishi-plugin-mysql', ({ listFields, tables }) => {
  listFields.push('group.rss')
  tables.group.rss = `TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci'`
})

export interface Config {
  timeout?: number
  refresh?: number
  userAgent?: string
}

const logger = new Logger('rss')

export const name = 'rss'

export function apply(ctx: Context, config: Config = {}) {
  const { timeout = 10 * Time.second, refresh = Time.minute, userAgent } = config
  const feedMap: Record<string, Set<number>> = {}
  const feeder = new RssFeedEmitter({ skipFirstLoad: true, userAgent })

  function subscribe(url: string, groupId: number) {
    if (url in feedMap) {
      feedMap[url].add(groupId)
    } else {
      feedMap[url] = new Set([groupId])
      feeder.add({ url, refresh })
      logger.debug('subscribe', url)
    }
  }

  function unsubscribe(url: string, groupId: number) {
    feedMap[url].delete(groupId)
    if (!feedMap[url].size) {
      delete feedMap[url]
      feeder.remove(url)
      logger.debug('unsubscribe', url)
    }
  }

  ctx.on('connect', async () => {
    feeder.on('error', (err: Error) => {
      logger.warn(err.message)
    })

    const groups = await ctx.database.getAllGroups(['id', 'rss'])
    for (const group of groups) {
      for (const url of group.rss) {
        subscribe(url, group.id)
      }
    }

    feeder.on('new-item', async (payload) => {
      logger.debug('receive', payload.title)
      const source = payload.meta.link.toLowerCase()
      if (!feedMap[source]) return
      const message = `${payload.meta.title} (${payload.author})\n${payload.title}`
      await ctx.broadcast([...feedMap[source]], message)
    })
  })

  const validators: Record<string, Promise<unknown>> = {}
  async function validate(url: string, session: Session) {
    if (validators[url]) {
      await session.$send('正在尝试连接……')
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

  ctx.group().command('rss <url...>', '订阅 RSS 链接')
    .groupFields(['rss', 'id'])
    .option('list', '-l 查看订阅列表')
    .option('remove', '-r 取消订阅')
    .action(async ({ session, options }, url) => {
      const { rss, id } = session.$group
      if (options.list) {
        if (!rss.length) return '未订阅任何链接。'
        return rss.join('\n')
      }

      url = url.toLowerCase()
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
        logger.warn(error)
        return '无法订阅此链接。'
      })
    })
}
