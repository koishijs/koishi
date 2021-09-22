import ts from 'typescript'
import json5 from 'json5'
import { promises as fs } from 'fs'
import { LoaderConfig } from '../worker'
import { resolve } from 'path'
import { Logger } from '@koishijs/utils'

export { extractScript } from './default'

export const name = 'typescript'

const compilerOptions: ts.CompilerOptions = {
  inlineSourceMap: true,
  module: ts.ModuleKind.ES2020,
  target: ts.ScriptTarget.ES2020,
}

export async function prepare(config: LoaderConfig, root: string) {
  compilerOptions.jsxFactory = config.jsxFactory
  compilerOptions.jsxFragmentFactory = config.jsxFragment
  if (!root) return
  const logger = new Logger('eval:loader')
  const tsconfigPath = resolve(root, 'tsconfig.json')
  return fs.readFile(tsconfigPath, 'utf8').then((tsconfig) => {
    Object.assign(compilerOptions, json5.parse(tsconfig))
  }, () => {
    logger.info('auto generating tsconfig.json...')
    return fs.writeFile(tsconfigPath, json5.stringify({ compilerOptions }, null, 2))
  })
}

export async function transformScript(expr: string) {
  return ts.transpile(expr, compilerOptions)
}

export async function transformModule(expr: string) {
  return ts.transpileModule(expr, { compilerOptions })
}
