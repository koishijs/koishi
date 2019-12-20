import axios from 'axios'
import express, { Express } from 'express'
import { EventEmitter } from 'events'
import { createHmac } from 'crypto'
import { Meta, PostType, MetaTypeMap, SubTypeMap } from 'koishi-core'
import { camelCase, snakeCase } from 'koishi-utils'

export const SERVER_PORT = 15700
export const MAX_TIMEOUT = 1000
export const CLIENT_PORT = 17070
export const SERVER_URL = `http://localhost:${SERVER_PORT}`

let app: Express
const emitter = new EventEmitter()

export function createServer () {
  app = express()

  app.get('/:method', (req, res) => {
    emitter.emit(req.params.method, req.query)
    res.status(200).send({
      data: {},
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
  return axios.post(`http://localhost:${port}`, data, { headers })
}

export async function waitFor (method: string) {
  return new Promise((resolve, reject) => {
    const listener = (query: any) => {
      clearTimeout(timer)
      resolve(query)
    }
    emitter.on(method, listener)
    const timer = setTimeout(() => {
      emitter.off(method, listener)
      reject(new Error('timeout'))
    }, MAX_TIMEOUT)
  })
}

export class ServerSession {
  constructor (public type: MetaTypeMap['message'], subType: SubTypeMap['message'], public meta?: Meta<'message'>) {
    meta.postType = 'message'
    meta.messageType = type
    meta.subType = subType
  }

  async send (message: string) {
    await postMeta({ ...this.meta, message })
    const response = await waitFor(`send_${this.type}_msg`) as any
    return response.message
  }

  testSnapshot (message: string) {
    return expect(this.send(message)).resolves.toMatchSnapshot(message)
  }
}
