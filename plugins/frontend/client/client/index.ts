import { Console } from '@koishijs/plugin-console'
import { Dict } from 'koishi'
import { App, Component, defineComponent, h, markRaw, reactive, ref, Ref, resolveComponent, watch } from 'vue'
import { createRouter, createWebHistory, RouteRecordNormalized, START_LOCATION } from 'vue-router'
import { config, Store, store } from './data'
import install from './components'
import Overlay from './components/chat/overlay.vue'

export * from './components'
export * from './data'

export default install

// layout api

export type Computed<T> = T | (() => T)

export interface ViewOptions {
  id?: string
  type: string
  order?: number
  component: Component
}

export interface PageExtension {
  name: string
  fields?: (keyof Console.Services)[]
  badge?: () => number
}

interface RouteMetaExtension {
  icon?: string
  order?: number
  authority?: number
  position?: Computed<'top' | 'bottom' | 'hidden'>
}

export interface PageOptions extends RouteMetaExtension, PageExtension {
  path: string
  strict?: boolean
  component: Component
}

declare module 'vue-router' {
  interface RouteMeta extends RouteMetaExtension {
    fields?: (keyof Console.Services)[]
    badge?: (() => number)[]
  }
}

export const views = reactive<Record<string, ViewOptions[]>>({})

export const router = createRouter({
  history: createWebHistory(config.uiPath),
  linkActiveClass: 'active',
  routes: [],
})

export const extensions = reactive<Record<string, Context>>({})

export const routes: Ref<RouteRecordNormalized[]> = ref([])

export type Disposable = () => void
export type Extension = (ctx: Context) => void

interface DisposableExtension extends PageExtension {
  ctx: Context
}

export function getValue<T>(computed: Computed<T>): T {
  return typeof computed === 'function' ? (computed as any)() : computed
}

export class Context {
  static app: App
  static pending: Dict<DisposableExtension[]> = {}

  public disposables: Disposable[] = []

  addView(options: ViewOptions) {
    options.order ??= 0
    options.id ??= Math.random().toString(36).slice(2)
    const list = views[options.type] ||= []
    const index = list.findIndex(a => a.order < options.order)
    markRaw(options.component)
    if (index >= 0) {
      list.splice(index, 0, options)
    } else {
      list.push(options)
    }
    this.disposables.push(() => {
      const index = list.findIndex(item => item.id === options.id)
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
        authority: 0,
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

  extendsPage(options: PageExtension): void
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

const root = new Context()

root.addView({
  type: 'global',
  component: Overlay,
})

export function defineExtension(callback: Extension) {
  return callback
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

  const { redirect } = router.currentRoute.value.query
  if (typeof redirect === 'string') {
    const location = router.resolve(redirect)
    if (location.matched.length) {
      router.replace(location)
    }
  }
}

const initTask = new Promise<void>((resolve) => {
  watch(() => store.http, async (newValue, oldValue) => {
    newValue ||= []
    for (const path in extensions) {
      if (newValue.includes(path)) continue
      extensions[path].dispose()
      delete extensions[path]
    }

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
