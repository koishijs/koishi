declare module '*.vue' {
  import { Component } from 'vue'

  const component: Component
  export default component
}

declare module '~/server' {
  export type * from 'koishi'
  export type * from '@koishijs/plugin-console'
}

declare module '~/client' {
  export * from '@koishijs/ui-console'
}

declare const KOISHI_CONFIG: import('~/server').ClientConfig
