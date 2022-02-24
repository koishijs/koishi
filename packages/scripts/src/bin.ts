#!/usr/bin/env node

import registerBuildCommand from './build'
import registerBumpCommand from './bump'
import registerCleanCommand from './clean'
import registerInitCommand from './init'
import registerPublishCommand from './publish'
import CAC from 'cac'

const { version } = require('../package.json')

const cli = CAC('koishi-scripts').help().version(version)

registerBuildCommand(cli)
registerBumpCommand(cli)
registerCleanCommand(cli)
registerInitCommand(cli)
registerPublishCommand(cli)

cli.parse()

if (!cli.matchedCommand) {
  cli.outputHelp()
}
