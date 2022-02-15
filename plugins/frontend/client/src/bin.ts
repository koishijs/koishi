#!/usr/bin/env node

import CAC from 'cac'
import { resolve } from 'path'
import { buildExtension } from '.'

const { version } = require('../package.json')

const cli = CAC('koishi-console').help().version(version)

cli.command('build [root]')
  .action((root) => {
    root = resolve(process.cwd(), root || '.')
    buildExtension(root)
  })

cli.parse()

if (!cli.matchedCommand) {
  cli.outputHelp()
}
