import { App, Dict } from 'koishi'
import { Socket } from 'net'
import * as http from 'http'

export namespace Webhook {
  export interface Response {
    code: number
    body: string
    headers: Dict<any>
  }
}

export class Webhook {
  constructor(public app: App) {}

  get(path: string, headers?: Dict<any>) {
    return this.request('GET', path, headers, '')
  }

  post(path: string, body: any, headers?: Dict<any>) {
    return this.request('POST', path, {
      ...headers,
      'content-type': 'application/json',
    }, JSON.stringify(body))
  }

  private request(method: string, path: string, headers: Dict<any>, content: string) {
    const socket = new Socket()
    const req = new http.IncomingMessage(socket)
    req.url = path
    req.method = method
    Object.assign(req.headers, headers)
    req.headers['content-length'] = '' + content.length
    return new Promise<Webhook.Response>((resolve) => {
      const res = new http.ServerResponse(req)
      let body = ''
      res.write = (chunk: any) => {
        body += chunk
        return true
      }
      res.end = (chunk: any) => {
        res.write(chunk)
        const code = res.statusCode
        const headers = res.getHeaders()
        resolve({ code, body, headers })
      }
      this.app._httpServer.emit('request', req, res)
      req.emit('data', content)
      req.emit('end')
    })
  }
}
