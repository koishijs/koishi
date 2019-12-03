import { existsSync, writeFileSync } from 'fs'
import { black, cyanBright } from 'chalk'
import { resolve } from 'path'
import CAC from 'cac/types/CAC'

export default function (cli: CAC) {
  cli.command('init', 'initialize a koishi.config.js file')
    .option('-f, --forced', 'overwrite config file if it exists')
    .option('-o, --output <file>', 'path of output file', { default: 'koishi.config.js' })
    .option('-p, --port <port>', 'port number', { default: 8080 })
    .option('-s, --secret [secret]', 'secret for koishi server')
    .option('-t, --token [token]', 'token for CoolQ server')
    .option('-u, --url <url>', 'CoolQ server url', { default: 'http://localhost:5700' })
    .action(function (options) {
      const path = resolve(process.cwd(), '' + options.output)
      if (!options.forced && existsSync(path)) {
        console.log(`${black.bgRedBright('  ERROR  ')} ${options.output} already exists. If you want to overwrite the current file, use ${cyanBright.bold('koishi init -f')}.`)
        process.exit(1)
      }
      const output: string[] = ['module.exports = {']
      output.push(`  port: ${JSON.stringify(options.port)},`)
      output.push(`  sendUrl: ${JSON.stringify(options.url)},`)
      if (options.secret) output.push(`  secret: ${JSON.stringify(options.secret)},`)
      if (options.token) output.push(`  token: ${JSON.stringify(options.token)},`)
      output.push('  plugins: [')
      output.push('    ["common"],')
      output.push('  ],')
      output.push('}\n')
      writeFileSync(path, output.join('\n'))
      console.log(`${black.bgGreenBright(' SUCCESS ')} created config file: ${path}.`)
      process.exit(0)
    })
}
