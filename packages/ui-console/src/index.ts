/// <reference types="./global"/>

import { ref, h, Component, markRaw, defineComponent, resolveComponent } from 'vue'
import { createWebHistory, createRouter, RouteRecordRaw } from 'vue-router'
import type { DataSource, Console } from '@koishijs/plugin-console'
import Home from './layout/home.vue'

export const router = createRouter({
  history: createWebHistory(KOISHI_CONFIG.uiPath),
  routes: [],
})

declare module 'vue-router' {
  interface RouteMeta {
    icon?: string
    order?: number
    hidden?: boolean
    require?: (keyof Console.Sources)[]
  }
}

export interface View {
  order: number
  component: Component
}

export const views = ref<Record<string, View[]>>({})

export function addView(name: string, component: Component, order = 0) {
  const list = views.value[name] ||= []
  const index = list.findIndex(a => a.order > order)
  markRaw(component)
  if (index >= 0) {
    list.splice(index, 0, { order, component })
  } else {
    list.push({ order, component })
  }
}

export interface HomeMeta {
  icon: string
  title: string
  order?: number
  type?: string
  when?: () => any
  content: () => any
}

export function addHomeMeta({ when, icon, title, type, order, content }: HomeMeta) {
  const render = type ? () => h(resolveComponent('k-numeric'), {
    icon, title, type, value: content(), fallback: '未安装',
  }) : () => h(resolveComponent('k-numeric'), {
    icon, title,
  }, () => content())

  addView('home-meta', defineComponent({
    render: () => !when || when() ? render() : null,
  }), order)
}

export interface PageOptions {
  path: string
  name: string
  component: Component
  icon?: string
  order?: number
  hidden?: boolean
  require?: (keyof Console.Sources)[]
}

export function addPage(options: PageOptions) {
  const { path, name, component, ...rest } = options
  router.addRoute({
    path,
    name,
    component,
    meta: {
      order: 0,
      require: [] as any,
      ...rest,
    },
  })
}

addPage({
  path: '/',
  name: '仪表盘',
  icon: 'tachometer-alt',
  component: Home,
})

export const store = ref<{
  [K in keyof Console.Sources]?: Console.Sources[K] extends DataSource<infer T> ? T : never
}>({})

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
    setTimeout(connect, 1000)
  }

  return new Promise((resolve) => {
    socket.value.onopen = resolve
  })
}

export const config = KOISHI_CONFIG
