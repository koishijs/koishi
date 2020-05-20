import { onApp } from '..'

declare module '../meta' {
  interface Meta {
    $_sleep?: number
    $cancelQueued?(): void
    $sendQueued?(message: string | void, ms?: number): Promise<void>
  }
}

onApp((app) => {
  app.on('parse', (meta) => {
    if (meta.postType !== 'message') return

    const hooks: (() => void)[] = []
    meta.$cancelQueued = () => {
      hooks.forEach(Reflect.apply)
    }

    meta.$sendQueued = async (message, ms) => {
      if (!message) return
      return new Promise<void>(async (resolve) => {
        function hook () {
          resolve()
          clearTimeout(timer)
          const index = hooks.indexOf(hook)
          if (index >= 0) hooks.splice(index, 1)
        }
        hooks.push(hook)
        const timer = setTimeout(async () => {
          await meta.$send(message.replace(/\$s/g, meta.$nickname))
          Object.defineProperty(meta, '$_sleep', { value: ms, writable: true })
          hook()
        }, meta.$_sleep || 0)
      })
    }
  })
})
