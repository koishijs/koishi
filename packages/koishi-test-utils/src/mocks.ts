import { snakeCase } from 'koishi-utils'
import { CQResponse } from 'koishi-core'

export type RequestParams = Record<string, any>
export type RequestData = readonly [string, RequestParams]
export type RequestHandler = (params: RequestParams) => Partial<CQResponse>

export class MockedServer {
  requests: RequestData[] = []
  responses: Record<string, RequestHandler> = {}

  clearRequests () {
    this.requests = []
  }

  shouldHaveNoRequests () {
    expect(this.requests).toHaveLength(0)
  }

  shouldHaveLastRequest (action: string, params: RequestParams = {}) {
    expect(this.requests[0]).toMatchObject([action, snakeCase(params)])
    this.clearRequests()
  }

  shouldMatchSnapshot (name = '') {
    expect(this.requests[0]).toMatchSnapshot(name)
    this.clearRequests()
  }

  shouldHaveLastRequests (requests: RequestData[]) {
    expect(this.requests.slice(0, requests.length)).toMatchObject(requests.map(snakeCase).reverse())
    this.clearRequests()
  }

  receive (action: string, params: RequestParams = {}): CQResponse {
    this.requests.unshift([action, snakeCase(params)])
    const response = this.responses[action]?.(params)
    return {
      status: 'succeed',
      retcode: 0,
      data: {},
      ...response,
    }
  }

  setResponse (event: string, hanlder: RequestHandler): void
  setResponse (event: string, data: RequestParams, retcode?: number): void
  setResponse (event: string, ...args: [RequestHandler] | [RequestParams, number?]) {
    if (typeof args[0] === 'function') {
      this.responses[event] = args[0] as RequestHandler
    } else {
      this.responses[event] = () => ({
        data: snakeCase(args[0]),
        retcode: args[1] || 0,
        status: args[1] ? 'failed' : 'succeed',
      })
    }
  }
}
