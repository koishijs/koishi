import { isInteger } from 'koishi-utils'
import { Meta } from './meta'

export function getSenderName (meta: Meta<'message'>) {
  const idString = '' + meta.$user.id
  return meta.$user && idString !== meta.$user.name
    ? meta.$user.name
    : meta.sender
      ? meta.sender.card || meta.sender.nickname
      : idString
}

export function getTargetId (target: string | number) {
  if (typeof target !== 'string' && typeof target !== 'number') return
  let qq = +target
  if (!qq) {
    const capture = /\[CQ:at,qq=(\d+)\]/.exec(target as any)
    if (capture) qq = +capture[1]
  }
  if (!isInteger(qq)) return
  return qq
}
