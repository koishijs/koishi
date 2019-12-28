import axios from 'axios'
import debug from 'debug'
import express, { Express } from 'express'
import { EventEmitter } from 'events'
import { createHmac } from 'crypto'
import { Meta, PostType, MetaTypeMap, SubTypeMap, App, AppOptions } from 'koishi-core'
import { camelCase, snakeCase, sleep } from 'koishi-utils'

export const SERVER_PORT = 15700
export const MAX_TIMEOUT = 1000
export const CLIENT_PORT = 17070
export const SERVER_URL = `http://localhost:${SERVER_PORT}`

let app: Express
const emitter = new EventEmitter()
const showLog = debug('koishi:test')

export function createApp (options: AppOptions = {}) {
  return new App({
    port: CLIENT_PORT,
    server: SERVER_URL,
    selfId: 514,
    ...options,
  })
}

let handler = {}

export function expectReqResToBe (callback: () => Promise<any>, data: object, method: string, query: any, response?: any) {
  return expect(new Promise((resolve) => {
    handler = data
    let method, query
    emitter.once('*', (_method, _query) => {
      method = _method
      query = _query
    })
    callback().then((response) => {
      resolve([method, query, response])
      handler = {}
    })
  })).resolves.toMatchObject([method, query, response])
}

export function createServer () {
  app = express()

  app.get('/:method', (req, res) => {
    showLog('receive', req.params.method, req.query)
    emitter.emit('*', req.params.method, req.query)
    emitter.emit(req.params.method.replace(/_async$/, ''), req.query)
    res.status(200).send({
      data: handler,
      retcode: 0,
    })
  })

  return app.listen(SERVER_PORT)
}

export function createMeta <T extends PostType> (postType: T, type: MetaTypeMap[T], subType: SubTypeMap[T], meta: Meta<T> = {}) {
  meta.postType = postType
  meta[camelCase(postType) + 'Type'] = type
  meta.subType = subType
  return meta
}

export async function postMeta (meta: Meta, port = CLIENT_PORT, secret?: string) {
  const data = snakeCase(meta)
  const headers: object = {}
  if (secret) {
    headers['X-Signature'] = 'sha1=' + createHmac('sha1', secret).update(JSON.stringify(data)).digest('hex')
  }
  showLog('post', data)
  return axios.post(`http://localhost:${port}`, data, { headers })
}

export async function waitFor (method: string, timeout = MAX_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const listener = (query: any) => {
      clearTimeout(timer)
      resolve(query)
    }
    emitter.once(method, listener)
    const timer = setTimeout(() => {
      emitter.off(method, listener)
      reject(new Error('timeout'))
    }, timeout)
  })
}

export class ServerSession {
  action: string

  constructor (public type: MetaTypeMap['message'], userId: number, public meta: Meta<'message'> = {}) {
    if (!meta.selfId) meta.selfId = 514
    meta.postType = 'message'
    meta.messageType = type
    meta.userId = userId
    meta.subType = type === 'private' ? 'friend' : type === 'group' ? 'normal' : undefined
    meta.$ctxType = type === 'private' ? 'user' : type
    meta.$ctxId = meta[`${meta.$ctxType}Id`]
    this.action = `send_${this.type}_msg`
  }

  async waitForResponse (message: string) {
    await postMeta({ ...this.meta, message })
    const response = await waitFor(this.action) as any
    return response.message
  }

  testSnapshot (message: string) {
    return expect(this.waitForResponse(message)).resolves.toMatchSnapshot(message)
  }

  shouldHaveResponse (message: string, response: string) {
    return expect(this.waitForResponse(message)).resolves.toBe(response)
  }

  async shouldHaveNoResponse (message: string): Promise<void> {
    await postMeta({ ...this.meta, message })
    return new Promise((resolve, reject) => {
      const listener = meta => reject(new Error('has response: ' + JSON.stringify(meta)))
      emitter.once(this.action, listener)
      sleep(0).then(() => {
        resolve()
        emitter.off(this.action, listener)
      })
    })
  }
}
