import axios from 'axios'
import Cheerio from 'cheerio'
import { Meta } from 'koishi-core'
import { noop, Logger } from 'koishi-utils'
import { getShareText } from './utils'

const baseURL = 'https://ascii2d.net'
const logger = Logger.create('image')

export default async function (url: string, meta: Meta) {
  try {
    const tasks: Promise<void>[] = []
    const response = await axios.get(`${baseURL}/search/url/${encodeURIComponent(url)}`)
    tasks.push(meta.$send('ascii2d 色合检索\n' + getDetail(response.data)).catch(noop))
    try {
      const bovwURL = response.request.res.responseUrl.replace('/color/', '/bovw/')
      const bovwHTML = await axios.get(bovwURL).then(r => r.data)
      tasks.push(meta.$send('ascii2d 特征检索\n' + getDetail(bovwHTML)).catch(noop))
    } catch (err) {
      logger.warn(`[error] ascii2d bovw ${err}`)
    }
    await Promise.all(tasks)
  } catch (err) {
    logger.warn(`[error] ascii2d color ${err}`)
    return meta.$send('访问失败。')
  }
}

function getDetail (html: string) {
  const $ = Cheerio.load(html, { decodeEntities: false })
  const $box = $($('.item-box')[1])
  const thumbnail = baseURL + $box.find('.image-box img').attr('src')
  const $link = $box.find('.detail-box a')
  const $title = $($link[0])
  const $author = $($link[1])
  return getShareText({
    url: $title.attr('href'),
    title: $author
      ? `「${$title.html()}」/「${$author.html()}」`
      : $title.html(),
    thumbnail,
    authorUrl: $author.attr('href'),
  })
}
