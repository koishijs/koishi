import { CAC } from 'cac'
import { promises as fsp } from 'fs'
import { resolve } from 'path'
import { getAgent } from './utils'
import spawn from 'cross-spawn'
import kleur from 'kleur'
import prompts from 'prompts'

class Runner {
  meta: any
  root: string
  name: string
  fullname: string

  async init(name: string) {
    this.name = name || await this.getName()
    this.fullname = name.includes('/')
      ? name.replace('/', '/koishi-plugin-')
      : 'koishi-plugin-' + name
    this.root = resolve(process.cwd(), 'plugins', name)
    await this.write()
  }

  async start(name: string) {
    const [agent] = await Promise.all([
      getAgent(),
      this.init(name),
    ])
    const args: string[] = agent === 'yarn' ? [] : ['install']
    spawn.sync(agent, args, { stdio: 'inherit' })
  }

  async getName() {
    const { name } = await prompts({
      type: 'text',
      name: 'name',
      message: 'plugin name:',
    })
    return name.trim() as string
  }

  async write() {
    await fsp.mkdir(this.root + '/src', { recursive: true })
    await Promise.all([
      this.writeManifest(),
      this.writeTsConfig(),
      this.writeIndex(),
    ])
  }

  async writeManifest() {
    await fsp.writeFile(this.root + '/package.json', JSON.stringify({
      name: this.fullname,
      version: '1.0.0',
      main: 'lib/index.js',
      typings: 'lib/index.d.ts',
      files: ['lib'],
      license: 'MIT',
      scripts: {
        build: 'tsc -b',
      },
      keywords: [
        'chatbot',
        'koishi',
        'plugin',
      ],
      peerDependencies: {
        koishi: this.meta.dependencies.koishi,
      },
    }, null, 2))
  }

  async writeTsConfig() {
    await fsp.writeFile(this.root + '/tsconfig.json', JSON.stringify({
      extends: '../../tsconfig.base',
      compilerOptions: {
        rootDir: 'src',
        outDir: 'lib',
      },
      include: ['src'],
    }, null, 2))
  }

  async writeIndex() {
    await fsp.writeFile(this.root + '/src/index.ts', [
      `import { Context } from 'koishi'`,
      '',
      `export const name = '${this.name.replace(/^@\w+\//, '')}'`,
      '',
      `export function apply(ctx: Context) {`,
      `  // write your plugin here`,
      `}`,
      '',
    ].join('\n'))
  }
}

export default function (cli: CAC) {
  cli.command('create [name]', 'create a plugin')
    .action(async (name: string, options) => {
      const meta = require(process.cwd() + '/package.json')
      if (!meta.workspaces) {
        console.log(kleur.red('error') + ' koishi create is only supported in workspaces.')
      } else {
        new Runner().start(name)
      }
    })
}
