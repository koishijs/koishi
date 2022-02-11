import { App, ref, reactive, h, markRaw, defineComponent, resolveComponent, watch, Ref } from 'vue'
import { createWebHistory, createRouter, START_LOCATION, RouteRecordNormalized } from 'vue-router'
import { Disposable, Extension, PageExtension, PageOptions, Store, ViewOptions } from '~/client'
import { ClientConfig, Console } from '@koishijs/plugin-console'
import { Dict } from '@koishijs/utils'

// data api

declare const KOISHI_CONFIG: ClientConfig

export const config = KOISHI_CONFIG

export const store = reactive<Store>({})

const socket = ref<WebSocket>(null)
const listeners: Record<string, (data: any) => void> = {}
const responseHooks: Record<string, [Function, Function]> = {}

export function send(type: string, ...args: any[]) {
  const id = Math.random().toString(36).slice(2, 9)
  socket.value.send(JSON.stringify({ id, type, args }))
  return new Promise((resolve, reject) => {
    responseHooks[id] = [resolve, reject]
    setTimeout(() => {
      delete responseHooks[id]
      reject(new Error('timeout'))
    }, 60000)
  })
}

export function receive<T = any>(event: string, listener: (data: T) => void) {
  listeners[event] = listener
}

receive('data', ({ key, value }) => {
  store[key] = value
})

receive('patch', ({ key, value }) => {
  if (Array.isArray(store[key])) {
    store[key].push(...value)
  } else {
    Object.assign(store[key], value)
  }
})

receive('response', ({ id, value, error }) => {
  if (!responseHooks[id]) return
  const [resolve, reject] = responseHooks[id]
  delete responseHooks[id]
  if (error) {
    reject(error)
  } else {
    resolve(value)
  }
})

export async function connect(endpoint: string) {
  socket.value = new WebSocket(endpoint)

  socket.value.onmessage = (ev) => {
    const data = JSON.parse(ev.data)
    console.debug('%c', 'color:purple', data.type, data.body)
    if (data.type in listeners) {
      listeners[data.type](data.body)
    }
  }

  socket.value.onclose = (ev) => {
    console.log('[koishi] websocket disconnected, will retry in 1s...')
    setTimeout(() => connect(endpoint), 1000)
  }

  return new Promise((resolve) => {
    socket.value.onopen = resolve
  })
}

// layout api

export const views = reactive<Record<string, ViewOptions[]>>({})

export const router = createRouter({
  history: createWebHistory(config.uiPath),
  linkActiveClass: 'active',
  routes: [],
})

export const extensions = reactive<Record<string, Context>>({})

export const routes: Ref<RouteRecordNormalized[]> = ref([])

interface DisposableExtension extends PageExtension {
  ctx: Context
}

export class Context {
  static app: App
  static pending: Dict<DisposableExtension[]> = {}

  public disposables: Disposable[] = []

  addView(options: ViewOptions) {
    options.order ??= 0
    const list = views[options.type] ||= []
    const index = list.findIndex(a => a.order < options.order)
    markRaw(options.component)
    if (index >= 0) {
      list.splice(index, 0, options)
    } else {
      list.push(options)
    }
    this.disposables.push(() => {
      const index = list.findIndex(item => item === options)
      if (index >= 0) list.splice(index, 1)
    })
  }

  addPage(options: PageOptions) {
    const { path, name, component, badge, ...rest } = options
    const dispose = router.addRoute({
      path,
      name,
      component,
      meta: {
        order: 0,
        position: 'top',
        fields: [],
        badge: badge ? [badge] : [],
        ...rest,
      },
    })
    routes.value = router.getRoutes()
    this.disposables.push(() => {
      dispose()
      routes.value = router.getRoutes()
    })
    const route = routes.value.find(r => r.name === name)
    for (const options of Context.pending[name] || []) {
      this.mergeMeta(route, options)
    }
  }

  private mergeMeta(route: RouteRecordNormalized, options: DisposableExtension) {
    const { ctx, fields, badge } = options
    if (fields) route.meta.fields.push(...fields)
    if (badge) route.meta.badge.push(badge)
    ctx.disposables.push(() => {
      const index = route.meta.badge.indexOf(badge)
      if (index >= 0) route.meta.badge.splice(index, 1)
    })
  }

  extendsPage(options: DisposableExtension) {
    const { name } = options
    options.ctx = this
    const route = router.getRoutes().find(r => r.name === name)
    if (route) {
      this.mergeMeta(route, options)
    } else {
      (Context.pending[name] ||= []).push(options)
    }
  }

  install(extension: Extension) {
    extension(this)
  }

  dispose() {
    this.disposables.forEach(dispose => dispose())
  }
}

export function defineExtension(callback: Extension) {
  return callback
}

const initTask = new Promise<void>((resolve) => {
  watch(() => store.http, async (newValue, oldValue) => {
    for (const path in extensions) {
      if (newValue.includes(path)) continue
      extensions[path].dispose()
      delete extensions[path]
    }

    async function loadExtension(path: string) {
      if (extensions[path]) return
      extensions[path] = new Context()

      if (path.endsWith('.css')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = path
        document.head.appendChild(link)
        extensions[path].disposables.push(() => {
          document.head.removeChild(link)
        })
        return
      }

      const exports = await import(/* @vite-ignore */ path)
      exports.default?.(extensions[path])
      if (typeof redirect === 'string') {
        const location = router.resolve(redirect)
        if (location.matched.length) {
          router.replace(location)
        }
      }
    }

    const { redirect } = router.currentRoute.value.query
    await Promise.all(newValue.map((path) => {
      return loadExtension(path).catch(console.error)
    }))

    if (!oldValue) resolve()
  }, { deep: true })
})

router.beforeEach(async (to, from) => {
  if (to.matched.length) return

  if (from === START_LOCATION) {
    await initTask
    to = router.resolve(to)
    if (to.matched.length) return to
  }

  const routes = router.getRoutes()
    .filter(item => item.meta.position === 'top')
    .sort((a, b) => b.meta.order - a.meta.order)
  const path = routes[0]?.path || '/blank'
  return {
    path,
    query: { redirect: to.fullPath },
  }
})

// component helper

export namespace Card {
  export function create(render: Function, fields: readonly (keyof Console.Services)[] = []) {
    return defineComponent({
      render: () => fields.every(key => store[key]) ? render() : null,
    })
  }

  export interface NumericOptions {
    icon: string
    title: string
    type?: string
    fields?: (keyof Console.Services)[]
    content: (store: Store) => any
  }

  export function numeric({ type, icon, fields, title, content }: NumericOptions) {
    const render = type ? () => h(resolveComponent('k-numeric'), {
      icon, title, type, value: content(store), fallback: '未安装',
    }) : () => h(resolveComponent('k-numeric'), {
      icon, title,
    }, () => content(store))
  
    return create(render, fields)
  }
}
