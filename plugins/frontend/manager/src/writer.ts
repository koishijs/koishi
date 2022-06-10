import { DataService } from '@koishijs/plugin-console'
import { Adapter, App, Bot, Context, Plugin, remove } from 'koishi'
import { Loader } from '@koishijs/cli'

declare module '@koishijs/plugin-console' {
  interface Events {
    'manager/app-reload'(config: any): void
    'manager/teleport'(source: string, target: string, index: number): void
    'manager/reload'(path: string, config: any, key?: string): void
    'manager/unload'(path: string, config: any, key?: string): void
    'manager/group'(path: string): void
    'manager/alias'(path: string, alias: string): void
    'manager/meta'(path: string, config: any): void
    'manager/bot-update'(id: string, adapter: string, config: any): void
    'manager/bot-remove'(id: string): void
  }
}

function insertKey(object: {}, temp: {}, rest: string[]) {
  for (const key of rest) {
    temp[key] = object[key]
    delete object[key]
  }
  Object.assign(object, temp)
}

function rename(object: any, old: string, neo: string, value: any) {
  const keys = Object.keys(object)
  const index = keys.findIndex(key => key === old || key === '~' + old)
  const rest = index < 0 ? [] : keys.slice(index + 1)
  const temp = { [neo]: value }
  delete object[old]
  delete object['~' + old]
  insertKey(object, temp, rest)
}

function dropKey(plugins: {}, name: string) {
  if (!(name in plugins)) {
    name = '~' + name
  }
  const value = plugins[name]
  delete plugins[name]
  return { [name]: value }
}

class ConfigWriter extends DataService<App.Config> {
  private loader: Loader
  private plugins: {}

  constructor(ctx: Context) {
    super(ctx, 'config', { authority: 4 })
    this.loader = ctx.loader
    this.plugins = ctx.loader.config.plugins

    ctx.console.addListener('manager/app-reload', (config) => {
      this.reloadApp(config)
    }, { authority: 4 })

    for (const key of ['teleport', 'reload', 'unload', 'group', 'meta', 'alias'] as const) {
      ctx.console.addListener(`manager/${key}`, this[key].bind(this), { authority: 4 })
    }

    ctx.console.addListener('manager/bot-update', (id, adapter, config) => {
      this.updateBot(id, adapter, config)
    }, { authority: 4 })

    ctx.console.addListener('manager/bot-remove', (id) => {
      this.removeBot(id)
    }, { authority: 4 })

    ctx.on('config', () => this.refresh())
  }

  async get() {
    return this.loader.config
  }

  reloadApp(config: any) {
    this.loader.config = config
    this.loader.config.plugins = this.plugins
    this.loader.writeConfig()
    this.loader.fullReload()
  }

  private resolve(path: string) {
    const segments = path.split('/')
    let runtime = this.loader.runtime
    let name = segments.shift()
    while (segments.length) {
      runtime = runtime[Symbol.for('koishi.loader.record')][name].runtime
      name = segments.shift()
    }
    return [runtime, name] as const
  }

  alias(path: string, alias: string) {
    const [runtime, oldKey] = this.resolve(path)
    const config = runtime.config[oldKey]
    let newKey = oldKey.split(':', 1)[0] + (alias ? ':' : '') + alias
    const record = runtime[Symbol.for('koishi.loader.record')]
    const fork = record[oldKey]
    if (fork) {
      delete record[oldKey]
      record[newKey] = fork
    } else {
      newKey = '~' + newKey
    }
    rename(runtime.config, oldKey, newKey, config)
    this.loader.writeConfig()
  }

  meta(path: string, config: any) {
    const [runtime, name] = this.resolve(path)
    const target = path ? runtime.config[name] : runtime.config
    for (const key of Object.keys(config)) {
      if (config[key] === null) {
        delete target[key]
      } else {
        target[key] = config[key]
      }
    }
    this.loader.writeConfig()
  }

  reload(path: string, config: any, newKey?: string) {
    const [runtime, oldKey] = this.resolve(path)
    if (newKey) {
      this.loader.unloadPlugin(runtime, oldKey)
    }
    this.loader.reloadPlugin(runtime, newKey || oldKey, config)
    rename(runtime.config, oldKey, newKey || oldKey, config)
    this.loader.writeConfig()
    this.refresh()
  }

  unload(path: string, config = {}, newKey?: string) {
    const [runtime, oldKey] = this.resolve(path)
    this.loader.unloadPlugin(runtime, oldKey)
    rename(runtime.config, oldKey, '~' + (newKey || oldKey), config)
    this.loader.writeConfig()
    this.refresh()
  }

  group(path: string) {
    const [runtime, oldKey] = this.resolve(path)
    const config = runtime.config[oldKey] = {}
    this.loader.loadGroup(runtime, oldKey, config)
    this.loader.writeConfig()
    this.refresh()
  }

  teleport(source: string, target: string, index: number) {
    const [runtimeS, nameS] = this.resolve(source)
    const [runtimeT] = this.resolve(target ? target + '/' : '')

    // teleport fork
    const fork = runtimeS[Symbol.for('koishi.loader.record')][nameS]
    if (fork) {
      remove(fork.parent.state.disposables, fork.dispose)
      fork.parent = runtimeT.context
      fork.parent.state.disposables.push(fork.dispose)
    }

    // teleport config
    const temp = dropKey(runtimeS.config, nameS)
    const rest = Object.keys(runtimeT.config).slice(index)
    insertKey(runtimeT.config, temp, rest)
    this.loader.writeConfig()
  }

  private locate(name: string, runtime: Plugin.Runtime) {
    for (const key in runtime.config) {
      const value = runtime.config[key]
      const fork = runtime[Symbol.for('koishi.loader.record')][key]
      if (key === name) {
        return value
      } else if (key === '~' + name) {
        this.loader.reloadPlugin(runtime, name, value)
        rename(runtime.config, name, name, value)
        return value
      } else if (key.startsWith('group@')) {
        const result = this.locate(name, fork.runtime)
        if (result) return result
      }
    }
  }

  updateBot(id: string, platform: string, config: any) {
    let bot: Bot
    const name = 'adapter-' + platform
    if (id) {
      bot = this.ctx.bots.find(bot => bot.id === id)
      const index = bot.adapter.bots.filter(bot => !bot.hidden).indexOf(bot)
      bot.adapter.ctx.state.parent.state.runtime.config[name].bots[index] = config
    } else {
      let record = this.locate(name, this.loader.runtime)
      if (!record) {
        record = this.loader.runtime.config[name] = { bots: [] }
        this.loader.reloadPlugin(this.loader.runtime, name, record)
      }
      record.bots.push(config)
      // make sure adapter get correct caller context
      bot = this.loader.runtime[Symbol.for('koishi.loader.record')][name].context.bots.create(platform, config)
    }
    this.loader.writeConfig()
    this.refresh()
    bot.config = Adapter.library[Adapter.join(platform, bot.protocol)].schema(config)
    if (config.disabled) {
      bot.stop()
    } else {
      bot.start()
    }
  }

  removeBot(id: string) {
    const bot = this.ctx.bots.find(bot => bot.id === id)
    const index = bot.adapter.bots.filter(bot => !bot.hidden).indexOf(bot)
    const name = 'adapter-' + bot.adapter.platform
    const config = bot.adapter.ctx.state.parent.state.runtime.config[name]
    config.bots.splice(index, 1)
    this.loader.writeConfig()
    this.refresh()
    this.ctx.bots.remove(id)
    return bot.stop()
  }
}

export default ConfigWriter
