/// <reference types="vite/client" />

declare module '*.vue' {
  import { Component } from 'vue'

  const component: Component
  export default component
}

declare module '~/client' {
  import { Component } from 'vue'
  import { EChartsOption } from 'echarts'
  import Console, { Events, DataService, ClientConfig } from '@koishijs/plugin-console'

  // data api

  export type Store = {
    [K in keyof Console.Services]?: Console.Services[K] extends DataService<infer T> ? T : never
  }

  export const config: ClientConfig
  export const store: Store

  export function send<K extends keyof Events>(type: K, ...args: Parameters<Events[K]>): ReturnType<Events[K]>
  export function send(type: string, ...args: any[]): Promise<any>
  export function receive<T = any>(event: string, listener: (data: T) => void): void

  // layout api

  declare module 'vue-router' {
    interface RouteMeta extends RouteMetaExtension {}
  }

  interface RouteMetaExtension {
    icon?: string
    order?: number
    fields?: readonly (keyof Console.Services)[]
    position?: 'top' | 'bottom' | 'hidden'
  }

  export interface PageOptions extends RouteMetaExtension {
    path: string
    name: string
    component: Component
  }

  export interface ViewOptions {
    id?: string
    type: string
    order?: number
    component: Component
  }

  export type Disposable = () => void
  export type Extension = (ctx: Context) => void

  export class Context {
    disposables: Disposable[] = []

    addPage(options: PageOptions): void
    addView(options: ViewOptions): void
    install(extension: Extension): void
  }

  export function defineExtension(extension: Extension): Extension

  // component helper

  export namespace Card {
    export interface NumericOptions<T extends keyof Console.Services> {
      icon: string
      title: string
      type?: string
      fields?: T[]
      content: (store: Pick<Store, T>) => any
    }

    export interface ChartOptions<T extends keyof Console.Services> {
      title: string
      fields?: T[]
      options: (store: Pick<Store, T>) => EChartsOption
    }

    export function numeric<T extends keyof Console.Services = never>(options: NumericOptions<T>): Component
    export function echarts<T extends keyof Console.Services = never>(options: ChartOptions<T>): Component
  }
}
