import { Shooter } from 'puppeteer-core'
import { Context, Logger, noop, Schema, segment, Time } from 'koishi'
import { PNG } from 'pngjs'

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

const logger = new Logger('puppeteer')

export const name = 'screenshot'
export const using = ['puppeteer'] as const

export interface Config {
  loadTimeout?: number
  idleTimeout?: number
  maxSize?: number
  protocols?: string[]
}

export const Config: Schema<Config> = Schema.object({
  protocols: Schema.array(Schema.string()).description('允许的协议列表。').default(['http', 'https']),
  maxSize: Schema.number().description('单张图片的最大尺寸，单位为字节。当截图尺寸超过这个值时会自动截取图片顶部的一段进行发送。').default(1000000),
  loadTimeout: Schema.number().description('加载页面的最长时间。当一个页面等待时间超过这个值时，如果此页面主体已经加载完成，则会发送一条提示消息“正在加载中，请稍等片刻”并继续等待加载；否则会直接提示“无法打开页面”并终止加载。').default(Time.second * 5),
  idleTimeout: Schema.number().description('等待页面空闲的最长时间。当一个页面等待时间超过这个值时，将停止进一步的加载并立即发送截图。').default(Time.second * 30),
}).description('截图设置')

export function apply(ctx: Context, config: Config) {
  const { defaultViewport } = ctx.puppeteer.config.browser
  const { protocols, maxSize, loadTimeout, idleTimeout } = config

  ctx.command('shot <url> [selector:rawtext]', '网页截图', { authority: 2 })
    .alias('screenshot')
    .option('full', '-f  对整个可滚动区域截图')
    .option('viewport', '-v <viewport:string>  指定视口')
    .action(async ({ session, options }, url, selector) => {
      if (!url) return '请输入网址。'
      const scheme = /^(\w+):\/\//.exec(url)
      if (!scheme) {
        url = 'http://' + url
      } else if (!protocols.includes(scheme[1])) {
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
            timeout: idleTimeout,
          }).then(_resolve, () => {
            return loaded ? _resolve() : reject(new Error('navigation timeout'))
          })

          const timer = setTimeout(() => {
            return loaded
              ? session.send('正在加载中，请稍等片刻~')
              : reject(new Error('navigation timeout'))
          }, loadTimeout)
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
        if (buffer.byteLength > maxSize) {
          await new Promise<PNG>((resolve, reject) => {
            const png = new PNG()
            png.parse(buffer, (error, data) => {
              return error ? reject(error) : resolve(data)
            })
          }).then((data) => {
            const width = data.width
            const height = data.height * maxSize / buffer.byteLength
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
}
