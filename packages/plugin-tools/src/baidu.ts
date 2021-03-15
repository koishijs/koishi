/**
 * @name koishi-plugin-baidu 百度百科插件
 * @author 机智的小鱼君 <dragon-fish@qq.com>
 * @license Apache-2.0
 */

import axios from 'axios'
import { load } from 'cheerio'
import { Context, segment } from 'koishi-core'

export interface BaiduOptions {
  maxResultDisplay?: number
  maxSummaryLength?: number
  sendError?: boolean
  showImage?: boolean
}

export const name = 'baidu'

/**
 * @function _msg
 * @param {String} msgKey
 * @param  {...String} args
 * @return {String}
 */
function _msg(msgKey: string, ...args: string[]): string {
  function handleArgs(message: string, ...args: string[]) {
    args.forEach(function (elem, index) {
      const rgx = new RegExp('\\$' + (index + 1), 'g')
      message = message.replace(rgx, elem)
    })

    return message
  }
  const allMsg = {
    article_not_exist: '喵，百度百科尚未收录词条 “$1” 。\n您可以访问以确认：$2',
    baike_article: 'https://baike.baidu.com/item/$1',
    baike_search: 'https://baike.baidu.com/search?word=$1',
    basic_search: 'https://www.baidu.com/s?wd=$1',
    await_choose_result: '请发送您想查看的词条编号（1 - $1）',
    error_with_link: '百度搜索时出现问题。\n您可以访问以确认：$1',
    has_multi_result: '“$1”有多个搜索结果（显示前 $2 个）：',
  }
  if (allMsg[msgKey]) {
    const finalMsg = handleArgs(allMsg[msgKey], ...args)
    return finalMsg
  } else {
    let showArgs = ''
    if (args.length > 0) {
      showArgs += ': ' + args.join(', ')
    }
    return `<${name}-${msgKey}${showArgs}>`
  }
}

/**
 * @function makeSearch 获取搜索列表
 * @param {String} keyword 搜索关键词
 * @return {Promise}
 */
async function makeSearch(keyword): Promise<any> {
  const { data } = await axios.get(_msg('baike_search', encodeURI(keyword)))
  return load(data)
}

/**
 * @function getArticleLink 从搜索列表中获取指定顺位结果的词条链接
 * @param {Cheerio} $search 搜索列表的cheerio对象
 * @param {Number} index
 * @return {String} 词条的链接
 */
function getArticleLink($search: any, index: number = 0): string | null {
  const $list = $search('.search-list dd')

  // 处理 index
  if (index < 0) index = 0
  if ($list.length < 1 || index + 1 > $list.length) return null

  // 获取词条链接
  const $entry = $list.eq(index)
  let url = $entry.find('a.result-title').attr('href')
  if (!url) return null
  if (/^\/item\//.test(url)) { url = _msg('baike_article', url.replace('/item/', '')) }

  return url
}

/**
 * @function getArticle 从搜索列表中获取指定顺位结果的词条内容
 * @param {Cheerio} $search 搜索列表的cheerio对象
 * @param {Number} index
 * @return {Promise}
 */
async function getArticle(url): Promise<any> {
  if (!url) return null

  // 获取词条内容
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

export function apply(koishi: Context, userOptions = {}) {
  const defaultOptions: BaiduOptions = {
    maxResultDisplay: 3,
    maxSummaryLength: 200,
    sendError: true,
    showImage: true,
  }

  const pOptions: BaiduOptions = Object.assign({}, defaultOptions, userOptions)

  koishi
    .command('tools/baidu <keyword>', '使用百度百科搜索')
    .example('百度一下最终幻想14')
    .shortcut(/^百度(一下)?(.+?)$/, { args: ['$2'] })
    .action(async ({ session }, keyword) => {
      // 是否有关键词
      if (!keyword) return session.execute('baidu -h')

      try {
        // 尝试搜索
        const $search = await makeSearch(keyword)
        // console.log('搜索完成')

        // 没有相关词条
        if (
          $search('.create-entrance').length > 0 ||
          $search('.no-result').length > 0
        ) {
          return _msg(
            'article_not_exist',
            keyword,
            _msg('baike_search', encodeURI(keyword)),
          )
        }

        // 有多个搜索结果
        const $resultList = $search('.search-list dd')
        let nthOfResult = 0
        const allResults = $resultList.length
        const showedResult =
          allResults > pOptions.maxResultDisplay
            ? pOptions.maxResultDisplay
            : allResults
        if (allResults > 1) {
          const question = []
          question.push(_msg('has_multi_result', keyword, showedResult))
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
          question.push(_msg('await_choose_result', showedResult))
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
        const articleLink = getArticleLink($search, nthOfResult)
        const $article = await getArticle(articleLink)
        // console.log('已取得词条内容')

        if (!$article) {
          return pOptions.sendError
            ? _msg('error_with_link', _msg('baike_search', encodeURI(keyword)))
            : ''
        }

        // 获取格式化文本
        return formatAnswer({
          $article,
          from: articleLink,
          pOptions,
        })
      } catch (err) {
        // console.error('百度搜索时出现问题', err)
        return pOptions.sendError
          ? _msg('error_with_link', _msg('baike_search', encodeURI(keyword)))
          : ''
      }
    })
}
