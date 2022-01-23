import { Logger } from 'koishi'
import { Loader } from './loader'
import * as addons from './addons'

function handleException(error: any) {
  new Logger('app').error(error)
  process.exit(1)
}

process.on('uncaughtException', handleException)

process.on('unhandledRejection', (error) => {
  new Logger('app').warn(error)
})

const loader = new Loader()
const config = loader.loadConfig()

addons.prepare(config)

const app = loader.createApp()

app.plugin(addons, app.options)
app.start()
