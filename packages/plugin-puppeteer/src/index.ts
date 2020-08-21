import { launch, LaunchOptions, Browser } from 'puppeteer-core'
import { Context } from 'koishi-core'
import { Logger, defineProperty, noop } from 'koishi-utils'
import { escape } from 'querystring'
import { PNG } from 'pngjs'
export * from './svg'

declare module 'koishi-core/dist/app' {
  interface App {
    browser: Browser
  }
}

declare module 'koishi-core/dist/context' {
  interface EventMap {
    'puppeteer/validate'(url: string): string
  }
}

const logger = Logger.create('puppeteer')

export interface Config {
  browser?: LaunchOptions
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

export function apply(ctx: Context, config: Config = {}) {
  config = { ...defaultConfig, ...config }
  const { executablePath, defaultViewport } = config.browser

  const { app } = ctx
  ctx.on('before-connect', async () => {
    try {
      if (!executablePath) {
        const findChrome = require('chrome-finder')
        logger.info('finding chrome executable path...')
        config.browser.executablePath = findChrome()
      }
      defineProperty(app, 'browser', await launch(config.browser))
      logger.info('browser launched')
    } catch (error) {
      logger.error(error)
      ctx.dispose()
    }
  })

  ctx.on('before-disconnect', async () => {
    await app.browser?.close()
  })

  ctx.command('shot <url>', '网页截图', { authority: 2 })
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
      const page = await app.browser.newPage()
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

        await new Promise((resolve, reject) => {
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
              ? session.$send('正在加载中，请稍等片刻~')
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
        return `[CQ:image,file=base64://${buffer.toString('base64')}]`
      }, (error) => {
        logger.debug(error)
        return '截图失败。'
      }).finally(() => page.close())
    })

  ctx.command('tex <code...>', 'TeX 渲染', { authority: 2 })
    .option('scale', '-s <scale>  缩放比例', { fallback: 2 })
    .usage('渲染器由 https://www.zhihu.com/equation 提供。')
    .action(async ({ options }, tex) => {
      if (!tex) return '请输入要渲染的 LaTeX 代码。'
      const page = await app.browser.newPage()
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
        const buffer = await page.screenshot({
          clip: await svg.boundingBox(),
        })
        page.close()
        return `[CQ:image,file=base64://${buffer.toString('base64')}]`
      }
    })
}
