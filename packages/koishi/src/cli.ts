#!/usr/bin/env node

import registerInitCommand from './init'
import registerRunCommand from './run'
import CAC from 'cac'

const { version } = require('../package')
const cli = CAC('koishi').help().version(version)

registerInitCommand(cli)
registerRunCommand(cli)

cli.parse()

if (!cli.matchedCommand) {
  cli.outputHelp()
}
