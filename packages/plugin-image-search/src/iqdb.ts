import { searchPic } from 'iqdb-client'
import { Session, segment } from 'koishi-core'

async function makeSearch(url: string): Promise<string> {
  const res = await searchPic(url, { lib: 'www' })
  if (res.ok || (res.data && res.data.length > 1)) {
    const data: any = res.data[1]
    const { head, sourceUrl, img, type, source } = data

    return [
      segment('image', { url: 'https://iqdb.org' + img }),
      '准度：' + head.toLowerCase(),
      '来源：' + sourceUrl,
      '色图：' + (type.toLowerCase() === 'safe' ? '否' : '是⚠️'),
      '源站：' + source.join(', '),
    ].join('\n')
  } else if (res.err) {
    return '搜图时遇到问题：' + res.err
  } else {
    return '搜图时遇到未知问题。'
  }
}

export default async function (url: string, session: Session) {
  let result: string = 'iqdb.org 搜图\n'
  try {
    result += await makeSearch(url)
  } catch (err) {
    result += '搜图时遇到问题：' + err
  }
  return session.send(result)
}
