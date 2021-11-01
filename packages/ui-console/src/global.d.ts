declare module '*.vue' {
  import { Component } from 'vue'

  const component: Component
  export default component
}

declare module '~/client' {
  export * from '@koishijs/ui-console'
}

declare const KOISHI_CONFIG: import('@koishijs/plugin-console').ClientConfig
