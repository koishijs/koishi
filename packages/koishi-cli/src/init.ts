import { existsSync, writeFileSync } from 'fs'
import { AppOptions } from 'koishi-core'
import { yellow } from 'kleur'
import { resolve } from 'path'
import { logger } from './utils'
import prompts from 'prompts'
import CAC from 'cac/types/CAC'

function createConfig (options): Promise<AppOptions> {
  return prompts([{
    name: 'type',
    type: 'autocomplete',
    message: 'Connection Type',
    initial: 'http',
    choices: [
      { title: 'HTTP', value: 'http' },
      { title: 'WebSocket', value: 'ws' },
    ],
  }, {
    name: 'port',
    type: (_, data) => data.type === 'http' ? 'number' : null,
    message: 'Koishi Port',
    initial: 8080,
  }, {
    name: 'server',
    type: (_, data) => data.type === 'http' ? 'text' : null,
    message: 'HTTP Server',
    initial: 'http://localhost:5700',
  }, {
    name: 'server',
    type: (_, data) => data.type === 'ws' ? 'text' : null,
    message: 'WebSocket Server',
    initial: 'ws://localhost:6700',
  }, {
    name: 'selfId',
    type: 'number',
    message: 'Your Bot\'s QQ Number',
  }, {
    name: 'secret',
    type: 'text',
    message: 'Secret for Koishi Server',
  }, {
    name: 'token',
    type: 'text',
    message: 'Token for CoolQ Server',
  }])
}

export default function (cli: CAC) {
  cli.command('init [file]', 'initialize a koishi.config.js file')
    .option('-f, --forced', 'overwrite config file if it exists')
    .action(async (file, options) => {
      const path = resolve(process.cwd(), String(file || 'koishi.config.js'))
      if (!options.forced && existsSync(path)) {
        logger.error(`${options.output} already exists. If you want to overwrite the current file, use ${yellow('koishi init -f')}.`)
        process.exit(1)
      }
      const config = await createConfig(options)
      const output: string[] = ['module.exports = {']
      output.push(`  type: "${config.type}",`)
      if (config.port) output.push(`  port: ${config.port},`)
      output.push(`  server: ${JSON.stringify(config.server)},`)
      if (config.selfId) output.push(`  selfId: ${config.selfId},`)
      if (config.secret) output.push(`  secret: ${JSON.stringify(config.secret)},`)
      if (config.token) output.push(`  token: ${JSON.stringify(config.token)},`)
      output.push('  plugins: [')
      output.push('    ["common"],')
      output.push('  ],')
      output.push('}\n')
      writeFileSync(path, output.join('\n'))
      logger.success(`created config file: ${path}.`)
      process.exit(0)
    })
}
