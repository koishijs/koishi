import puppeteer from 'puppeteer-core'
import { Context } from 'koishi-core'
import { Logger, defineProperty, noop, segment } from 'koishi-utils'
import { escape } from 'querystring'
import { PNG } from 'pngjs'
export * from './svg'

// workaround puppeteer typings downgrade
declare module 'puppeteer-core/lib/types' {
  interface Base64ScreenshotOptions extends ScreenshotOptions {
    encoding: 'base64'
  }

  interface BinaryScreenshotOptions extends ScreenshotOptions {
    encoding?: 'binary'
  }

  interface Page {
    screenshot(options?: Base64ScreenshotOptions): Promise<string>
    screenshot(options?: BinaryScreenshotOptions): Promise<Buffer>
  }

  interface ElementHandle {
    screenshot(options?: Base64ScreenshotOptions): Promise<string>
    screenshot(options?: BinaryScreenshotOptions): Promise<Buffer>
  }
}

declare module 'koishi-core' {
  interface App {
    browser: puppeteer.Browser
  }

  interface EventMap {
    'puppeteer/validate'(url: string): string
  }
}

const logger = new Logger('puppeteer')

export interface Config {
  browser?: Parameters<typeof puppeteer.launch>[0]
  loadTimeout?: number
  idleTimeout?: number
  maxLength?: number
  protocols?: string[]
}

export const defaultConfig: Config = {
  browser: {},
  loadTimeout: 10000, // 10s
  idleTimeout: 30000, // 30s
  maxLength: 1000000, // 1MB
  protocols: ['http', 'https'],
}

export const name = 'puppeteer'
export const disposable = true

export function apply(ctx: Context, config: Config = {}) {
  config = { ...defaultConfig, ...config }
  const { executablePath, defaultViewport } = config.browser

  ctx.on('connect', async () => {
    try {
      if (!executablePath) {
        const findChrome = require('chrome-finder')
        logger.debug('chrome executable found at %c', config.browser.executablePath = findChrome())
      }
      defineProperty(ctx.app, 'browser', await puppeteer.launch(config.browser))
      logger.debug('browser launched')
    } catch (error) {
      logger.error(error)
      ctx.dispose()
    }
  })

  ctx.before('disconnect', async () => {
    await ctx.app.browser?.close()
  })

  const ctx1 = ctx.intersect(sess => !!sess.app.browser)
  ctx1.command('shot <url>', '网页截图', { authority: 2 })
    .alias('screenshot')
    .option('full', '-f  对整个可滚动区域截图')
    .option('viewport', '-v <viewport>  指定视口', { type: 'string' })
    .action(async ({ session, options }, url) => {
      if (!url) return '请输入网址。'
      const scheme = /^(\w+):\/\//.exec(url)
      if (!scheme) {
        url = 'http://' + url
      } else if (!config.protocols.includes(scheme[1])) {
        return '请输入正确的网址。'
      }

      const result = ctx.bail('puppeteer/validate', url)
      if (typeof result === 'string') return result

      let loaded = false
      const page = await ctx.app.browser.newPage()
      page.on('load', () => loaded = true)

      try {
        if (options.viewport) {
          const viewport = options.viewport.split('x')
          const width = +viewport[0]
          const height = +viewport[1]
          if (width !== defaultViewport.width || height !== defaultViewport.height) {
            await page.setViewport({ width, height })
          }
        }

        await new Promise<void>((resolve, reject) => {
          logger.debug(`navigating to ${url}`)
          const _resolve = () => {
            clearTimeout(timer)
            resolve()
          }

          page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: config.idleTimeout,
          }).then(_resolve, () => {
            return loaded ? _resolve() : reject(new Error('navigation timeout'))
          })

          const timer = setTimeout(() => {
            return loaded
              ? session.send('正在加载中，请稍等片刻~')
              : reject(new Error('navigation timeout'))
          }, config.loadTimeout)
        })
      } catch (error) {
        page.close()
        logger.debug(error)
        return '无法打开页面。'
      }

      return page.screenshot({
        fullPage: options.full,
      }).then(async (buffer) => {
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
        return segment.image('base64://' + buffer.toString('base64'))
      }, (error) => {
        logger.debug(error)
        return '截图失败。'
      }).finally(() => page.close())
    })

  ctx1.command('tex <code:text>', 'TeX 渲染', { authority: 2 })
    .option('scale', '-s <scale>  缩放比例', { fallback: 2 })
    .usage('渲染器由 https://www.zhihu.com/equation 提供。')
    .action(async ({ options }, tex) => {
      if (!tex) return '请输入要渲染的 LaTeX 代码。'
      const page = await ctx.app.browser.newPage()
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
        page.close()
        return text[1]
      } else {
        const base64 = await page.screenshot({
          encoding: 'base64',
          clip: await svg.boundingBox(),
        })
        page.close()
        return segment.image('base64://' + base64)
      }
    })
}
