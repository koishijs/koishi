import { AppOptions, App, Meta, appList, WsClient } from 'koishi-core'
import { snakeCase } from 'koishi-utils'
import { EventEmitter } from 'events'
import { Server } from 'ws'
import debug from 'debug'

const showLog = debug('koishi:test')

export const SERVER_PORT = 15700
export const MAX_TIMEOUT = 100
export const CLIENT_PORT = 17070
export const SERVER_URL = `ws://localhost:${SERVER_PORT}`
export const emitter = new EventEmitter()

export function createApp (options: AppOptions = {}) {
  return new App({
    server: SERVER_URL,
    selfId: 514,
    ...options,
  })
}

let _data = {}
let _retcode = 0

export function setResponse (data = {}, retcode = 0) {
  _data = data
  _retcode = retcode
}

let server: Server
export function createServer (port = SERVER_PORT, fail = false) {
  const _server = new Server({ port })
  if (!fail) server = _server

  _server.on('connection', (socket) => {
    if (fail) return socket.send('authorization failed')
    socket.on('message', (data) => {
      const parsed = JSON.parse(data.toString())
      emitter.emit(parsed.action, parsed.params)
      emitter.emit('*', parsed)
      socket.send(JSON.stringify({
        echo: parsed.echo,
        retcode: _retcode,
        data: _data,
      }))
    })
  })

  return _server
}

export function nextTick () {
  return new Promise((resolve, reject) => {
    const listener = () => {
      clearTimeout(timer)
      resolve()
    }
    emitter.once('*', listener)
    const timer = setTimeout(() => {
      emitter.off('*', listener)
      reject()
    }, MAX_TIMEOUT)
  })
}

export function postMeta (meta: Meta) {
  const data = JSON.stringify(snakeCase(meta))
  for (const socket of server.clients) {
    socket.send(data)
  }
  return new Promise((resolve) => {
    const listener = () => {
      resolve()
      for (const app of appList) {
        (app.server as WsClient).socket.off('message', listener)
      }
    }
    for (const app of appList) {
      (app.server as WsClient).socket.on('message', listener)
    }
  })
}
