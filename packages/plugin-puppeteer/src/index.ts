import { launch, LaunchOptions, Browser, Page } from 'puppeteer-core'
import { Context } from 'koishi-core'
import { Logger, defineProperty, noop } from 'koishi-utils'
import { escape } from 'querystring'
import { PNG } from 'pngjs'
export * from './svg'

declare module 'koishi-core/dist/app' {
  interface App {
    browser: Browser
    _idlePages: Page[]
  }
}

declare module 'koishi-core/dist/context' {
  interface Context {
    getPage (): Promise<Page>
    freePage (page: Page): void
  }
}

const logger = Logger.create('puppeteer')

Context.prototype.getPage = async function getPage (this: Context) {
  if (this.app._idlePages.length) {
    return this.app._idlePages.pop()
  }

  logger.debug('create new page')
  return this.app.browser.newPage()
}

Context.prototype.freePage = function freePage (this: Context, page: Page) {
  this.app._idlePages.push(page)
}

export interface Config {
  browser?: LaunchOptions
  loadTimeout?: number
  idleTimeout?: number
  maxLength?: number
  shot?: false
  latex?: false
}

export const defaultConfig: Config = {
  loadTimeout: 10000, // 10s
  idleTimeout: 30000, // 30s
  maxLength: 1000000, // 1MB
}

const allowedProtocols = ['http', 'https']

export const name = 'puppeteer'

export function apply (ctx: Context, config: Config = {}) {
  config = { ...defaultConfig, ...config }
  defineProperty(ctx.app, '_idlePages', [])

  ctx.on('before-connect', async () => {
    ctx.app.browser = await launch(config.browser)
    logger.info('browser launched')
  })

  ctx.on('before-disconnect', async () => {
    await ctx.app.browser?.close()
  })

  ctx.command('shot <url>', '网页截图', { authority: 2 })
    .alias('screenshot')
    .option('fullPage', '-f  对整个可滚动区域截图')
    .action(async ({ session, options }, url) => {
      if (!url) return '请输入网址。'
      const scheme = /^(\w+):\/\//.exec(url)
      if (!scheme) {
        url = 'http://' + url
      } else if (!allowedProtocols.includes(scheme[1])) {
        return '请输入正确的网址。'
      }

      let loaded = false
      const page = await ctx.getPage()
      page.on('load', () => loaded = true)

      try {
        await new Promise((resolve, reject) => {
          logger.debug(`navigating to ${url}`)
          const _resolve = (...args: any[]) => {
            clearTimeout(timer)
            resolve()
          }

          page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: config.idleTimeout,
          }).then(_resolve, () => loaded ? _resolve() : reject())

          const timer = setTimeout(() => {
            return loaded ? session.$send('正在加载中，请稍等片刻~') : reject()
          }, config.loadTimeout)
        })
      } catch (error) {
        ctx.freePage(page)
        logger.debug(error)
        return '无法打开页面。'
      }

      return page.screenshot({
        fullPage: options.fullPage,
      }).then(async (buffer) => {
        ctx.freePage(page)
        if (buffer.byteLength > config.maxLength) {
          await new Promise<PNG>((resolve, reject) => {
            const png = new PNG()
            png.parse(buffer, (error, data) => {
              return error ? reject(error) : resolve(data)
            })
          }).then((data) => {
            const width = data.width
            const height = data.height * config.maxLength / buffer.byteLength
            const png = new PNG({ width, height })
            data.bitblt(png, 0, 0, width, height, 0, 0)
            buffer = PNG.sync.write(png)
          }).catch(noop)
        }
        return `[CQ:image,file=base64://${buffer.toString('base64')}]`
      }, (error) => {
        ctx.freePage(page)
        logger.debug(error)
        return '截图失败。'
      })
    })

  ctx.command('latex <code...>', 'LaTeX 渲染', { authority: 2 })
    .option('scale', '-s <scale>  缩放比例', { fallback: 2 })
    .usage('渲染器由 https://www.zhihu.com/equation 提供。')
    .action(async ({ session, options }, tex) => {
      if (!tex) return '请输入要渲染的 LaTeX 代码。'
      const page = await ctx.getPage()
      const viewport = page.viewport()
      await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: options.scale,
      })
      await page.goto('https://www.zhihu.com/equation?tex=' + escape(tex))
      const svg = await page.$('svg')
      const inner = await svg.evaluate(node => node.innerHTML)
      const text = inner.match(/>([^<]+)<\/text>/)
      if (text) {
        await session.$send(text[1])
      } else {
        const buffer = await page.screenshot({
          clip: await svg.boundingBox(),
        })
        await session.$send(`[CQ:image,file=base64://${buffer.toString('base64')}]`)
      }
      await page.setViewport(viewport)
      ctx.freePage(page)
    })
}
