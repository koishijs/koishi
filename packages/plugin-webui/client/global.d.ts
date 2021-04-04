declare module '*.vue' {
  import { Component } from 'vue'

  const component: Component
  export default component
}

declare module '~/server' {
  export * from 'koishi-plugin-webui'
}

declare module '~/client' {
  export * from 'koishi-plugin-webui/client'
}

declare const KOISHI_CONFIG: import('~/server').ClientConfig
