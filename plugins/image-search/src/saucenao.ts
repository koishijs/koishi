/* eslint-disable camelcase */

import nhentai from './nhentai'
import danbooru from './danbooru'
import konachan from './konachan'
import { Session, Logger, Schema } from 'koishi'
import { getShareText, checkHost } from './utils'

declare module 'koishi' {
  interface EventMap {
    'saucenao/get-key'(): string
    'saucenao/drop-key'(key: string): string | void
  }
}

const logger = new Logger('search')

// https://saucenao.com/user.php?page=search-api
namespace Response {
  export interface Index {
    status: number
    id: number
    parent_id: number
    results: number
  }

  export interface Header {
    user_id: number
    account_type: number
    short_limit: string
    long_limit: string
    long_remaining: number
    short_remaining: number
    status: number
    message?: string
    index?: Record<number, Index>
    search_depth?: string
    minimum_similarity?: number
    query_image_display?: string
    query_image?: string
    results_requested?: number
    results_returned?: number
  }
}

namespace Result {
  export interface Header {
    dupes: number
    similarity: string
    thumbnail: string
    index_id: number
    index_name: string
  }

  export interface Data {
    ext_urls?: string[]
    source: string
    creator: string
    material?: string
    characters?: string
    title?: string
    gelbooru_id?: number
    member_name?: string
    member_id?: number
    eng_name?: string
    jp_name?: string
    author_name?: string
    author_url?: string
    da_id?: string
    pixiv_id?: string
  }
}

interface Result {
  header: Result.Header
  data?: Result.Data
}

interface Response {
  header: Response.Header
  results: Result[]
}

namespace Params {
  export enum Type { html, xml, json }
  export enum Dedupe { none, consolidate, all }
}

interface Params {
  output_type: Params.Type
  api_key: string
  test_mode?: number
  dbmask?: number
  dbmaski?: number
  db?: number
  numres: number
  dedupe?: Params.Dedupe
  url: string
}

async function search(url: string, session: Session, config: saucenao.Config, mixed?: boolean) {
  const { app } = session
  const keys = new Set<string>()
  for (let i = 0; i < config.maxTrials || 3; ++i) {
    const api_key = app.bail('saucenao/get-key')
    if (!api_key || keys.has(api_key)) {
      if (!mixed) return session.send('当前没有可用的 API 令牌，请联系机器人作者。')
      return
    }
    keys.add(api_key)
    try {
      return await session.app.http.get<Response>('https://saucenao.com/search.php', {
        db: 999,
        numres: 3,
        api_key,
        url,
        output_type: Params.Type.json,
      } as Params)
    } catch (err) {
      if (!err.response) {
        if (!(err instanceof Error) || !err.message.includes('ECONNRESET') && !err.message.includes('ECONNREFUSED')) {
          logger.warn(`[error] saucenao:`, err)
        }
        return session.send('无法连接服务器。')
      } else if (err.response.status === 403) {
        const result = app.bail('saucenao/drop-key', api_key)
        if (result) return session.send(result)
      } else if (err.response.status !== 429) {
        logger.warn(`[error] saucenao:`, err.response.data)
        return session.send('由于未知原因搜索失败。')
      }
    }
  }
  return session.send('搜索次数已达单位时间上限，请稍候再试。')
}

async function saucenao(url: string, session: Session, config: saucenao.Config, mixed?: boolean): Promise<boolean | void> {
  const data = await search(url, session, config, mixed)
  if (!data) return

  if (!data.results) {
    const message = data.header.message.toLowerCase()
    if (message.includes('you need an image')) {
      return session.send('没有传入图片 URL。')
    } else if (message.includes('supplied url is not usable')) {
      return session.send('无法使用传入的图片 URL。')
    }
    logger.warn(`[error] saucenao:`, data.header)
    return session.send('由于未知原因搜索失败：' + data.header.message)
  }

  if (!data.results.length) return session.send('没有找到搜索结果。')

  const { long_remaining, short_remaining } = data.header

  const output: string[] = []

  const { similarity } = data.results[0].header
  const lowSimilarity = +similarity < (config.lowSimilarity ?? 40)
  const highSimilarity = +similarity > (config.highSimilarity ?? 60)

  if (lowSimilarity) {
    output.push(`相似度 (${similarity}%) 过低，这很可能不是你要找的图。`)
  } else if (!highSimilarity) {
    output.push(`相似度 (${similarity}%) 较低，这可能不是你要找的图。`)
    if (mixed) output[0] += '将自动使用 ascii2d 继续进行搜索。'
  }

  if (!lowSimilarity || !mixed) await handleResult(data.results[0], session, output)

  if (long_remaining < 20) {
    output.push(`注意：24h 内搜图次数仅剩 ${long_remaining} 次。`)
  } else if (short_remaining < 3) {
    output.push(`注意：30s 内搜图次数仅剩 ${short_remaining} 次。`)
  }

  await session.send(output.join('\n'))
  return !highSimilarity && mixed
}

async function handleResult(result: Result, session: Session, output: string[]) {
  const { header, data } = result
  const { thumbnail, similarity } = header
  const { ext_urls, title, member_id, member_name, eng_name, jp_name } = data

  let imageUrl: string
  let source: string | void
  if (ext_urls) {
    imageUrl = ext_urls[0]
    for (let i = 1; i < ext_urls.length; i++) {
      if (checkHost(ext_urls[i], 'danbooru')) {
        imageUrl = ext_urls[i]
        break
      }
    }
    if (checkHost(imageUrl, 'danbooru')) {
      source = await danbooru(imageUrl, session).catch(logger.debug)
    } else if (checkHost(imageUrl, 'konachan')) {
      source = await konachan(imageUrl, session).catch(logger.debug)
    }
  }

  if (jp_name || eng_name) {
    const bookName = (jp_name || eng_name).replace('(English)', '')

    try {
      const book = await nhentai(bookName)
      if (book) {
        imageUrl = `https://nhentai.net/g/${book.id}/`
      } else {
        output.push('没有在 nhentai 找到对应的本子_(:3」∠)_')
      }
    } catch (error) {
      logger.debug(error)
    }

    output.push(getShareText({
      imageUrl,
      thumbnail,
      title: `(${similarity}%) ${bookName}`,
    }))
  } else {
    const displayTitle = member_name
      ? `「${title}」/「${member_name}」`
      : title || (checkHost(imageUrl, 'anidb.net') ? 'AniDB' : '搜索结果')
    output.push(getShareText({
      imageUrl,
      thumbnail,
      title: `(${similarity}%) ${displayTitle}`,
      authorUrl: member_id && checkHost(imageUrl, 'pixiv.net') && `https://www.pixiv.net/u/${member_id}`,
      source,
    }))
  }
}

namespace saucenao {
  export interface Config {
    maxTrials?: number
    lowSimilarity?: number
    highSimilarity?: number
  }

  export const schema: Schema<Config> = Schema.object({
    maxTrials: Schema.number('最大尝试访问次数。').default(3),
    lowSimilarity: Schema.number('相似度较低的认定标准（百分比）。当 saucenao 给出的相似度低于这个值时，将不会显示 saucenao 本身的搜索结果（但是 ascii2d 的结果会显示）。').default(40),
    highSimilarity: Schema.number('相似度较高的认定标准（百分比）。当 saucenao 给出的相似度高于这个值时，将不会使用 ascii2d 再次搜索。').default(60),
  })
}

export default saucenao
