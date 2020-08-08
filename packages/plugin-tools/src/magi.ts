import { Context } from 'koishi-core'
import { load } from 'cheerio'
import axios from 'axios'

const tagMap = {
  description: '描述',
  synonym: '近义项',
  tag: '标签',
}

export function apply (ctx: Context) {
  ctx.command('tools/magi <text...>', '使用 Magi 搜索')
    .option('-c, --confidence', '显示数据可信度')
    .alias('搜索')
    .usage('由 https://magi.com 提供支持。')
    .action(async ({ session, options }, q) => {
      if (!q) return '请输入要搜索的文本。'
      const { data } = await axios.get('https://magi.com/search', {
        params: { q },
      })
      const $ = load(data)
      const messages = []

      $('main .card[data-type="fact"]').each((_, el) => {
        const header = el.firstChild.nextSibling
        const title = $('h2', header).text()
        const category = $('span', header).text()
        let message = `${title} [${category}]`
        if (options.confidence) message += ` (${$('svg text', header).text()})`
        $('section', el).each((_, el) => {
          const scope = el.attribs['data-scope']
          const articles = []
          $('article dl', el).each((_, el) => {
            articles.push({
              subject: $('dd[data-field="subject"]', el).text(),
              object: $('dd[data-field="object"]', el).text(),
              predicate: $('dd[data-field="predicate"]', el).text(),
              confidence: el.attribs['data-confidence'],
            })
          })

          switch (scope) {
            case 'description':
            case 'tag':
            case 'synonym':
              message += `\n${tagMap[scope]}: ` + articles.map(a => a.object + (options.confidence ? ` (${a.confidence})` : '')).join(', ')
              break
            case 'mixed':
              message += '\n' + articles.map(a => (title.includes(a.subject) ? a.object : a.subject) + (options.confidence ? ` (${a.confidence})` : '')).join(', ')
              break
            case 'property':
              for (const { object, confidence, predicate } of articles) {
                message += `\n${predicate}: ${object}`
                if (options.confidence) message += ` (${confidence})`
              }
          }
        })
        messages.push(message)
      })

      if (!messages.length) {
        return `没有找到“${q}”相关的结果。`
      } else {
        for (const message of messages) {
          await session.$send(message)
        }
      }
    })
}
