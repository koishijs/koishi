/**
 * Copyright 2019 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License")
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * modified from https://github.com/GoogleChromeLabs/comlink
 * v4.3.0
 */

import { MessageChannel, MessagePort, Worker } from 'worker_threads'
const proxyMarker = Symbol('Comlink.proxy')
const createEndpoint = Symbol('Comlink.endpoint')
const releaseProxy = Symbol('Comlink.releaseProxy')
const throwMarker = Symbol('Comlink.thrown')

type Endpoint = MessagePort | Worker
type Transferable = ArrayBuffer | MessagePort

interface ProxyMarked {
  [proxyMarker]: true
}

type Promisify<T> = T extends Promise<unknown> ? T : Promise<T>
type Unpromisify<P> = P extends Promise<infer T> ? T : P
type MaybePromise<T> = Promise<T> | T
type RemoteProperty<T> = T extends Function | ProxyMarked ? Remote<T> : Promisify<T>
type LocalProperty<T> = T extends Function | ProxyMarked ? Local<T> : Unpromisify<T>
type ProxyOrClone<T> = T extends ProxyMarked ? Remote<T> : T
type UnproxyOrClone<T> = T extends RemoteObject<ProxyMarked> ? Local<T> : T
type RemoteObject<T> = { [P in keyof T]: RemoteProperty<T[P]> }
type LocalObject<T> = { [P in keyof T]: LocalProperty<T[P]> }

interface ProxyMethods {
  [createEndpoint]: () => Promise<MessagePort>
  [releaseProxy]: () => void
}

export type Remote<T> = RemoteObject<T> & ProxyMethods
  & (T extends (...args: infer P) => infer R
    ? (...args: { [I in keyof P]: UnproxyOrClone<P[I]> }) => Promisify<ProxyOrClone<Unpromisify<R>>>
    : unknown)
  & (T extends new (...args: infer P) => infer R
    ? new (...args: { [I in keyof P]: UnproxyOrClone<P[I]> }) => Promisify<Remote<R>>
    : unknown)

export type Local<T> = Omit<LocalObject<T>, keyof ProxyMethods>
  & (T extends (...args: infer P) => infer R
    ? (...args: { [I in keyof P]: ProxyOrClone<P[I]> }) => MaybePromise<UnproxyOrClone<Unpromisify<R>>>
    : unknown)
  & (T extends new (...args: infer P) => infer R
    ? new (...args: { [I in keyof P]: ProxyOrClone<P[I]>}) => MaybePromise<Local<Unpromisify<R>>>
    : unknown)

enum MessageType {
  GET,
  SET,
  APPLY,
  CONSTRUCT,
  ENDPOINT,
  RELEASE,
  READY,
  ERROR,
}

enum WireValueType {
  RAW,
  PROXY,
  THROW,
  HANDLER,
}

const isObject = (val: unknown): val is object =>
  (typeof val === 'object' && val !== null) || typeof val === 'function'

interface TransferHandler<T, S> {
  canHandle(value: unknown): value is T
  serial(value: T): [S, Transferable[]]
  deserialize(value: S): T
}

const proxyTransferHandler: TransferHandler<object, MessagePort> = {
  canHandle: (val): val is ProxyMarked =>
    isObject(val) && (val as ProxyMarked)[proxyMarker],
  serial (obj) {
    const { port1, port2 } = new MessageChannel()
    expose(obj, port1)
    return [port2, [port2]]
  },
  deserialize (port) {
    port.start()
    return wrap(port)
  },
}

interface ThrownValue {
  [throwMarker]: unknown; // just needs to be present
  value: unknown
}

type SerializedThrownValue =
  | { isError: true; value: Error }
  | { isError: false; value: unknown }

/**
 * Internal transfer handler to handle thrown exceptions.
 */
const throwTransferHandler: TransferHandler<ThrownValue, SerializedThrownValue> = {
  canHandle: (value): value is ThrownValue =>
    isObject(value) && throwMarker in value,
  serial ({ value }) {
    let serialized: SerializedThrownValue
    if (value instanceof Error) {
      serialized = {
        isError: true,
        value: {
          message: value.message,
          name: value.name,
          stack: value.stack,
        },
      }
    } else {
      serialized = { isError: false, value }
    }
    return [serialized, []]
  },
  deserialize (serialized) {
    if (serialized.isError) {
      throw Object.assign(new Error(serialized.value.message), serialized.value)
    }
    throw serialized.value
  },
}

const transferHandlers = new Map<string, TransferHandler<unknown, unknown>>([
  ['proxy', proxyTransferHandler],
  ['throw', throwTransferHandler],
])

export function expose (obj: any, ep: Endpoint) {
  ep.on('message', function callback (data: Message) {
    const { id, type, path = [] } = data
    const argumentList = (data.argumentList || []).map(fromWireValue)
    let returnValue
    try {
      const parent = path.slice(0, -1).reduce((obj, prop) => obj[prop], obj)
      const RawValue = path.reduce((obj, prop) => obj[prop], obj)
      switch (type) {
        case MessageType.GET:
          returnValue = RawValue
          break
        case MessageType.SET:
          parent[path.slice(-1)[0]] = fromWireValue(data.value)
          returnValue = true
          break
        case MessageType.APPLY:
          returnValue = RawValue.apply(parent, argumentList)
          break
        case MessageType.CONSTRUCT:
          returnValue = proxy(new RawValue(...argumentList))
          break
        case MessageType.ENDPOINT: {
          const { port1, port2 } = new MessageChannel()
          expose(obj, port2)
          returnValue = transfer(port1, [port1])
          break
        }
        case MessageType.RELEASE:
          returnValue = undefined
          break
      }
    } catch (value) {
      returnValue = { value, [throwMarker]: 0 }
    }
    Promise.resolve(returnValue)
      .catch((value) => {
        return { value, [throwMarker]: 0 }
      })
      .then((returnValue) => {
        const [wireValue, transferables] = toWireValue(returnValue)
        ep.postMessage({ ...wireValue, id }, transferables)
        if (type === MessageType.RELEASE) {
          // detach and deactive after sending release response above.
          ep.off('message', callback as any)
          closeEndPoint(ep)
        }
      })
  })
}

function isMessagePort (endpoint: Endpoint): endpoint is MessagePort {
  return endpoint.constructor.name === 'MessagePort'
}

function closeEndPoint (endpoint: Endpoint) {
  if (isMessagePort(endpoint)) endpoint.close()
}

export function wrap <T> (ep: Endpoint, target?: any): Remote<T> {
  return createProxy<T>(ep, [], target) as any
}

function throwIfProxyReleased (isReleased: boolean) {
  if (isReleased) {
    throw new Error('Proxy has been released and is not useable')
  }
}

function createProxy<T> (
  ep: Endpoint,
  path: (string | number | symbol)[] = [],
  target: object = function () {},
): Remote<T> {
  let isProxyReleased = false
  const proxy = new Proxy(target, {
    get (_target, prop) {
      throwIfProxyReleased(isProxyReleased)
      if (prop === releaseProxy) {
        return () => {
          return requestResponseMessage(ep, {
            type: MessageType.RELEASE,
            path: path.map((p) => p.toString()),
          }).then(() => {
            closeEndPoint(ep)
            isProxyReleased = true
          })
        }
      }
      if (prop === 'then') {
        if (path.length === 0) {
          return { then: () => proxy }
        }
        const r = requestResponseMessage(ep, {
          type: MessageType.GET,
          path: path.map((p) => p.toString()),
        }).then(fromWireValue)
        return r.then.bind(r)
      }
      return createProxy(ep, [...path, prop])
    },
    set (_target, prop, rawValue) {
      throwIfProxyReleased(isProxyReleased)
      const [value, transferables] = toWireValue(rawValue)
      return requestResponseMessage(ep, {
        type: MessageType.SET,
        path: [...path, prop].map((p) => p.toString()),
        value,
      }, transferables).then(fromWireValue) as any
    },
    apply (_target, _thisArg, rawArgumentList) {
      throwIfProxyReleased(isProxyReleased)
      const last = path[path.length - 1]
      if ((last as any) === createEndpoint) {
        return requestResponseMessage(ep, {
          type: MessageType.ENDPOINT,
        }).then(fromWireValue)
      }
      // We just pretend that `bind()` didn’t happen.
      if (last === 'bind') {
        return createProxy(ep, path.slice(0, -1))
      }
      const [argumentList, transferables] = processArguments(rawArgumentList)
      return requestResponseMessage(
        ep,
        {
          type: MessageType.APPLY,
          path: path.map((p) => p.toString()),
          argumentList,
        },
        transferables,
      ).then(fromWireValue)
    },
    construct (_target, rawArgumentList) {
      throwIfProxyReleased(isProxyReleased)
      const [argumentList, transferables] = processArguments(rawArgumentList)
      return requestResponseMessage(
        ep,
        {
          type: MessageType.CONSTRUCT,
          path: path.map((p) => p.toString()),
          argumentList,
        },
        transferables,
      ).then(fromWireValue)
    },
  })
  return proxy as any
}

function myFlat <T> (arr: (T | T[])[]): T[] {
  return Array.prototype.concat.apply([], arr)
}

function processArguments (argumentList: any[]): [WireValue[], Transferable[]] {
  const processed = argumentList.map(toWireValue)
  return [processed.map((v) => v[0]), myFlat(processed.map((v) => v[1]))]
}

const transferCache = new WeakMap<any, Transferable[]>()
export function transfer (obj: any, transfers: Transferable[]) {
  transferCache.set(obj, transfers)
  return obj
}

export function proxy <T> (obj: T): T & ProxyMarked {
  return Object.assign(obj, { [proxyMarker]: true }) as any
}

function toWireValue (value: any): [WireValue, Transferable[]] {
  for (const [name, handler] of transferHandlers) {
    if (handler.canHandle(value)) {
      const [serializedValue, transferables] = handler.serial(value)
      return [
        {
          type: WireValueType.HANDLER,
          name,
          value: serializedValue,
        },
        transferables,
      ]
    }
  }
  return [
    {
      type: WireValueType.RAW,
      value,
    },
    transferCache.get(value) || [],
  ]
}

function fromWireValue (value: WireValue): any {
  switch (value.type) {
    case WireValueType.HANDLER:
      return transferHandlers.get(value.name)!.deserialize(value.value)
    case WireValueType.RAW:
      return value.value
  }
}

function requestResponseMessage (ep: Endpoint, msg: Message, transfers?: Transferable[]) {
  return new Promise<WireValue>((resolve) => {
    const id = generateUUID()
    ep.once('message', resolve)
    ep.postMessage({ id, ...msg }, transfers)
  })
}

function generateUUID (): string {
  return new Array(4)
    .fill(0)
    .map(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16))
    .join('-')
}

interface RawWireValue {
  id?: string
  type: WireValueType.RAW
  value: {}
}

interface HandlerWireValue {
  id?: string
  type: WireValueType.HANDLER
  name: string
  value: unknown
}

type WireValue = RawWireValue | HandlerWireValue

interface Message {
  id?: string
  type: MessageType
  path?: string[]
  value?: WireValue
  argumentList?: WireValue[]
}

export function status (ep: Endpoint, error?: Error) {
  if (!error) return ep.postMessage({ type: MessageType.READY })
  return ep.postMessage({
    type: MessageType.ERROR,
    stack: error.stack,
  })
}

export function pend (ep: Endpoint) {
  return new Promise<void>((resolve, reject) => {
    ep.on('message', function callback (value) {
      if (value.type === MessageType.READY) {
        ep.off('message', callback)
        resolve()
      } else if (value.type === MessageType.ERROR) {
        ep.off('message', callback)
        reject(value.stack)
      }
    })
  })
}
