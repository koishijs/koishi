// I don't know why do I need this
// this should be provided by vue

declare module '*.vue' {
  import { Component } from 'vue'

  const component: Component
  export default component
}
