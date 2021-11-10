/// <reference types="vite/client" />
/// <reference path="./global.d.ts" />

import { Component, Ref } from 'vue'
import { Console, DataSource, ClientConfig } from '@koishijs/plugin-console'

export interface View {
  order: number
  component: Component
}

export function addView(name: string, component: Component, order?: number): void

export interface HomeMeta {
  icon: string
  title: string
  order?: number
  type?: string
  when?: () => any
  content: () => any
}

export function addHomeMeta(options: HomeMeta): void

export interface PageOptions {
  path: string
  name: string
  component: Component
  icon?: string
  order?: number
  hidden?: boolean
  require?: (keyof Console.Sources)[]
}

export function addPage(options: PageOptions): void

export const config: ClientConfig

export const store: Ref<{
  [K in keyof Console.Sources]?: Console.Sources[K] extends DataSource<infer T> ? T : never
}>

export function send(type: string, body: any): void
export function receive<T = any>(event: string, listener: (data: T) => void): void
