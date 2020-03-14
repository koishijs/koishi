import { use } from './plugin'
import help from './plugins/help'
import suggest from './plugins/suggest'
import throttle from './plugins/throttle'
import validate from './plugins/validate'

use(help)
use(suggest)
use(throttle)
use(validate)

export * from './koishi'
