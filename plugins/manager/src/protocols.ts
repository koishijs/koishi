import { Adapter, Context, Dict, Schema } from 'koishi'
import { DataSource } from '@koishijs/plugin-console'

export class AdapterProvider extends DataSource<Dict<Schema>> {
  constructor(ctx: Context) {
    super(ctx, 'protocols')

    ctx.on('adapter', () => {
      this.broadcast()
    })
  }

  async get() {
    const protocols: Dict<Schema> = {}
    for (const key in Adapter.library) {
      if (key.includes('.')) continue
      protocols[key] = Adapter.library[key].schema
    }
    return protocols
  }

  start() {}

  stop() {}
}
