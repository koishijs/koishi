import { App, Schema } from '@koishijs/core'
import { Dict, defineProperty } from '@koishijs/utils'
import { Agent } from 'http'
import ProxyAgent from 'proxy-agent'
import axios, { AxiosRequestConfig, Method } from 'axios'

declare module '@koishijs/core' {
  namespace App {
    interface Config extends Config.Request {}

    namespace Config {
      interface Static {
        Request?: Schema<Config.Request>
      }

      interface Request {
        request?: Quester.Config
      }
    }
  }

  interface Adapter {
    http?: Quester
  }
}

export interface Quester {
  <T = any>(method: Method, url: string, data?: any, headers?: Dict): Promise<T>
  extend(config: Quester.Config): Quester
  config: Quester.Config
  get: Quester.Get
  head(url: string, params?: Dict, headers?: Dict): Promise<Dict<string>>
  delete(url: string, params?: Dict, headers?: Dict): Promise<Dict<string>>
  options(url: string, params?: Dict, headers?: Dict): Promise<Dict<string>>
  post<T = any>(url: string, data?: any, headers?: Dict): Promise<T>
  put<T = any>(url: string, data?: any, headers?: Dict): Promise<T>
  patch<T = any>(url: string, data?: any, headers?: Dict): Promise<T>
}

export namespace Quester {
  export interface Config {
    headers?: Dict
    endpoint?: string
    timeout?: number
    proxyAgent?: string
  }

  export const Config: Schema<Config> = Schema.object({
    endpoint: Schema.string().description('要连接的端点。'),
    proxyAgent: Schema.string().description('使用的代理服务器地址。'),
    headers: Schema.dict(Schema.string()).description('要附加的额外请求头。'),
    timeout: Schema.number().description('等待连接建立的最长时间。'),
  }).description('请求设置')

  export interface Get {
    <T = any>(url: string, params?: Dict, headers?: Dict): Promise<T>
    stream(url: string, params?: Dict, headers?: Dict): Promise<ReadableStream>
    arraybuffer(url: string, params?: Dict, headers?: Dict): Promise<ArrayBuffer>
  }

  const agents: Dict<Agent> = {}

  function getAgent(url: string) {
    return agents[url] ||= new ProxyAgent(url)
  }

  export function create(config: Quester.Config = {}) {
    const { endpoint = '' } = config

    const options: AxiosRequestConfig = {
      timeout: config.timeout,
      headers: config.headers,
    }

    if (config.proxyAgent) {
      options.httpAgent = getAgent(config.proxyAgent)
      options.httpsAgent = getAgent(config.proxyAgent)
    }

    async function request<T>(method: Method, url: string, config?: AxiosRequestConfig) {
      const response = await axios({
        ...options,
        ...config,
        method,
        url: endpoint + url,
        headers: {
          ...options.headers,
          ...config.headers,
        },
      })
      return response.data as T
    }

    const instance = ((method, url, data, headers) => request(method, url, { headers, data })) as Quester
    instance.get = ((url, params, headers) => request('GET', url, { headers, params })) as Get
    instance.get.stream = (url, params, headers) => request('GET', url, { headers, params, responseType: 'stream' })
    instance.get.arraybuffer = (url, params, headers) => request('GET', url, { headers, params, responseType: 'arraybuffer' })
    instance.options = (url, params, headers) => request('OPTIONS', url, { headers, params })
    instance.delete = (url, params, headers) => request('DELETE', url, { headers, params })
    instance.post = (url, data, headers) => request('POST', url, { headers, data })
    instance.put = (url, data, headers) => request('PUT', url, { headers, data })
    instance.patch = (url, data, headers) => request('PATCH', url, { headers, data })
    instance.extend = (newConfig) => create({ ...config, ...newConfig })
    instance.config = config

    instance.head = async (url, params, _headers) => {
      const response = await axios({
        ...options,
        params,
        method: 'HEAD',
        url: endpoint + url,
        headers: {
          ...options.headers,
          ..._headers,
        },
      })
      return response.headers
    }

    return instance
  }
}

const RequestConfig: Schema<App.Config.Request> = Schema.object({
  request: Quester.Config,
})

defineProperty(App.Config, 'Request', RequestConfig)

App.Config.list.push(RequestConfig)
