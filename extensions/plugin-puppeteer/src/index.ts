import { launch, LaunchOptions, Browser, Page } from 'puppeteer-core'
import { Context } from 'koishi-core'
import { Logger } from 'koishi-utils'
export * from './svg'

declare module 'koishi-core/dist/context' {
  interface Context {
    getPage (): Promise<Page>
    freePage (page: Page): void
  }
}

const logger = Logger.create('puppeteer')
let browserPromise: Promise<Browser>
const idlePages: Page[] = []

export async function getPage () {
  if (idlePages.length) {
    return idlePages.pop()
  }

  const browser = await browserPromise
  logger.debug('create new page')
  return browser.newPage()
}

export function freePage (page: Page) {
  idlePages.push(page)
}

Context.prototype.getPage = getPage
Context.prototype.freePage = freePage

export interface Options extends LaunchOptions {}

export const name = 'pupperteer'

export function apply (ctx: Context, config: Options = {}) {
  const logger = ctx.logger('puppeteer')

  ctx.on('connect', () => {
    browserPromise = launch(config)
    browserPromise.then(
      () => logger.debug('browser launched'),
      (error) => logger.warn(error),
    )
  })

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
