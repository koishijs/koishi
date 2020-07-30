import { Context } from 'koishi-core'
import { AlphaOptions } from './alpha'
import { BrainfuckOptions } from './brainfuck'
import { MusicOptions } from './music'
import { RollOptions } from './roll'
import { TranslateOptions } from './translate'

export interface Options extends AlphaOptions, TranslateOptions {
  brainfuck?: false | BrainfuckOptions
  bvid?: false
  crypto?: false
  latex?: false
  magi?: false
  maya?: false
  mcping?: false
  music?: false | MusicOptions
  oeis?: false
  qrcode?: false
  roll?: false | RollOptions
  weather?: false
}

export const name = 'tools'

export function apply (ctx: Context, config: Options = {}) {
  ctx.command('tools', '实用工具')

  if (config.wolframAlphaAppId) ctx.plugin(require('./alpha'), config)
  if (config.brainfuck !== false) ctx.plugin(require('./brainfuck'), config.brainfuck)
  if (config.bvid !== false) ctx.plugin(require('./bvid'))
  if (config.crypto !== false) ctx.plugin(require('./crypto'))
  if (config.latex !== false) ctx.plugin(require('./latex'))
  if (config.magi !== false) ctx.plugin(require('./magi'))
  if (config.maya !== false) ctx.plugin(require('./maya'))
  if (config.mcping !== false) ctx.plugin(require('./mcping'))
  if (config.music !== false) ctx.plugin(require('./music'), config.music)
  if (config.oeis !== false) ctx.plugin(require('./oeis'))
  if (config.qrcode !== false) ctx.plugin(require('./qrcode'))
  if (config.roll !== false) ctx.plugin(require('./roll'), config.roll)
  if (config.youdaoAppKey) ctx.plugin(require('./translate'), config)
  if (config.weather !== false) ctx.plugin(require('./weather'))
}
