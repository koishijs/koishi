import spawn from 'cross-spawn'
import open from 'open'
import { resolve } from 'path'

const args = ['jest', '--coverage']

const [,, argv2, argv3] = process.argv

if (argv2 && !argv2.startsWith('-')) {
  args.push(argv2)
  if (argv3 && !argv3.startsWith('-')) {
    args.push('--collectCoverageFrom', `**/${argv3}/**/*.ts`, ...process.argv.slice(3))
  } else {
    args.push(...process.argv.slice(3))
  }
} else {
  args.push('packages/.+\\.spec\\.ts', ...process.argv.slice(2))
}

const child = spawn('npx', args, { stdio: 'inherit' })

child.on('close', () => {
  open(resolve(__dirname, '../coverage/lcov-report/index.html'))
})
