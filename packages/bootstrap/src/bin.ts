#!/usr/bin/env node

import which from 'which-pm-runs'
import parse from 'yargs-parser'
import { resolve } from 'path'
import { existsSync } from 'fs'
import { spawnSync } from 'child_process'
import ConfigLoader from '@koishijs/loader'

const { _ } = parse(process.argv.slice(2))

const loader = new ConfigLoader('' + _[0])
const { plugins = {} } = loader.readConfig()

const agent = which()?.name || 'npm'
const metafile = resolve(loader.baseDir, 'package.json')
if (!existsSync(metafile)) {
  spawnSync(agent, ['init'], { cwd: loader.baseDir, stdio: 'inherit' })
}

const args: string[] = []

for (const shortname in plugins) {
  const { $official, $version } = plugins[shortname] || {}
  const suffix = $version ? '@' + $version : ''
  if (shortname.startsWith('@')) {
    const [scope, name] = shortname.split('/', 2)
    args.push(`${scope}/koishi-plugin-${name}${suffix}`)
  } else if ($official) {
    args.push(`@koishijs/plugin-${shortname}${suffix}`)
  } else {
    args.push(`koishi-plugin-${shortname}${suffix}`)
  }
}

spawnSync(agent, ['add', ...args], { cwd: loader.baseDir, stdio: 'inherit' })
