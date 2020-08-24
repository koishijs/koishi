import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const codePath = resolve(__dirname, '../dist/internal.js')
const mapPath = resolve(__dirname, '../dist/internal.js.map')

const code = readFileSync(codePath, 'utf-8')
const map = JSON.parse(readFileSync(mapPath, 'utf-8'))

const prefix = '(function(host, exports) {'
const suffix = '})'

if (code.startsWith(prefix)) process.exit()

map.mappings = ';' + map.mappings
writeFileSync(codePath, `${prefix}\n${code}\n${suffix}`)
writeFileSync(mapPath, JSON.stringify(map))
