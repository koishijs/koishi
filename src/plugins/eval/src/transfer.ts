import { MessagePort, Worker } from 'worker_threads'
import { Logger, noop, Random } from 'koishi-utils'

type Endpoint = MessagePort | Worker

interface Message {
  uuid: string
  type: 'apply'
  key?: string
  args?: any[]
  value?: any
}

const logger = new Logger('transfer')

export function request(ep: Endpoint, payload: Partial<Message>) {
  const uuid = Random.uuid()
  return new Promise<Message>((resolve) => {
    ep.on('message', function listener(data: string) {
      const message = JSON.parse(data)
      if (message.uuid !== uuid) return
      ep.off('message', listener)
      resolve(message)
    })
    logger.debug('[request] %o', { uuid, ...payload })
    ep.postMessage(JSON.stringify({ uuid, ...payload }))
  })
}

function wrapFunction(ep: Endpoint, key: string) {
  return new Proxy(noop, {
    async apply(target, thisArg, args) {
      const message = await request(ep, { type: 'apply', key, args })
      return message.value
    },
  })
}

export type Promisify<T> = T extends Promise<unknown> ? T : Promise<T>
export type RemoteFunction<T> = T extends (...args: infer R) => infer S ? (...args: R) => Promisify<S> : never
export type Remote<T> = { [P in keyof T]: RemoteFunction<T[P]> }

export function wrap<T>(ep: Endpoint) {
  return new Proxy({} as Remote<T>, {
    get(target, key) {
      if (typeof key !== 'string') return
      return wrapFunction(ep, key)
    },
  })
}

export function expose(ep: Endpoint, object: {}) {
  ep.on('message', async (data: string) => {
    const payload = JSON.parse(data)
    logger.debug('[receive] %o', payload)
    const { type, key, uuid, args } = payload
    if (type !== 'apply') return
    const value = await object[key](...args)
    ep.postMessage(JSON.stringify({ uuid, value }))
  })
}
