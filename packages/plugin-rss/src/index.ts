import { Context, Group, extendDatabase } from 'koishi-core'
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
      feedMap[url] = new Set()
      feeder.add({ url, refresh })
    }
  }

  function unsubscribe(url: string, groupId: number) {
    feedMap[url].delete(groupId)
    if (!feedMap[url].size) {
      delete feedMap[url]
      feeder.remove(url)
    }
  }

  ctx.on('connect', async () => {
    feeder.on('error', (err: Error) => {
      logger.warn(err)
    })

    const groups = await ctx.database.getAllGroups(['id', 'rss'])
    for (const group of groups) {
      for (const url of group.rss) {
        subscribe(url, group.id)
      }
    }

    feeder.on('new-item', async (payload) => {
      const source = payload.meta.link.toLowerCase()
      if (!feedMap[source]) return
      const message = `${payload.meta.title} (${payload.author})\n${payload.title}`
      await ctx.broadcast([...feedMap[source]], message)
    })
  })

  const validators: Record<string, Promise<unknown>> = {}
  function validate(url: string) {
    if (validators[url]) return validators[url]
    let timer: NodeJS.Timeout
    const feeder = new RssFeedEmitter({ userAgent })
    return validators[url] = new Promise((resolve, reject) => {
      // rss-feed-emitter's typings suck
      feeder.add({ url, refresh: Number.MAX_SAFE_INTEGER })
      feeder.on('new-item', resolve)
      feeder.on('error', reject)
      timer = setTimeout(() => reject(new Error('connect timeout')), timeout)
    }).finally(() => {
      feeder.destroy()
      clearTimeout(timer)
      delete validators[url]
    })
  }

  ctx.group().command('rss <url...>', 'Subscribe a rss url')
    .groupFields(['rss', 'id'])
    .option('remove', '-r, --remove 取消订阅')
    .action(async ({ session: { $group }, options }, url) => {
      url = url.toLowerCase()

      const index = $group.rss.indexOf(url)
      if (options.remove) {
        if (index < 0) return '未订阅此链接。'
        $group.rss.splice(index, 1)
        unsubscribe(url, $group.id)
        return '取消订阅成功！'
      }

      if (index >= 0) return '已订阅此链接。'
      return validate(url).then(() => {
        subscribe(url, $group.id)
        if (!$group.rss.includes(url)) {
          $group.rss.push(url)
          return '添加订阅成功！'
        }
      }, (error) => {
        logger.warn(error)
        return '无法订阅此链接。'
      })
    })
}
