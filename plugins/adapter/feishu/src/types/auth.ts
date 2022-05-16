import { Internal } from '.'

declare module './internal' {
  export interface Internal {
    getTenantAccessToken(app_id: string, app_secret: string): Promise<string>
  }
}

Internal.define({
  'auth/v3/tenant_access_token/internal': {
    POST: 'getTenantAccessToken',
  },
})
