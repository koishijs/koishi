import * as K from 'koishi-core'

const registry = new WeakMap<Object, Map<Function, (this: K.Context) => void>>()

export interface PluginContext<T = any> extends K.Plugin.Object<T>, K.Context {}

export class PluginContext<T = any> {
  protected config: T
  readonly state: K.Plugin.State<T>
}

type PluginStatic = typeof K.Plugin & (<T extends new () => any>(name?: string) => (factory: T) => T)

export type Plugin = K.Plugin

export const Plugin = ((name) => (factory) => {
  return class {
    name = name
    apply(context: K.Context, config: any) {
      const instance = Object.create(context)
      instance.config = config
      const cbs = registry.get(factory.prototype) || []
      cbs.forEach(cb => cb.call(instance))
      factory.prototype.apply?.call(instance)
    }
  }
}) as PluginStatic

Object.assign(Plugin, K.Plugin)

type MethodDecorator<T = (...args: any[]) => any> = (target: Object, key: string | symbol, desc: TypedPropertyDescriptor<T>) => void | TypedPropertyDescriptor<T>

export type Middleware = K.Middleware

export const Middleware: (prepend?: boolean) => MethodDecorator<K.Middleware> = (prepend) => (target, key, desc) => {
  if (!registry.has(target)) registry.set(target, new Map())
  registry.get(target).set(desc.value, function() {
    this.middleware(desc.value.bind(this), prepend)
  })
}

export const Event: <E extends keyof K.EventMap>(name: E, prepend?: boolean) => MethodDecorator<K.EventMap[E]> = (name, prepend) => (target, key, desc) => {
  if (!registry.has(target)) registry.set(target, new Map())
  registry.get(target).set(desc.value, function() {
    this.on(name, (desc.value as any).bind(this), prepend)
  })
}

export const Before: <E extends keyof K.BeforeEventMap>(name: E, append?: boolean) => MethodDecorator<K.BeforeEventMap[E]> = (name, append) => (target, key, desc) => {
  if (!registry.has(target)) registry.set(target, new Map())
  registry.get(target).set(desc.value, function() {
    this.before(name, (desc.value as any).bind(this), append)
  })
}

type PartialSeletor<R extends any[]> = (...values: R) => MethodDecorator

interface Selector<R extends any[]> extends PartialSeletor<R> {
  except?: PartialSeletor<R>
}

function createPartialSelector<T extends keyof K.Context>(name: T, except?: boolean): PartialSeletor<K.Context[T] extends (...args: infer R) => any ? R : never> {
  return (...values) => (target, key, desc) => {
    const map = registry.get(target)
    const callback = map?.get(desc.value)
    if (!callback) return
    map.set(desc.value, function () {
      let selector: any = this[name]
      if (except) selector = selector.except
      callback.call(selector(...values))
    })
  }
}

function createSelector<T extends keyof K.Context, U>(name: T, target?: U): U & Selector<K.Context[T] extends (...args: infer R) => any ? R : never> {
  const value: any = createPartialSelector(name)
  value.except = createPartialSelector(name, true)
  return Object.assign(value, target)
}

export type User = K.User
export type Channel = K.Channel
export type Platform = K.Platform

export const All = createPartialSelector('all')
export const User = createSelector('user', K.User)
export const Channel = createSelector('channel', K.Channel)
export const Platform = createSelector('platform')
export const Self = createSelector('self')
export const Group = createSelector('group')
export const Private = createSelector('private')
