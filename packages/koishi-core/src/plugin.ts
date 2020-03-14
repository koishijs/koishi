import * as koishi from './koishi'
import { errors } from './messages'

export type Koishi = typeof koishi
export type PluginFunction <T, U = any> = (ctx: T, options: U) => void
export type PluginObject <T, U = any> = { name?: string, apply: PluginFunction<T, U> }
export type Plugin <T, U = any> = PluginFunction<T, U> | PluginObject<T, U>

const installedPlugins = new Set<Plugin<Koishi>>()

export function use <T extends PluginFunction<Koishi>> (plugin: T, options?: T extends PluginFunction<Koishi, infer U> ? U : never): void
export function use <T extends PluginObject<Koishi>> (plugin: T, options?: T extends PluginObject<Koishi, infer U> ? U : never): void
export function use <T extends Plugin<Koishi>> (plugin: T, options?: T extends Plugin<Koishi, infer U> ? U : never) {
  if (installedPlugins.has(plugin)) return
  installedPlugins.add(plugin)
  if (typeof plugin === 'function') {
    (plugin as PluginFunction<Koishi>)(koishi, options)
  } else if (plugin && typeof plugin === 'object' && typeof plugin.apply === 'function') {
    (plugin as PluginObject<Koishi>).apply(koishi, options)
  } else {
    throw new Error(errors.INVALID_PLUGIN)
  }
}
