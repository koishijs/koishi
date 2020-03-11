import { Context } from '..'

export interface ThrottleConfig {
  interval: number
  messages: number
}

declare module '../app' {
  interface AppOptions {
    throttle?: ThrottleConfig | ThrottleConfig[]
  }
}

export default function apply (ctx: Context) {
  const { throttle } = ctx.app.options
  const throttleConfig = !throttle ? [] : Array.isArray(throttle) ? throttle : [throttle]

  const counters: Record<number, number> = {}
  for (const { interval, messages } of throttleConfig) {
    counters[interval] = messages
  }

  ctx.on('before-send', () => {
    for (const { interval } of throttleConfig) {
      counters[interval]--
      setTimeout(() => counters[interval]++, interval)
    }
  })

  ctx.prependMiddleware((meta, next) => {
    for (const interval in counters) {
      if (counters[interval] <= 0) return
    }
    return next()
  })
}
