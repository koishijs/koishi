/* eslint-disable no-undef */

/// <reference types="./global"/>

import { ref, watch, reactive, Ref, Component } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import type { User } from 'koishi'
import type { Registry, Profile, Meta, Statistics, Awesome } from '~/server'
import * as client from '~/client'

export const views: Component[] = []

export const store = reactive({
  showOverlay: false,
  overlayImage: null as HTMLImageElement,
})

type Keys<O, T = any> = {
  [K in keyof O]: O[K] extends T ? K : never
}[keyof O]

declare module 'vue-router' {
  interface RouteMeta {
    icon?: string
    hidden?: boolean
    authority?: number
    frameless?: boolean
    require?: Keys<typeof client, Ref>[]
  }
}

export const router = createRouter({
  history: createWebHistory(KOISHI_CONFIG.uiPath),
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
  variant?: string
  userId?: string
  showPass?: boolean
}

export const user = storage.create<User>('user')
export const config = storage.create<Config>('config', { authType: 0 }, true)
export const meta = ref<Meta.Payload>(null)
export const profile = ref<Profile.Payload>(null)
export const awesome = ref<Awesome.PackageData[]>(null)
export const registry = ref<Registry.PluginData[]>(null)
export const stats = ref<Statistics.Payload>(null)
export const socket = ref<WebSocket>(null)

export const listeners: Record<string, (data: any) => void> = {}

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

export interface segment {
  type: string
  data: segment.Data
}

export function segment(type: string, data: segment.Data = {}) {
  if (type === 'text') return segment.escape(String(data.content))
  let output = '[CQ:' + type
  for (const key in data) {
    if (data[key]) output += `,${key}=${segment.escape(data[key], true)}`
  }
  return output + ']'
}

type primitive = string | number | boolean

export namespace segment {
  export type Chain = segment.Parsed[]
  export type Data = Record<string, primitive>
  export type Transformer = string | ((data: Record<string, string>, index: number, chain: Chain) => string)

  export interface Parsed extends segment {
    data: Record<string, string>
    capture?: RegExpExecArray
  }

  export function escape(source: any, inline = false) {
    const result = String(source)
      .replace(/&/g, '&amp;')
      .replace(/\[/g, '&#91;')
      .replace(/\]/g, '&#93;')
    return inline
      ? result.replace(/,/g, '&#44;').replace(/(\ud83c[\udf00-\udfff])|(\ud83d[\udc00-\ude4f\ude80-\udeff])|[\u2600-\u2B55]/g, ' ')
      : result
  }

  export function unescape(source: string) {
    return String(source)
      .replace(/&#91;/g, '[')
      .replace(/&#93;/g, ']')
      .replace(/&#44;/g, ',')
      .replace(/&amp;/g, '&')
  }

  export function join(codes: segment[]) {
    return codes.map(code => segment(code.type, code.data)).join('')
  }

  export function from(source: string, typeRegExp = '\\w+'): segment.Parsed {
    const capture = new RegExp(`\\[CQ:(${typeRegExp})((,\\w+=[^,\\]]*)*)\\]`).exec(source)
    if (!capture) return null
    const [, type, attrs] = capture
    const data: Record<string, string> = {}
    attrs && attrs.slice(1).split(',').forEach((str) => {
      const index = str.indexOf('=')
      data[str.slice(0, index)] = unescape(str.slice(index + 1))
    })
    return { type, data, capture }
  }

  export function parse(source: string) {
    const chain: Chain = []
    let result: segment.Parsed
    while ((result = from(source))) {
      const { capture } = result
      if (capture.index) {
        chain.push({ type: 'text', data: { content: unescape(source.slice(0, capture.index)) } })
      }
      chain.push(result)
      source = source.slice(capture.index + capture[0].length)
    }
    if (source) chain.push({ type: 'text', data: { content: unescape(source) } })
    return chain
  }

  export function transform(source: string, rules: Record<string, Transformer>, dropOthers = false) {
    return parse(source).map(({ type, data, capture }, index, chain) => {
      const transformer = rules[type]
      return typeof transformer === 'string' ? transformer
        : typeof transformer === 'function' ? transformer(data, index, chain)
          : dropOthers ? '' : type === 'text' ? escape(data.content) : capture[0]
    }).join('')
  }

  export type Factory<T> = (value: T, data?: segment.Data) => string

  function createFactory(type: string, key: string): Factory<primitive> {
    return (value, data = {}) => segment(type, { ...data, [key]: value })
  }

  export const at = createFactory('at', 'id')
  export const sharp = createFactory('sharp', 'id')
  export const quote = createFactory('quote', 'id')
  export const image = createFactory('image', 'url')
  export const video = createFactory('video', 'url')
  export const audio = createFactory('audio', 'url')
}
