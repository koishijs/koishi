import { Context, Group } from 'koishi-core'
import { Logger, Time } from 'koishi-utils'
import RssFeedEmitter from 'rss-feed-emitter'

declare module 'koishi-core/dist/database' {
  interface Group {
    rss?: string[]
  }
}

export interface Config {
  refresh?: number
}

const logger = Logger.create('rss')

export const name = 'rss'

export function apply(ctx: Context, config: Config = {}) {
  const { refresh = Time.minute } = config

  const feedMap: Record<string, Set<number>> = {}

  ctx.on('connect', async () => {
    const feeder = new RssFeedEmitter({ skipFirstLoad: true })

    feeder.on('error', (err: Error) => {
      // TODO remove subscription if returns 404?
      logger.warn(err)
    })

    const groups = await ctx.database.getAllGroups(['id', 'rss'])
    for (const group of groups) {
      for (const url of group.rss) {
        if (url in feedMap) {
          feedMap[url].add(group.id)
        } else {
          feedMap[url] = new Set()
          feeder.add({ url, refresh })
        }
      }
    }

    feeder.on('new-item', async (payload) => {
      const source = payload.meta.link.toLowerCase()
      if (!feedMap[source]) return
      const message = `${payload.meta.title} (${payload.author})\n${payload.title}`
      const groups = await ctx.database.getAllGroups(['id', 'assignee', 'flag'])
      const groupMap = Object.fromEntries(groups.map(g => [g.id, g]))
      for (const id of feedMap[source]) {
        if (!groupMap[id].assignee || groupMap[id].flag & Group.Flag.noEmit) continue
        ctx.bots[groupMap[id].assignee].sendGroupMsg(id, message)
      }
    })
  })

  ctx.group().command('rss <url>', 'Subscribe a rss url')
    .groupFields(['rss'])
    .option('remove', '-r, --remove 取消订阅')
    .action(async ({ session, options }, url) => {
      url = url.toLowerCase()

      const index = session.$group.rss.indexOf(url)
      if (!options.remove) {
        if (index < 0) return '未订阅此链接。'
        session.$group.rss.splice(index, 1)
        feedMap[url].delete(session.groupId)
        return '取消订阅成功！'
      }

      if (index >= 0) return '已订阅此链接。'
      session.$group.rss.push(url)
      feedMap[url].add(session.groupId)
      return '添加订阅成功！'
    })
}
