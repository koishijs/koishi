/// <reference types="vite/client" />

declare module '*.vue' {
  import { Component } from 'vue'

  const component: Component
  export default component
}

declare module '~/components' {
  import client from '@koishijs/components'

  export default client
  export * from '@koishijs/components'
}

declare module '~/client' {
  import { App, Component } from 'vue'
  import { Console, Events, DataService, ClientConfig } from '@koishijs/plugin-console'

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

  export type Computed<T> = T | (() => T)

  declare module 'vue-router' {
    interface RouteMeta extends RouteMetaExtension {
      fields?: (keyof Console.Services)[]
      badge?: (() => number)[]
    }
  }

  export interface PageExtension {
    name: string
    fields?: (keyof Console.Services)[]
    badge?: () => number
  }

  interface RouteMetaExtension {
    icon?: string
    order?: number
    authority?: number
    position?: Computed<'top' | 'bottom' | 'hidden'>
  }

  export interface PageOptions extends RouteMetaExtension, PageExtension {
    path: string
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
    static app: App
    disposables: Disposable[] = []

    addPage(options: PageOptions): void
    extendsPage(options: PageExtension): void
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

    export function create(render: Function, fields: (keyof Console.Services)[] = []): Component
    export function numeric<T extends keyof Console.Services = never>(options: NumericOptions<T>): Component
  }
}
