/* eslint-disable no-undef */

import { ref, watch } from 'vue'
import type { User } from 'koishi-core'
import type { Registry, Profile, Statistics } from '~/server'

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

  export function create<T>(key: string, fallback?: T) {
    const wrapper = ref<T>(fallback && { ...fallback, ...get(key) })
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

export const user = storage.create<User>('user')
export const config = storage.create<Config>('config', { authType: 0 })
export const profile = ref<Profile>(null)
export const registry = ref<Registry>(null)
export const stats = ref<Statistics>(null)
export const socket = ref<WebSocket>(null)

const listeners: Record<string, (data: any) => void> = {}

export function start() {
  socket.value = new WebSocket(KOISHI_ENDPOINT.replace(/^http/, 'ws'))
  socket.value.onmessage = (ev) => {
    const data = JSON.parse(ev.data)
    console.log(data)
    if (data.type in listeners) {
      listeners[data.type](data.body)
    }
  }
  receive('profile', data => profile.value = data)
  receive('registry', data => registry.value = data)
  receive('stats', data => stats.value = data)
  receive('user', data => user.value = data)
}

export function send(type: string, body: any) {
  socket.value.send(JSON.stringify({ type, body }))
}

export function receive<T = any>(event: string, listener: (data: T) => void) {
  listeners[event] = listener
}

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
