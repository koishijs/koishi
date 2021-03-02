import { searchPic } from 'iqdb-client'
import { segment } from 'koishi-utils'

async function makeSearch(url: string): Promise<string> {
  const res = await searchPic(url, { lib: 'www' })
  if (res.ok || (res.data && res.data.length > 1)) {
    let data = res.data[1]
    let { head, sourceUrl, img, type, source } = data

    return [
      segment('image', { url: 'https://iqdb.org' + img }),
      '准度：' + head.toLowerCase(),
      '来源：' + sourceUrl,
      '色图：' + (type.toLowerCase() === 'safe' ? '否' : '是⚠️'),
      '源站：' + source.join(', ')
    ].join('\n')
  } else if (res.err) {
    return '搜图时遇到亿点问题：' + res.err
  } else {
    return '搜图时遇到未知问题……'
  }
}

export default async function(url: string, session: Session) {
  let result: string
  try {
    result = await makeSearch(url)
  } catch (err) {
    result = '搜图时遇到亿点问题：' + err
  }
  session.send(result)
}
