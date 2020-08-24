const fs = require('fs')
const child_process = require('child_process')

const path = process.cwd() + '/koishi.config.js'
if (!fs.existsSync(path)) {
  const config = {
    type: 'http',
    port: 8080,
    server: 'http://localhost:5700',
    plugins: [
      'common',
      'schedule',
    ],
  } // default config
  const envNames = ['PORT', 'TYPE', 'SERVER']
  envNames.map((name) => {
    if (process.env[name]) config[name.toLowerCase()] = process.env[name]
  })

  output = JSON.stringify(config, null, 2)
  output = 'module.exports = ' + output.replace(/^(\s+)"([\w$]+)":/mg, '$1$2:')
  fs.writeFileSync(path, output)
  console.log(`Successfully created config file: ${path}`)
}

console.log('Starting Koishi server...')
const koishi = child_process.exec('koishi run', (err) => {
  if (err) throw err
})
process.stdin.pipe(koishi.stdin)
koishi.stdout.pipe(process.stdout)
console.log('Koishi server started.')
