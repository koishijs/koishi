/* eslint-disable no-undef */

import { ref } from 'vue'
import type { User } from 'koishi-core'
import type { Payload } from '~/server'

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
}

export const user = ref<User>(storage.get('user'))
export const status = ref<Payload>(null)
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
  receive('update', data => status.value = data)
  receive('user', data => {
    user.value = data
    storage.set('user', data)
  })
}

export function send(type: string, body: any) {
  socket.value.send(JSON.stringify({ type, body }))
}

export function receive<T = any>(event: string, listener: (data: T) => void) {
  listeners[event] = listener
}
