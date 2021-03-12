// I don't know why do I need this
// this should be provided by vue

declare module '*.vue' {
  import { Component } from 'vue'

  const component: Component
  export default component
}

declare module '~/server' {
  export * from 'koishi-plugin-status/server/webui'
}

declare module '~/client' {
  export * from 'koishi-plugin-status/client'
}

declare module '~/layout' {
  export * from 'koishi-plugin-status/client/app.vue'
}

declare const KOISHI_ENDPOINT: string
