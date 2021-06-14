import * as K from 'koishi-core'

const map = new WeakMap<{}, K.Disposable[]>()

export interface PluginContext<T = any> extends K.Plugin.Object<T>, K.Context {}

export class PluginContext<T = any> {
  protected config: T
}

type PluginStatic = typeof K.Plugin & (<T extends new () => any>(name: string) => (factory: T) => T)

export type Plugin = K.Plugin

export const Plugin = ((name) => (factory) => {
  return class {
    name = name
    apply(context: K.Context, options: any) {
      const instance = Object.create(context)
      instance.options = options
      const cbs = map.get(factory.prototype) || []
      cbs.forEach(cb => cb.call(instance))
    }
  }
}) as PluginStatic

Object.assign(Plugin, K.Plugin)

export type Middleware = K.Middleware

export const Middleware: MethodDecorator = (target, key, desc) => {
  if (!map.has(target)) map.set(target, [])
  map.get(target).push(function() {
    this.middleware(desc.value)
  })
}
