import axios from 'axios'
import { load } from 'cheerio'
import { Context, segment, template } from 'koishi-core'

export interface BaiduOptions {
  maxResultDisplay?: number
  maxSummaryLength?: number
  showImage?: boolean
}

export const name = 'baidu'

const URL_BASE = 'https://baike.baidu.com'
const URL_SEARCH = URL_BASE + '/search?word='

template.set('baidu', {
  'article-not-exist': '喵，百度百科尚未收录词条 “$1” 。\n您可以访问以确认：$2',
  'await-choose-result': '请发送您想查看的词条编号（1 - $1）',
  'error-with-link': '百度搜索时出现问题。\n您可以访问以确认：$1',
  'has-multi-result': '“$1”有多个搜索结果（显示前 $2 个）：',
})

/** 从搜索列表中获取指定顺位结果的词条链接 */
function getArticleLink($: ReturnType<typeof load>, index: number = 0): string | null {
  const $list = $('.search-list dd')

  // 处理 index
  if (index < 0) index = 0
  if ($list.length < 1 || index + 1 > $list.length) return null

  // 获取词条链接
  const $entry = $list.eq(index)
  let url = $entry.find('a.result-title').attr('href')
  if (!url) return null
  if (/^\/item\//.test(url)) {
    url = URL_BASE + url
  }

  return url
}

/** 从搜索列表中获取指定顺位结果的词条内容 */
async function getHtml(url: string) {
  if (!url) return null
  const { data } = await axios.get(url)
  return load(data)
}

/**
 * @function formatAnswer
 * @param {Cheerio} $article 词条页面的cheerio对象
 * @param {String} from 来源url
 * @return {String}
 */
function formatAnswer({
  $article,
  from,
  pOptions,
}: {
  $article: any
  from: string
  pOptions: BaiduOptions
}): string {
  const msg = []

  // 获取简图
  const summaryPic = $article('.summary-pic img')
  if (summaryPic.length > 0 && pOptions.showImage) {
    msg.push(
      segment('image', {
        file: summaryPic.attr('src'),
      }),
    )
  }

  // 获取词条标题
  const title = $article('h1')
    .text()
    .trim()
  msg.push(title)

  // 获取类似“同义词”的提示
  let tip: any = $article('.view-tip-panel')
  if (tip.length > 0) {
    tip = tip.text().trim()
    msg.push(tip)
  }

  // 获取词条的第一段
  $article('.lemma-summary sup').remove() // 删掉 [1] 这种鬼玩意
  const summary = $article('.lemma-summary')
    .text()
    .trim()
  let maxLength = summary.length
  if (pOptions.maxSummaryLength > 0) {
    maxLength = pOptions.maxSummaryLength
  }
  msg.push(
    summary.length > maxLength
      ? summary.substr(0, maxLength) + ' [...]'
      : summary,
  )

  msg.push(`来自：${from}`)

  return msg.join('\n')
}

export function apply(ctx: Context, options: BaiduOptions = {}) {
  options = {
    maxResultDisplay: 3,
    maxSummaryLength: 200,
    showImage: true,
    ...options,
  }

  ctx.command('tools/baidu <keyword>', '使用百度百科搜索')
    .example('百度一下最终幻想14')
    .shortcut(/^百度(一下)?(.+?)$/, { args: ['$2'] })
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
        const $resultList = $('.search-list dd')
        let nthOfResult = 0
        const allResults = $resultList.length
        const showedResult = Math.max(allResults, options.maxResultDisplay)
        if (allResults > 1) {
          const question = []
          question.push(template('baidu.has-multi-result', keyword, showedResult))
          for (let i = 0; i < showedResult; i++) {
            const $item = $resultList.eq(i)
            const title = $item
              .find('.result-title')
              .text()
              .trim()
              .replace(/[_\-]\s*百度百科$/, '')
              .trim()
            const desc = $item
              .find('.result-summary')
              .text()
              .trim()
            question.push(`${String(i + 1)}. ${title}\n  ${desc}`)
          }
          question.push(template('baidu.await-choose-result', showedResult))
          session.send(question.join('\n'))
          const answer: string = await session.prompt(30 * 1000)

          if (!answer) {
            return
          }
          if (
            isNaN(Number(answer)) ||
            Number(answer) < 1 ||
            Number(answer) > showedResult
          ) {
            return session.send('编号输入有误！')
          }
          nthOfResult = Number(answer) - 1
        }

        // 获取词条内容
        const articleLink = getArticleLink($, nthOfResult)
        const $article = await getHtml(articleLink)
        // console.log('已取得词条内容')

        if (!$article) {
          return template('baidu.error-with-link', url)
        }

        // 获取格式化文本
        return formatAnswer({
          $article,
          from: articleLink,
          pOptions: options,
        })
      } catch (err) {
        return template('baidu.error-with-link', url)
      }
    })
}
