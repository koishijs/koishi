import { Context, Schema } from '@koishijs/core'

export interface Config {
  autoRestart?: boolean
  heartbeatInterval?: number
  heartbeatTimeout?: number
}

export const Config: Schema<Config> = Schema.object({
  autoRestart: Schema.boolean().description('在运行时崩溃自动重启。').default(true),
  heartbeatInterval: Schema.number().description('心跳发送间隔。').default(0),
  heartbeatTimeout: Schema.number().description('心跳超时时间。').default(0),
}).description('守护设置').hidden()

Context.Config.list.push(Schema.object({
  daemon: Config,
}))

export const name = 'daemon'

export function apply(ctx: Context, config: Config = {}) {
  function handleSignal(signal: NodeJS.Signals) {
    // prevent restarting when child process is exiting
    if (config.autoRestart) {
      process.send({ type: 'exit' })
    }
    ctx.logger('app').info(`terminated by ${signal}`)
    ctx.parallel('exit', signal).finally(() => process.exit())
  }

  ctx.on('ready', () => {
    process.send({ type: 'start', body: config })
    process.on('SIGINT', handleSignal)
    process.on('SIGTERM', handleSignal)

    config.heartbeatInterval && setInterval(() => {
      process.send({ type: 'heartbeat' })
    }, config.heartbeatInterval)
  })
}
