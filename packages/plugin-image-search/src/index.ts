import { Context, Session, Group } from 'koishi-core'
import ascii2d from './ascii2d'
import saucenao from './saucenao'

export interface Options {
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

function searchImage (ctx: Context, session: Session, callback: (url: string) => Promise<any>) {
  const urls = extractImages(session.message)
  if (urls.length) {
    return Promise.all(urls.map(url => callback(url)))
  }

  ctx.onceMiddleware((session, next) => {
    const urls = extractImages(session.message)
    if (!urls.length) return next()
    return Promise.all(urls.map(url => callback(url)))
  }, session)

  return session.$send('请发送图片。')
}

async function mixedSearch (url: string, session: Session, config: Options) {
  return await saucenao(url, session, config, true) && ascii2d(url, session)
}

export const name = 'image-search'

export function apply (ctx: Context, config: Options = {}) {
  const command = ctx.command('image-search <...images>', '搜图片')
    .alias('搜图')
    .groupFields(['flag'])
    .before(session => !!(session.$group.flag & Group.Flag.noImage))
    .action(({ session }) => searchImage(ctx, session, url => mixedSearch(url, session, config)))

  command.subcommand('saucenao <...images>', '使用 saucenao 搜图')
    .groupFields(['flag'])
    .before(session => !!(session.$group.flag & Group.Flag.noImage))
    .action(({ session }) => searchImage(ctx, session, url => saucenao(url, session, config)))

  command.subcommand('ascii2d <...images>', '使用 ascii2d 搜图')
    .groupFields(['flag'])
    .before(session => !!(session.$group.flag & Group.Flag.noImage))
    .action(({ session }) => searchImage(ctx, session, url => ascii2d(url, session)))
}
