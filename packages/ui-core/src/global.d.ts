declare module '*.vue' {
  import { Component } from 'vue'

  const component: Component
  export default component
}

declare module '*.yaml' {
  const data: any
  export default data
}

declare module '*?raw' {
  const content: string
  export default content
}

declare module '*?worker' {
  const worker: new () => Worker
  export default worker
}

interface ImportMeta {
  readonly hot?: {
    readonly data: any

    accept(): void
    accept(cb: (mod: any) => void): void
    accept(dep: string, cb: (mod: any) => void): void
    accept(deps: string[], cb: (mods: any[]) => void): void

    dispose(cb: (data: any) => void): void
    decline(): void
    invalidate(): void

    on(event: string, cb: (...args: any[]) => void): void
  }
}

interface MonacoEnvironment {
  getWorker(moduleId: string, label: string): Worker
}

interface Window {
  MonacoEnvironment: MonacoEnvironment
}
