import { EventEmitter } from 'events'
import { TextDecoder } from 'util'
import WS, { WSState, WSOptions } from './ws'
import pako from 'pako'

export enum GatewayOp {
  DISPATCH = 0,
  HEARTBEAT = 1,
  IDENTIFY = 2,
  HELLO = 3,
  HEARTBEAT_ACK = 4,
  VOICE_STATE_UPDATE = 5,
}

const ab = new TextDecoder('utf-8')

interface SessionOptions {
  zlib?: boolean
  ws?: string
  wsOptions?: WSOptions
}

export default class Session {
  _url: string
  _emitter?: EventEmitter

  _heartbeatTimer?: NodeJS.Timeout
  _heartbeatInterval: number = 40000
  _ws: WS
  _ready: boolean = false
  _connected: boolean = false
  _sessionId?: string
  _inflate?: pako.Inflate

  token: string = ''

  constructor(options?: SessionOptions) {
    this._url = 'https://gateway.tomon.co?compress=zlib-stream'
    this._emitter = new EventEmitter()
    this._ws = new WS(options?.wsOptions)

    this._ws.onOpen = () => {
      console.log('🟢 [ws] open')
      this.handleOpen()
    }
    this._ws.onClose = (event) => {
      console.log('🔴 [ws] close', `code ${event.code}`)
      this.handleClose(event.code, event.reason)
    }
    this._ws.onMessage = (event) => {
      this.handleMessage(event)
    }
    this._ws.onReconnect = (event) => {
      console.log('🟡 [ws] reconnecting')
      this._emitter?.emit('NETWORK_RECONNECTING', event)
    }
  }

  open() {
    this._ws.open(this._url)
  }

  close(code: number, reason: string) {
    this._ws.close(code, reason)
  }

  send(op: number, d?: any) {
    this._ws.send({ op, d })
  }

  get state(): WSState {
    return this._ws.state
  }

  get connected(): boolean {
    return this._connected
  }

  get ready(): boolean {
    return this._ready
  }

  /**
   * handle open
   */
  private handleOpen() {
    this._connected = true
    this._emitter?.emit('NETWORK_CONNECTED')
  }

  /**
   * handle close
   * @param {event} event
   */
  private handleClose(code: number, reason: string) {
    this.stopHeartbeat()
    this._sessionId = undefined
    this._connected = false
    this._ready = false
    this._emitter?.emit('NETWORK_DISCONNECTED')
  }

  private unpack(data: any) {
    if (typeof data !== 'string') {
      data = ab.decode(data)
    }
    return JSON.parse(data)
  }

  private handleMessage(event: { data: any }) {
    let { data } = event
    if (!this._inflate) {
      this._inflate = new pako.Inflate({
        chunkSize: 65535,
        to: 'string',
      })
    }
    if (data instanceof ArrayBuffer) data = new Uint8Array(data)
    const l = data.length
    const flush =
      l >= 4 && data[l - 4] === 0x00 && data[l - 3] === 0x00 && data[l - 2] === 0xff && data[l - 1] === 0xff
    this._inflate.push(data, flush ? 2 : false)
    if (!flush) return
    const raw = this._inflate.result
    this._inflate = undefined
    let packet
    try {
      packet = this.unpack(raw)
    } catch (err) {
      // console.log(err)
    }
    this.handlePacket(packet)
  }

  /**
   * handle socket message
   */
  private handlePacket(data: any) {
    switch (data.op) {
      case GatewayOp.DISPATCH: {
        this._emitter?.emit(data.e, data)
        this._emitter?.emit('DISPATCH', data)
        break
      }
      case GatewayOp.IDENTIFY: {
        this._ready = true
        this._emitter?.emit('READY', data)
        break
      }
      case GatewayOp.HELLO: {
        this._heartbeatInterval = data.d.heartbeat_interval
        this._sessionId = data.d.session_id
        this.heartbeat()
        this._emitter?.emit('HELLO', data)
        this.send(GatewayOp.IDENTIFY, {
          token: this.token,
        })
        break
      }
      case GatewayOp.HEARTBEAT: {
        this.send(GatewayOp.HEARTBEAT_ACK)
        break
      }
      case GatewayOp.HEARTBEAT_ACK: {
        this._emitter?.emit('HEARTBEAT_ACK')
        break
      }
      default: {
        break
      }
    }
  }

  /**
   * heartbeat
   */
  private heartbeat = () => {
    this._emitter?.emit('HEARTBEAT')
    this.send(GatewayOp.HEARTBEAT)
    this._heartbeatTimer = setTimeout(this.heartbeat, this._heartbeatInterval)
  }

  /**
   * stop heartbeat
   */
  private stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearTimeout(this._heartbeatTimer)
      this._heartbeatTimer = undefined
    }
  }
}
