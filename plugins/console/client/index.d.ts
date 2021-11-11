/// <reference types="vite/client" />

declare module '*.vue' {
  import { Component } from 'vue'

  const component: Component
  export default component
}

declare module '~/client' {
  import { Component, Ref } from 'vue'
  import { EChartsOption } from 'echarts'
  import { Console, DataSource, ClientConfig } from '@koishijs/plugin-console'

  // data api

  export type Store = {
    [K in keyof Console.Sources]?: Console.Sources[K] extends DataSource<infer T> ? T : never
  }

  export const config: ClientConfig
  export const store: Ref<Store>

  export function send(type: string, body: any): void
  export function receive<T = any>(event: string, listener: (data: T) => void): void

  // layout api

  export interface PageOptions {
    path: string
    name: string
    icon?: string
    order?: number
    hidden?: boolean
    fields?: (keyof Console.Sources)[]
    component: Component
  }

  export interface ViewOptions {
    id?: string
    type: string
    order?: number
    component: Component
  }

  export function registerPage(options: PageOptions): void
  export function registerView(options: ViewOptions): void

  // component helper

  export namespace Card {
    export interface NumericOptions {
      icon: string
      title: string
      type?: string
      fields?: (keyof Console.Sources)[]
      content: (store: Store) => any
    }

    export interface ChartOptions {
      title: string
      fields?: (keyof Console.Sources)[]
      options: (store: Store) => EChartsOption
    }

    export function numeric(options: NumericOptions): Component
    export function echarts(options: ChartOptions): Component
  }
}
