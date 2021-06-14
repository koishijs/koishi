import * as K from 'koishi-core'

const map = new WeakMap<Object, ((this: K.Context) => void)[]>()

export interface PluginContext<T = any> extends K.Plugin.Object<T>, K.Context {}

export class PluginContext<T = any> {
  protected config: T
}

type PluginStatic = typeof K.Plugin & (<T extends new () => any>(name: string) => (factory: T) => T)

export type Plugin = K.Plugin

export const Plugin = ((name) => (factory) => {
  return class {
    name = name
    apply(context: K.Context, config: any) {
      const instance = Object.create(context)
      instance.config = config
      const cbs = map.get(factory.prototype) || []
      cbs.forEach(cb => cb.call(instance))
      factory.prototype.apply?.call(instance)
    }
  }
}) as PluginStatic

Object.assign(Plugin, K.Plugin)

type MethodDecorator<T> = (target: Object, key: string | symbol, desc: TypedPropertyDescriptor<T>) => void

export type Middleware = K.Middleware

export const Middleware: (prepend?: boolean) => MethodDecorator<K.Middleware> = (prepend) => (target, key, desc) => {
  if (!map.has(target)) map.set(target, [])
  map.get(target).push(function() {
    this.middleware(desc.value.bind(this), prepend)
  })
}

export const Event: <E extends keyof K.EventMap>(name: E, prepend?: boolean) => MethodDecorator<K.EventMap[E]> = (name, prepend) => (target, key, desc) => {
  if (!map.has(target)) map.set(target, [])
  map.get(target).push(function() {
    this.on(name, (desc.value as any).bind(this), prepend)
  })
}
