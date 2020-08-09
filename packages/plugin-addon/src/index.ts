import { Context } from 'koishi-core'
import { resolve } from 'path'
import {} from 'koishi-plugin-eval'

export interface Config {
  moduleRoot: string
}

declare module 'koishi-plugin-eval/dist/worker' {
  interface WorkerConfig extends Config {}
}

export const name = 'addon'

export function apply (ctx: Context, config: Config) {
  Object.assign(ctx.app.evalConfig, config)
  ctx.app.evalConfig.setupFiles.push(resolve(__dirname, 'worker'))
}
