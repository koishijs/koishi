import ts from 'typescript'
import json5 from 'json5'
import { promises as fs } from 'fs'
import { WorkerData } from '../worker'
import { resolve } from 'path'
import { Logger } from 'koishi-utils'

export { extract } from './default'

const compilerOptions: ts.CompilerOptions = {
  inlineSourceMap: true,
  module: ts.ModuleKind.ES2020,
  target: ts.ScriptTarget.ES2020,
}

export async function prepare(config: WorkerData) {
  const logger = new Logger('eval:loader')
  const tsconfigPath = resolve(config.root, 'tsconfig.json')
  return fs.readFile(tsconfigPath, 'utf8').then((tsconfig) => {
    Object.assign(compilerOptions, json5.parse(tsconfig))
  }, () => {
    logger.info('auto generating tsconfig.json...')
    return fs.writeFile(tsconfigPath, json5.stringify({ compilerOptions }, null, 2))
  })
}

export async function transform(expr: string) {
  return ts.transpile(expr, compilerOptions)
}
