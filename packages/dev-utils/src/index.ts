import * as K from 'koishi'

class Registry<T> extends WeakMap<Object, T> {
  constructor(private fallback: () => T) {
    super()
  }

  ensure(target: Object) {
    if (!this.has(target)) this.set(target, this.fallback())
    return this.get(target)
  }
}

const plugins = new Registry(() => new Map<Function, (this: K.Context) => void>())
const commands = new Registry(() => [] as ((this: K.Command) => void)[])

export interface PluginContext<T = any> extends K.Plugin.Object<T>, K.Context {}

export class PluginContext<T = any> {
  readonly state: K.Plugin.State<T>

  protected get config() {
    return this.state.config
  }
}

type PluginStatic = typeof K.Plugin & (<T extends new () => any>(name?: string) => (factory: T) => T)

export type Plugin = K.Plugin

export const Plugin = ((name) => (factory) => {
  return class {
    name = name
    apply(context: K.Context, config: any) {
      const instance = Object.create(context)
      instance.config = config
      const callbacks = plugins.get(factory.prototype)
      callbacks?.forEach(cb => cb.call(instance))
    }
  }
}) as PluginStatic

Object.assign(Plugin, K.Plugin)

type MethodDecorator<T = (...args: any[]) => any>
  = (target: Object, key: string | symbol, desc: TypedPropertyDescriptor<T>)
    => void | TypedPropertyDescriptor<T>

export type Middleware = K.Middleware

export const Middleware: (prepend?: boolean) => MethodDecorator = (prepend) => (target, prop, desc) => {
  plugins.ensure(target).set(desc.value, function () {
    this.middleware(desc.value.bind(this), prepend)
  })
}

export const Apply: MethodDecorator = (target, prop, desc) => {
  plugins.ensure(target).set(desc.value, function () {
    desc.value.call(this)
  })
}

type CommandStatic = typeof K.Command & ((def?: string, config?: K.Command.Config) => MethodDecorator)

export type Command = K.Command

export const Command = ((def, config) => (target, prop, desc) => {
  if (typeof prop !== 'string') return
  plugins.ensure(target).set(desc.value, function () {
    const command = this.command(def || prop, config)
    const callbacks = commands.get(desc.value)
    callbacks?.forEach(cb => cb.call(command))
    command.action(desc.value.bind(this))
  })
}) as CommandStatic

Object.assign(Command, K.Command)

export const Usage = (text: K.Command.Usage): MethodDecorator => (target, prop, desc) => {
  commands.ensure(desc.value).push(function () {
    this.usage(text)
  })
}

export const Example = (text: string): MethodDecorator => (target, prop, desc) => {
  commands.ensure(desc.value).push(function () {
    this.example(text)
  })
}

export const Option = (name: string, def: string, config?: K.Argv.OptionConfig): MethodDecorator => (target, prop, desc) => {
  commands.ensure(desc.value).push(function () {
    this.option(name, def, config)
  })
}

type EventDecorator<T> = <E extends keyof T>(name: E, xpend?: boolean) => MethodDecorator

export const Event: EventDecorator<K.EventMap> = (name, prepend) => (target, prop, desc) => {
  plugins.ensure(target).set(desc.value, function () {
    this.on(name, desc.value.bind(this), prepend)
  })
}

export const Before: EventDecorator<K.BeforeEventMap> = (name, append) => (target, prop, desc) => {
  plugins.ensure(target).set(desc.value, function () {
    this.before(name, desc.value.bind(this), append)
  })
}

export const Select = <T extends keyof K.Session>(key: T, ...values: K.Session[T][]): MethodDecorator => (target, prop, desc) => {
  const map = plugins.get(target)
  const callback = map?.get(desc.value)
  if (!callback) return
  map.set(desc.value, function () {
    callback.call(this.select(key, ...values))
  })
}

export const Unselect = <T extends keyof K.Session>(key: T, ...values: K.Session[T][]): MethodDecorator => (target, prop, desc) => {
  const map = plugins.get(target)
  const callback = map?.get(desc.value)
  if (!callback) return
  map.set(desc.value, function () {
    callback.call(this.unselect(key, ...values))
  })
}

type PartialSeletor<R extends any[]> = (...values: R) => MethodDecorator

interface Selector<R extends any[]> extends PartialSeletor<R> {
  Except?: PartialSeletor<R>
}

type ExtractParameter<U, T extends keyof U> = U[T] extends (...args: infer R) => any ? R : never

function createPartialSelector<T extends keyof K.Context>(name: T, except?: boolean): PartialSeletor<ExtractParameter<K.Context, T>> {
  return (...args) => (target, prop, desc) => {
    const map = plugins.get(target)
    const callback = map?.get(desc.value)
    if (!callback) return
    map.set(desc.value, function () {
      let selector: any = this[name]
      if (except) selector = selector.except
      callback.call(selector(...args))
    })
  }
}

function createSelector<T extends keyof K.Context, U>(name: T, source?: U): U & Selector<ExtractParameter<K.Context, T>> {
  const value: any = createPartialSelector(name)
  value.Except = createPartialSelector(name, true)
  return Object.assign(value, source)
}

interface FieldStatic<T extends keyof K.Tables> {
  Field: (fields: K.FieldCollector<T>) => MethodDecorator
}

type UserStatic = typeof K.User & FieldStatic<'user'>
type ChannelStatic = typeof K.Channel & FieldStatic<'channel'>

const UserStatic = K.User as UserStatic
const ChannelStatic = K.Channel as ChannelStatic

UserStatic.Field = (fields) => (target, prop, desc) => {
  commands.ensure(desc.value).push(function () {
    this.userFields(fields)
  })
}

ChannelStatic.Field = (fields) => (target, prop, desc) => {
  commands.ensure(desc.value).push(function () {
    this.channelFields(fields)
  })
}

export type User = K.User
export type Channel = K.Channel
export type Platform = K.Platform

export const Any = createPartialSelector('any')
export const Never = createPartialSelector('never')
export const User = createSelector('user', UserStatic)
export const Channel = createSelector('channel', ChannelStatic)
export const Platform = createSelector('platform')
export const Self = createSelector('self')
export const Group = createSelector('group')
export const Private = createSelector('private')

export namespace User {
  export type Field = K.User.Field
}

export namespace Channel {
  export type Field = K.Channel.Field
}
