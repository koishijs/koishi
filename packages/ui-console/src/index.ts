/// <reference types="./global"/>

import { ref, watch, Component } from 'vue'
import { createWebHistory, createRouter } from 'vue-router'
import type { DataSource } from '~/server'

export const views: Component[] = []

export const router = createRouter({
  history: createWebHistory(KOISHI_CONFIG.uiPath),
  routes: [],
})

declare module 'vue-router' {
  interface RouteMeta {
    icon?: string
    hidden?: boolean
    require?: (keyof DataSource.Library)[]
  }
}

const prefix = 'koishi:'

export namespace storage {
  export function get(key: string) {
    if (typeof localStorage === 'undefined') return
    const rawData = localStorage.getItem(prefix + key)
    if (!rawData) return
    try {
      return JSON.parse(rawData)
    } catch {}
  }

  export function set(key: string, value: any) {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(prefix + key, JSON.stringify(value))
  }

  export function create<T>(key: string, fallback?: T, merge?: boolean) {
    const value = get(key)
    const wrapper = ref<T>(merge ? { ...fallback, ...value } : value || fallback)
    watch(wrapper, () => set(key, wrapper.value), {
      deep: typeof fallback === 'object',
    })
    return wrapper
  }
}

interface Config {
  authType: 0 | 1
  username?: string
  password?: string
  platform?: string
  userId?: string
  showPass?: boolean
}

export const store = ref<{
  [K in keyof DataSource.Library]?: DataSource.Library[K] extends DataSource<infer T> ? T : never
}>({})

export const config = storage.create<Config>('config', { authType: 0 }, true)
export const socket = ref<WebSocket>(null)

export const listeners: Record<string, (data: any) => void> = {}

export function send(type: string, body: any) {
  socket.value.send(JSON.stringify({ type, body }))
}

export function receive<T = any>(event: string, listener: (data: T) => void) {
  listeners[event] = listener
}

receive('data', ({ key, value }) => store.value[key] = value)
receive('logs/data', data => store.value.logs += data)

export async function sha256(password: string) {
  const data = new TextEncoder().encode(password)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  const view = new DataView(buffer)
  let output = ''
  for (let i = 0; i < view.byteLength; i += 4) {
    output += ('00000000' + view.getUint32(i).toString(16)).slice(-8)
  }
  return output
}
