import { snakeCase } from 'koishi-core'
import { CQResponse } from 'koishi-adapter-cqhttp'
import { expect } from 'chai'

export type RequestParams = Record<string, any>
export type RequestData = readonly [string, RequestParams]
export type RequestHandler = (params: RequestParams) => Partial<CQResponse>

export class MockedServer {
  requests: RequestData[] = []
  responses: Record<string, RequestHandler> = {}

  clearRequests() {
    this.requests = []
  }

  shouldHaveNoRequests() {
    expect(this.requests).to.have.length(0)
  }

  shouldHaveLastRequest(action: string, params: RequestParams = {}) {
    expect(this.requests[0]).to.have.shape([action, snakeCase(params)])
    this.clearRequests()
  }

  shouldMatchSnapshot(name = '') {
    // TODO
    // expect(this.requests[0]).toMatchSnapshot(name)
    this.clearRequests()
  }

  shouldHaveLastRequests(requests: RequestData[]) {
    expect(this.requests.slice(0, requests.length)).to.have.shape(requests.map(snakeCase).reverse())
    this.clearRequests()
  }

  receive(action: string, params: RequestParams = {}): CQResponse {
    this.requests.unshift([action, snakeCase(params)])
    const response = this.responses[action]?.(params)
    return {
      status: 'succeed',
      retcode: 0,
      data: {},
      ...response,
    }
  }

  setResponse(event: string, hanlder: RequestHandler): void
  setResponse(event: string, data: RequestParams, retcode?: number): void
  setResponse(event: string, ...args: [RequestHandler] | [RequestParams, number?]) {
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
