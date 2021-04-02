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

declare const KOISHI_ENDPOINT: string
declare const KOISHI_TITLE: string
declare const KOISHI_UI_PATH: string
declare const KOISHI_DEV_MODE: boolean
