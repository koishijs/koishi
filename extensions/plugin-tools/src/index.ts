import { Context } from 'koishi-core'
import { AlphaOptions } from './alpha'
import { BrainfuckOptions } from './brainfuck'
import { MusicOptions } from './music'
import { TranslateOptions } from './translate'

export interface Options extends AlphaOptions, TranslateOptions {
  brainfuck?: false | BrainfuckOptions
  crypto?: false
  latex?: false
  magi?: false
  maya?: false
  mcping?: false
  music?: false | MusicOptions
  oeis?: false
  qrcode?: false
  weather?: false
}

export const name = 'tools'

export function apply (ctx: Context, config: Options = {}) {
  if (config.wolframAlphaAppId) ctx.plugin(require('./alpha'), config)
  if (config.brainfuck !== false) ctx.plugin(require('./brainfuck'), config.brainfuck)
  if (config.crypto !== false) ctx.plugin(require('./crypto'))
  if (config.latex !== false) ctx.plugin(require('./latex'))
  if (config.magi !== false) ctx.plugin(require('./magi'))
  if (config.maya !== false) ctx.plugin(require('./maya'))
  if (config.mcping !== false) ctx.plugin(require('./mcping'))
  if (config.music !== false) ctx.plugin(require('./music'), config.music)
  if (config.oeis !== false) ctx.plugin(require('./oeis'))
  if (config.qrcode !== false) ctx.plugin(require('./qrcode'))
  if (config.youdaoAppKey) ctx.plugin(require('./translate'), config)
  if (config.weather !== false) ctx.plugin(require('./weather'))
}
