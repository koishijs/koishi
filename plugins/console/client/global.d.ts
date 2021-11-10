declare module '*.vue' {
  import { Component } from 'vue'

  const component: Component
  export default component
}

declare module '~/client' {
  export * from '@koishijs/plugin-console/client'
}
