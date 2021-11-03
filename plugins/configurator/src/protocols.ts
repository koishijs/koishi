import { Adapter, Context, Dict, Schema } from 'koishi'
import { DataSource } from '@koishijs/plugin-console'

declare module '@koishijs/plugin-console' {
  namespace DataSource {
    interface Library {
      protocols: ProtocolSource
    }
  }
}

export class ProtocolSource implements DataSource<Dict<Schema>> {
  constructor(private ctx: Context) {
    ctx.on('adapter', async () => {
      this.ctx.webui.broadcast('data', {
        key: 'protocols',
        value: this.get(),
      })
    })
  }

  get() {
    const protocols: Dict<Schema> = {}
    for (const key in Adapter.library) {
      if (key.includes('.')) continue
      protocols[key] = Adapter.library[key].schema
    }
    return protocols
  }
}
