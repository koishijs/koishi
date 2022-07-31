import { addHook } from 'yakumo'
import { Plugin } from 'esbuild'
import {} from 'yakumo-esbuild'
import yaml from 'js-yaml'
import { resolve } from 'path'
import { promises as fsp } from 'fs'

const yamlPlugin = (options: yaml.LoadOptions = {}): Plugin => ({
  name: 'i18n',
  setup(build) {
    build.onResolve({ filter: /\/locales\/[\w-]+$/ }, ({ path, resolveDir }) => ({
      path: resolve(resolveDir, path) + '.yml',
      namespace: 'yaml',
    }))

    build.onLoad({ namespace: 'yaml', filter: /.*/ }, async ({ path }) => {
      const source = await fsp.readFile(path, 'utf8')
      return {
        loader: 'json',
        contents: JSON.stringify(yaml.load(source, options)),
      }
    })
  },
})

addHook('esbuild.before', (options) => {
  options.plugins.push(yamlPlugin())
})
