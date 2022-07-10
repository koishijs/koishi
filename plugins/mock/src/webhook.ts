import { Context, Dict } from 'koishi'
import { Socket } from 'net'
import { IncomingMessage, ServerResponse } from 'http'

export namespace Webhook {
  export interface Response {
    code: number
    body: string
    headers: Dict<any>
  }
}

export class Webhook {
  constructor(public app: Context) {}

  async head(path: string, headers?: Dict<any>) {
    const res = await this.receive('HEAD', path, headers, '')
    return res.headers
  }

  async get(path: string, headers?: Dict<any>) {
    return this.receive('GET', path, headers, '')
  }

  async delete(path: string, headers?: Dict<any>) {
    return this.receive('DELETE', path, headers, '')
  }

  async post(path: string, body: any, headers?: Dict<any>) {
    return this.receive('POST', path, headers, body)
  }

  async put(path: string, body: any, headers?: Dict<any>) {
    return this.receive('PUT', path, headers, body)
  }

  async patch(path: string, body: any, headers?: Dict<any>) {
    return this.receive('PATCH', path, headers, body)
  }

  receive(method: string, path: string, headers: Dict<any>, body: any) {
    const socket = new Socket()
    const req = new IncomingMessage(socket)
    req.url = path
    req.method = method

    // prepare request headers
    Object.assign(req.headers, headers)
    if (typeof body === 'string') {
      req.headers['content-type'] = 'text/plain'
    } else if (Buffer.isBuffer(body)) {
      req.headers['content-type'] = 'application/octet-stream'
    } else {
      body = JSON.stringify(body)
      req.headers['content-type'] = 'application/json'
    }
    req.headers['content-length'] = '' + body.length

    // send request body
    return new Promise<Webhook.Response>((resolve) => {
      const res = new ServerResponse(req)
      let body = ''
      res.write = (chunk: any) => {
        body += chunk
        return true
      }
      res.end = (callback: () => void) => {
        const code = res.statusCode
        const headers = res.getHeaders()
        resolve({ code, body, headers })
        if (typeof callback === 'function') callback()
        return res
      }
      this.app.router._http.emit('request', req, res)
      req.emit('data', body)
      req.emit('end')
    })
  }
}
