import WebSocket from 'ws'
import http from 'http'

export enum WSState {
  CONNECTING,
  OPEN,
  CLOSING,
  CLOSED,
  RECONNECTING,
}

export type WSOptions = WebSocket.ClientOptions | http.ClientRequestArgs

export class WS {
  static retryDelay(times: number): number {
    if (times <= 0) {
      return 500
    } else if (times <= 1) {
      return 1000
    } else if (times <= 2) {
      return 3000
    } else if (times <= 5) {
      return 5000
    } else {
      return 10000
    }
  }

  private _ws?: WebSocket
  private _wsOptions?: WSOptions
  private _retryCount = 0
  private _reconnecting = false
  private _reconnectTimer?: NodeJS.Timeout

  public onOpen?: () => void
  public onClose?: (event: { code: number; reason: string }) => void
  public onReconnect?: (event: { count: number }) => void
  public onError?: (event: { error: any; message: string }) => void
  public onMessage?: (event: { data: any }) => void

  constructor(_wsOptions?: WSOptions) {
    this._wsOptions = _wsOptions
  }

  open(url: string) {
    if (this.state !== WSState.CLOSED) {
      return
    }
    this._connect(url)
  }

  close(code: number, reason: string) {
    if (this.state !== WSState.CLOSED) {
      this._reconnecting = false
      this._close(code, reason)
    }
  }

  send(data: any) {
    if (this.state !== WSState.OPEN) {
      return
    }
    this._ws?.send(JSON.stringify(data))
  }

  get url() {
    return this._ws?.url
  }

  get reconnecting() {
    return this._reconnecting
  }

  get state() {
    if (!this._ws) {
      return WSState.CLOSED
    }
    switch (this._ws.readyState) {
      case WebSocket.CONNECTING: {
        return this._retryCount === 0 ? WSState.CONNECTING : WSState.RECONNECTING
      }
      case WebSocket.OPEN: {
        return WSState.OPEN
      }
      case WebSocket.CLOSING: {
        return WSState.CLOSING
      }
      case WebSocket.CLOSED: {
        return WSState.CLOSED
      }
      default: {
        return WSState.CLOSED
      }
    }
  }

  _connect(url: string) {
    this._ws = new WebSocket(url, this._wsOptions)
    this._ws.binaryType = 'arraybuffer'
    this._ws.onopen = this._onOpen.bind(this)
    this._ws.onclose = this._onClose.bind(this)
    this._ws.onerror = this._onError.bind(this)
    this._ws.onmessage = this._onMessage.bind(this)
  }

  _reconnect(url: string) {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
    }
    this._reconnecting = true
    this._reconnectTimer = setTimeout(() => {
      this._retryCount += 1
      this._connect(url)
      if (this.onReconnect) {
        this.onReconnect({ count: this._retryCount })
      }
    }, WS.retryDelay(this._retryCount))
  }

  _close(code: number, reason: string) {
    this._ws?.close(code, reason)
  }

  _stopReconnect() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = undefined
    }
  }

  _onOpen() {
    this._retryCount = 0
    this._reconnecting = false
    this._stopReconnect()
    if (this.onOpen) {
      this.onOpen()
    }
  }

  _onClose(event: WebSocket.CloseEvent) {
    let reason: string = ''
    if (event.reason) {
      try {
        const data = JSON.parse(event.reason)
        reason = `${data.reason}`
      } catch (err) {
        reason = event.reason
      }
    }
    let needReconnect = false
    if (event.code === 1006) {
      needReconnect = true
    } else if (event.code >= 4000) {
      needReconnect = true
    }
    if (needReconnect) {
      this._reconnect(this.url!!)
    }
    if (this.onClose) {
      this.onClose({ code: event.code, reason })
    }
  }

  _onMessage(event: WebSocket.MessageEvent) {
    if (this.onMessage) {
      this.onMessage({ data: event.data })
    }
  }

  _onError(event: WebSocket.ErrorEvent) {
    if (this.onError) {
      this.onError({ error: event.error, message: event.message })
    }
  }
}
