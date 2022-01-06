import { App, Schema } from '@koishijs/core'
import { Dict, defineProperty } from '@koishijs/utils'
import { Agent } from 'http'
import ProxyAgent from 'proxy-agent'
import axios, { AxiosRequestConfig, AxiosResponse, Method } from 'axios'

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
  <T = any>(method: Method, url: string, config?: AxiosRequestConfig): Promise<T>
  axios<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>
  extend(config: Quester.Config): Quester
  config: Quester.Config
  head(url: string, config?: AxiosRequestConfig): Promise<Dict<string>>
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>
  patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>
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

    const request = async (url: string, config?: AxiosRequestConfig) => axios({
      ...options,
      ...config,
      url: endpoint + url,
      headers: {
        ...options.headers,
        ...config?.headers,
      },
    })

    const http = (async (method, url, config) => {
      const response = await request(url, { ...config, method })
      return response.data
    }) as Quester

    http.config = config
    http.axios = request as any
    http.extend = (newConfig) => create({ ...config, ...newConfig })

    http.get = (url, config) => http('GET', url, config)
    http.delete = (url, config) => http('DELETE', url, config)
    http.post = (url, data, config) => http('POST', url, { ...config, data })
    http.put = (url, data, config) => http('PUT', url, { ...config, data })
    http.patch = (url, data, config) => http('PATCH', url, { ...config, data })
    http.head = async (url, config) => {
      const response = await request(url, { ...config, method: 'HEAD' })
      return response.headers
    }

    return http
  }
}

const RequestConfig: Schema<App.Config.Request> = Schema.object({
  request: Quester.Config,
})

defineProperty(App.Config, 'Request', RequestConfig)

App.Config.list.push(RequestConfig)
