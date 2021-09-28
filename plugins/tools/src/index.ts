import { Context, Schema } from 'koishi'
import { AlphaOptions } from './alpha'
import { BaiduOptions } from './baidu'
import { BrainfuckOptions } from './brainfuck'
import { MusicOptions } from './music'
import { TranslateOptions } from './translate'

declare module 'koishi' {
  interface Modules {
    tools: typeof import('.')
  }
}

export interface Config extends AlphaOptions, TranslateOptions {
  baidu?: false | BaiduOptions
  brainfuck?: false | BrainfuckOptions
  bilibili?: false
  crypto?: false
  magi?: false
  maya?: false
  mcping?: false
  music?: false | MusicOptions
  oeis?: false
  qrcode?: false
  weather?: false
}

export const name = 'tools'

export const schema: Schema<Config> = Schema.object({})

export function apply(ctx: Context, config: Config = {}) {
  ctx.command('tools', '实用工具')

  if (config.wolframAlphaAppId) ctx.plugin(require('./alpha'), config)
  if (config.baidu !== false) ctx.plugin(require('./baidu'), config.baidu)
  if (config.brainfuck !== false) ctx.plugin(require('./brainfuck'), config.brainfuck)
  if (config.bilibili !== false) ctx.plugin(require('./bilibili'))
  if (config.crypto !== false) ctx.plugin(require('./crypto'))
  if (config.magi !== false) ctx.plugin(require('./magi'))
  if (config.maya !== false) ctx.plugin(require('./maya'))
  if (config.mcping !== false) ctx.plugin(require('./mcping'))
  if (config.music !== false) ctx.plugin(require('./music'), config.music)
  if (config.oeis !== false) ctx.plugin(require('./oeis'))
  if (config.qrcode !== false) ctx.plugin(require('./qrcode'))
  if (config.youdaoAppKey) ctx.plugin(require('./translate'), config)
  if (config.weather !== false) ctx.plugin(require('./weather'))
}
