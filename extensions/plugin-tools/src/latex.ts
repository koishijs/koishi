import { Context } from 'koishi-core'
import {} from 'koishi-plugin-puppeteer'
import axios from 'axios'

export function apply (ctx: Context) {
  // ensure that peer dependency exist
  try {
    require('koishi-plugin-puppeteer')
  } catch (err) {
    return ctx.logger('tools').warn('peer dependency "koishi-plugin-puppeteer" does not exist')
  }

  ctx.command('tools/latex <code...>', 'LaTeX 渲染')
    .usage('渲染器由 https://www.zhihu.com/equation 提供。')
    .action(async ({ meta }, message) => {
      const tex = message.slice(message.indexOf('tex') + 3).trim()
      if (!tex) return meta.$send('请输入要渲染的 LaTeX 代码。')
      let { data: svg } = await axios.get('https://www.zhihu.com/equation', {
        params: { tex },
      })
      const text = svg.match(/>([^<]+)<\/text>/)
      if (text) return meta.$send(text[1])
      const viewBox = svg.match(/ viewBox="0 (-?\d*(.\d+)?) -?\d*(.\d+)? -?\d*(.\d+)?" /)
      if (viewBox) {
        svg = svg.replace('\n', `\n<rect x="0" y="${viewBox[1]}" width="100%" height="100%" fill="white"></rect>\n`)
      }
      const page = await ctx.getPage()
      await page.setContent(svg)
      const base64 = await page.screenshot({
        encoding: 'base64',
      })
      ctx.freePage(page)
      return meta.$send(`[CQ:image,file=base64://${base64}]`)
    })
}
