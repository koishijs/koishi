// I don't know why do I need this
// this should be provided by vue

declare module '*.vue' {
  import { Component } from 'vue'

  const component: Component
  export default component
}

declare module '~/server' {
  import {} from 'koishi-plugin-status/server'
  export * from 'koishi-plugin-status/server/webui'
}

declare module '~/client' {
  export * from 'koishi-plugin-status/client'
}

declare const KOISHI_ENDPOINT: string
declare const KOISHI_UI_PATH: string
