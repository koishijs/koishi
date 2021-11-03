/// <reference types="./global"/>

import { ref, Component } from 'vue'
import { createWebHistory, createRouter } from 'vue-router'
import type { DataSource } from '@koishijs/plugin-console'

export const router = createRouter({
  history: createWebHistory(KOISHI_CONFIG.uiPath),
  routes: [],
})

declare module 'vue-router' {
  interface RouteMeta {
    icon?: string
    order?: number
    hidden?: boolean
    require?: (keyof DataSource.Library)[]
  }
}

export const views: Record<string, Component[]> = {}

export function addView(name: string, component: Component) {
  (views[name] ||= []).push(component)
}

export const store = ref<{
  [K in keyof DataSource.Library]?: DataSource.Library[K] extends DataSource<infer T> ? T : never
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
receive('logs/data', data => store.value.logs += data)

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
