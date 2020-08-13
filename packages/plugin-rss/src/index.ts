import { App, Session } from 'koishi-core'
import RssFeedEmitter from 'rss-feed-emitter'
import { Collection } from 'mongodb'
import { } from 'koishi-plugin-mongo'

// IsGroup groupId|userId assignee
type Target = [boolean, number, number];

interface RssSubscription {
    _id: string,
    target: Target[],
}

function get(session: Session): Target {
  return [!!session.groupId, session.groupId || session.userId, session.selfId]
}

export const apply = (app: App) => {
  app.on('connect', async () => {
    const feeder = new RssFeedEmitter({ skipFirstLoad: true })
    feeder.on('error', (err: Error) => {
      // TODO remove subscription if returns 404?
      console.error(err)
    })
    const coll: Collection<RssSubscription> = app.database.db.collection('rss')

    const urls = await coll.find().map((doc) => doc._id).toArray()
    for (const url of urls) {
      feeder.add({ url, refresh: 60000 })
    }

    feeder.on('new-item', async (payload) => {
      const source = payload.meta.link.toLowerCase()
      const message = `${payload.meta.title} (${payload.author})\n${payload.title}`
      const data = await coll.findOne({ _id: source })
      if (data) {
        for (const [isGroup, id, selfId] of data.target) {
          if (isGroup) app.bots[selfId].sendGroupMsg(id, message)
          else app.bots[selfId].sendPrivateMsg(id, message)
        }
      }
    })

    app.command('rss.subscribe <url>', 'Subscribe a rss url')
      .action(async ({ session }, url) => {
        url = url.toLowerCase()
        const current = await coll.findOne({ _id: url })
        if (current) {
          await coll.updateOne(
            { _id: url },
            {
              $addToSet: {
                target: get(session),
              },
            },
            { upsert: true },
          )
          return `Subscribed ${url}`
        }
        await coll.insertOne(
          {
            _id: url,
            target: [get(session)],
          },
        )
        feeder.add({ url, refresh: 120000 })
        return `Subscribed ${url}`
      })

    app.command('rss.cancel <url>', 'Cancel')
      .action(async ({ session }, url) => {
        url = url.toLowerCase()
        await coll.updateOne(
          { _id: url },
          { $pull: { target: get(session) } },
        )
        return `Cancelled ${url}`
      })
  })

  app.command('rss', 'Rss')
}
