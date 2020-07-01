import { onApp } from '..'

declare module '../app' {
  interface AppOptions {
    blackList?: string[]
  }
}

onApp((app) => {
  app.prependMiddleware((meta, next) => {
    for (const word of app.options.blackList || []) {
      if (meta.message.includes(word)) return
    }
    return next()
  })
})
