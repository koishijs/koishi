import { Adapter, Schema } from 'koishi'
import { Context } from 'koa'
import { MatrixBot } from './bot'
import { AdapterConfig } from './utils'

export class HttpAdapter extends Adapter<MatrixBot, AdapterConfig> {
    static schema: Schema<AdapterConfig> = Schema.object({
        selfId: Schema.string().description('机器人的 ID。').required(),
        senderLocalpart: Schema.string().description('机器人的 localpart, 继承自 selfId 。').required(),
        hsToken: Schema.string().description('hs_token').required(),
        asToken: Schema.string().description('as_token').required(),
    })
    start() {
        const {  } = this.config
        const put = (path: string, callback: (ctx: Context) => void) => {
            this.ctx.router.put(path, callback)
            this.ctx.router.put('/_matrix/app/v1' + path, callback)
        }
        const get = (path: string, callback: (ctx: Context) => void) => {
            this.ctx.router.get(path, callback)
            this.ctx.router.get('/_matrix/app/v1' + path, callback)
        }
        put('/transactions/{txnId}', this.transactions)
    }
    stop() {
    }

    private transactions(ctx: Context) {
    }
}