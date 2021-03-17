/* eslint-disable no-undef */

import { ref } from 'vue'
import type { Payload } from '~/server'

export const status = ref<Payload>(null)
export const socket = ref<WebSocket>(null)

export function start() {
  socket.value = new WebSocket(KOISHI_ENDPOINT.replace(/^http/, 'ws'))
  receive('update', body => status.value = body)
}

export function send(data: any) {
  socket.value.send(JSON.stringify(data))
}

export function receive<T = any>(event: string, listener: (data: T) => void) {
  socket.value.onmessage = (ev) => {
    const data = JSON.parse(ev.data)
    if (data.type === event) {
      console.log(event, data.body)
      listener(data.body)
    }
  }
}

export namespace Storage {
  export function get(key: string) {
    if (typeof localStorage === 'undefined') return
    const rawData = localStorage.getItem(key)
    if (!rawData) return
    try {
      return JSON.parse(rawData)
    } catch {}
  }

  export function set(key: string, value: any) {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key, JSON.stringify(value))
  }
}
