#!/usr/bin/env node

import parse from 'yargs-parser'
import prompts from 'prompts'
import spawn from 'cross-spawn'
import axios from 'axios'
import which from 'which-pm-runs'
import { blue, bold, dim, green, red, yellow } from 'kleur'
import { basename, join, relative } from 'path'
import { extract } from 'tar'
import * as fs from 'fs'

let project: string
let rootDir: string

const cwd = process.cwd()

const argv = parse(process.argv.slice(2), {
  alias: {
    forced: ['f'],
    mirror: ['m'],
    template: ['t'],
  },
})

const hasGit = supports('git', ['--version'])

function supports(command: string, args: string[] = []) {
  return new Promise<boolean>((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore' })
    child.on('exit', (code) => {
      resolve(!code)
    })
    child.on('error', () => {
      resolve(false)
    })
  })
}

async function getName() {
  if (argv._[0]) return '' + argv._[0]
  const { name } = await prompts({
    type: 'text',
    name: 'name',
    message: 'Project name:',
    initial: 'koishi-app',
  })
  return name.trim() as string
}

// baseline is Node 12 so can't use rmSync
function emptyDir(root: string) {
  for (const file of fs.readdirSync(root)) {
    const abs = join(root, file)
    if (fs.lstatSync(abs).isDirectory()) {
      emptyDir(abs)
      fs.rmdirSync(abs)
    } else {
      fs.unlinkSync(abs)
    }
  }
}

async function confirm(message: string) {
  const { yes } = await prompts({
    type: 'confirm',
    name: 'yes',
    initial: 'Y',
    message,
  })
  return yes as boolean
}

async function prepare() {
  if (!fs.existsSync(rootDir)) {
    return fs.mkdirSync(rootDir, { recursive: true })
  }

  const files = fs.readdirSync(rootDir)
  if (!files.length) return

  if (!argv.forced) {
    console.log(yellow(`  Target directory "${project}" is not empty.`))
    const yes = await confirm('Remove existing files and continue?')
    if (!yes) process.exit(0)
  }

  emptyDir(rootDir)
}

async function scaffold() {
  console.log(dim('  Scaffolding project in ') + project + dim(' ...'))

  const mirror = argv.mirror || 'https://github.com'
  const template = argv.template || 'koishijs/boilerplate'
  const url = `${mirror}/${template}/archive/refs/heads/master.tar.gz`

  try {
    const { data } = await axios.get<NodeJS.ReadableStream>(url, { responseType: 'stream' })

    await new Promise<void>((resolve, reject) => {
      const stream = data.pipe(extract({ cwd: rootDir, newer: true, strip: 1 }))
      stream.on('finish', resolve)
      stream.on('error', reject)
    })
  } catch (err) {
    if (!axios.isAxiosError(err) || !err.response) throw err
    const { status, statusText } = err.response
    console.log(`${red('error')} request failed with status code ${status} ${statusText}`)
    process.exit(1)
  }

  const filename = join(rootDir, 'package.json')
  const meta = require(filename)
  meta.name = project
  fs.writeFileSync(filename, JSON.stringify(meta, null, 2))

  console.log(green('  Done.\n'))
}

async function initGit() {
  if (!await hasGit) return
  const yes = await confirm('Initialize Git for version control?')
  if (!yes) return
  spawn.sync('git', ['init'], { stdio: 'ignore', cwd: rootDir })
  console.log(green('  Done.\n'))
}

async function install() {
  const agent = which()?.name || 'npm'

  const yes = await confirm('Install and start it now?')
  if (yes) {
    spawn.sync(agent, ['install'], { stdio: 'inherit', cwd: rootDir })
    spawn.sync(agent, ['run', 'start'], { stdio: 'inherit', cwd: rootDir })
  } else {
    console.log(dim('  You can start it later by:\n'))
    if (rootDir !== cwd) {
      const related = relative(cwd, rootDir)
      console.log(blue(`  cd ${bold(related)}`))
    }
    console.log(blue(`  ${agent === 'yarn' ? 'yarn' : `${agent} install`}`))
    console.log(blue(`  ${agent === 'yarn' ? 'yarn start' : `${agent} run start`}`))
    console.log()
  }
}

async function start() {
  const { version } = require('../package.json')
  console.log()
  console.log(`  ${bold('Create Koishi')}  ${blue(`v${version}`)}`)
  console.log()

  const name = await getName()
  rootDir = join(cwd, name)
  project = basename(rootDir)

  await prepare()
  await scaffold()
  await initGit()
  await install()
}

start().catch((e) => {
  console.error(e)
})
