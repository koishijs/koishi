declare module '*.vue' {
  import { Component } from 'vue'

  const component: Component
  export default component
}

declare module '~/server' {
  export * from '@koishijs/plugin-status'
}

declare const KOISHI_CONFIG: import('~/server').ClientConfig
