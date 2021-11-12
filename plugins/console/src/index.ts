import { Context, Awaitable, Schema } from 'koishi'
import { Console, SocketHandle, Config } from './server'

export * from './provider'
export * from './server'

declare module 'koishi' {
  namespace Context {
    interface Services {
      console: Console
    }
  }

  interface EventMap {
    'status/validate'(handle: SocketHandle): Awaitable<boolean>
  }

  interface Modules {
    console: typeof import('.')
  }
}

Context.service('console')

const defaultConfig: Config = {
  apiPath: '/status',
  uiPath: '',
  selfUrl: '',
}

export const name = 'status'

export const schema: Schema<Config> = Schema.object({
  uiPath: Schema.string('前端页面呈现的路径。').default(''),
  apiPath: Schema.string('后端 API 服务的路径。').default('/status'),
  selfUrl: Schema.string('Koishi 服务暴露在公网的地址。').comment('与其他需要 selfUrl 配置项的地方不同的是，这里的属性不会继承 app.options.selfUrl 的值。这是因为，由于这里缺省时会使用相对路径，网页依旧可以正常访问。只有你将 uiPath 和 apiPath 分别部署到了不同的端口或域名时，这个选项才建议使用。'),
  open: Schema.boolean('在应用启动后自动在浏览器中打开控制台。'),
  devMode: Schema.boolean('启用调试模式（仅供开发者使用）。'),
})

export function apply(ctx: Context, config: Config = {}) {
  config = { ...defaultConfig, ...config }
  ctx.plugin(Console, config)
}
