import { use } from './plugin'
import help from './plugins/help'
import suggest from './plugins/suggest'
import throttle from './plugins/throttle'
import validate from './plugins/validate'
import manager from './manager'

export * from './koishi'
export default manager
export { manager }

use(help)
use(suggest)
use(throttle)
use(validate)
