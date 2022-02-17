import { Adapter, Context, Dict, Schema } from 'koishi'
import { DataService } from '@koishijs/plugin-console'

class AdapterProvider extends DataService<Dict<Schema>> {
  constructor(ctx: Context) {
    super(ctx, 'protocols')

    ctx.on('adapter', () => {
      this.refresh()
    })
  }

  async get() {
    const protocols: Dict<Schema> = {}
    for (const key in Adapter.library) {
      const constructor = Adapter.library[key]
      if (constructor[Adapter.redirect]) continue
      protocols[key] = constructor.schema
    }
    return protocols
  }
}

export default AdapterProvider
