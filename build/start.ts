import { resolve } from 'path'
import spawn from 'cross-spawn'

const name = process.argv[2]
if (!name) process.exit(0)

spawn('npx', ['koishi', 'run'], {
  cwd: resolve(__dirname, '../bots', name),
  stdio: 'inherit',
})
