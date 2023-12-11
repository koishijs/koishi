import registerStartCommand from './start'
import CAC from 'cac'

const { version } = require('../../package.json')
const cli = CAC('koishi').help().version(version)

registerStartCommand(cli)

const argv = cli.parse()

if (!cli.matchedCommand && !argv.options.help) {
  cli.outputHelp()
}
