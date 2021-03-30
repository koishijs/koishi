/* eslint-disable no-undef */

/// <reference types="./global"/>

import { ref, watch, Ref } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import type { User } from 'koishi-core'
import type { Registry, Profile, Meta, Statistics } from '~/server'
import * as client from '~/client'

type Keys<O, T = any> = {
  [K in keyof O]: O[K] extends T ? K : never
}[keyof O]

declare module 'vue-router' {
  interface RouteMeta {
    icon?: string
    hidden?: boolean
    authorize?: boolean
    frameless?: boolean
    require?: Keys<typeof client, Ref>[]
  }
}

export const router = createRouter({
  history: createWebHistory(KOISHI_UI_PATH),
  routes: [],
})

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

export const user = storage.create<User>('user')
export const config = storage.create<Config>('config', { authType: 0 }, true)
export const meta = ref<Meta.Payload>(null)
export const profile = ref<Profile.Payload>(null)
export const registry = ref<Registry.Payload>(null)
export const stats = ref<Statistics.Payload>(null)
export const socket = ref<WebSocket>(null)

const listeners: Record<string, (data: any) => void> = {}

export function start() {
  const endpoint = new URL(KOISHI_ENDPOINT, location.origin).toString()
  socket.value = new WebSocket(endpoint.replace(/^http/, 'ws'))
  socket.value.onmessage = (ev) => {
    const data = JSON.parse(ev.data)
    console.debug(data)
    if (data.type in listeners) {
      listeners[data.type](data.body)
    }
  }
  receive('meta', data => meta.value = data)
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
