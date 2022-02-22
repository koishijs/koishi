import { CAC } from 'cac'
import { copyFile, mkdir, readFile, readJson, writeFile, writeJson } from 'fs-extra'
import { resolve } from 'path'
import { getAgent } from '@koishijs/cli'
import { cwd, meta, PackageJson } from './utils'
import spawn from 'cross-spawn'
import prompts from 'prompts'

class Initiator {
  name: string
  fullname: string
  target: string
  source = resolve(__dirname, '../template')

  constructor(private options: Options) {}

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
    this.target = resolve(cwd, 'plugins', name)
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
    await mkdir(this.target, { recursive: true })
    await Promise.all([
      this.writeManifest(),
      this.writeTsConfig(),
      this.writeIndex(),
      this.writeClient(),
    ])
  }

  async writeManifest() {
    const source: PackageJson = await readJson(this.source + '/package.json', 'utf8')
    if (this.options.console) {
      source.peerDependencies['@koishijs/console'] = meta.dependencies['@koishijs/console']
    }
    source.peerDependencies['koishi'] = meta.dependencies['koishi']
    await writeJson(this.target + '/package.json', {
      name: this.fullname,
      ...source,
    }, { spaces: 2 })
  }

  async writeTsConfig() {
    await copyFile(this.source + '/tsconfig.snap.json', this.target + '/tsconfig.json')
  }

  async writeIndex() {
    await mkdir(this.target + '/src')
    const filename = `/src/index.${this.options.console ? 'console' : 'default'}.ts`
    const source = await readFile(this.source + filename, 'utf8')
    await writeFile(this.target + '/src/index.ts', source
      .replace('{{ name }}', this.name.replace(/^@\w+\//, '')))
  }

  async writeClient() {
    if (!this.options.console) return
    await mkdir(this.target + '/client')
    await Promise.all([
      copyFile(this.source + '/client/index.ts', this.target + '/client/index.ts'),
      copyFile(this.source + '/client/page.vue', this.target + '/client/page.vue'),
      copyFile(this.source + '/client/tsconfig.json', this.target + '/client/tsconfig.json'),
    ])
  }
}

interface Options {
  console?: boolean
}

export default function (cli: CAC) {
  cli.command('init [name]', 'init a new plugin')
    .alias('create')
    .option('-c, --console', 'with console extension')
    .action(async (name: string, options) => {
      new Initiator(options).start(name)
    })
}
