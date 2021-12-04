import { App, Dict } from 'koishi'
import { Socket } from 'net'
import { ServerResponse, IncomingMessage } from 'http'

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
    return this.receive('GET', path, headers, '')
  }

  post(path: string, body: any, headers?: Dict<any>) {
    return this.receive('POST', path, {
      ...headers,
      'content-type': 'application/json',
    }, JSON.stringify(body))
  }

  private receive(method: string, path: string, headers: Dict<any>, content: string) {
    const socket = new Socket()
    const req = new IncomingMessage(socket)
    req.url = path
    req.method = method
    Object.assign(req.headers, headers)
    req.headers['content-length'] = '' + content.length
    return new Promise<Webhook.Response>((resolve) => {
      const res = new ServerResponse(req)
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
