import cheerio from 'cheerio'
import { Context, isInteger, segment, template, interpolate } from 'koishi'

export interface BaiduOptions {
  maxResultCount?: number
  maxSummaryLength?: number
  format?: string
}

export const name = 'baidu'

const URL_BASE = 'https://baike.baidu.com'
const URL_SEARCH = URL_BASE + '/search?word='

template.set('baidu', {
  'article-not-exist': '百度百科尚未收录词条 “{0}” 。',
  'await-choose-result': '请发送您想查看的词条编号。',
  'error-with-link': '百度搜索时出现问题。',
  'has-multi-result': '“{0}”有多个搜索结果（显示前 {1} 个）：',
  'incorrect-index': '',
})

type CheerioRoot = ReturnType<typeof cheerio.load>

/** 从搜索列表中获取指定顺位结果的词条链接 */
function getArticleLink($: CheerioRoot, index: number) {
  const $list = $('.search-list dd')

  // 处理 index
  if (index < 0) index = 0
  if ($list.length < 1 || index + 1 > $list.length) return

  // 获取词条链接
  const $entry = $list.eq(index)
  let url = $entry.find('a.result-title').attr('href')
  if (!url) return
  if (/^\/item\//.test(url)) {
    url = URL_BASE + url
  }
  return url
}

function formatAnswer($: CheerioRoot, link: string, options: BaiduOptions): string {
  $('.lemma-summary sup').remove() // 删掉 [1] 这种鬼玩意
  let summary = $('.lemma-summary').text().trim() // 获取词条的第一段
  if (summary.length > options.maxSummaryLength) {
    summary = summary.slice(0, options.maxSummaryLength) + '...'
  }

  return interpolate(options.format, {
    title: $('h1').text().trim(),
    thumbnail: segment.image($('.summary-pic img').attr('src')),
    tips: $('.view-tip-panel').text().trim(),
    summary,
    link,
  }).replace(/\n+/g, '\n')
}

export function apply(ctx: Context, options: BaiduOptions = {}) {
  options = {
    maxResultCount: 3,
    maxSummaryLength: 200,
    format: '{{ thumbnail }}\n{{ title }}\n{{ tips }}\n{{ summary }}\n来自：{{ link }}',
    ...options,
  }

  /** 从搜索列表中获取指定顺位结果的词条内容 */
  async function getHtml(url: string) {
    if (!url) return null
    const data = await ctx.http.get(url)
    return cheerio.load(data)
  }

  ctx.command('tools/baidu <keyword>', '使用百度百科搜索')
    .example('百度一下 最终幻想14')
    .shortcut('百度一下', { fuzzy: true })
    .shortcut('百度', { fuzzy: true })
    .action(async ({ session }, keyword) => {
      if (!keyword) return session.execute('baidu -h')
      const url = URL_SEARCH + encodeURI(keyword)

      try {
        // 尝试搜索
        const $ = await getHtml(url)

        // 没有相关词条
        if ($('.create-entrance').length || $('.no-result').length) {
          return template('baidu.article-not-exist', keyword, url)
        }

        // 有多个搜索结果
        let index = 0
        const $results = $('.search-list dd')
        const count = Math.min($results.length, options.maxResultCount)
        if (count > 1) {
          const output = [template('baidu.has-multi-result', keyword, count)]
          for (let i = 0; i < count; i++) {
            const $item = $results.eq(i)
            const title = $item.find('.result-title').text().replace(/[_\-]\s*百度百科\s*$/, '').trim()
            const desc = $item.find('.result-summary').text().trim()
            output.push(`${i + 1}. ${title}\n  ${desc}`)
          }
          output.push(template('baidu.await-choose-result', count))
          await session.send(output.join('\n'))
          const answer = await session.prompt(30 * 1000)
          if (!answer) return

          index = +answer - 1
          if (!isInteger(index) || index < 0 || index >= count) {
            return template('baidu.incorrect-index')
          }
        }

        // 获取词条内容
        const articleLink = getArticleLink($, index)
        const $article = await getHtml(articleLink)

        if (!$article) {
          return template('baidu.error-with-link', url)
        }

        // 获取格式化文本
        return formatAnswer($article, articleLink, options)
      } catch (err) {
        ctx.logger('baidu').warn(err)
        return template('baidu.error-with-link', url)
      }
    })
}
