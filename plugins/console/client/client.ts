import { ref, h, Component, markRaw, defineComponent, resolveComponent } from 'vue'
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

export const store = ref<Store>({})

const socket = ref<WebSocket>(null)
const listeners: Record<string, (data: any) => void> = {}

export function send(type: string, body: any) {
  socket.value.send(JSON.stringify({ type, body }))
}

export function receive<T = any>(event: string, listener: (data: T) => void) {
  listeners[event] = listener
}

receive('data', ({ key, value }) => store.value[key] = value)

export async function connect(endpoint: string) {
  socket.value = new WebSocket(endpoint)

  socket.value.onmessage = (ev) => {
    const data = JSON.parse(ev.data)
    console.debug(data)
    if (data.type in listeners) {
      listeners[data.type](data.body)
    }
  }

  socket.value.onclose = () => {
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

export const views = ref<Record<string, ViewOptions[]>>({})

export function registerView(options: ViewOptions) {
  options.order ??= 0
  const list = views.value[options.type] ||= []
  const index = list.findIndex(a => a.order < options.order)
  markRaw(options.component)
  if (index >= 0) {
    list.splice(index, 0, options)
  } else {
    list.push(options)
  }
}

export interface PageOptions {
  path: string
  name: string
  icon?: string
  order?: number
  hidden?: boolean
  fields?: (keyof Console.Sources)[]
  component: Component
}

export const router = createRouter({
  history: createWebHistory(KOISHI_CONFIG.uiPath),
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
      fields: [] as any,
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
  function createFieldComponent(render: Function, fields?: (keyof Console.Sources)[]) {
    return defineComponent({
      render: () => fields ? fields.every(key => store.value[key]) ? render() : null : render(),
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
      icon, title, type, value: content(store.value), fallback: '未安装',
    }) : () => h(resolveComponent('k-numeric'), {
      icon, title,
    }, () => content(store.value))
  
    return createFieldComponent(render, fields)
  }

  export interface ChartOptions {
    title: string
    fields?: (keyof Console.Sources)[]
    options: (store: Store) => EChartsOption
  }

  export function echarts({ title, fields, options }: ChartOptions) {
    return createFieldComponent(() => {
      const option = options(store.value)
      return h(resolveComponent('k-card'), {
        class: 'frameless',
        title,
      }, option ? h(resolveComponent('k-chart'), {
        option,
        autoresize: true,
      }) : '暂无数据。')
    }, fields)
  }
}
