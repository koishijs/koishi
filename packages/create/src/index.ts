#!/usr/bin/env node

import parse from 'yargs-parser'
import prompts from 'prompts'
import { bold, blue, yellow, green, dim } from 'kleur'
import { basename, join, relative } from 'path'
import spawn from 'cross-spawn'
import * as fs from 'fs'

let project: string
let rootDir: string

const cwd = process.cwd()
const tempDir = join(__dirname, '..', 'template')
const meta = require(join(tempDir, 'package.json'))

const argv = parse(process.argv.slice(2), {
  alias: {
    forced: ['f'],
  },
})

const { npm_execpath: execpath = '' } = process.env
const isYarn = execpath.includes('yarn')
const hasPnpm = !isYarn && supports('pnpm', ['--version'])

function supports(command: string, args: string[] = []) {
  return new Promise<boolean>((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore' })
    child.on('exit', (code) => {
      resolve(code ? false : true)
    })
    child.on('error', () => {
      resolve(false)
    })
  })
}

async function getName() {
  if (argv._[0]) return argv._[0]
  const { name } = await prompts({
    type: 'text',
    name: 'name',
    message: 'Project Name:',
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

function copy(src: string, dest: string) {
  const stat = fs.statSync(src)
  if (!stat.isDirectory()) {
    fs.copyFileSync(src, dest)
  } else {
    fs.mkdirSync(dest, { recursive: true })
    for (const file of fs.readdirSync(src)) {
      const srcFile = join(src, file)
      const destFile = join(dest, file)
      copy(srcFile, destFile)
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

interface CompilerOptions {
  dependencies: string[]
  register: string
}

const compilers: Record<string, CompilerOptions> = {
  'tsc': {
    dependencies: ['ts-node'],
    register: 'ts-node/register/transpile-only',
  },
  'esbuild': {
    dependencies: ['esbuild', 'esbuild-register'],
    register: 'esbuild-register',
  },
}

const devDeps: string[] = []

const files: (string | [string, string])[] = [
  '.gitignore',
  'koishi.config.yml',
]

async function getCompiler() {
  const keys = ['', ...Object.keys(compilers)]
  const { name } = await prompts({
    type: 'select',
    name: 'name',
    message: 'Choose a typescript compiler:',
    choices: keys.map(value => ({ title: value || 'none', value })),
  })

  if (!name) {
    files.push(['src-js', 'src'])
    return
  }

  files.push('src', 'tsconfig.json')
  const compiler = compilers[name]
  devDeps.push('typescript', ...compiler.dependencies)
  meta.scripts.start += ' -- -r ' + compiler.register
}

async function scaffold() {
  console.log(dim('  Scaffolding project in ') + project + dim(' ...'))

  for (const name of files) {
    const [src, dest] = typeof name === 'string' ? [name, name] : name
    copy(join(tempDir, src), join(rootDir, dest))
  }

  for (const key in meta.devDependencies) {
    if (!devDeps.includes(key)) {
      delete meta.devDependencies[key]
    }
  }

  // place "name" on the top of package.json
  fs.writeFileSync(join(rootDir, 'package.json'), JSON.stringify({
    name: project,
    ...meta,
  }, null, 2))

  console.log(green('  Done.\n'))
}

async function getAgent() {
  if (isYarn) return 'yarn'
  const agents = ['npm']
  if (await hasPnpm) agents.push('pnpm')
  const { agent } = await prompts({
    type: 'select',
    name: 'agent',
    message: 'Choose a package manager:',
    choices: agents.map((agent) => ({ title: agent, value: agent })),
  })
  return agent as string
}

async function install() {
  const agent = await getAgent()

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
  await getCompiler()
  await scaffold()
  await install()
}

start().catch((e) => {
  console.error(e)
})
