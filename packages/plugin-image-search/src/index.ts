import { Context, Session, Group, CommandAction } from 'koishi-core'
import ascii2d from './ascii2d'
import saucenao from './saucenao'

export interface Config {
  lowSimilarity?: number
  highSimilarity?: number
}

const imageRE = /\[CQ:image,file=([^,]+),url=([^\]]+)\]/g
function extractImages (message: string) {
  let search = imageRE.exec(message)
  const result: string[] = []
  while (search) {
    result.push(search[2])
    search = imageRE.exec(message)
  }
  return result
}

async function mixedSearch (url: string, session: Session, config: Config) {
  return await saucenao(url, session, config, true) && ascii2d(url, session, config)
}

export const name = 'search'

export function apply (ctx: Context, config: Config = {}) {
  const command = ctx.command('search <...images>', '搜图片')
    .alias('搜图')
    .groupFields(['flag'])
    .before(session => !!(session.$group.flag & Group.Flag.noImage))
    .action(searchWith(mixedSearch))

  command.subcommand('saucenao <...images>', '使用 saucenao 搜图')
    .groupFields(['flag'])
    .before(session => !!(session.$group.flag & Group.Flag.noImage))
    .action(searchWith(saucenao))

  command.subcommand('ascii2d <...images>', '使用 ascii2d 搜图')
    .groupFields(['flag'])
    .before(session => !!(session.$group.flag & Group.Flag.noImage))
    .action(searchWith(ascii2d))

  function searchWith (callback: (url: string, session: Session<never, never>, config: Config) => Promise<any>): CommandAction {
    return async ({ session }) => {
      const urls = extractImages(session.message)
      if (urls.length) {
        await Promise.all(urls.map(url => callback(url, session, config)))
      }

      session.$app.onceMiddleware((session, next) => {
        const urls = extractImages(session.message)
        if (!urls.length) return next()
        return Promise.all(urls.map(url => callback(url, session, config)))
      }, session)

      return session.$send('请发送图片。')
    }
  }
}
