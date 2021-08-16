import { Context, segment } from 'koishi-core'
import axios from 'axios'

const lang = 'zh-CN'
const unit = 'metric'
const products = ['astro', 'civil', 'civillight', 'meteo', 'two']

export const name = 'weather'

export function apply(ctx: Context) {
  ctx.command('tools/weather <longitude> <latitude>', '查询天气')
    // typescript cannot infer type from string templates
    .option('product', `-p <product:string>  晴天钟产品选择，可为 ${products.join(', ')}`, { fallback: 'civil' })
    .action(async ({ options }, lon, lat) => {
      if (!lon || !lat) return '请输入经纬度。'
      const { product } = options
      if (!products.includes(options.product)) {
        return `不支持该产品，产品选择应为 ${products.join(', ')} 之一。`
      }
      try {
        const { data } = await axios.get<ArrayBuffer>(`http://www.7timer.info/bin/${product}.php`, {
          params: { lon, lat, lang, unit },
          responseType: 'arraybuffer',
        })
        return segment.image(data)
      } catch (error) {
        ctx.logger('tools').warn(error)
      }
    })
}
