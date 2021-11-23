import { ref, reactive, h, Component, markRaw, defineComponent, resolveComponent } from 'vue'
import { createWebHistory, createRouter } from 'vue-router'
import { DataSource, Console, ClientConfig } from '@koishijs/plugin-console'
import { EChartsOption } from 'echarts'
import Home from './layout/home.vue'

// data api

declare const KOISHI_CONFIG: ClientConfig

export const config = KOISHI_CONFIG

type Store = {
  [K in keyof Console.Sources]?: Console.Sources[K] extends DataSource<infer T> ? T : never
}

export const store = reactive<Store>({})

const socket = ref<WebSocket>(null)
const listeners: Record<string, (data: any) => void> = {}
const responseHooks: Record<string, (data: any) => void> = {}

export function send(type: string, ...args: any[]) {
  const id = Math.random().toString(36).substr(2, 9)
  socket.value.send(JSON.stringify({ id, type, args }))
  return new Promise((resolve, reject) => {
    responseHooks[id] = resolve
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

receive('response', ({ id, value }) => {
  const callback = responseHooks[id]
  delete responseHooks[id]
  callback?.(value)
})

export async function connect(endpoint: string) {
  socket.value = new WebSocket(endpoint)

  socket.value.onmessage = (ev) => {
    const data = JSON.parse(ev.data)
    console.debug(data)
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

export interface ViewOptions {
  id?: string
  type: string
  order?: number
  component: Component
}

export const views = reactive<Record<string, ViewOptions[]>>({})

export function registerView(options: ViewOptions) {
  options.order ??= 0
  const list = views[options.type] ||= []
  const index = list.findIndex(a => a.order < options.order)
  markRaw(options.component)
  if (index >= 0) {
    list.splice(index, 0, options)
  } else {
    list.push(options)
  }
}

interface RouteMetaExtension {
  icon?: string
  order?: number
  fields?: (keyof Console.Sources)[]
  position?: 'top' | 'bottom' | 'hidden'
}

export interface PageOptions extends RouteMetaExtension {
  path: string
  name: string
  component: Component
}

declare module 'vue-router' {
  interface RouteMeta extends RouteMetaExtension {}
}

export const router = createRouter({
  history: createWebHistory(KOISHI_CONFIG.uiPath),
  linkActiveClass: 'active',
  routes: [],
})

export function registerPage(options: PageOptions) {
  const { path, name, component, ...rest } = options
  router.addRoute({
    path,
    name,
    component,
    meta: {
      order: 0,
      position: 'top',
      fields: [],
      ...rest,
    },
  })
}

registerPage({
  path: '/',
  name: '仪表盘',
  icon: 'tachometer-alt',
  order: 1000,
  component: Home,
})

// component helper

export namespace Card {
  function createFieldComponent(render: Function, fields: (keyof Console.Sources)[] = []) {
    return defineComponent({
      render: () => fields.every(key => store[key]) ? render() : null,
    })
  }

  export interface NumericOptions {
    icon: string
    title: string
    type?: string
    fields?: (keyof Console.Sources)[]
    content: (store: Store) => any
  }

  export function numeric({ type, icon, fields, title, content }: NumericOptions) {
    const render = type ? () => h(resolveComponent('k-numeric'), {
      icon, title, type, value: content(store), fallback: '未安装',
    }) : () => h(resolveComponent('k-numeric'), {
      icon, title,
    }, () => content(store))
  
    return createFieldComponent(render, fields)
  }

  export interface ChartOptions {
    title: string
    fields?: (keyof Console.Sources)[]
    options: (store: Store) => EChartsOption
  }

  export function echarts({ title, fields, options }: ChartOptions) {
    return createFieldComponent(() => {
      const option = options(store)
      return h(resolveComponent('k-card'), {
        class: 'frameless',
        title,
      }, () => option ? h(resolveComponent('k-chart'), {
        option,
        autoresize: true,
      }) : '暂无数据。')
    }, fields)
  }
}
