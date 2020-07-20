import { Context } from 'koishi-core'
import { Page } from 'puppeteer-core'
import { freePage, getPage } from './puppeteer'

export default function apply (ctx: Context) {
  const logger = ctx.logger('puppeteer')

  ctx.command('screenshot <url>', '网页截图', { authority: 2 })
    .alias('shot')
    .option('-f, --full-page', '对整个可滚动区域截图')
    .action(async ({ meta, options }, url) => {
      let page: Page
      try {
        page = await getPage()
      } catch (error) {
        return meta.$send('无法启动浏览器。')
      }

      try {
        await page.goto(url)
        logger.debug(`navigated to ${url}`)
      } catch (error) {
        freePage(page)
        return meta.$send('无法打开页面。')
      }

      const data = await page.screenshot({
        encoding: 'base64',
        fullPage: options.fullPage,
      })
      freePage(page)
      return meta.$send(`[CQ:image,file=base64://${data}]`)
    })
}
