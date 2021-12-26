import { Context } from 'koishi'
import { DataSource } from '@koishijs/plugin-console'
import { components } from '@octokit/openapi-types'

type Release = components['schemas']['release']

export class ReleaseProvider extends DataSource<Release[]> {
  cache: Promise<Release[]>

  constructor(ctx: Context) {
    super(ctx, 'releases')
  }

  async get(forced = false) {
    if (!forced && this.cache) return this.cache
    return this.cache = this.ctx.http.get('https://api.github.com/repos/koishijs/koishi/releases', {
      params: { per_page: 100 },
    }).catch(() => {
      delete this.cache
    })
  }
}
