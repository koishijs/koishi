import { Context } from 'koishi-core'
import { resolve } from 'path'
import {} from 'koishi-plugin-eval'
import { assertProperty } from 'koishi-utils'

export interface Config {
  moduleRoot: string
}

declare module 'koishi-plugin-eval/dist/worker' {
  interface WorkerConfig extends Config {}
}

export function apply (ctx: Context, config: Config) {
  Object.assign(ctx.app.evalConfig, config)
  assertProperty(ctx.app.evalConfig, 'moduleRoot')
  ctx.app.evalConfig.setupFiles.push(resolve(__dirname, 'worker'))
}
