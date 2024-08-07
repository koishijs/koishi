import registerStartCommand from './start'
import { cac } from 'cac'

const { version } = require('../../package.json')
const cli = cac('koishi').help().version(version)

registerStartCommand(cli)

const argv = cli.parse()

if (!cli.matchedCommand && !argv.options.help) {
  cli.outputHelp()
}
