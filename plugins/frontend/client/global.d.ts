/// <reference types="vite/client" />
/// <reference types="element-plus/global" />

declare module '*.vue' {
  import { Component } from 'vue'

  const component: Component
  export default component
}
