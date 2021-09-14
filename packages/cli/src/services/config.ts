import { App, Schema, isNullable, Dict, Plugin } from 'koishi'
import { writeFileSync } from 'fs'
import { dump } from 'js-yaml'
import { Loader } from '../loader'
import {} from '../..'

function codegen(config: any, schema?: Schema) {
  if (isNullable(config)) return ''
  const handler = schema && handlers[schema.type]
  return handler ? handler(config, schema) : dump(config)
}

function indent(text: string) {
  return text.split('\n').join('\n  ')
}

function comment(text: string, schema: Schema) {
  return schema.desc ? `# ${schema.desc}\n${text}` : text
}

function codegenForDict(config: any, schema: Schema) {
  const output = codegen(config, schema)
  if (typeof config === 'object' && output) {
    return '\n  ' + indent(output)
  } else {
    return output
  }
}

function codegenForArray(config: any, schema?: Schema) {
  return indent(codegen(config, schema))
}

const handlers: Dict<(config: any, schema?: Schema) => string> = {
  string: config => config,
  number: config => config.toString(),
  boolean: config => config.toString(),
  array(config, schema) {
    return config
      .map(value => `- ${codegenForArray(value, schema.value)}`)
      .join('\n')
  },
  dict(config, schema) {
    return Object.entries(config)
      .map(([key, value]) => `${key}: ${codegenForDict(value, schema.value)}`)
      .join('\n')
  },
  object(config, schema) {
    return Object.entries(schema.dict)
      .filter(([key, value]) => key in config && !value._hidden)
      .map(([key, value]) => `${key}: ${codegenForDict(config[key], value)}`)
      .join('\n')
  },
  merge(config, schema) {
    return schema.list
      .map(schema => comment(codegen(config, schema), schema))
      .join('\n\n')
  },
}

export function createConfigManager(app: App, loader: Loader) {
  const { plugins } = app.options
  const allowWrite = app.options.allowWrite && ['.yml', '.yaml'].includes(loader.extname)

  const configTexts: Dict<string> = {}
  if (allowWrite) {
    configTexts[''] = codegen(app.options, App.Config)
    for (const name in plugins) {
      configTexts[name] = codegenForDict(plugins[name], loader.cache[name]['schema'])
    }
  }

  app.on('config/install', (name, config) => {
    const plugin = loader.loadPlugin(name, config)
    plugins[name] = config
    delete plugins['~' + name]
    if (!allowWrite) return
    updateText(name, config, plugin)
    delete configTexts['~' + name]
    writeConfig()
  })

  app.on('config/dispose', async (name, config) => {
    const plugin = loader.cache[name]
    await app.dispose(plugin)
    plugins['~' + name] = plugins[name]
    delete plugins[name]
    if (!allowWrite) return
    updateText('~' + name, config, plugin)
    delete configTexts[name]
    writeConfig()
  })

  app.on('config/reload', async (name, config) => {
    const plugin = loader.cache[name]
    const state = app.registry.get(plugin)
    await app.dispose(plugin)
    state.context.plugin(plugin, config)
    plugins[name] = config
    if (!allowWrite) return
    updateText(name, config, plugin)
    writeConfig()
  })

  function updateText(name: string, config: any, plugin: Plugin) {
    configTexts[name] = codegenForDict(config, plugin['schema'])
  }

  function writeConfig() {
    let output = configTexts[''] + '\n\n# 插件设置\nplugins:'
    for (const name in plugins) {
      output += `\n  ${name}: ${indent(configTexts[name])}\n`
    }
    writeFileSync(loader.filename, output)
  }
}
