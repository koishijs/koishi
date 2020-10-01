/* eslint-disable camelcase */

import axios from 'axios'
import nhentai from './nhentai'
import danbooru from './danbooru'
import konachan from './konachan'
import { Session } from 'koishi-core'
import { Logger } from 'koishi-utils'
import { getShareText, checkHost } from './utils'
import { Config } from '.'

export interface SaucenaoIndex {
  status: number
  id: number
  parent_id: number
  results: number
}

export interface SaucenaoResponseHeader {
  user_id: number
  account_type: number
  short_limit: string
  long_limit: string
  long_remaining: number
  short_remaining: number
  status: number
  results_requested: number
  message?: string
  index?: Record<number, SaucenaoIndex>
  search_depth?: string
  minimum_similarity?: number
  query_image_display?: string
  query_image?: string
  results_returned?: number
}

export interface SaucenaoResultHeader {
  similarity: string
  thumbnail: string
  index_id: number
  index_name: string
}

export interface SaucenaoResultData {
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
}

export interface SaucenaoResult {
  header: SaucenaoResultHeader
  data?: SaucenaoResultData
}

export interface SaucenaoResponse {
  header: SaucenaoResponseHeader
  results: SaucenaoResult[]
}

const logger = new Logger('search')

export default async function saucenao(sourceUrl: string, session: Session, config: Config, mixedMode = false) {
  let data: SaucenaoResponse

  try {
    const response = await axios.get<SaucenaoResponse>('http://saucenao.com/search.php', {
      params: { db: 999, url: sourceUrl, output_type: 2, numres: 3 },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36',
      },
    })
    data = response.data
  } catch (err) {
    if (!('response' in err)) {
      logger.warn(`[error] saucenao: ${err}`)
      return session.$send('访问失败。')
    } else if (err.response.status === 429) {
      return session.$send('搜索次数已达单位时间上限，请稍候再试。')
    } else {
      logger.warn(`[error] saucenao: ${err.response.data}`)
      return session.$send('由于未知原因搜索失败。')
    }
  }

  if (!data.results?.length) {
    if (data.header.message) {
      return session.$send(data.header.message)
    } else {
      logger.warn(`[error] saucenao: ${data}`)
      return session.$send('由于未知原因搜索失败。')
    }
  }

  const { long_remaining, short_remaining } = data.header
  const [{
    header,
    data: { ext_urls, title, member_id, member_name, eng_name, jp_name },
  }] = data.results

  let url: string
  let source: string | void
  if (ext_urls) {
    url = ext_urls[0]
    for (let i = 1; i < ext_urls.length; i++) {
      if (checkHost(ext_urls[i], 'danbooru')) {
        url = ext_urls[i]
        break
      }
    }
    if (checkHost(url, 'danbooru')) {
      source = await danbooru(url).catch(logger.debug)
    } else if (checkHost(url, 'konachan')) {
      source = await konachan(url).catch(logger.debug)
    }
  }

  const output: string[] = []

  const { thumbnail, similarity } = header
  const lowSimilarity = +similarity < (config.lowSimilarity ?? 40)
  const highSimilarity = +similarity > (config.highSimilarity ?? 60)

  if (lowSimilarity) {
    output.push(`相似度 (${similarity}%) 过低，这很可能不是你要找的图。`)
  } else if (!highSimilarity) {
    output.push(`相似度 (${similarity}%) 较低，这可能不是你要找的图。`)
    if (mixedMode) output[0] += '将自动使用 ascii2d 继续进行搜索。'
  }

  if (!lowSimilarity || !mixedMode) {
    if (jp_name || eng_name) {
      const bookName = (jp_name || eng_name).replace('(English)', '')

      try {
        const book = await nhentai(bookName)
        if (book) {
          url = `https://nhentai.net/g/${book.id}/`
        } else {
          output.push('没有在 nhentai 找到对应的本子_(:3」∠)_')
        }
      } catch (error) {
        logger.debug(error)
      }

      output.push(getShareText({
        url,
        thumbnail,
        title: `(${similarity}%) ${bookName}`,
      }))
    } else {
      const displayTitle = member_name
        ? `「${title}」/「${member_name}」`
        : title || (checkHost(url, 'anidb.net') ? 'AniDB' : '搜索结果')
      output.push(getShareText({
        url,
        thumbnail,
        title: `(${similarity}%) ${displayTitle}`,
        authorUrl: member_id && checkHost(url, 'pixiv.net') && `https://pixiv.net/u/${member_id}`,
        source,
      }))
    }
  }

  if (long_remaining < 20) {
    output.push(`注意：24h 内搜图次数仅剩 ${long_remaining} 次。`)
  } else if (short_remaining < 3) {
    output.push(`注意：30s 内搜图次数仅剩 ${short_remaining} 次。`)
  }

  await session.$send(output.join('\n'))
  return !highSimilarity && mixedMode
}
