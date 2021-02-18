import { Context, Session, Command, makeArray, Segment } from 'koishi-core'
import ascii2d from './ascii2d'
import saucenao from './saucenao'

export interface Config extends saucenao.Config {
  saucenaoApiKey?: string | string[]
}

async function mixedSearch(url: string, session: Session, config: Config) {
  return await saucenao(url, session, config, true) && ascii2d(url, session)
}

export const name = 'search'

export function apply(ctx: Context, config: Config = {}) {
  let index = 0
  const keys = makeArray(config.saucenaoApiKey)

  ctx.on('saucenao/get-key', () => {
    const result = keys[index]
    index = (index + 1) % keys.length
    return result
  })

  ctx.on('saucenao/drop-key', (key) => {
    if (keys.indexOf(key) < 0) return
    if (index === 0) {
      keys.pop()
    } else {
      keys.splice(--index, 1)
    }
    return '令牌失效导致访问失败，请联系机器人作者。'
  })

  ctx.command('search [image]', '搜图片')
    .shortcut('搜图', { fuzzy: true })
    .action(search(mixedSearch))
    .subcommand('saucenao [image]', '使用 saucenao 搜图')
    .action(search(saucenao))
    .subcommand('ascii2d [image]', '使用 ascii2d 搜图')
    .action(search(ascii2d))

  const pendings = new Set<string>()

  type SearchCallback = (url: string, session: Session, config: Config) => Promise<boolean | void>

  async function searchUrl(session: Session, url: string, callback: SearchCallback) {
    const id = session.channelId
    pendings.add(id)
    try {
      await callback(url, session, config)
    } catch {
      await session.send('搜索失败。')
    } finally {
      pendings.delete(id)
    }
  }

  function search(callback: SearchCallback): Command.Action {
    return async ({ session }) => {
      const id = session.channelId
      if (pendings.has(id)) return '存在正在进行的查询，请稍后再试。'

      const code = Segment.from(session.content, 'image')
      if (code && code.data.url) {
        pendings.add(id)
        return searchUrl(session, code.data.url, callback)
      }

      const dispose = session.middleware(({ content }, next) => {
        dispose()
        const code = Segment.from(content, 'image')
        if (!code || !code.data.url) return next()
        return searchUrl(session, code.data.url, callback)
      })

      return '请发送图片。'
    }
  }
}
