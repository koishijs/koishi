import { CAC } from 'cac'
import { copyFile, mkdir, readFile, readJson, writeFile } from 'fs-extra'
import { resolve } from 'path'
import { config, cwd, meta, PackageJson } from './utils'
import { blue, red } from 'kleur'
import which from 'which-pm-runs'
import spawn from 'cross-spawn'
import prompts from 'prompts'

class Initiator {
  name: string
  desc: string
  fullname: string
  target: string
  source = resolve(__dirname, '../template')

  constructor(private options: Options) {}

  async start(name: string) {
    await this.init(name)
    const agent = which()?.name || 'npm'
    const args: string[] = agent === 'yarn' ? [] : ['install']
    spawn.sync(agent, args, { stdio: 'inherit' })
  }

  async init(name: string) {
    name ||= await this.getName()
    if (!/^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)) {
      console.log(red('error'), 'plugin name contains invalid character')
      process.exit(1)
    }
    if (name.includes('koishi-plugin-')) {
      this.fullname = name
      this.name = name.replace('koishi-plugin-', '')
      console.log(blue('info'), 'prefix "koishi-plugin-" can be omitted')
    } else {
      this.name = name
      this.fullname = name.replace(/^(.+\/)?/, '$1koishi-plugin-')
    }
    this.desc = await this.getDesc()
    this.target = resolve(cwd, 'plugins', this.name)
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

  async getDesc() {
    const { desc } = await prompts({
      type: 'text',
      name: 'desc',
      message: 'description:',
    })
    return desc as string
  }

  async write() {
    await mkdir(this.target, { recursive: true })
    await Promise.all([
      this.writeManifest(),
      this.writeTsConfig(),
      this.writeIndex(),
      this.writeReadme(),
      this.writeClient(),
    ])
    await this.initGit()
  }

  async writeManifest() {
    const source: PackageJson = await readJson(this.source + '/package.json', 'utf8')
    if (this.options.console) {
      source.peerDependencies['@koishijs/console'] = meta.dependencies['@koishijs/console']
    }
    source.peerDependencies['koishi'] = meta.dependencies['koishi']
    await writeFile(this.target + '/package.json', JSON.stringify({
      name: this.fullname,
      description: this.desc,
      ...source,
    }, null, 2))
  }

  async writeTsConfig() {
    await copyFile(this.source + '/tsconfig.json', this.target + '/tsconfig.json')
  }

  async writeIndex() {
    await mkdir(this.target + '/src')
    const filename = `/src/index.${this.options.console ? 'console' : 'default'}.ts`
    const source = await readFile(this.source + filename, 'utf8')
    await writeFile(this.target + '/src/index.ts', source
      .replace(/\{\{name\}\}/g, this.name.replace(/^@\w+\//, '')))
  }

  async writeReadme() {
    const source = await readFile(this.source + '/readme.md', 'utf8')
    await writeFile(this.target + '/readme.md', source
      .replace(/\{\{name\}\}/g, this.fullname)
      .replace(/\{\{desc\}\}/g, this.desc))
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

  async initGit() {
    if (config.mode === 'monorepo') return
    await Promise.all([
      copyFile(this.source + '/.editorconfig', this.target + '/.editorconfig'),
      copyFile(this.source + '/.gitignore', this.target + '/.gitignore'),
    ])
    spawn.sync('git', ['init'], { cwd: this.target, stdio: 'inherit' })
    spawn.sync('git', ['add', '.'], { cwd: this.target, stdio: 'inherit' })
    spawn.sync('git', ['commit', '-m', 'initial commit'], { cwd: this.target, stdio: 'inherit' })
  }
}

interface Options {
  console?: boolean
}

export default function (cli: CAC) {
  cli.command('setup [name]', 'initialize a new plugin')
    .alias('create')
    .alias('init')
    .alias('new')
    .option('-c, --console', 'with console extension')
    .action(async (name: string, options) => {
      new Initiator(options).start(name)
    })
}
