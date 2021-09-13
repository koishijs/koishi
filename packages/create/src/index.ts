#!/usr/bin/env node

import parse from 'yargs-parser'
import prompts from 'prompts'
import { bold, blue, yellow, green, dim } from 'kleur'
import { basename, join, relative } from 'path'
import spawn from 'cross-spawn'
import * as fs from 'fs'

declare const KOISHI_VERSION: string

let project: string
let rootDir: string

const cwd = process.cwd()
const argv = parse(process.argv.slice(2))
const tempDir = join(__dirname, '..', 'template')

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

  console.log(yellow(`  Target directory "${project}" is not empty.`))
  const yes = await confirm('Remove existing files and continue?')
  if (!yes) process.exit(0)
  emptyDir(rootDir)
}

function writeRoot(name: string, content?: string) {
  const dest = join(rootDir, name.startsWith('_') ? '.' + name.slice(1) : name)
  if (content) {
    fs.writeFileSync(dest, content)
  } else {
    copy(join(tempDir, name), dest)
  }
}

async function scaffold() {
  console.log(dim('  Scaffolding project in ') + project + dim(' ...'))

  const files = fs.readdirSync(tempDir)
  for (const name of files) {
    if (name !== 'package.json') {
      writeRoot(name)
    } else {
      // place "name" on the top of package.json
      const meta = require(join(tempDir, name))
      writeRoot(name, JSON.stringify({
        name: project,
        ...meta,
      }, null, 2))
    }
  }

  console.log(green('  Done.\n'))
}

async function install() {
  const { npm_execpath: execpath = '' } = process.env
  const manager = execpath.includes('pnpm') ? 'pnpm' : execpath.includes('yarn') ? 'yarn' : 'npm'

  const yes = await confirm('Install and start it now?')
  if (yes) {
    spawn.sync(manager, ['install'], { stdio: 'inherit', cwd: rootDir })
    spawn.sync(manager, ['run', 'start'], { stdio: 'inherit', cwd: rootDir })
  } else {
    console.log(dim('  You can start it later by:\n'))
    if (rootDir !== cwd) {
      const related = relative(cwd, rootDir)
      console.log(blue(`  cd ${bold(related)}`))
    }
    console.log(blue(`  ${manager === 'yarn' ? 'yarn' : `${manager} install`}`))
    console.log(blue(`  ${manager === 'yarn' ? 'yarn start' : `${manager} run start`}`))
    console.log()
  }
}

async function start() {
  console.log()
  console.log(`  ${bold('Koishi')}  ${blue(`v${KOISHI_VERSION}`)}`)
  console.log()

  const name = await getName()
  rootDir = join(cwd, name)
  project = basename(rootDir)

  await prepare()
  await scaffold()
  await install()
}

start().catch((e) => {
  console.error(e)
})
