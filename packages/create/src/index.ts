#!/usr/bin/env node

// @ts-ignore
import { version } from '../package.json'
import { execSync } from 'child_process'
import { basename, join, relative } from 'path'
import { extract } from 'tar'
import parse from 'yargs-parser'
import prompts from 'prompts'
import axios from 'axios'
import which from 'which-pm-runs'
import kleur from 'kleur'
import * as fs from 'fs'

let project: string
let rootDir: string

const cwd = process.cwd()

const argv = parse(process.argv.slice(2), {
  alias: {
    ref: ['r'],
    forced: ['f'],
    mirror: ['m'],
    prod: ['p'],
    template: ['t'],
    yes: ['y'],
  },
})

function supports(command: string) {
  try {
    execSync(command)
    return true
  } catch {
    return false
  }
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

  if (!argv.forced && !argv.yes) {
    console.log(kleur.yellow(`  Target directory "${project}" is not empty.`))
    const yes = await confirm('Remove existing files and continue?')
    if (!yes) process.exit(0)
  }

  emptyDir(rootDir)
}

function getRef() {
  if (!argv.ref) return 'refs/heads/master'
  if (argv.ref.startsWith('refs/')) return argv.ref
  if (/^[0-9a-f]{40}$/.test(argv.ref)) return argv.ref
  return `refs/heads/${argv.ref}`
}

async function scaffold() {
  console.log(kleur.dim('  Scaffolding project in ') + project + kleur.dim(' ...'))

  const mirror = process.env.GITHUB_MIRROR = argv.mirror || 'https://github.com'
  const template = argv.template || 'koishijs/boilerplate'
  const url = `${mirror}/${template}/archive/${getRef()}.tar.gz`

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
    console.log(`${kleur.red('error')} request failed with status code ${status} ${statusText}`)
    process.exit(1)
  }

  writePackageJson()
  writeEnvironment()

  console.log(kleur.green('  Done.\n'))
}

function writePackageJson() {
  const filename = join(rootDir, 'package.json')
  const meta = require(filename)
  meta.name = project
  fs.writeFileSync(filename, JSON.stringify(meta, null, 2))
}

function writeEnvironment() {
  const filename = join(rootDir, '.env')
  if (!fs.existsSync(filename)) return
  const content = fs.readFileSync(filename, 'utf8').split('\n').map((line) => {
    if (!line.startsWith('GITHUB_MIRROR = ')) return line
    return `GITHUB_MIRROR = ${process.env.GITHUB_MIRROR}`
  }).join('\n')
  fs.writeFileSync(filename, content)
}

async function initGit() {
  if (argv.yes || !supports('git --version')) return
  const yes = await confirm('Initialize Git for version control?')
  if (!yes) return
  execSync('git init', { stdio: 'ignore', cwd: rootDir })
  console.log(kleur.green('  Done.\n'))
}

async function install() {
  // with `-y` option, we don't install dependencies
  if (argv.yes) return

  const agent = which()?.name || 'npm'
  const yes = await confirm('Install and start it now?')
  if (yes) {
    // https://docs.npmjs.com/cli/v8/commands/npm-install
    // with the --production flag or `NODE_ENV` set to production,
    // npm will not install modules listed in devDependencies
    execSync([agent, 'install', ...argv.prod ? ['--production'] : []].join(' '), { stdio: 'inherit', cwd: rootDir })
    execSync([agent, 'run', 'start'].join(' '), { stdio: 'inherit', cwd: rootDir })
  } else {
    console.log(kleur.dim('  You can start it later by:\n'))
    if (rootDir !== cwd) {
      const related = relative(cwd, rootDir)
      console.log(kleur.blue(`  cd ${kleur.bold(related)}`))
    }
    console.log(kleur.blue(`  ${agent === 'yarn' ? 'yarn' : `${agent} install`}`))
    console.log(kleur.blue(`  ${agent === 'yarn' ? 'yarn start' : `${agent} run start`}`))
    console.log()
  }
}

async function start() {
  console.log()
  console.log(`  ${kleur.bold('Create Koishi')}  ${kleur.blue(`v${version}`)}`)
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
