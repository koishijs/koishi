/// <reference types="vite/client" />

declare module '*.vue' {
  import { Component } from 'vue'

  const component: Component
  export default component
}

declare module '~/client' {
  import { Component } from 'vue'
  import { EChartsOption } from 'echarts'
  import { Services, Events, DataSource, ClientConfig } from '@koishijs/plugin-console'

  // data api

  export type Store = {
    [K in keyof Services]?: Services[K] extends DataSource<infer T> ? T : never
  }

  export const config: ClientConfig
  export const store: Store

  export function send<K extends keyof Events>(type: K, ...args: Parameters<Events[K]>): ReturnType<Events[K]>
  export function send(type: string, ...args: any[]): Promise<any>
  export function receive<T = any>(event: string, listener: (data: T) => void): void

  // layout api

  export interface PageOptions {
    path: string
    name: string
    icon?: string
    order?: number
    position?: 'top' | 'bottom' | 'hidden'
    fields?: readonly (keyof Services)[]
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
    export interface NumericOptions<T extends keyof Services> {
      icon: string
      title: string
      type?: string
      fields?: T[]
      content: (store: Pick<Store, T>) => any
    }

    export interface ChartOptions<T extends keyof Services> {
      title: string
      fields?: T[]
      options: (store: Pick<Store, T>) => EChartsOption
    }

    export function numeric<T extends keyof Services = never>(options: NumericOptions<T>): Component
    export function echarts<T extends keyof Services = never>(options: ChartOptions<T>): Component
  }
}
