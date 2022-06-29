import puppeteer, { Browser, ElementHandle, Page } from 'puppeteer-core'
import { Context, Logger, Schema, segment, Service } from 'koishi'
import { SVG, SVGOptions } from './svg'
import * as screenshot from './screenshot'

export * from './svg'

declare module 'koishi' {
  namespace Context {
    interface Services {
      puppeteer: Puppeteer
    }
  }

  interface EventMap {
    'puppeteer/validate'(url: string): string
  }
}

type LaunchOptions = Parameters<typeof puppeteer.launch>[0]

const LaunchOptions = Schema.intersect([
  Schema.object({
    executablePath: Schema.string().description('Chromium 可执行文件的路径。缺省时将自动从系统中寻找。'),
    defaultViewport: Schema.object({
      width: Schema.natural().description('默认的视图宽度。').default(800),
      height: Schema.natural().description('默认的视图高度。').default(600),
      deviceScaleFactor: Schema.number().min(0).description('默认的设备缩放比率。').default(2),
    }),
  }).description('浏览器设置'),
  Schema.object({
    headless: Schema.boolean().description('是否开启[无头模式](https://developer.chrome.com/blog/headless-chrome/)。').default(true),
    ignoreHTTPSErrors: Schema.boolean().description('在导航时忽略 HTTPS 错误。').default(false),
    args: Schema.array(String).description('额外的浏览器参数。Chromium 参数可以参考[这个页面](https://peter.sh/experiments/chromium-command-line-switches/)。'),
  }).description('高级设置'),
])

type RenderCallback = (page: Page, next: (handle?: ElementHandle) => Promise<string>) => Promise<string>

const logger = new Logger('puppeteer')

class Puppeteer extends Service {
  browser: Browser

  constructor(ctx: Context, public config: Puppeteer.Config) {
    super(ctx, 'puppeteer')
    if (!config.browser.executablePath) {
      const findChrome = require('chrome-finder')
      logger.debug('chrome executable found at %c', config.browser.executablePath = findChrome())
    }
    ctx.plugin(screenshot, this.config.screenshot)
  }

  async start() {
    this.browser = await puppeteer.launch(this.config.browser)
    logger.debug('browser launched')
  }

  async stop() {
    await this.browser?.close()
  }

  page = () => this.browser.newPage()

  svg = (options?: SVGOptions) => new SVG(options)

  render = async (content: string, callback?: RenderCallback) => {
    const page = await this.page()
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

namespace Puppeteer {
  export interface Config {
    browser?: LaunchOptions
    screenshot?: screenshot.Config
  }

  export const Config: Schema<Config> = Schema.object({
    browser: LaunchOptions,
    screenshot: screenshot.Config,
  })
}

export default Puppeteer
