import puppeteer, { Browser, ElementHandle, Page, Shooter, Viewport } from 'puppeteer-core'
import { Context, Logger, hyphenate, noop, segment, Schema, Time } from 'koishi'
import { escape } from 'querystring'
import { PNG } from 'pngjs'
import { resolve } from 'path'
import {} from '@koishijs/plugin-eval'
import { SVG, SVGOptions } from './svg'

export * from './svg'

// workaround puppeteer typings downgrade
declare module 'puppeteer-core/lib/types' {
  interface Base64ScreenshotOptions extends ScreenshotOptions {
    encoding: 'base64'
  }

  interface BinaryScreenshotOptions extends ScreenshotOptions {
    encoding?: 'binary'
  }

  interface Shooter {
    screenshot(options?: Base64ScreenshotOptions): Promise<string>
    screenshot(options?: BinaryScreenshotOptions): Promise<Buffer>
  }

  interface Page extends Shooter {
    screenshot(options?: Base64ScreenshotOptions): Promise<string>
    screenshot(options?: BinaryScreenshotOptions): Promise<Buffer>
  }

  interface ElementHandle extends Shooter {
    screenshot(options?: Base64ScreenshotOptions): Promise<string>
    screenshot(options?: BinaryScreenshotOptions): Promise<Buffer>
  }
}

declare module 'koishi' {
  interface Services {
    puppeteer: Puppeteer
  }

  interface Module {
    puppeteer: typeof import('.')
  }

  interface EventMap {
    'puppeteer/start'(): void
    'puppeteer/validate'(url: string): string
  }
}

type LaunchOptions = Parameters<typeof puppeteer.launch>[0]

type RenderCallback = (page: Page, next: (handle?: ElementHandle) => Promise<string>) => Promise<string>

export interface Config {
  browser?: LaunchOptions
  renderViewport?: Partial<Viewport>
  loadTimeout?: number
  idleTimeout?: number
  maxSize?: number
  protocols?: string[]
  bodyStyle?: Record<string, string>
}

export const schema: Schema<Config> = Schema.object({
  browser: Schema.object({
    executablePath: Schema.string('Chromium 可执行文件的路径。缺省时将自动从系统中寻找。'),
    viewPort: Schema.object({
      width: Schema.number('默认的视图宽度。').default(800),
      height: Schema.number('默认的视图高度。').default(600),
      deviceScaleFactor: Schema.number('默认的设备缩放比率。').default(2),
    }),
  }, true, '浏览器设置'),
  maxSize: Schema.number('单张图片的最大尺寸，单位为字节。当截图尺寸超过这个值时会自动截取图片顶部的一段进行发送。').default(1000000),
  loadTimeout: Schema.number('加载页面的最长时间。当一个页面等待时间超过这个值时，如果此页面主体已经加载完成，则会发送一条提示消息“正在加载中，请稍等片刻”并继续等待加载；否则会直接提示“无法打开页面”并终止加载。').default(Time.second * 10),
  idleTimeout: Schema.number('等待页面空闲的最长时间。当一个页面等待时间超过这个值时，将停止进一步的加载并立即发送截图。').default(Time.second * 30),
})

enum Status { close, opening, open, closing }

export class Puppeteer {
  status = Status.close
  browser: Browser
  private promise: Promise<Browser>

  constructor(private context: Context, public config: Config) {
    if (!config.browser.executablePath) {
      const findChrome = require('chrome-finder')
      logger.debug('chrome executable found at %c', config.browser.executablePath = findChrome())
    }
  }

  launch = async () => {
    this.status = Status.opening
    this.browser = await (this.promise = puppeteer.launch(this.config.browser))
    this.status = Status.open
    logger.debug('browser launched')
    this.context.emit('puppeteer/start')
  }

  close = async () => {
    this.status = Status.closing
    await this.browser?.close()
    this.status = Status.close
  }

  page = () => this.browser.newPage()

  svg = (options?: SVGOptions) => new SVG(options)

  render = async (content: string, callback?: RenderCallback) => {
    if (this.status === Status.opening) {
      await this.promise
    } else if (this.status !== Status.open) {
      throw new Error('browser instance is not running')
    }

    const page = await this.page()
    await page.setViewport({
      ...this.config.browser.defaultViewport,
      ...this.config.renderViewport,
    })
    if (content) await page.setContent(content)

    callback ||= async (_, next) => page.$('body').then(next)
    const output = await callback(page, async (handle) => {
      const clip = handle ? await handle.boundingBox() : null
      const buffer = await page.screenshot({ clip })
      return segment.image(buffer)
    })

    page.close()
    return output
  }
}

export const defaultConfig: Config = {
  browser: {},
  loadTimeout: 10000, // 10s
  idleTimeout: 30000, // 30s
  maxSize: 1000000, // 1MB
  protocols: ['http', 'https'],
  renderViewport: {
    width: 800,
    height: 600,
    deviceScaleFactor: 2,
  },
  bodyStyle: {
    display: 'inline-block',
    padding: '0.25rem 0.375rem',
  },
}

Context.service('puppeteer')

const logger = new Logger('puppeteer')

export const name = 'puppeteer'

export function apply(ctx: Context, config: Config = {}) {
  config = { ...defaultConfig, ...config }
  const { defaultViewport } = config.browser

  ctx.on('connect', async () => {
    ctx.puppeteer = new Puppeteer(ctx, config)
    await ctx.puppeteer.launch().catch((error) => {
      logger.error(error)
      ctx.dispose()
    })
  })

  ctx.on('disconnect', async () => {
    await ctx.puppeteer?.close()
    delete ctx.puppeteer
  })

  const ctx1 = ctx.intersect(sess => !!sess.app.puppeteer)
  ctx1.command('shot <url> [selector:rawtext]', '网页截图', { authority: 2 })
    .alias('screenshot')
    .option('full', '-f  对整个可滚动区域截图')
    .option('viewport', '-v <viewport:string>  指定视口')
    .action(async ({ session, options }, url, selector) => {
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
      const page = await ctx.puppeteer.page()
      page.on('load', () => loaded = true)

      try {
        if (options.viewport) {
          const viewport = options.viewport.split('x')
          const width = +viewport[0]
          const height = +viewport[1]
          if (width !== defaultViewport?.width || height !== defaultViewport?.height) {
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

      const shooter: Shooter = selector ? await page.$(selector) : page
      if (!shooter) return '找不到满足该选择器的元素。'

      return shooter.screenshot({
        fullPage: options.full,
      }).then(async (buffer) => {
        if (buffer.byteLength > config.maxSize) {
          await new Promise<PNG>((resolve, reject) => {
            const png = new PNG()
            png.parse(buffer, (error, data) => {
              return error ? reject(error) : resolve(data)
            })
          }).then((data) => {
            const width = data.width
            const height = data.height * config.maxSize / buffer.byteLength
            const png = new PNG({ width, height })
            data.bitblt(png, 0, 0, width, height, 0, 0)
            buffer = PNG.sync.write(png)
          }).catch(noop)
        }
        return segment.image(buffer)
      }, (error) => {
        logger.debug(error)
        return '截图失败。'
      }).finally(() => page.close())
    })

  ctx1.command('tex <code:rawtext>', 'TeX 渲染', { authority: 2 })
    .usage('渲染器由 https://www.zhihu.com/equation 提供。')
    .action(async (_, tex) => {
      if (!tex) return '请输入要渲染的 LaTeX 代码。'
      return ctx.puppeteer.render(null, async (page, next) => {
        await page.goto('https://www.zhihu.com/equation?tex=' + escape(tex))
        const svg = await page.$('svg')
        const inner: string = await svg.evaluate((node: SVGElement) => {
          node.style.padding = '0.25rem 0.375rem'
          return node.innerHTML
        })
        const text = inner.match(/>([^<]+)<\/text>/)
        return text ? text[1] : next(svg)
      })
    })

  ctx1.with(['eval'], (ctx) => {
    ctx.worker.config.loaderConfig.jsxFactory = 'jsxFactory'
    ctx.worker.config.loaderConfig.jsxFragment = 'jsxFragment'
    ctx.worker.config.setupFiles['puppeteer.ts'] = resolve(__dirname, 'worker')

    ctx.before('eval/send', (content) => {
      return segment.transformAsync(content, {
        async fragment({ content }) {
          const style = Object
            .entries(config.bodyStyle)
            .map(([key, value]) => `${hyphenate(key)}: ${value};`)
            .join('')
          return await ctx.puppeteer.render(`<!doctype html>
            <html><body style="${style}">${content}</body></html>
          `, async (page, next) => next(await page.$('body')))
        },
      })
    })
  })
}
