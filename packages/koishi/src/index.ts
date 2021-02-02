#!/usr/bin/env node

import registerInitCommand from './init'
import registerRunCommand from './run'
import CAC from 'cac'

declare const KOISHI_VERSION: string

const cli = CAC('koishi').help().version(KOISHI_VERSION)

registerInitCommand(cli)
registerRunCommand(cli)

cli.parse()

if (!cli.matchedCommand) {
  cli.outputHelp()
}
