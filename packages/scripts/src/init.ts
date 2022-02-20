import { CAC } from 'cac'
import { promises as fsp } from 'fs'
import { resolve } from 'path'
import { getAgent } from '@koishijs/cli'
import { cwd, meta } from './utils'
import spawn from 'cross-spawn'
import prompts from 'prompts'

class Initiator {
  root: string
  name: string
  fullname: string

  async start(name: string) {
    const [agent] = await Promise.all([
      getAgent(),
      this.init(name),
    ])
    const args: string[] = agent === 'yarn' ? [] : ['install']
    spawn.sync(agent, args, { stdio: 'inherit' })
  }

  async init(name: string) {
    this.name = name || await this.getName()
    this.fullname = name.includes('/')
      ? name.replace('/', '/koishi-plugin-')
      : 'koishi-plugin-' + name
    this.root = resolve(cwd, 'plugins', name)
    await this.write()
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
      private: true,
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
        koishi: meta.dependencies.koishi,
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
  cli.command('init [name]', 'init a new plugin')
    .alias('create')
    .action(async (name: string, options) => {
      new Initiator().start(name)
    })
}
