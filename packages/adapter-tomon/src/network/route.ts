import axios, { AxiosRequestConfig } from 'axios'
import FormData from 'form-data'
import fs from 'fs'
import ospath from 'path'
import urljoin from 'url-join'

type RequestMethod = 'get' | 'post' | 'put' | 'delete' | 'patch'
const DEFAULT_TIMEOUT = 30000

export interface RequestOptions {
  query?: { [key: string]: any }
  data?: any
  /**
   * 文件路径，上传文件，会自动改为multipart
   */
  files?: string[]
  /**
   * 是否携带鉴权token，默认true
   */
  auth?: boolean
  headers?: { [key: string]: any }
  timeout?: number
}

export default class Route {
  path: string
  api: string
  token?: string
  partialAxiosConfig?: Partial<AxiosRequestConfig>

  constructor(path: string, api: string, token?: string, partialAxiosConfig: Partial<AxiosRequestConfig> = {}) {
    this.path = path
    this.token = token
    this.api = api
    this.partialAxiosConfig = partialAxiosConfig
  }

  queryString(options?: RequestOptions): string | undefined {
    if (options?.query) {
      const query = Object.entries(options.query).filter(([, value]) => value !== null && typeof value !== 'undefined')
      return new URLSearchParams(query).toString()
    }
    return undefined
  }

  url(options?: RequestOptions): string {
    const query = this.queryString(options)
    return `${urljoin(this.api, this.path)}${query ? `?${query}` : ''}`
  }

  get auth(): string | undefined {
    return this.token ? `Bearer ${this.token}` : undefined
  }

  async request(method: RequestMethod, options?: RequestOptions): Promise<any> {
    const url = this.url(options)
    let headers: { [key: string]: any } = {}
    if (options?.headers) {
      headers = Object.assign(headers, options.headers)
    }
    if (options?.auth !== false) {
      const auth = this.auth
      if (auth) {
        headers.Authorization = auth
      }
    }
    let body
    if (options?.files) {
      body = new FormData()
      for (const file of options.files) {
        const filename = ospath.basename(file)
        body.append(filename, fs.createReadStream(file), { filename })
      }
      if (typeof options.data !== 'undefined') {
        body.append('payload_json', JSON.stringify(options.data))
      }
      headers = {
        ...headers,
        ...body.getHeaders(),
      }
    } else if (options?.data) {
      body = JSON.stringify(options.data)
      headers['Content-Type'] = 'application/json'
    }
    const response = await axios({
      ...this.partialAxiosConfig,
      method,
      url,
      headers,
      data: body,
      timeout: options?.timeout || DEFAULT_TIMEOUT,
    })
    return response.data
  }

  async get(options?: RequestOptions): Promise<any> {
    return this.request('get', options)
  }

  async post(options?: RequestOptions): Promise<any> {
    return this.request('post', options)
  }

  async patch(options?: RequestOptions): Promise<any> {
    return this.request('patch', options)
  }

  async put(options?: RequestOptions): Promise<any> {
    return this.request('put', options)
  }

  async delete(options?: RequestOptions): Promise<any> {
    return this.request('delete', options)
  }
}
