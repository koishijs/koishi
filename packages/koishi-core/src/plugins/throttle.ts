import { onApp } from '..'

export interface ThrottleConfig {
  interval: number
  messages: number
}

declare module '../app' {
  interface AppOptions {
    throttle?: ThrottleConfig | ThrottleConfig[]
  }
}

onApp((app) => {
  const { throttle } = app.options
  const throttleConfig = !throttle ? [] : Array.isArray(throttle) ? throttle : [throttle]

  const counters: Record<number, number> = {}
  for (const { interval, messages } of throttleConfig) {
    counters[interval] = messages
  }

  app.on('before-send', () => {
    for (const { interval } of throttleConfig) {
      counters[interval]--
      setTimeout(() => counters[interval]++, interval)
    }
  })

  app.prependMiddleware((meta, next) => {
    for (const interval in counters) {
      if (counters[interval] <= 0) return
    }
    return next()
  })
})
