import { ClientConfig, Console, DataService, Events } from '@koishijs/plugin-console'
import { Promisify } from 'koishi'
import { reactive, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'

interface StorageData<T> {
  version: number
  data: T
}

export function createStorage<T extends object>(key: string, version: number, fallback?: () => T) {
  const storage = useLocalStorage('koishi.console.' + key, {} as StorageData<T>)
  const initial = fallback ? fallback() : {} as T
  if (storage.value.version !== version) {
    storage.value = { version, data: initial }
  } else if (!Array.isArray(storage.value.data)) {
    storage.value.data = { ...initial, ...storage.value.data }
  }
  return reactive<T>(storage.value['data'])
}

export type Store = {
  [K in keyof Console.Services]?: Console.Services[K] extends DataService<infer T> ? T : never
}

declare const KOISHI_CONFIG: ClientConfig
export const config = KOISHI_CONFIG
export const store = reactive<Store>({})

export const socket = ref<WebSocket>(null)
const listeners: Record<string, (data: any) => void> = {}
const responseHooks: Record<string, [Function, Function]> = {}

export function send<T extends keyof Events>(type: T, ...args: Parameters<Events[T]>): Promisify<ReturnType<Events[T]>>
export function send(type: string, ...args: any[]) {
  if (!socket.value) return
  const id = Math.random().toString(36).slice(2, 9)
  socket.value.send(JSON.stringify({ id, type, args }))
  return new Promise((resolve, reject) => {
    responseHooks[id] = [resolve, reject]
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

receive('patch', ({ key, value }) => {
  if (Array.isArray(store[key])) {
    store[key].push(...value)
  } else {
    Object.assign(store[key], value)
  }
})

receive('response', ({ id, value, error }) => {
  if (!responseHooks[id]) return
  const [resolve, reject] = responseHooks[id]
  delete responseHooks[id]
  if (error) {
    reject(error)
  } else {
    resolve(value)
  }
})

export async function connect(endpoint: string) {
  socket.value = new WebSocket(endpoint)

  socket.value.onmessage = (ev) => {
    const data = JSON.parse(ev.data)
    console.debug('%c', 'color:purple', data.type, data.body)
    if (data.type in listeners) {
      listeners[data.type](data.body)
    }
  }

  socket.value.onclose = (ev) => {
    socket.value = null
    for (const key in store) {
      store[key] = undefined
    }
    console.log('[koishi] websocket disconnected, will retry in 1s...')
    setTimeout(() => connect(endpoint), 1000)
  }

  return new Promise((resolve) => {
    socket.value.onopen = resolve
  })
}
