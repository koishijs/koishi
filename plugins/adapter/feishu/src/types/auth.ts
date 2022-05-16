import { BaseResponse, Internal } from '.'

export interface AppAccessToken extends BaseResponse {
  /** access token */
  app_access_token: string
  /** expire time in seconds. e.g: 7140 (119 minutes) */
  expire: number
}

export interface TenantAccessToken extends BaseResponse {
  /** access token */
  tenant_access_token: string
  /** expire time in seconds. e.g: 7140 (119 minutes) */
  expire: number
}

declare module './internal' {
  export interface Internal {
    /**
     * Returns the app_access_token for the bot.
     * @see https://open.feishu.cn/document/ukTMukTMukTM/ukDNz4SO0MjL5QzM/auth-v3/auth/app_access_token_internal
     */
    getAppAccessToken(app_id: string, app_secret: string): Promise<AppAccessToken>
    /**
     * Returns the tenant_access_token for the bot.
     * @see https://open.feishu.cn/document/ukTMukTMukTM/ukDNz4SO0MjL5QzM/auth-v3/auth/tenant_access_token_internal
     */
    getTenantAccessToken(app_id: string, app_secret: string): Promise<TenantAccessToken>
  }
}

Internal.define({
  'auth/v3/app_access_token/internal': {
    POST: 'getAppAccessToken',
  },
  'auth/v3/tenant_access_token/internal': {
    POST: 'getTenantAccessToken',
  },
})
