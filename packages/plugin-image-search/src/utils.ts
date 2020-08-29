import { CQCode } from 'koishi-utils'

export function getLink(url: string) {
  const pidSearch = /pixiv.+illust_id=(\d+)/.exec(url)
  if (pidSearch) return 'https://pixiv.net/i/' + pidSearch[1]
  const uidSearch = /pixiv.+member\.php\?id=(\d+)/.exec(url)
  if (uidSearch) return 'https://pixiv.net/u/' + uidSearch[1]
  return url
}

export interface ShareData {
  url: string
  title: string
  thumbnail: string
  authorUrl?: string
  source?: string | void
}

export function getShareText({ url, title, thumbnail, authorUrl, source }: ShareData) {
  const output = [
    title,
    CQCode.stringify('image', { file: thumbnail }),
  ]
  if (url) output.push(`链接：${getLink(url)}`)
  if (authorUrl) output.push(`作者：${getLink(authorUrl)}`)
  if (source) output.push(`来源：${getLink(source)}`)
  return output.join('\n')
}

export function checkHost(source: string, name: string) {
  return source && source.includes(name)
}
