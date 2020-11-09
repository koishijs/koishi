import { Context, Session, CommandAction, getContextId } from 'koishi-core'
import ascii2d from './ascii2d'
import saucenao from './saucenao'

export interface Config {
  lowSimilarity?: number
  highSimilarity?: number
}

const imageRE = /\[CQ:image,file=([^,]+),url=([^\]]+)\]/g
function extractImages(message: string) {
  let search = imageRE.exec(message)
  const result: string[] = []
  while (search) {
    result.push(search[2])
    search = imageRE.exec(message)
  }
  return result
}

async function mixedSearch(url: string, session: Session, config: Config) {
  return await saucenao(url, session, config, true) && ascii2d(url, session)
}

export const name = 'search'

export function apply(ctx: Context, config: Config = {}) {
  const command = ctx.command('search <...images>', '搜图片')
    .alias('搜图')
    .action(search(mixedSearch))

  command.subcommand('saucenao <...images>', '使用 saucenao 搜图')
    .action(search(saucenao))

  command.subcommand('ascii2d <...images>', '使用 ascii2d 搜图')
    .action(search(ascii2d))

  const pending = new Set<string>()

  type SearchCallback = (url: string, session: Session, config: Config) => Promise<any>

  async function searchUrls(session: Session, urls: string[], callback: SearchCallback) {
    const id = getContextId(session)
    pending.add(id)
    let hasSuccess = false, hasFailure = false
    await Promise.all(urls.map((url) => {
      return callback(url, session, config).then(() => hasSuccess = true, () => hasFailure = true)
    }))
    pending.delete(id)
    if (!hasFailure) return
    return session.$send(hasSuccess ? '其他图片搜索失败。' : '搜索失败。')
  }

  function search(callback: SearchCallback): CommandAction {
    return async ({ session }) => {
      const id = getContextId(session)
      if (pending.has(id)) return '存在正在进行的查询，请稍后再试。'

      const urls = extractImages(session.message)
      if (urls.length) {
        return searchUrls(session, urls, callback)
      }

      const dispose = session.$use(({ message }, next) => {
        dispose()
        const urls = extractImages(message)
        if (!urls.length) return next()
        return searchUrls(session, urls, callback)
      })

      return '请发送图片。'
    }
  }
}
