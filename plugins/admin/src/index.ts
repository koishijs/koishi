import { Context } from 'koishi'
import * as admin from './admin'
import * as bind from './bind'
import * as callme from './callme'

export { adminChannel, adminUser } from './admin'

export interface Config extends bind.Config {
  admin?: boolean
  bind?: boolean
  callme?: boolean
}

export const name = 'admin'
export const using = ['database'] as const

export function apply(ctx: Context, config: Config = {}) {
  if (config.admin !== false) ctx.plugin(admin)
  if (config.bind !== false) ctx.plugin(bind, config)
  if (config.callme !== false) ctx.plugin(callme)
}
