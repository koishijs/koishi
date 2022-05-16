import { BaseResponse, Internal } from '.'

export interface TenantAccessToken extends BaseResponse {
  /** access token */
  tenant_access_token: string
  /** expire time in second. e.g: 7140 (119 minutes) */
  expire: number
}

declare module './internal' {
  export interface Internal {
    getTenantAccessToken(app_id: string, app_secret: string): Promise<TenantAccessToken>
  }
}

Internal.define({
  'auth/v3/tenant_access_token/internal': {
    POST: 'getTenantAccessToken',
  },
})
