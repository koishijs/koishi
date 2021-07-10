#!/usr/bin/env node

import registerInitCommand from './init'
import registerStartCommand from './start'
import CAC from 'cac'

declare const KOISHI_VERSION: string

const cli = CAC('koishi').help().version(KOISHI_VERSION)

registerInitCommand(cli)
registerStartCommand(cli)

cli.parse()

if (!cli.matchedCommand) {
  cli.outputHelp()
}
