#!/usr/bin/env node

import registerBuildCommand from './build'
import registerSetupCommand from './setup'
import CAC from 'cac'

const { version } = require('../package.json')

const cli = CAC('koishi-scripts').help().version(version)

registerBuildCommand(cli)
registerSetupCommand(cli)

cli.parse()

if (!cli.matchedCommand) {
  cli.outputHelp()
}
